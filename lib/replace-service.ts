/**
 * 替换块解析与校验服务
 * 负责解析 LLM 输出中的替换指令，校验格式，并提供辅助工具。
 */

export type CommandType = 'replace' | 'insert'

export interface ReplaceCommand {
  id: string
  file: string
  search: string        // 对于替换操作，这是搜索文本；对于插入操作，这是主锚点
  replace: string       // 替换内容或插入内容
  isRegex: boolean
  commandType: CommandType  // 操作类型
  // 插入操作的锚点信息
  insertAnchor?: {
    after?: string      // 在此文本后插入
    before?: string     // 在此文本前插入
  }
  status: 'pending' | 'accepted' | 'rejected' | 'applied' | 'error'
  errorMessage?: string
  matchCount?: number
}

export interface ParseResult {
  commands: ReplaceCommand[]
  cleanContent: string // 去除替换块标记后的原始文本
}

// 替换块标记 - 新格式：<<<SEARCH>>> ... <<<WITH>>>
const REPLACE_BLOCK_NEW_FORMAT = /<<<REPLACE>>>\s*FILE:\s*(.+?)\s*<<<SEARCH>>>([\s\S]*?)<<<WITH>>>([\s\S]*?)<<<END>>>/g
// 旧格式兼容：SEARCH: ... REPLACE:
const REPLACE_BLOCK_OLD_FORMAT = /<<<REPLACE>>>\s*FILE:\s*(.+?)\s*SEARCH:\s*([\s\S]*?)\s*REPLACE:\s*([\s\S]*?)\s*<<<END>>>/g
// 正则替换模式
const REPLACE_BLOCK_REGEX_MODE = /<<<REPLACE_REGEX>>>\s*FILE:\s*(.+?)\s*PATTERN:\s*(.+?)\s*REPLACE:\s*([\s\S]*?)\s*<<<END>>>/g
// 统一插入模式：支持 AFTER/BEFORE 可选（可只写一个，甚至可省略空块）
const INSERT_BLOCK = /<<<INSERT>>>\s*FILE:\s*(.+?)\s*(?:<<<AFTER>>>([\s\S]*?))?(?:<<<BEFORE>>>([\s\S]*?))?<<<CONTENT>>>([\s\S]*?)<<<END>>>/g
// 包裹指令的代码块（剥离只含替换指令的 ``` 块）
const CODE_FENCE_WITH_COMMANDS = /```[^\n]*\n([\s\S]*?)```/g

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 构造支持“换行块”的正则（非正则模式下使用）：
 * SEARCH 中的每个换行会匹配由空格/制表符与至少一个换行组成的块。
 */
function buildFlexibleRegex(search: string): RegExp {
  const parts = search.split(/\r?\n/).map(escapeRegex)
  const newlineBlock = '(?:[ \\t]*\\r?\\n[ \\t]*)+'
  const pattern = parts.join(newlineBlock)
  return new RegExp(pattern, 'g')
}

function isOnlyReplaceBlocks(body: string): boolean {
  let stripped = body
  ;[
    new RegExp(REPLACE_BLOCK_NEW_FORMAT.source, 'g'),
    new RegExp(REPLACE_BLOCK_OLD_FORMAT.source, 'g'),
    new RegExp(REPLACE_BLOCK_REGEX_MODE.source, 'g'),
    new RegExp(INSERT_BLOCK.source, 'g')
  ].forEach(regex => {
    stripped = stripped.replace(regex, '')
  })
  return stripped.trim() === ''
}

function stripCommandCodeFences(content: string): string {
  let result = content
  CODE_FENCE_WITH_COMMANDS.lastIndex = 0
  let match
  while ((match = CODE_FENCE_WITH_COMMANDS.exec(content)) !== null) {
    const fullMatch = match[0]
    const body = match[1]
    if (isOnlyReplaceBlocks(body)) {
      result = result.replace(fullMatch, body)
    }
  }
  return result
}

/**
 * 生成基于内容的稳定 ID
 * 使用文件路径和搜索内容生成确定性的 ID
 */
function generateStableId(file: string, search: string): string {
  // 简单 hash 生成稳定 ID
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
 * 校验正则表达式
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
    return { valid: false, error: '搜索内容过短（至少 3 个字符）' }
  }
  
  if (trimmed.length > 3600) {
    return { valid: false, error: '搜索内容过长（最多 3600 个字符）' }
  }
  
  return { valid: true }
}

/**
 * 校验匹配次数是否合理
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
      const regex = buildFlexibleRegex(search)
      let m: RegExpExecArray | null
      while ((m = regex.exec(content)) !== null) {
        matchCount++
        if (m[0].length === 0) regex.lastIndex += 1
      }
    }
    
    if (matchCount === 0) {
      return { valid: false, matchCount, error: '未找到匹配内容' }
    }
    
    if (matchCount > 10) {
      return { valid: false, matchCount, error: `匹配次数过多（${matchCount} 次），请提供更精确的搜索内容` }
    }
    
    return { valid: true, matchCount }
  } catch (e) {
    return { valid: false, matchCount: 0, error: e instanceof Error ? e.message : '匹配校验失败' }
  }
}

/**
 * 解析并添加单个替换块
 */
function parseAndAddReplaceCommand(
  file: string,
  search: string,
  replace: string,
  isRegex: boolean,
  commands: ReplaceCommand[],
  processedIds: Set<string>
): { id: string; command: ReplaceCommand } {
  const trimmedFile = file.trim()
  const trimmedSearch = search.trim()
  const id = generateStableId(trimmedFile, trimmedSearch + 'replace')
  
  if (processedIds.has(id)) {
    return { id, command: commands.find(c => c.id === id)! }
  }
  processedIds.add(id)
  
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
    commandType: 'replace',
    status: validation.valid ? 'pending' : 'error',
    errorMessage: validation.error
  }
  
  commands.push(command)
  return { id, command }
}

/**
 * 解析并添加单个插入块
 */
function parseAndAddInsertCommand(
  file: string,
  afterAnchor: string,
  beforeAnchor: string,
  content: string,
  commands: ReplaceCommand[],
  processedIds: Set<string>
): { id: string; command: ReplaceCommand } {
  const trimmedFile = file.trim()
  const trimmedAfter = (afterAnchor || '').trim()
  const trimmedBefore = (beforeAnchor || '').trim()
  const trimmedContent = content.trim()
  
  // 确定主锚点用于定位和生成 ID
  const mainAnchor = trimmedAfter || trimmedBefore || ''
  const id = generateStableId(trimmedFile, mainAnchor + 'insert' + trimmedContent.substring(0, 50))
  
  if (processedIds.has(id)) {
    return { id, command: commands.find(c => c.id === id)! }
  }
  processedIds.add(id)
  
  // 校验：至少需要一个锚点
  let validation: { valid: boolean; error?: string } = { valid: true }
  if (!trimmedAfter && !trimmedBefore) {
    validation = { valid: false, error: '插入操作至少需要指定 AFTER 或 BEFORE 锚点' }
  } else if (mainAnchor.length < 3) {
    validation = { valid: false, error: '锚点内容过短（至少 3 个字符）' }
  }
  
  const command: ReplaceCommand = {
    id,
    file: trimmedFile,
    search: mainAnchor,  // 主锚点用于兼容现有逻辑
    replace: trimmedContent,
    isRegex: false,
    commandType: 'insert',
    insertAnchor: {
      after: trimmedAfter || undefined,
      before: trimmedBefore || undefined
    },
    status: validation.valid ? 'pending' : 'error',
    errorMessage: validation.error
  }
  
  commands.push(command)
  return { id, command }
}

/**
 * 解析 LLM 输出中的替换/插入指令
 * 支持格式：REPLACE、INSERT（统一插入格式）
 */
export function parseReplaceCommands(content: string): ParseResult {
  const commands: ReplaceCommand[] = []
  const sanitizedContent = stripCommandCodeFences(content)
  let cleanContent = sanitizedContent
  const processedIds = new Set<string>()
  
  // 1. 解析新格式 <<<SEARCH>>> ... <<<WITH>>>
  let match
  REPLACE_BLOCK_NEW_FORMAT.lastIndex = 0
  while ((match = REPLACE_BLOCK_NEW_FORMAT.exec(sanitizedContent)) !== null) {
    const [fullMatch, file, search, replace] = match
    const { id } = parseAndAddReplaceCommand(file, search, replace, false, commands, processedIds)
    cleanContent = cleanContent.replace(fullMatch, `[[REPLACE_BLOCK:${id}]]`)
  }
  
  // 2. 解析旧格式 SEARCH: ... REPLACE:
  REPLACE_BLOCK_OLD_FORMAT.lastIndex = 0
  while ((match = REPLACE_BLOCK_OLD_FORMAT.exec(sanitizedContent)) !== null) {
    const [fullMatch, file, search, replace] = match
    const { id } = parseAndAddReplaceCommand(file, search, replace, false, commands, processedIds)
    if (cleanContent.includes(fullMatch)) {
      cleanContent = cleanContent.replace(fullMatch, `[[REPLACE_BLOCK:${id}]]`)
    }
  }
  
  // 3. 解析正则替换块
  REPLACE_BLOCK_REGEX_MODE.lastIndex = 0
  while ((match = REPLACE_BLOCK_REGEX_MODE.exec(sanitizedContent)) !== null) {
    const [fullMatch, file, pattern, replace] = match
    const { id } = parseAndAddReplaceCommand(file, pattern, replace, true, commands, processedIds)
    cleanContent = cleanContent.replace(fullMatch, `[[REPLACE_BLOCK:${id}]]`)
  }
  
  // 4. 解析统一插入块 <<<INSERT>>> ... <<<AFTER>>> ... <<<BEFORE>>> ... <<<CONTENT>>>
  INSERT_BLOCK.lastIndex = 0
  while ((match = INSERT_BLOCK.exec(sanitizedContent)) !== null) {
    const fullMatch = match[0]
    const file = match[1]
    const afterAnchor = match[2] || ''
    const beforeAnchor = match[3] || ''
    const insertContent = match[4] || ''
    const { id } = parseAndAddInsertCommand(file, afterAnchor, beforeAnchor, insertContent, commands, processedIds)
    cleanContent = cleanContent.replace(fullMatch, `[[REPLACE_BLOCK:${id}]]`)
  }
  
  return { commands, cleanContent }
}

/**
 * 检查文本中是否包含替换/插入指令
 */
export function hasReplaceCommands(content: string): boolean {
  REPLACE_BLOCK_NEW_FORMAT.lastIndex = 0
  REPLACE_BLOCK_OLD_FORMAT.lastIndex = 0
  REPLACE_BLOCK_REGEX_MODE.lastIndex = 0
  INSERT_BLOCK.lastIndex = 0
  return (
    REPLACE_BLOCK_NEW_FORMAT.test(content) || 
    REPLACE_BLOCK_OLD_FORMAT.test(content) || 
    REPLACE_BLOCK_REGEX_MODE.test(content) ||
    INSERT_BLOCK.test(content)
  )
}

/**
 * 执行替换/插入操作（返回操作后的内容）
 */
export function executeReplace(
  content: string,
  search: string,
  replace: string,
  isRegex: boolean,
  commandType: CommandType = 'replace',
  insertAnchor?: { after?: string; before?: string }
): { success: boolean; result: string; error?: string; insertPosition?: number } {
  try {
    let result: string
    let insertPosition: number | undefined
    
    if (commandType === 'insert' && insertAnchor) {
      const { after, before } = insertAnchor
      
      if (after && before) {
        // 两个锚点都有：在 after 后、before 前之间插入
        const afterIndex = content.indexOf(after)
        const beforeIndex = content.indexOf(before)
        if (afterIndex === -1) {
          return { success: false, result: content, error: '未找到 AFTER 锚点文本' }
        }
        if (beforeIndex === -1) {
          return { success: false, result: content, error: '未找到 BEFORE 锚点文本' }
        }
        const insertPos = afterIndex + after.length
        if (insertPos > beforeIndex) {
          return { success: false, result: content, error: 'AFTER 锚点必须在 BEFORE 锚点之前' }
        }
        result = content.slice(0, insertPos) + replace + content.slice(insertPos)
        insertPosition = insertPos
      } else if (after) {
        // 只有 after：在 after 文本后插入
        const index = content.indexOf(after)
        if (index === -1) {
          return { success: false, result: content, error: '未找到 AFTER 锚点文本' }
        }
        insertPosition = index + after.length
        result = content.slice(0, insertPosition) + replace + content.slice(insertPosition)
      } else if (before) {
        // 只有 before：在 before 文本前插入
        const index = content.indexOf(before)
        if (index === -1) {
          return { success: false, result: content, error: '未找到 BEFORE 锚点文本' }
        }
        insertPosition = index
        result = content.slice(0, index) + replace + content.slice(index)
      } else {
        return { success: false, result: content, error: '插入操作需要至少一个锚点' }
      }
    } else if (isRegex) {
      const regex = new RegExp(search, 'g')
      result = content.replace(regex, replace)
    } else {
      // 普通文本替换全部匹配
      result = content.split(search).join(replace)
    }
    
    return { success: true, result, insertPosition }
  } catch (e) {
    return { 
      success: false, 
      result: content, 
      error: e instanceof Error ? e.message : '操作执行失败' 
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
  isRegex: boolean,
  commandType: CommandType = 'replace',
  insertAnchor?: { after?: string; before?: string }
): string {
  try {
    if (commandType === 'insert' && insertAnchor) {
      const { after, before } = insertAnchor
      let result = content
      if (after) {
        result = result.split(after).join(
          `<mark class="bg-blue-100">${after}</mark><mark class="bg-green-200">${replace}</mark>`
        )
      }
      if (before && !after) {
        result = result.split(before).join(
          `<mark class="bg-green-200">${replace}</mark><mark class="bg-blue-100">${before}</mark>`
        )
      }
      return result
    } else if (isRegex) {
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
 * 获取匹配位置（用于在编辑器中定位）
 */
export function getMatchPositions(
  content: string,
  search: string,
  isRegex: boolean
): Array<{ start: number; end: number; text: string }> {
  const positions: Array<{ start: number; end: number; text: string }> = []
  
  try {
    const regex = isRegex ? new RegExp(search, 'g') : buildFlexibleRegex(search)
    let match
    while ((match = regex.exec(content)) !== null) {
      positions.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      })
      if (match[0].length === 0) {
        regex.lastIndex += 1
      }
    }
  } catch (e) {
    console.error('Error getting match positions:', e)
  }
  
  return positions
}
