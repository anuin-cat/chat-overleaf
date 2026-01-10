/**
 * 文件替换服务
 * 解析 LLM 输出中的替换指令，验证正则表达式，执行替换操作
 */

export interface ReplaceCommand {
  id: string
  file: string
  search: string
  replace: string
  isRegex: boolean
  status: 'pending' | 'accepted' | 'rejected' | 'applied' | 'error'
  errorMessage?: string
  matchCount?: number
}

export interface ParseResult {
  commands: ReplaceCommand[]
  cleanContent: string // 移除替换块后的内容
}

// 替换块的标记格式 - 新格式（推荐）: <<<SEARCH>>> ... <<<WITH>>>
const REPLACE_BLOCK_NEW_FORMAT = /<<<REPLACE>>>\s*FILE:\s*(.+?)\s*<<<SEARCH>>>([\s\S]*?)<<<WITH>>>([\s\S]*?)<<<END>>>/g
// 旧格式（向后兼容）: SEARCH: ... REPLACE:
const REPLACE_BLOCK_OLD_FORMAT = /<<<REPLACE>>>\s*FILE:\s*(.+?)\s*SEARCH:\s*([\s\S]*?)\s*REPLACE:\s*([\s\S]*?)\s*<<<END>>>/g
// 正则替换模式
const REPLACE_BLOCK_REGEX_MODE = /<<<REPLACE_REGEX>>>\s*FILE:\s*(.+?)\s*PATTERN:\s*(.+?)\s*REPLACE:\s*([\s\S]*?)\s*<<<END>>>/g

/**
 * 生成基于内容的稳定 ID
 * 使用文件路径和搜索内容生成确定性的 ID
 */
function generateStableId(file: string, search: string): string {
  // 使用简单的 hash 算法生成稳定 ID
  const str = `${file}:${search}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * 验证正则表达式是否合法
 */
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern)
    return { valid: true }
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : '无效的正则表达式' }
  }
}

/**
 * 验证搜索字符串长度是否合理
 * 搜索字符串不能过长（避免误匹配大段内容）或过短（过于模糊）
 */
export function validateSearchLength(search: string): { valid: boolean; error?: string } {
  const trimmed = search.trim()
  
  if (trimmed.length < 3) {
    return { valid: false, error: '搜索内容过短（最少3个字符）' }
  }
  
  if (trimmed.length > 2000) {
    return { valid: false, error: '搜索内容过长（最多2000个字符）' }
  }
  
  return { valid: true }
}

/**
 * 验证匹配结果是否合理
 */
export function validateMatchCount(
  content: string,
  search: string,
  isRegex: boolean
): { valid: boolean; matchCount: number; error?: string } {
  try {
    let matchCount = 0
    
    if (isRegex) {
      const regex = new RegExp(search, 'g')
      const matches = content.match(regex)
      matchCount = matches?.length || 0
    } else {
      // 字面量匹配
      let pos = 0
      while ((pos = content.indexOf(search, pos)) !== -1) {
        matchCount++
        pos += 1
      }
    }
    
    if (matchCount === 0) {
      return { valid: false, matchCount, error: '未找到匹配内容' }
    }
    
    if (matchCount > 10) {
      return { valid: false, matchCount, error: `匹配数量过多（${matchCount}处），请提供更精确的搜索内容` }
    }
    
    return { valid: true, matchCount }
  } catch (e) {
    return { valid: false, matchCount: 0, error: e instanceof Error ? e.message : '匹配验证失败' }
  }
}

/**
 * 解析单个替换块并添加到命令列表
 */
function parseAndAddCommand(
  fullMatch: string,
  file: string,
  search: string,
  replace: string,
  isRegex: boolean,
  commands: ReplaceCommand[],
  processedIds: Set<string>
): { id: string; command: ReplaceCommand } {
  const trimmedFile = file.trim()
  const trimmedSearch = search.trim()
  const id = generateStableId(trimmedFile, trimmedSearch)
  
  // 避免重复添加相同的命令
  if (processedIds.has(id)) {
    return { id, command: commands.find(c => c.id === id)! }
  }
  processedIds.add(id)
  
  // 验证
  let validation: { valid: boolean; error?: string }
  if (isRegex) {
    validation = validateRegex(trimmedSearch)
  } else {
    validation = validateSearchLength(trimmedSearch)
  }
  
  const command: ReplaceCommand = {
    id,
    file: trimmedFile,
    search: trimmedSearch,
    replace: replace.trim(),
    isRegex,
    status: validation.valid ? 'pending' : 'error',
    errorMessage: validation.error
  }
  
  commands.push(command)
  return { id, command }
}

/**
 * 解析 LLM 输出中的替换命令
 * 支持新格式（<<<SEARCH>>> ... <<<WITH>>>）和旧格式（SEARCH: ... REPLACE:）
 */
export function parseReplaceCommands(content: string): ParseResult {
  const commands: ReplaceCommand[] = []
  let cleanContent = content
  const processedIds = new Set<string>()
  
  // 1. 解析新格式字面量替换块 <<<SEARCH>>> ... <<<WITH>>>
  let match
  REPLACE_BLOCK_NEW_FORMAT.lastIndex = 0
  while ((match = REPLACE_BLOCK_NEW_FORMAT.exec(content)) !== null) {
    const [fullMatch, file, search, replace] = match
    const { id } = parseAndAddCommand(
      fullMatch, file, search, replace, false, commands, processedIds
    )
    cleanContent = cleanContent.replace(fullMatch, `[[REPLACE_BLOCK:${id}]]`)
  }
  
  // 2. 解析旧格式字面量替换块 SEARCH: ... REPLACE:（向后兼容）
  REPLACE_BLOCK_OLD_FORMAT.lastIndex = 0
  while ((match = REPLACE_BLOCK_OLD_FORMAT.exec(content)) !== null) {
    const [fullMatch, file, search, replace] = match
    const { id } = parseAndAddCommand(
      fullMatch, file, search, replace, false, commands, processedIds
    )
    // 只在未被新格式处理时替换
    if (cleanContent.includes(fullMatch)) {
      cleanContent = cleanContent.replace(fullMatch, `[[REPLACE_BLOCK:${id}]]`)
    }
  }
  
  // 3. 解析正则替换块
  REPLACE_BLOCK_REGEX_MODE.lastIndex = 0
  while ((match = REPLACE_BLOCK_REGEX_MODE.exec(content)) !== null) {
    const [fullMatch, file, pattern, replace] = match
    const { id } = parseAndAddCommand(
      fullMatch, file, pattern, replace, true, commands, processedIds
    )
    cleanContent = cleanContent.replace(fullMatch, `[[REPLACE_BLOCK:${id}]]`)
  }
  
  return { commands, cleanContent }
}

/**
 * 检查内容中是否包含替换命令
 */
export function hasReplaceCommands(content: string): boolean {
  REPLACE_BLOCK_NEW_FORMAT.lastIndex = 0
  REPLACE_BLOCK_OLD_FORMAT.lastIndex = 0
  REPLACE_BLOCK_REGEX_MODE.lastIndex = 0
  return (
    REPLACE_BLOCK_NEW_FORMAT.test(content) || 
    REPLACE_BLOCK_OLD_FORMAT.test(content) || 
    REPLACE_BLOCK_REGEX_MODE.test(content)
  )
}

/**
 * 执行替换操作（返回替换后的内容）
 */
export function executeReplace(
  content: string,
  search: string,
  replace: string,
  isRegex: boolean
): { success: boolean; result: string; error?: string } {
  try {
    let result: string
    
    if (isRegex) {
      const regex = new RegExp(search, 'g')
      result = content.replace(regex, replace)
    } else {
      // 字面量替换所有匹配
      result = content.split(search).join(replace)
    }
    
    return { success: true, result }
  } catch (e) {
    return { 
      success: false, 
      result: content, 
      error: e instanceof Error ? e.message : '替换执行失败' 
    }
  }
}

/**
 * 高亮显示匹配区域的 HTML
 */
export function highlightMatches(
  content: string,
  search: string,
  replace: string,
  isRegex: boolean
): string {
  try {
    if (isRegex) {
      const regex = new RegExp(`(${search})`, 'g')
      return content.replace(regex, '<mark class="bg-red-200 line-through">$1</mark><mark class="bg-green-200">' + replace + '</mark>')
    } else {
      return content.split(search).join(
        `<mark class="bg-red-200 line-through">${search}</mark><mark class="bg-green-200">${replace}</mark>`
      )
    }
  } catch (e) {
    return content
  }
}

/**
 * 获取匹配位置信息（用于在编辑器中定位）
 */
export function getMatchPositions(
  content: string,
  search: string,
  isRegex: boolean
): Array<{ start: number; end: number; text: string }> {
  const positions: Array<{ start: number; end: number; text: string }> = []
  
  try {
    if (isRegex) {
      const regex = new RegExp(search, 'g')
      let match
      while ((match = regex.exec(content)) !== null) {
        positions.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        })
      }
    } else {
      let pos = 0
      while ((pos = content.indexOf(search, pos)) !== -1) {
        positions.push({
          start: pos,
          end: pos + search.length,
          text: search
        })
        pos += 1
      }
    }
  } catch (e) {
    console.error('Error getting match positions:', e)
  }
  
  return positions
}

