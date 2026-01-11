/**
 * 悬浮高亮管理模块
 * 支持批量高亮所有待替换区域，鼠标悬浮显示操作悬浮框
 */

import type { WordDiffSegment } from './types'
import { computeDiff, computeWordDiff, escapeHtml, renderNewDiffHtml } from './diff-algorithm'
import { getCodeMirrorEditor, findMatchPositions, replaceInEditor } from './editor-utils'

// 高亮区域数据
interface HighlightRegion {
  id: string
  search: string
  replace: string
  isRegex: boolean
  from: number
  to: number
  overlays: HTMLElement[]
  status: 'pending' | 'accepted' | 'rejected'
}

// 模块状态
const highlightRegions = new Map<string, HighlightRegion>()
let currentPopover: HTMLElement | null = null
let currentPopoverId: string | null = null
let isPopoverHovered = false

/**
 * 创建可交互的高亮覆盖层
 */
function createInteractiveOverlay(
  id: string,
  index: string,
  left: number,
  top: number,
  width: number,
  height: number,
  isWord: boolean = false
): HTMLElement {
  const overlay = document.createElement('div')
  overlay.className = isWord ? 'co-hover-highlight-word' : 'co-hover-highlight-bg'
  overlay.id = `co-hover-${id}-${index}`
  overlay.dataset.highlightId = id
  overlay.style.left = `${Math.max(0, left)}px`
  overlay.style.top = `${top}px`
  overlay.style.width = `${Math.max(4, width)}px`
  overlay.style.height = `${height}px`
  return overlay
}

/**
 * 创建高亮区域的所有覆盖层
 */
function createRegionOverlays(
  region: HighlightRegion,
  editorView: any,
  scroller: HTMLElement
): HTMLElement[] {
  const scrollerRect = scroller.getBoundingClientRect()
  const overlays: HTMLElement[] = []
  
  const { from, to, id, search, replace, isRegex } = region
  
  // 计算差异
  const matchedText = editorView.state.doc.sliceString(from, to)
  const replacementText = isRegex 
    ? matchedText.replace(new RegExp(search), replace)
    : replace
  const diff = computeDiff(matchedText, replacementText)
  const { oldSegments } = computeWordDiff(diff.oldDiff, diff.newDiff)
  
  // 高亮范围（只高亮差异部分）
  const highlightFrom = from + diff.commonPrefix.length
  const highlightTo = to - diff.commonSuffix.length
  
  if (highlightFrom >= highlightTo) {
    // 无差异，高亮整个区域
    createBackgroundOverlaysForRegion(id, from, to, editorView, scroller, scrollerRect, overlays)
  } else {
    // 1. 创建淡色背景
    createBackgroundOverlaysForRegion(id, highlightFrom, highlightTo, editorView, scroller, scrollerRect, overlays)
    // 2. 创建深色单词高亮
    if (oldSegments.length > 0) {
      createWordOverlaysForRegion(id, highlightFrom, oldSegments, editorView, scroller, scrollerRect, overlays)
    }
  }
  
  return overlays
}

/**
 * 创建背景覆盖层
 */
function createBackgroundOverlaysForRegion(
  id: string,
  from: number,
  to: number,
  editorView: any,
  scroller: HTMLElement,
  scrollerRect: DOMRect,
  overlays: HTMLElement[]
): void {
  const startCoords = editorView.coordsAtPos(from)
  const endCoords = editorView.coordsAtPos(to)
  
  if (!startCoords || !endCoords) return
  
  const isSingleLine = Math.abs(startCoords.top - endCoords.top) < 5
  
  if (isSingleLine) {
    const left = startCoords.left - scrollerRect.left
    const top = startCoords.top - scrollerRect.top + scroller.scrollTop
    const height = startCoords.bottom - startCoords.top
    const width = endCoords.right - startCoords.left
    
    const overlay = createInteractiveOverlay(id, 'bg-0', left, top, width, height, false)
    scroller.appendChild(overlay)
    overlays.push(overlay)
  } else {
    const lineHeight = startCoords.bottom - startCoords.top
    let currentPos = from
    let lineIndex = 0
    
    while (currentPos < to) {
      const lineStartCoords = editorView.coordsAtPos(currentPos)
      if (!lineStartCoords) break
      
      let lineEndPos = currentPos
      let lineEndCoords = lineStartCoords
      
      for (let pos = currentPos; pos <= to; pos++) {
        const coords = editorView.coordsAtPos(pos)
        if (!coords) break
        if (Math.abs(coords.top - lineStartCoords.top) > 5) break
        lineEndPos = pos
        lineEndCoords = coords
      }
      
      const isFirstLine = currentPos === from
      const isLastLine = lineEndPos >= to - 1
      let left: number, width: number
      
      if (isFirstLine) {
        left = lineStartCoords.left - scrollerRect.left
        width = isLastLine ? endCoords.right - lineStartCoords.left : lineEndCoords.right - lineStartCoords.left + 10
      } else if (isLastLine) {
        const lineInfo = editorView.state.doc.lineAt(to)
        const lineStartPosCoords = editorView.coordsAtPos(lineInfo.from)
        left = lineStartPosCoords ? lineStartPosCoords.left - scrollerRect.left : 0
        width = endCoords.right - (lineStartPosCoords?.left || scrollerRect.left)
      } else {
        left = lineStartCoords.left - scrollerRect.left
        width = lineEndCoords.right - lineStartCoords.left + 10
      }
      
      const top = lineStartCoords.top - scrollerRect.top + scroller.scrollTop
      const overlay = createInteractiveOverlay(id, `bg-${lineIndex}`, left, top, width, lineHeight, false)
      scroller.appendChild(overlay)
      overlays.push(overlay)
      
      currentPos = lineEndPos + 1
      lineIndex++
      if (lineIndex > 100) break
    }
  }
}

/**
 * 创建单词级别高亮
 */
function createWordOverlaysForRegion(
  id: string,
  from: number,
  oldSegments: WordDiffSegment[],
  editorView: any,
  scroller: HTMLElement,
  scrollerRect: DOMRect,
  overlays: HTMLElement[]
): void {
  let currentPos = from
  let wordIndex = 0
  
  for (const segment of oldSegments) {
    const segmentLen = segment.text.length
    
    if (segment.type === 'changed' && segmentLen > 0) {
      const segStart = currentPos
      const segEnd = currentPos + segmentLen
      
      try {
        const startCoords = editorView.coordsAtPos(segStart)
        const endCoords = editorView.coordsAtPos(segEnd)
        
        if (startCoords && endCoords) {
          const isSingleLine = Math.abs(startCoords.top - endCoords.top) < 5
          
          if (isSingleLine) {
            const left = startCoords.left - scrollerRect.left
            const top = startCoords.top - scrollerRect.top + scroller.scrollTop
            const width = endCoords.right - startCoords.left
            const height = startCoords.bottom - startCoords.top
            
            const overlay = createInteractiveOverlay(id, `word-${wordIndex}`, left, top, width, height, true)
            scroller.appendChild(overlay)
            overlays.push(overlay)
          }
        }
      } catch (e) {
        // 忽略错误
      }
      wordIndex++
    }
    
    currentPos += segmentLen
  }
}

/**
 * 显示悬浮框
 */
function showPopover(region: HighlightRegion, scroller: HTMLElement, editorView: any): void {
  // 先关闭现有悬浮框
  hidePopover()
  
  const scrollerRect = scroller.getBoundingClientRect()
  
  // 计算悬浮框位置 - 使用第一个覆盖层的位置
  const firstOverlay = region.overlays[0]
  if (!firstOverlay) return
  
  // 计算差异用于显示
  const matchedText = editorView.state.doc.sliceString(region.from, region.to)
  const replacementText = region.isRegex 
    ? matchedText.replace(new RegExp(region.search), region.replace)
    : region.replace
  const diff = computeDiff(matchedText, replacementText)
  const { newSegments } = computeWordDiff(diff.oldDiff, diff.newDiff)
  
  let displayContent: string
  if (diff.oldDiff.length === 0 && diff.newDiff.length === 0) {
    displayContent = escapeHtml(replacementText)
  } else {
    displayContent = renderNewDiffHtml(newSegments)
  }
  
  // 计算最后一个覆盖层的底部位置
  let maxBottom = 0
  let minLeft = Infinity
  region.overlays.forEach(overlay => {
    const top = parseFloat(overlay.style.top)
    const height = parseFloat(overlay.style.height)
    const left = parseFloat(overlay.style.left)
    if (top + height > maxBottom) maxBottom = top + height
    if (left < minLeft) minLeft = left
  })
  
  const popover = document.createElement('div')
  popover.className = 'co-hover-popover'
  popover.id = `co-popover-${region.id}`
  popover.style.left = `${Math.max(10, minLeft)}px`
  popover.style.top = `${maxBottom + 4}px`
  
  popover.innerHTML = `
    <div class="co-hover-popover-content">
      <span class="co-hover-popover-text">${displayContent}</span>
    </div>
    <div class="co-hover-popover-actions">
      <button class="co-hover-popover-btn co-hover-popover-btn-accept" data-action="accept">✓ 接受</button>
      <button class="co-hover-popover-btn co-hover-popover-btn-reject" data-action="reject">✕</button>
    </div>
  `
  
  // 悬浮框事件
  popover.addEventListener('mouseenter', () => {
    isPopoverHovered = true
  })
  
  popover.addEventListener('mouseleave', () => {
    isPopoverHovered = false
  })
  
  popover.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const action = target.dataset.action
    
    if (action === 'accept') {
      // 执行替换
      const result = replaceInEditor(region.search, region.replace, region.isRegex)
      // 更新状态
      region.status = 'accepted'
      // 移除高亮和悬浮框
      removeRegionHighlight(region.id)
      hidePopover()
      // 通知外部
      window.postMessage({
        type: 'HOVER_HIGHLIGHT_ACTION',
        data: { 
          id: region.id, 
          action: 'accepted',
          success: result.success,
          replacedCount: result.replacedCount,
          error: result.error
        }
      }, '*')
    } else if (action === 'reject') {
      // 更新状态并移除高亮
      region.status = 'rejected'
      removeRegionHighlight(region.id)
      hidePopover()
      // 通知外部
      window.postMessage({
        type: 'HOVER_HIGHLIGHT_ACTION',
        data: { id: region.id, action: 'rejected' }
      }, '*')
    }
  })
  
  scroller.appendChild(popover)
  currentPopover = popover
  currentPopoverId = region.id
}

/**
 * 隐藏悬浮框
 */
function hidePopover(): void {
  if (currentPopover) {
    currentPopover.remove()
    currentPopover = null
    currentPopoverId = null
  }
}

/**
 * 移除单个区域的高亮
 */
function removeRegionHighlight(id: string): void {
  const region = highlightRegions.get(id)
  if (region) {
    region.overlays.forEach(overlay => overlay.remove())
    highlightRegions.delete(id)
  }
  // 也通过选择器清理
  document.querySelectorAll(`[data-highlight-id="${id}"]`).forEach(el => el.remove())
}

/**
 * 设置鼠标事件监听
 */
let isEventListenerSetup = false

function setupEventListeners(scroller: HTMLElement, editorView: any): void {
  if (isEventListenerSetup) return
  isEventListenerSetup = true
  
  // 鼠标悬浮事件 - 使用事件委托
  scroller.addEventListener('mouseover', (e) => {
    const target = e.target as HTMLElement
    const highlightId = target.dataset?.highlightId
    
    if (highlightId && highlightId !== currentPopoverId) {
      const region = highlightRegions.get(highlightId)
      if (region && region.status === 'pending') {
        showPopover(region, scroller, editorView)
      }
    }
  })
  
  // 鼠标离开高亮区域
  scroller.addEventListener('mouseout', (e) => {
    // 保持悬浮框，除非用户点击其他区域或触发其他高亮
  })
  
  // 点击其他区域关闭悬浮框
  document.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.co-hover-popover') && !target.dataset?.highlightId) {
      hidePopover()
    }
  })
}

/**
 * 检查文件名是否匹配
 */
function isFileMatch(targetFile: string, currentFile: string): boolean {
  if (!targetFile || !currentFile) return false
  
  // 精确匹配
  if (currentFile === targetFile) return true
  
  // 路径后缀匹配
  if (currentFile.endsWith('/' + targetFile) || targetFile.endsWith('/' + currentFile)) return true
  
  // 只比较文件名部分
  const currentFileName = currentFile.split('/').pop() || ''
  const targetFileName = targetFile.split('/').pop() || ''
  if (currentFileName === targetFileName) {
    return currentFile.includes(targetFile) || targetFile.includes(currentFile)
  }
  
  return false
}

/**
 * 批量添加高亮区域
 */
export function addHighlightRegions(
  commands: Array<{
    id: string
    file: string
    search: string
    replace: string
    isRegex: boolean
  }>,
  currentFileName: string
): { success: boolean; count: number } {
  console.log('[ChatOverleaf] addHighlightRegions called:', { 
    commandsCount: commands.length, 
    currentFileName 
  })
  
  const editorView = getCodeMirrorEditor()
  if (!editorView) {
    console.log('[ChatOverleaf] No editor view found')
    return { success: false, count: 0 }
  }
  
  const scroller = document.querySelector('.cm-scroller') as HTMLElement
  if (!scroller) {
    console.log('[ChatOverleaf] No scroller found')
    return { success: false, count: 0 }
  }
  
  scroller.style.position = 'relative'
  setupEventListeners(scroller, editorView)
  
  const content = editorView.state.doc.toString()
  let count = 0
  
  for (const cmd of commands) {
    // 跳过已存在的
    if (highlightRegions.has(cmd.id)) {
      console.log('[ChatOverleaf] Region already exists:', cmd.id)
      continue
    }
    
    // 检查文件是否匹配当前打开的文件
    if (!isFileMatch(cmd.file, currentFileName)) {
      console.log('[ChatOverleaf] File not match:', { cmdFile: cmd.file, currentFileName })
      continue
    }
    
    const positions = findMatchPositions(content, cmd.search, cmd.isRegex)
    if (positions.length === 0) {
      console.log('[ChatOverleaf] No match found for:', cmd.search.substring(0, 50))
      continue
    }
    
    const firstMatch = positions[0]
    
    const region: HighlightRegion = {
      id: cmd.id,
      search: cmd.search,
      replace: cmd.replace,
      isRegex: cmd.isRegex,
      from: firstMatch.from,
      to: firstMatch.to,
      overlays: [],
      status: 'pending'
    }
    
    // 创建覆盖层
    region.overlays = createRegionOverlays(region, editorView, scroller)
    
    if (region.overlays.length > 0) {
      highlightRegions.set(cmd.id, region)
      count++
      console.log('[ChatOverleaf] Highlight region created:', cmd.id)
    }
  }
  
  console.log('[ChatOverleaf] Total highlights created:', count)
  return { success: true, count }
}

/**
 * 重新显示某个区域的高亮（用于拒绝后重新激活）
 */
export function reactivateHighlight(
  id: string,
  file: string,
  search: string,
  replace: string,
  isRegex: boolean,
  currentFileName: string
): boolean {
  // 先移除旧的
  removeRegionHighlight(id)
  
  const result = addHighlightRegions([{ id, file, search, replace, isRegex }], currentFileName)
  return result.count > 0
}

/**
 * 移除所有高亮
 */
export function removeAllHoverHighlights(): number {
  const count = highlightRegions.size
  
  highlightRegions.forEach(region => {
    region.overlays.forEach(overlay => overlay.remove())
  })
  highlightRegions.clear()
  
  hidePopover()
  
  // 清理所有残留元素
  document.querySelectorAll('.co-hover-highlight-bg, .co-hover-highlight-word, .co-hover-popover').forEach(el => el.remove())
  
  return count
}

/**
 * 获取某个区域的状态
 */
export function getHighlightStatus(id: string): 'pending' | 'accepted' | 'rejected' | 'none' {
  const region = highlightRegions.get(id)
  return region?.status ?? 'none'
}

/**
 * 刷新所有高亮位置（编辑器滚动或内容变化时）
 */
export function refreshHighlights(): void {
  const editorView = getCodeMirrorEditor()
  const scroller = document.querySelector('.cm-scroller') as HTMLElement
  
  if (!editorView || !scroller) return
  
  // 刷新前先移除当前悬浮框，避免位置错位
  hidePopover()

  const content = editorView.state.doc.toString()
  
  highlightRegions.forEach((region, id) => {
    // 移除旧覆盖层
    region.overlays.forEach(overlay => overlay.remove())
    region.overlays = []
    
    // 重新查找位置
    const positions = findMatchPositions(content, region.search, region.isRegex)
    if (positions.length > 0) {
      region.from = positions[0].from
      region.to = positions[0].to
      // 重新创建覆盖层
      region.overlays = createRegionOverlays(region, editorView, scroller)
    } else {
      // 找不到匹配，移除该区域
      highlightRegions.delete(id)
    }
  })
}

