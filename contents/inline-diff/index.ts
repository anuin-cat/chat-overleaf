/**
 * Overleaf 内联差异显示模块
 * 在编辑器中显示修改建议，支持接受/拒绝操作
 */

import type { InlineDiff } from './types'
import { injectInlineDiffStyles } from './styles'
import { computeDiff, computeWordDiff, escapeHtml, renderNewDiffHtml } from './diff-algorithm'
import { getCodeMirrorEditor, findMatchPositions, replaceInEditor } from './editor-utils'

// 模块状态 - 存储活跃的内联差异
const activeDiffs = new Map<string, InlineDiff>()
// 存储高亮覆盖层元素（一个 id 可能对应多个覆盖层）
const highlightOverlays = new Map<string, HTMLElement[]>()

/**
 * 高亮区域的边界信息
 */
interface HighlightBounds {
  minLeft: number
  maxBottom: number
}

/**
 * 创建持久高亮覆盖层（支持多行）
 * 返回高亮区域的边界信息用于定位弹出框
 */
function createHighlightOverlay(
  id: string,
  from: number,
  to: number,
  editorView: any,
  scroller: HTMLElement
): HighlightBounds | null {
  // 移除之前的高亮覆盖层
  removeHighlightOverlay(id)
  
  if (from >= to) return null // 没有差异部分需要高亮
  
  try {
    const scrollerRect = scroller.getBoundingClientRect()
    const overlays: HTMLElement[] = []
    
    // 跟踪边界信息
    let minLeft = Infinity
    let maxBottom = 0
    
    // 获取起始和结束坐标
    const startCoords = editorView.coordsAtPos(from)
    const endCoords = editorView.coordsAtPos(to)
    
    if (!startCoords || !endCoords) return null
    
    scroller.style.position = 'relative'
    
    // 判断是否跨行（比较 top 值）
    const isSingleLine = Math.abs(startCoords.top - endCoords.top) < 5
    
    if (isSingleLine) {
      // 单行：创建一个覆盖层
      const left = startCoords.left - scrollerRect.left
      const top = startCoords.top - scrollerRect.top + scroller.scrollTop
      const height = startCoords.bottom - startCoords.top
      
      const overlay = createSingleOverlay(
        id, 0,
        left,
        top,
        endCoords.right - startCoords.left,
        height
      )
      scroller.appendChild(overlay)
      overlays.push(overlay)
      
      // 更新边界信息
      minLeft = left
      maxBottom = top + height
    } else {
      // 多行：为每一行创建覆盖层
      const lineHeight = startCoords.bottom - startCoords.top
      let currentPos = from
      let lineIndex = 0
      
      while (currentPos < to) {
        const lineStartCoords = editorView.coordsAtPos(currentPos)
        if (!lineStartCoords) break
        
        // 找到当前行的结束位置
        let lineEndPos = currentPos
        let lineEndCoords = lineStartCoords
        
        for (let pos = currentPos; pos <= to; pos++) {
          const coords = editorView.coordsAtPos(pos)
          if (!coords) break
          
          // 如果 top 值变化，说明换行了
          if (Math.abs(coords.top - lineStartCoords.top) > 5) {
            break
          }
          lineEndPos = pos
          lineEndCoords = coords
        }
        
        // 计算这一行的覆盖层
        const isFirstLine = currentPos === from
        const isLastLine = lineEndPos >= to - 1
        
        // 第一行从 startCoords.left 开始，最后一行到 endCoords.right 结束
        // 中间行需要覆盖整行宽度
        let left: number, width: number
        
        if (isFirstLine) {
          left = lineStartCoords.left - scrollerRect.left
          if (isLastLine) {
            // 单行的情况（不应该到这里，但以防万一）
            width = endCoords.right - lineStartCoords.left
          } else {
            // 第一行：从起始位置到行尾
            width = lineEndCoords.right - lineStartCoords.left + 10
          }
        } else if (isLastLine) {
          // 最后一行：从行首到结束位置
          const lineInfo = editorView.state.doc.lineAt(to)
          const lineStartPos = lineInfo.from
          const lineStartPosCoords = editorView.coordsAtPos(lineStartPos)
          left = lineStartPosCoords ? lineStartPosCoords.left - scrollerRect.left : 0
          width = endCoords.right - (lineStartPosCoords?.left || scrollerRect.left)
        } else {
          // 中间行：整行
          left = lineStartCoords.left - scrollerRect.left
          width = lineEndCoords.right - lineStartCoords.left + 10
        }
        
        const top = lineStartCoords.top - scrollerRect.top + scroller.scrollTop
        
        const overlay = createSingleOverlay(id, lineIndex, left, top, width, lineHeight)
        scroller.appendChild(overlay)
        overlays.push(overlay)
        
        // 更新边界信息
        if (left < minLeft) minLeft = left
        const bottom = top + lineHeight
        if (bottom > maxBottom) maxBottom = bottom
        
        // 移动到下一行
        currentPos = lineEndPos + 1
        lineIndex++
        
        // 安全检查：防止无限循环
        if (lineIndex > 100) break
      }
    }
    
    highlightOverlays.set(id, overlays)
    
    // 返回边界信息
    return { minLeft, maxBottom }
  } catch (error) {
    console.error('[ChatOverleaf] Error creating highlight overlay:', error)
    return null
  }
}

/**
 * 创建单个覆盖层元素
 */
function createSingleOverlay(
  id: string,
  index: number,
  left: number,
  top: number,
  width: number,
  height: number
): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = 'co-replace-highlight-overlay'
  overlay.id = `co-highlight-${id}-${index}`
  overlay.style.left = `${Math.max(0, left)}px`
  overlay.style.top = `${top}px`
  overlay.style.width = `${Math.max(10, width)}px`
  overlay.style.height = `${height}px`
  return overlay
}

/**
 * 移除高亮覆盖层
 */
function removeHighlightOverlay(id: string): void {
  const overlays = highlightOverlays.get(id)
  if (overlays) {
    overlays.forEach(overlay => overlay.remove())
    highlightOverlays.delete(id)
  }
  // 也尝试通过 class 查找并移除
  document.querySelectorAll(`[id^="co-highlight-${id}-"]`).forEach(el => el.remove())
}

// 重新导出其他模块的内容
export * from './types'
export { injectInlineDiffStyles } from './styles'
export { computeDiff, computeWordDiff, escapeHtml, renderNewDiffHtml } from './diff-algorithm'
export { getCodeMirrorEditor, findMatchPositions, replaceInEditor, highlightInEditor } from './editor-utils'

/**
 * 显示内联差异 - 使用 DOM 浮动面板
 */
function showInlineDiffWithDOM(
  id: string,
  search: string,
  replace: string,
  isRegex: boolean,
  editorView: any
): { success: boolean; error?: string; matchCount: number } {
  const content = editorView.state.doc.toString()
  const positions = findMatchPositions(content, search, isRegex)
  
  if (positions.length === 0) {
    return { success: false, error: '未找到匹配内容', matchCount: 0 }
  }
  
  // 移除之前的相同 ID 的差异显示
  removeInlineDiff(id)
  
  const firstMatch = positions[0]
  
  // 计算差异以确定需要高亮的范围
  const matchedText = firstMatch.text
  const replacementText = isRegex 
    ? matchedText.replace(new RegExp(search), replace)
    : replace
  const diff = computeDiff(matchedText, replacementText)
  
  // 只高亮差异部分（跳过首尾相同部分）
  const highlightFrom = firstMatch.from + diff.commonPrefix.length
  const highlightTo = firstMatch.to - diff.commonSuffix.length
  
  // 滚动到匹配位置（但不选中）
  editorView.dispatch({
    effects: [],
    scrollIntoView: true,
    selection: { anchor: firstMatch.from } // 只移动光标，不选中
  })
  
  // 等待滚动完成后创建 DOM 元素
  setTimeout(() => {
    try {
      const coords = editorView.coordsAtPos(firstMatch.from)
      if (!coords) {
        console.error('[ChatOverleaf] Cannot get coords for position')
        return
      }
      
      // 使用 .cm-scroller 作为容器，确保浮动面板跟随滚动
      const scroller = document.querySelector('.cm-scroller') as HTMLElement
      const editorContainer = document.querySelector('.cm-editor') as HTMLElement
      if (!scroller || !editorContainer) {
        console.error('[ChatOverleaf] Cannot find editor container')
        return
      }
      
      const scrollerRect = scroller.getBoundingClientRect()
      
      // 创建持久高亮覆盖层，并获取边界信息
      const bounds = createHighlightOverlay(id, highlightFrom, highlightTo, editorView, scroller)
      
      // 使用外部已计算的 diff
      const { newSegments } = computeWordDiff(diff.oldDiff, diff.newDiff)
      
      // 生成弹出框中显示的内容（只显示差异部分，高亮变化的单词）
      let displayContent: string
      if (diff.oldDiff.length === 0 && diff.newDiff.length === 0) {
        // 完全相同，直接显示
        displayContent = escapeHtml(replacementText)
      } else {
        // 有差异，只显示差异部分并高亮变化的单词
        displayContent = renderNewDiffHtml(newSegments)
      }
      
      // 创建差异显示元素
      const diffContainer = document.createElement('div')
      diffContainer.className = 'co-inline-diff-container'
      diffContainer.id = `co-diff-${id}`
      
      // 计算弹出框位置 - 从高亮区域的最左下角开始
      let left: number, top: number
      if (bounds) {
        // 使用高亮区域的边界信息
        left = Math.max(10, bounds.minLeft)
        top = bounds.maxBottom + 2
      } else {
        // 回退：使用差异起始位置
        const diffStartPos = firstMatch.from + diff.commonPrefix.length
        const diffCoords = editorView.coordsAtPos(diffStartPos) || coords
        left = Math.max(10, diffCoords.left - scrollerRect.left - 10)
        top = diffCoords.bottom - scrollerRect.top + scroller.scrollTop + 2
      }
      
      diffContainer.style.left = `${left}px`
      diffContainer.style.top = `${top}px`
      
      // 超紧凑版 UI - 只显示差异部分和操作按钮
      diffContainer.innerHTML = `
        <div class="co-inline-diff-overlay">
          <div class="co-inline-diff-content">
            <div class="co-inline-diff-row">
              <span class="co-inline-diff-text co-inline-diff-text-add">${displayContent}</span>
            </div>
          </div>
          <div class="co-inline-diff-actions">
            <button class="co-inline-diff-btn co-inline-diff-btn-accept" data-action="accept">✓ 接受</button>
            <button class="co-inline-diff-btn co-inline-diff-btn-reject" data-action="reject">✕</button>
          </div>
        </div>
      `
      
      // 添加事件监听
      diffContainer.addEventListener('click', (e) => {
        const target = e.target as HTMLElement
        const action = target.dataset.action
        
        if (action === 'close' || action === 'reject') {
          removeInlineDiff(id)
          window.postMessage({
            type: 'INLINE_DIFF_ACTION',
            data: { id, action: 'rejected' }
          }, '*')
        } else if (action === 'accept') {
          const result = replaceInEditor(search, replace, isRegex)
          removeInlineDiff(id)
          window.postMessage({
            type: 'INLINE_DIFF_ACTION',
            data: { 
              id, 
              action: 'accepted',
              success: result.success,
              replacedCount: result.replacedCount,
              error: result.error
            }
          }, '*')
        }
      })
      
      // 添加到 scroller
      scroller.style.position = 'relative'
      scroller.appendChild(diffContainer)
      
      // 存储引用
      activeDiffs.set(id, {
        id,
        element: diffContainer,
        from: firstMatch.from,
        to: firstMatch.to,
        search,
        replace
      })
      
      console.log('[ChatOverleaf] Inline diff created:', id)
    } catch (error) {
      console.error('[ChatOverleaf] Error creating inline diff:', error)
    }
  }, 150)
  
  return { success: true, matchCount: positions.length }
}

/**
 * 显示内联差异 - 主入口
 */
export function showInlineDiff(
  id: string,
  search: string, 
  replace: string, 
  isRegex: boolean
): { success: boolean; error?: string; matchCount: number } {
  try {
    console.log('[ChatOverleaf] showInlineDiff called:', { id, search: search.substring(0, 50), replace: replace.substring(0, 50), isRegex })
    
    // 注入样式
    injectInlineDiffStyles()
    
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      console.error('[ChatOverleaf] No editor view found')
      return { success: false, error: '未找到编辑器', matchCount: 0 }
    }
    
    console.log('[ChatOverleaf] Editor found, using DOM method')
    // 直接使用 DOM 方式，更可靠
    return showInlineDiffWithDOM(id, search, replace, isRegex, editorView)
  } catch (error) {
    console.error('[ChatOverleaf] Error showing inline diff:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '显示差异失败',
      matchCount: 0
    }
  }
}

/**
 * 移除内联差异显示
 */
export function removeInlineDiff(id: string): boolean {
  let removed = false
  
  // 移除高亮覆盖层
  removeHighlightOverlay(id)
  
  // DOM 方式移除弹出框
  const diff = activeDiffs.get(id)
  if (diff) {
    diff.element.remove()
    activeDiffs.delete(id)
    removed = true
  }
  
  // 尝试直接通过 ID 查找并移除弹出框
  const element = document.getElementById(`co-diff-${id}`)
  if (element) {
    element.remove()
    removed = true
  }
  
  return removed
}

/**
 * 移除所有内联差异显示
 */
export function removeAllInlineDiffs(): number {
  let count = activeDiffs.size
  
  // 移除所有高亮覆盖层
  highlightOverlays.forEach(overlays => overlays.forEach(overlay => overlay.remove()))
  highlightOverlays.clear()
  document.querySelectorAll('.co-replace-highlight-overlay').forEach(el => el.remove())
  
  // DOM 方式移除
  activeDiffs.forEach(diff => diff.element.remove())
  activeDiffs.clear()
  
  // 移除所有可能残留的弹出框
  document.querySelectorAll('.co-inline-diff-container').forEach(el => {
    el.remove()
    count++
  })
  
  return count
}

/**
 * 初始化模块
 */
export function initInlineDiff() {
  injectInlineDiffStyles()
  console.log('[ChatOverleaf] Inline diff module initialized')
}

