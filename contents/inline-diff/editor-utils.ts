/**
 * Overleaf 内联差异模块 - 编辑器工具函数
 */

import type { MatchPosition } from './types'

// 缓存的编辑器视图
let currentEditorView: any = null

/**
 * 获取 CodeMirror 编辑器实例
 */
export function getCodeMirrorEditor(): any | null {
  // 优先返回缓存的 view
  if (currentEditorView?.state?.doc) {
    return currentEditorView
  }
  
  try {
    const editors = document.querySelectorAll('.cm-editor')

    for (let i = 0; i < editors.length; i++) {
      const editorElement = editors[i]
      const cmContent = editorElement.querySelector('.cm-content') as any

      if (cmContent?.cmView?.view) {
        const editorView = cmContent.cmView.view
        if (editorView.state?.doc) {
          const content = editorView.state.doc.toString()
          if (content.includes('\\documentclass') || content.includes('\\begin') || content.length > 200) {
            currentEditorView = editorView
            return editorView
          }
        }
      }
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
    }
  } else {
    let pos = 0
    while ((pos = content.indexOf(search, pos)) !== -1) {
      positions.push({
        from: pos,
        to: pos + search.length,
        text: search
      })
      pos += 1
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
        insert: isRegex ? m.text.replace(new RegExp(search), replace) : replace
      }))
    }
    
    editorView.dispatch({ changes })
    
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

