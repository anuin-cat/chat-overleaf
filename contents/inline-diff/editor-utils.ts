/**
 * Overleaf 内联差异模块 - 编辑器工具函数
 */

import type { MatchPosition } from './types'

// 缓存的编辑器视图
let currentEditorView: any = null

export const COMMENT_PLACEHOLDER = '%%% comment ...'

/**
 * 验证编辑器实例是否仍然有效
 */
function isEditorViewValid(editorView: any): boolean {
  try {
    if (!editorView?.state?.doc) return false
    // 检查编辑器的 DOM 元素是否还在页面中（项目切换后会自动失效）
    if (editorView.dom && !document.contains(editorView.dom)) {
      return false
    }
    const content = editorView.state.doc.toString()
    return typeof content === 'string'
  } catch {
    return false
  }
}

/**
 * 判断元素是否可见
 */
function isElementVisible(element: Element | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false
  return element.offsetParent !== null
}

type NormalizedSpan = {
  type: 'raw' | 'comment'
  originalStart: number
  originalEnd: number
  normStart: number
  normEnd: number
  originalText: string
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 将内容规范化用于匹配：
 * - 把连续的纯注释行（可含前导空格）折叠为一行 COMMENT_PLACEHOLDER
 * - 保留其余文本和空格/换行
 * 同时记录规范化区间与原始区间的映射。
 */
function normalizeForMatching(content: string): { normalized: string; spans: NormalizedSpan[] } {
  const spans: NormalizedSpan[] = []
  let normalized = ''
  let normPos = 0

  const lineRegex = /(.*?)(\r?\n|$)/g
  let match: RegExpExecArray | null
  let commentBuffer: { start: number; end: number; text: string; lastNL: string } | null = null

  const flushComment = () => {
    if (!commentBuffer) return
    const hasTrailingNL = commentBuffer.lastNL !== ''
    const placeholderLine = COMMENT_PLACEHOLDER + (hasTrailingNL ? commentBuffer.lastNL : '')
    const normStart = normPos
    normalized += placeholderLine
    normPos = normalized.length
    spans.push({
      type: 'comment',
      originalStart: commentBuffer.start,
      originalEnd: commentBuffer.end,
      normStart,
      normEnd: normPos,
      originalText: commentBuffer.text
    })
    commentBuffer = null
  }

  while ((match = lineRegex.exec(content)) !== null) {
    const line = match[1]
    const newline = match[2]
    if (line === '' && newline === '' && match.index >= content.length) break
    const lineStart = match.index
    const lineEnd = lineStart + line.length + newline.length
    const isCommentLine = line.trimStart().startsWith('%')

    if (isCommentLine) {
      if (!commentBuffer) {
        commentBuffer = { start: lineStart, end: lineEnd, text: line + newline, lastNL: newline }
      } else {
        commentBuffer.end = lineEnd
        commentBuffer.text += line + newline
        commentBuffer.lastNL = newline
      }
    } else {
      flushComment()
      const normStart = normPos
      normalized += line + newline
      normPos = normalized.length
      spans.push({
        type: 'raw',
        originalStart: lineStart,
        originalEnd: lineEnd,
        normStart,
        normEnd: normPos,
        originalText: line + newline
      })
    }

    if (newline === '') break
  }

  flushComment()

  return { normalized, spans }
}

/**
 * 将规范化后的匹配区间映射回原文区间
 */
function mapNormalizedRangeToOriginal(
  spans: NormalizedSpan[],
  normStart: number,
  normEnd: number
): { from: number; to: number } {
  let originalStart: number | null = null
  let originalEnd: number | null = null

  for (const span of spans) {
    if (span.normEnd <= normStart || span.normStart >= normEnd) continue

    if (span.type === 'comment') {
      originalStart = originalStart === null ? span.originalStart : Math.min(originalStart, span.originalStart)
      originalEnd = originalEnd === null ? span.originalEnd : Math.max(originalEnd, span.originalEnd)
      continue
    }

    const overlapStart = Math.max(span.normStart, normStart)
    const overlapEnd = Math.min(span.normEnd, normEnd)
    const relativeStart = overlapStart - span.normStart
    const relativeEnd = overlapEnd - span.normStart
    const spanStart = span.originalStart + relativeStart
    const spanEnd = span.originalStart + relativeEnd

    originalStart = originalStart === null ? spanStart : Math.min(originalStart, spanStart)
    originalEnd = originalEnd === null ? spanEnd : Math.max(originalEnd, spanEnd)
  }

  return {
    from: originalStart ?? 0,
    to: originalEnd ?? 0
  }
}

/**
 * 构造支持“换行块”的正则：
 * - 搜索字符串里的每个换行，匹配时视为一个由空格/制表符与至少一个换行组成的块
 */
function buildFlexibleRegex(search: string): RegExp | null {
  if (!search) return null
  const parts = search.split(/\r?\n/)
  const escaped = parts.map(escapeRegex)
  const newlineBlock = '(?:[ \\t]*\\r?\\n[ \\t]*)+'
  const pattern = escaped.join(newlineBlock)
  return new RegExp(pattern, 'g')
}

/**
 * 提取原文中的注释块（连续的纯注释行）
 * 用于在替换文本中还原 COMMENT_PLACEHOLDER。
 */
function extractCommentBlocks(source: string): string[] {
  const blocks: string[] = []
  const lineRegex = /(.*?)(\r?\n|$)/g
  let match: RegExpExecArray | null
  let buffer: string[] = []

  const flush = () => {
    if (buffer.length > 0) {
      blocks.push(buffer.join(''))
      buffer = []
    }
  }

  while ((match = lineRegex.exec(source)) !== null) {
    const line = match[1]
    const nl = match[2]
    if (line === '' && nl === '' && match.index >= source.length) break
    const isComment = line.trimStart().startsWith('%')

    if (isComment) {
      buffer.push(line + nl)
    } else {
      flush()
    }

    if (nl === '') break
  }
  flush()
  return blocks
}

function countTrailingNewlines(str: string): number {
  let count = 0
  for (let i = str.length - 1; i >= 0; i--) {
    const ch = str[i]
    if (ch === '\n') {
      count++
      // handle \r\n
      if (i > 0 && str[i - 1] === '\r') i--
    } else {
      break
    }
  }
  return count
}

function expandPlaceholders(replaceText: string, originalSlice: string): string {
  if (!replaceText.includes(COMMENT_PLACEHOLDER)) {
    return replaceText
  }
  const commentBlocks = extractCommentBlocks(originalSlice)
  let idx = 0
  const parts = replaceText.split(COMMENT_PLACEHOLDER)
  let result = parts[0]

  for (let i = 1; i < parts.length; i++) {
    const block = commentBlocks[idx++] ?? COMMENT_PLACEHOLDER
    const trailingNewlines = countTrailingNewlines(block)
    let nextPart = parts[i]

    // If the original comment block ended with only one newline (i.e.,注释后无空行),
    // and the replacement text begins with a newline, drop that leading newline to
    // avoid introducing a new blank line.
    if (trailingNewlines === 1 && nextPart.startsWith('\n')) {
      nextPart = nextPart.replace(/^\r?\n/, '')
    }

    result += block + nextPart
  }

  return result
}

/**
 * 从 DOM 元素中提取 EditorView 实例
 * 支持多种属性名（cmTile 是新版，cmView 是旧版）
 */
function extractEditorView(element: any): any | null {
  // 新版 Overleaf 使用 cmTile
  if (element?.cmTile?.view && isEditorViewValid(element.cmTile.view)) {
    return element.cmTile.view
  }
  // 旧版 Overleaf 使用 cmView
  if (element?.cmView?.view && isEditorViewValid(element.cmView.view)) {
    return element.cmView.view
  }
  // 直接挂载在元素上
  if (element?.view && isEditorViewValid(element.view)) {
    return element.view
  }
  if (element?._view && isEditorViewValid(element._view)) {
    return element._view
  }
  return null
}

/**
 * 获取 CodeMirror 编辑器实例
 */
export function getCodeMirrorEditor(): any | null {
  // 优先验证并返回缓存的 view（必须验证有效性，因为导航到新项目后实例会失效）
  if (currentEditorView && isEditorViewValid(currentEditorView)) {
    return currentEditorView
  }
  
  // 缓存失效，清除
  currentEditorView = null
  
  try {
    const candidates: Array<{ view: any; host: Element | null }> = []

    // 方法 1: 直接从 .cm-content 获取（最可靠）
    const contents = Array.from(document.querySelectorAll('.cm-content')) as any[]
    for (const contentEl of contents) {
      const view = extractEditorView(contentEl)
      if (view) {
        candidates.push({ view, host: contentEl.closest('.cm-editor') || contentEl })
      }
    }

    // 方法 2: 从 .cm-editor 获取
    if (candidates.length === 0) {
      const editors = Array.from(document.querySelectorAll('.cm-editor'))
      for (const editorElement of editors) {
        // 先检查编辑器元素本身
        const viewFromEditor = extractEditorView(editorElement)
        if (viewFromEditor) {
          candidates.push({ view: viewFromEditor, host: editorElement })
          continue
        }
        // 再检查其子元素 .cm-content
        const cmContent = editorElement.querySelector('.cm-content')
        const viewFromContent = extractEditorView(cmContent)
        if (viewFromContent) {
          candidates.push({ view: viewFromContent, host: editorElement })
        }
      }
    }

    if (candidates.length > 0) {
      // 优先选择可见的编辑器
      const visible = candidates.find(item => isElementVisible(item.host))
      const picked = visible?.view ?? candidates[0].view
      currentEditorView = picked
      console.log('[ChatOverleaf] Editor found successfully')
      return picked
    }

    return null
  } catch (error) {
    console.error('[ChatOverleaf] Error getting CodeMirror editor:', error)
    return null
  }
}

/**
 * 查找所有匹配位置
 */
export function findMatchPositions(
  content: string,
  search: string,
  isRegex: boolean
): MatchPosition[] {
  const positions: MatchPosition[] = []

  if (isRegex) {
    const regex = new RegExp(search, 'g')
    let match
    while ((match = regex.exec(content)) !== null) {
      positions.push({
        from: match.index,
        to: match.index + match[0].length,
        text: match[0]
      })
      if (match[0].length === 0) {
        regex.lastIndex += 1
      }
    }
    return positions
  }

  const { normalized, spans } = normalizeForMatching(content)
  const flexibleRegex = buildFlexibleRegex(search)
  if (!flexibleRegex) return positions

  let match: RegExpExecArray | null
  while ((match = flexibleRegex.exec(normalized)) !== null) {
    const normStart = match.index
    const normEnd = match.index + match[0].length
    const { from, to } = mapNormalizedRangeToOriginal(spans, normStart, normEnd)
    positions.push({
      from,
      to,
      text: content.slice(from, to)
    })

    if (match[0].length === 0) {
      flexibleRegex.lastIndex += 1
    }
  }

  return positions
}

export type CommandType = 'replace' | 'insert'

export interface InsertAnchor {
  after?: string
  before?: string
}

/**
 * 滚动编辑器到指定位置（居中显示）
 */
export function scrollToPosition(pos: number, editorView?: any): void {
  try {
    const view = editorView || getCodeMirrorEditor()
    if (!view) return
    
    // 先设置光标位置
    view.dispatch({
      selection: { anchor: pos }
    })
    
    // 使用 requestAnimationFrame 等待渲染后再滚动
    requestAnimationFrame(() => {
      try {
        const coords = view.coordsAtPos(pos)
        const scroller = document.querySelector('.cm-scroller') as HTMLElement
        if (coords && scroller) {
          const scrollerRect = scroller.getBoundingClientRect()
          const targetY = coords.top - scrollerRect.top + scroller.scrollTop
          const centerOffset = scroller.clientHeight / 2
          scroller.scrollTo({
            top: Math.max(0, targetY - centerOffset),
            behavior: 'auto'
          })
        }
      } catch (e) {
        // 忽略滚动错误
      }
    })
  } catch (e) {
    console.error('[ChatOverleaf] Error scrolling to position:', e)
  }
}

/**
 * 在编辑器中执行替换/插入操作
 * @param search - 搜索文本（替换模式）或主锚点文本（插入模式，兼容用）
 * @param replace - 替换内容或插入内容
 * @param isRegex - 是否为正则表达式
 * @param commandType - 操作类型：replace | insert
 * @param insertAnchor - 插入操作的锚点信息
 */
export function replaceInEditor(
  search: string, 
  replace: string, 
  isRegex: boolean,
  commandType: CommandType = 'replace',
  insertAnchor?: InsertAnchor
): { success: boolean; error?: string; replacedCount: number } {
  try {
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      return { success: false, error: '未找到编辑器', replacedCount: 0 }
    }

    const doc = editorView.state.doc
    const content = doc.toString()
    
    let changes: Array<{ from: number; to: number; insert: string }>
    
    if (commandType === 'insert' && insertAnchor) {
      const { after, before } = insertAnchor
      
      if (after && before) {
        // 两个锚点都有：在 after 后、before 前之间插入
        const afterMatches = findMatchPositions(content, after, false)
        const beforeMatches = findMatchPositions(content, before, false)
        
        if (afterMatches.length === 0) {
          return { success: false, error: '未找到 AFTER 锚点', replacedCount: 0 }
        }
        if (beforeMatches.length === 0) {
          return { success: false, error: '未找到 BEFORE 锚点', replacedCount: 0 }
        }
        
        const insertPos = afterMatches[0].to
        if (insertPos > beforeMatches[0].from) {
          return { success: false, error: 'AFTER 锚点必须在 BEFORE 锚点之前', replacedCount: 0 }
        }
        
        changes = [{ from: insertPos, to: insertPos, insert: replace }]
      } else if (after) {
        // 只有 after：在 after 文本后插入
        const matches = findMatchPositions(content, after, false)
        if (matches.length === 0) {
          return { success: false, error: '未找到 AFTER 锚点', replacedCount: 0 }
        }
        changes = [{ from: matches[0].to, to: matches[0].to, insert: replace }]
      } else if (before) {
        // 只有 before：在 before 文本前插入
        const matches = findMatchPositions(content, before, false)
        if (matches.length === 0) {
          return { success: false, error: '未找到 BEFORE 锚点', replacedCount: 0 }
        }
        changes = [{ from: matches[0].from, to: matches[0].from, insert: replace }]
      } else {
        return { success: false, error: '插入操作需要至少一个锚点', replacedCount: 0 }
      }
    } else {
      // 普通替换
      const matches = findMatchPositions(content, search, isRegex)
      
      if (matches.length === 0) {
        return { success: false, error: '未找到匹配内容', replacedCount: 0 }
      }
      
      // 替换所有匹配（从后向前以保持位置有效）
      changes = matches.reverse().map(m => ({
        from: m.from,
        to: m.to,
        insert: isRegex
          ? m.text.replace(new RegExp(search), replace)
          : expandPlaceholders(replace, m.text)
      }))
    }
    
    // 获取第一个变更位置（在反转前记录，用于滚动）
    const firstChangePos = changes.length > 0 
      ? Math.min(...changes.map(c => c.from))
      : 0
    
    // 执行替换
    editorView.dispatch({ changes })
    
    // 替换后滚动到变更位置（居中显示）
    scrollToPosition(firstChangePos, editorView)
    
    return { success: true, replacedCount: commandType === 'replace' ? changes.length : 1 }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '操作失败',
      replacedCount: 0
    }
  }
}

/**
 * 直接设置编辑器内容（覆盖整个文档）
 */
export function setEditorContent(content: string): { success: boolean; error?: string } {
  try {
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      return { success: false, error: '未找到编辑器' }
    }

    const doc = editorView.state.doc
    const length = doc.length
    editorView.dispatch({
      changes: { from: 0, to: length, insert: content }
    })
    scrollToPosition(0, editorView)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '设置内容失败' }
  }
}

/**
 * 在文档末尾追加内容（保留已有内容）
 */
export function appendEditorContent(content: string): { success: boolean; error?: string } {
  try {
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      return { success: false, error: '未找到编辑器' }
    }

    const doc = editorView.state.doc
    const length = doc.length
    let insertText = content

    if (length > 0) {
      const lastChar = doc.sliceString(length - 1, length)
      if (lastChar !== '\n' && !content.startsWith('\n')) {
        insertText = `\n${content}`
      }
    }

    editorView.dispatch({
      changes: { from: length, to: length, insert: insertText }
    })
    scrollToPosition(doc.length + insertText.length, editorView)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '追加内容失败' }
  }
}

/**
 * 在编辑器中高亮匹配内容
 */
export function highlightInEditor(
  search: string, 
  isRegex: boolean
): { success: boolean; positions: Array<{ from: number; to: number }> } {
  try {
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      return { success: false, positions: [] }
    }

    const content = editorView.state.doc.toString()
    const positions = findMatchPositions(content, search, isRegex)
    
    if (positions.length > 0) {
      const firstMatch = positions[0]
      editorView.dispatch({
        selection: { anchor: firstMatch.from, head: firstMatch.to },
        scrollIntoView: true
      })
    }
    
    return { success: true, positions }
  } catch (error) {
    console.error('[ChatOverleaf] Error highlighting:', error)
    return { success: false, positions: [] }
  }
}

