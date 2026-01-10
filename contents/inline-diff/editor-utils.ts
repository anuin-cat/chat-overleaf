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

/**
 * 在编辑器中执行替换操作
 */
export function replaceInEditor(
  search: string, 
  replace: string, 
  isRegex: boolean
): { success: boolean; error?: string; replacedCount: number } {
  try {
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      return { success: false, error: '未找到编辑器', replacedCount: 0 }
    }

    const doc = editorView.state.doc
    const content = doc.toString()
    const matches = findMatchPositions(content, search, isRegex)
    
    if (matches.length === 0) {
      return { success: false, error: '未找到匹配内容', replacedCount: 0 }
    }
    
    const changes = matches.reverse().map(m => ({
      from: m.from,
      to: m.to,
      insert: isRegex ? m.text.replace(new RegExp(search), replace) : replace
    }))
    
    editorView.dispatch({ changes })
    
    return { success: true, replacedCount: matches.length }
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '替换失败',
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

