import type { PlasmoCSConfig } from "plasmo"
import { getFileTreeItems, clickFileTreeItem, waitForFileLoad, getCurrentFileName, isActiveTreeItemFile, expandAllFolders, collapseFolders, expandPathFolders } from "./overleaf-filetree"
import { 
  getCodeMirrorEditor, 
  replaceInEditor, 
  highlightInEditor, 
  findMatchPositions,
  initInlineDiff,
  addHighlightRegions,
  reactivateHighlight,
  removeAllHoverHighlights,
  removeRegionHighlight,
  refreshHighlights,
  COMMENT_PLACEHOLDER
} from "./overleaf-inline-diff"
import iconUrl from "data-base64:~assets/icon.svg"

export const config: PlasmoCSConfig = {
  matches: ["https://www.overleaf.com/*", "https://*.overleaf.com/*"],
  world: "MAIN"
}

export interface OverleafEditorInfo {
  content: string
  fileName: string
  length: number
  success: boolean
  error?: string
}

export interface AllFilesInfo {
  files: Array<{
    name: string
    content: string
    length: number
  }>
  success: boolean
  error?: string
}

export interface SelectedTextInfo {
  text: string
  fileName: string
  folderPath?: string
  success: boolean
  error?: string
}

/**
 * 获取 CodeMirror 编辑器内容
 */
function getCodeMirrorContent(): string | null {
  try {
    const editorView = getCodeMirrorEditor()
    if (editorView?.state?.doc) {
      return editorView.state.doc.toString()
    }
    return null
  } catch (error) {
    console.error('Error getting CodeMirror content:', error)
    return null
  }
}

/**
 * 清理内容：将纯注释块折叠成单行占位符，保持其余空格与换行
 */
function cleanContent(content: string): string {
  if (!content) return ''
  const lines = content.split(/\r?\n/)
  const result: string[] = []
  let commentBuffer: string[] = []

  const flush = () => {
    if (commentBuffer.length > 0) {
      result.push(COMMENT_PLACEHOLDER)
      commentBuffer = []
    }
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('%')) {
      commentBuffer.push(line)
    } else {
      flush()
      result.push(line)
    }
  }
  flush()

  return result.join('\n')
}

/**
 * 创建错误响应
 */
function createErrorResponse(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

/**
 * 获取编辑器选中的文本
 */
function getSelectedText(): SelectedTextInfo {
  try {
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      return { text: '', fileName: '', folderPath: '', success: false, error: 'No editor found' }
    }

    const selection = editorView.state.selection
    if (!selection || selection.ranges.length === 0) {
      const fileName = getCurrentFileName()
      const folderPath = fileName.includes('/') ? fileName.slice(0, fileName.lastIndexOf('/')) : ''
      return { text: '', fileName, folderPath, success: true }
    }

    const mainRange = selection.main
    if (mainRange.empty) {
      const fileName = getCurrentFileName()
      const folderPath = fileName.includes('/') ? fileName.slice(0, fileName.lastIndexOf('/')) : ''
      return { text: '', fileName, folderPath, success: true }
    }

    const selectedText = editorView.state.doc.sliceString(mainRange.from, mainRange.to)
    const fileName = getCurrentFileName()
    const folderPath = fileName.includes('/') ? fileName.slice(0, fileName.lastIndexOf('/')) : ''
    return { text: selectedText, fileName, folderPath, success: true }
  } catch (error) {
    return { text: '', fileName: '', folderPath: '', success: false, error: createErrorResponse(error) }
  }
}

/**
 * 在 Overleaf 的 review tooltip 中添加 Ctrl+L 快捷按钮
 */
function ensureReviewShortcutButton(selection: SelectedTextInfo): void {
  const menu = document.querySelector('.review-tooltip-menu.review-tooltip-menu-visible')
  if (!menu) return

  // 检查是否已存在
  if (menu.querySelector('[data-chatoverleaf-shortcut="ctrl-l"]')) return

  const btn = document.createElement('button')
  btn.className = 'review-tooltip-menu-button review-tooltip-add-comment-button'
  btn.setAttribute('data-chatoverleaf-shortcut', 'ctrl-l')
  btn.style.marginLeft = '4px'

  const icon = document.createElement('img')
  icon.src = iconUrl
  icon.alt = 'ChatOverleaf'
  icon.width = 16
  icon.height = 16
  icon.style.width = '16px'
  icon.style.height = '16px'
  icon.style.marginRight = '6px'

  const label = document.createElement('span')
  label.textContent = 'Ctrl + L'

  btn.appendChild(icon)
  btn.appendChild(label)

  btn.addEventListener('click', () => {
    window.postMessage({
      type: 'FOCUS_CHAT_INPUT',
      data: { selection }
    }, '*')
  })

  menu.appendChild(btn)
}

/**
 * 获取完整的编辑器信息
 */
function getOverleafEditorInfo(): OverleafEditorInfo {
  try {
    if (!isActiveTreeItemFile()) {
      return { content: '', fileName: '', length: 0, success: false, error: '当前选中项不是文件' }
    }

    const content = getCodeMirrorContent()
    const cleanedContent = cleanContent(content || '')

    if (!content) {
      return { content: '', fileName: '', length: 0, success: false, error: 'No content found' }
    }

    return {
      content: cleanedContent,
      fileName: getCurrentFileName(),
      length: cleanedContent.length,
      success: true
    }
  } catch (error) {
    return { content: '', fileName: '', length: 0, success: false, error: createErrorResponse(error) }
  }
}

/**
 * 提取所有文件内容
 */
async function getAllFilesContent(): Promise<AllFilesInfo> {
  try {
    const expandedFolders = await expandAllFolders()
    const fileItems = getFileTreeItems()

    if (fileItems.length === 0) {
      return { files: [], success: false, error: '未找到任何文件' }
    }

    const files: Array<{ name: string; content: string; length: number }> = []

    try {
      for (const fileItem of fileItems) {
        try {
          const clicked = await clickFileTreeItem(fileItem)
          if (!clicked) continue

          await waitForFileLoad(2000)

          if (!isActiveTreeItemFile()) continue

          const activeFileName = getCurrentFileName()
          if (activeFileName !== fileItem.name) continue

          const content = getCodeMirrorContent()
          if (content) {
            const cleanedContent = cleanContent(content)
            files.push({ name: activeFileName, content: cleanedContent, length: cleanedContent.length })
          }
        } catch (error) {
          console.error(`Error processing file ${fileItem.name}:`, error)
        }
      }
    } finally {
      await collapseFolders(expandedFolders)
    }

    return { files, success: true }
  } catch (error) {
    return { files: [], success: false, error: createErrorResponse(error) }
  }
}

// 存储编辑器状态
let currentEditorContent = ''
let currentFileName = ''
let contentChangeTimeout: NodeJS.Timeout | null = null
let lastFileNameNotified = ''
let refreshTimeout: NodeJS.Timeout | null = null
let resizeObserver: ResizeObserver | null = null
let contentObserver: MutationObserver | null = null

/**
 * 判断某个文档位置是否在当前视口内
 */
function isPositionVisible(pos: number): boolean {
  const editorView = getCodeMirrorEditor()
  const scroller = document.querySelector('.cm-scroller') as HTMLElement | null
  if (!editorView || !scroller) return false
  const coords = editorView.coordsAtPos(pos)
  if (!coords) return false
  const scrollerRect = scroller.getBoundingClientRect()
  return coords.bottom > scrollerRect.top && coords.top < scrollerRect.bottom
}

/**
 * 滚动到指定位置（居中显示）
 */
function scrollToPosition(pos: number): void {
  try {
    const editorView = getCodeMirrorEditor()
    const scroller = document.querySelector('.cm-scroller') as HTMLElement | null
    if (!editorView || !scroller) return
    
    editorView.dispatch({ selection: { anchor: pos }, scrollIntoView: true })
    
    requestAnimationFrame(() => {
      const coords = editorView.coordsAtPos(pos)
      if (!coords) return
      const scrollerRect = scroller.getBoundingClientRect()
      const targetY = coords.top - scrollerRect.top + scroller.scrollTop
      const centerOffset = scroller.clientHeight / 2
      scroller.scrollTo({
        top: Math.max(0, targetY - centerOffset),
        behavior: 'auto'
      })
    })
  } catch (error) {
    console.error('[ChatOverleaf] Error scrolling to position:', error)
  }
}

/**
 * 检查内容变化
 */
function checkContentChange() {
  try {
    if (!isActiveTreeItemFile()) return

    const content = getCodeMirrorContent()
    const fileName = getCurrentFileName()

    if (content && (content !== currentEditorContent || fileName !== currentFileName)) {
      const isContentValid = content.length > 0
      const isFileNameValid = fileName && fileName.trim().length > 0

      if (isContentValid && isFileNameValid) {
        const prevFile = currentFileName
        currentEditorContent = content
        currentFileName = fileName

        if (contentChangeTimeout) clearTimeout(contentChangeTimeout)

        contentChangeTimeout = setTimeout(() => {
          const cleanedContent = cleanContent(content)
          window.postMessage({
            type: 'OVERLEAF_CONTENT_CHANGED',
            data: { fileName, content: cleanedContent, length: cleanedContent.length }
          }, '*')
          // 如果切换了文件，移除旧文件的高亮
          if (prevFile && prevFile !== fileName) {
            removeAllHoverHighlights()
          }
          // 内容变化后刷新高亮位置
          refreshHighlights()
        }, 300)
      }
    }
  } catch (error) {
    console.error('Error checking content change:', error)
  }
}

/**
 * 监听编辑器选择变化
 */
function setupSelectionListener() {
  try {
    const editorView = getCodeMirrorEditor()
    if (!editorView) {
      console.log('[ChatOverleaf] No editor found, retrying in 2 seconds...')
      setTimeout(setupSelectionListener, 2000)
      return
    }

    console.log('[ChatOverleaf] Setting up selection listener')
    let lastSelection = ''

    const checkSelection = () => {
      const selectedInfo = getSelectedText()
      if (selectedInfo.success) {
        if (selectedInfo.text !== lastSelection) {
          lastSelection = selectedInfo.text
          window.postMessage({
            type: 'OVERLEAF_SELECTION_CHANGED',
            data: {
              text: selectedInfo.text,
              fileName: selectedInfo.fileName,
              folderPath: selectedInfo.folderPath || '',
              hasSelection: selectedInfo.text.length > 0
            }
          }, '*')
        }
        if (selectedInfo.text.length > 0) {
          ensureReviewShortcutButton(selectedInfo)
        }
      }
    }

    document.addEventListener('mouseup', () => setTimeout(checkSelection, 10))
    document.addEventListener('keyup', () => {
      setTimeout(checkSelection, 10)
      setTimeout(checkContentChange, 10)
    })

    setInterval(() => {
      checkSelection()
      checkContentChange()
    }, 300)

  } catch (error) {
    console.error('Error setting up selection listener:', error)
  }
}

/**
 * 监听滚动/窗口大小变化，实时刷新高亮位置
 */
function setupRefreshListeners() {
  const scroller = document.querySelector('.cm-scroller') as HTMLElement
  if (!scroller) {
    // 如果编辑器尚未加载，稍后重试
    setTimeout(setupRefreshListeners, 1000)
    return
  }

  const throttledRefresh = () => {
    if (refreshTimeout) return
    refreshTimeout = setTimeout(() => {
      refreshTimeout = null
      refreshHighlights()
    }, 80)
  }

  scroller.addEventListener('scroll', throttledRefresh)
  window.addEventListener('resize', throttledRefresh)

  // 观察编辑器容器尺寸变化（包括左右栏拖拽导致宽度变化）
  if (!resizeObserver) {
    resizeObserver = new ResizeObserver(throttledRefresh)
    resizeObserver.observe(scroller)
    const editor = document.querySelector('.cm-editor') as HTMLElement
    if (editor) resizeObserver.observe(editor)
  }

  // 观察内容结构变化（用户编辑、折叠、渲染等引起的节点位置变化）
  if (!contentObserver) {
    const contentEl = document.querySelector('.cm-content')
    if (contentEl) {
      contentObserver = new MutationObserver(throttledRefresh)
      contentObserver.observe(contentEl, { characterData: true, childList: true, subtree: true })
    }
  }
}

/**
 * 检查当前打开的文件是否匹配指定路径
 */
function isCurrentFile(filePath: string): boolean {
  const currentFile = getCurrentFileName()
  if (!currentFile) return false
  
  // 精确匹配
  if (currentFile === filePath) return true
  
  // 路径后缀匹配
  if (currentFile.endsWith('/' + filePath) || filePath.endsWith('/' + currentFile)) return true
  
  // 只比较文件名
  const currentFileName = currentFile.split('/').pop()
  const targetFileName = filePath.split('/').pop()
  if (currentFileName === targetFileName) {
    // 进一步验证路径
    return currentFile.includes(filePath) || filePath.includes(currentFile)
  }
  
  return false
}

/**
 * 点击并打开指定文件（支持展开嵌套文件夹）
 */
async function navigateToFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 先尝试展开路径中的所有文件夹
    await expandPathFolders(filePath)
    
    // 等待文件树更新
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const fileItems = getFileTreeItems()
    const targetFile = fileItems.find(item => 
      item.path === filePath || 
      item.name === filePath ||
      item.path.endsWith('/' + filePath) ||
      item.name.endsWith('/' + filePath)
    )
    
    if (!targetFile) {
      return { success: false, error: `未找到文件: ${filePath}` }
    }
    
    const clicked = await clickFileTreeItem(targetFile)
    if (!clicked) {
      return { success: false, error: '无法点击文件' }
    }
    
    await waitForFileLoad(1500)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '导航失败' }
  }
}

// 监听消息
window.addEventListener('message', async (event) => {
  // 忽略非对象消息
  if (!event.data || typeof event.data !== 'object' || !event.data.type) return
  
  // 调试日志
  if (event.data.type?.startsWith('NAVIGATE') || 
      event.data.type?.startsWith('REPLACE') || 
      event.data.type?.startsWith('HIGHLIGHT') || 
      event.data.type?.startsWith('SHOW_INLINE') ||
      event.data.type?.startsWith('REMOVE')) {
    console.log('[ChatOverleaf MainWorld] Received message:', event.data.type, event.data)
  }
  
  if (event.data.type === 'CHECK_CURRENT_FILE') {
    const isMatch = isCurrentFile(event.data.filePath)
    window.postMessage({
      type: 'CHECK_CURRENT_FILE_RESPONSE',
      requestId: event.data.requestId,
      data: { isCurrentFile: isMatch, currentFile: getCurrentFileName() }
    }, '*')
    return
  }

  if (event.data.type === 'CHECK_MATCH_VISIBLE') {
    const { search, replace, isRegex, commandType, insertAnchor } = event.data
    const editorView = getCodeMirrorEditor()
    const scroller = document.querySelector('.cm-scroller') as HTMLElement | null
    if (!editorView || !scroller) {
      window.postMessage({
        type: 'CHECK_MATCH_VISIBLE_RESPONSE',
        requestId: event.data.requestId,
        data: { visible: false, hasMatch: false }
      }, '*')
      return
    }

    const content = editorView.state.doc.toString()
    let searchText = search
    if (commandType === 'insert' && insertAnchor) {
      searchText = insertAnchor.after || insertAnchor.before || search
    }

    const positions = findMatchPositions(content, searchText, isRegex)
    const first = positions[0]
    const visible = first ? isPositionVisible(first.from) : false

    window.postMessage({
      type: 'CHECK_MATCH_VISIBLE_RESPONSE',
      requestId: event.data.requestId,
      data: { visible, hasMatch: !!first, pos: first?.from ?? null }
    }, '*')
    return
  }

  if (event.data.type === 'SCROLL_TO_POSITION') {
    const { pos } = event.data
    scrollToPosition(typeof pos === 'number' ? pos : 0)
    window.postMessage({
      type: 'SCROLL_TO_POSITION_RESPONSE',
      requestId: event.data.requestId,
      data: { success: true }
    }, '*')
    return
  }
  
  if (event.data.type === 'NAVIGATE_TO_FILE') {
    const result = await navigateToFile(event.data.filePath)
    window.postMessage({
      type: 'NAVIGATE_TO_FILE_RESPONSE',
      requestId: event.data.requestId,
      data: result
    }, '*')
    return
  }
  
  if (event.data.type === 'REPLACE_IN_EDITOR') {
    const { search, replace, isRegex, commandType, insertAnchor } = event.data
    const result = replaceInEditor(search, replace, isRegex, commandType || 'replace', insertAnchor)
    window.postMessage({
      type: 'REPLACE_IN_EDITOR_RESPONSE',
      requestId: event.data.requestId,
      data: result
    }, '*')
    return
  }
  
  if (event.data.type === 'HIGHLIGHT_IN_EDITOR') {
    const { search, isRegex } = event.data
    const result = highlightInEditor(search, isRegex)
    window.postMessage({
      type: 'HIGHLIGHT_IN_EDITOR_RESPONSE',
      requestId: event.data.requestId,
      data: result
    }, '*')
    return
  }
  
  // 批量添加高亮区域
  if (event.data.type === 'ADD_HIGHLIGHT_REGIONS') {
    const { commands, shouldScroll } = event.data
    const currentFile = getCurrentFileName()
    console.log('[ChatOverleaf] ADD_HIGHLIGHT_REGIONS:', { 
      commandsCount: commands?.length, 
      currentFile,
      shouldScroll
    })
    const result = addHighlightRegions(commands || [], currentFile, shouldScroll ?? true)
    window.postMessage({
      type: 'ADD_HIGHLIGHT_REGIONS_RESPONSE',
      requestId: event.data.requestId,
      data: result
    }, '*')
    return
  }
  
  // 重新激活高亮
  if (event.data.type === 'REACTIVATE_HIGHLIGHT') {
    const { id, file, search, replace, isRegex, commandType, insertAnchor } = event.data
    const currentFile = getCurrentFileName()
    const success = reactivateHighlight(id, file, search, replace, isRegex, currentFile, commandType, insertAnchor)
    window.postMessage({
      type: 'REACTIVATE_HIGHLIGHT_RESPONSE',
      requestId: event.data.requestId,
      data: { success }
    }, '*')
    return
  }
  
  // 移除所有悬浮高亮
  if (event.data.type === 'REMOVE_ALL_HOVER_HIGHLIGHTS') {
    const count = removeAllHoverHighlights()
    window.postMessage({
      type: 'REMOVE_ALL_HOVER_HIGHLIGHTS_RESPONSE',
      requestId: event.data.requestId,
      data: { success: true, count }
    }, '*')
    return
  }
  
  // 移除单个高亮区域
  if (event.data.type === 'REMOVE_HIGHLIGHT') {
    const { id } = event.data
    removeRegionHighlight(id)
    window.postMessage({
      type: 'REMOVE_HIGHLIGHT_RESPONSE',
      requestId: event.data.requestId,
      data: { success: true }
    }, '*')
    return
  }
  
  if (event.data.type === 'GET_OVERLEAF_CONTENT') {
    const mode = event.data.mode || 'current'

    if (mode === 'all') {
      const allFilesInfo = await getAllFilesContent()
      window.postMessage({
        type: 'OVERLEAF_CONTENT_RESPONSE',
        requestId: event.data.requestId,
        data: {
          success: allFilesInfo.success,
          files: allFilesInfo.files,
          mode: 'all',
          error: allFilesInfo.error
        }
      }, '*')
    } else {
      const info = getOverleafEditorInfo()
      window.postMessage({
        type: 'OVERLEAF_CONTENT_RESPONSE',
        requestId: event.data.requestId,
        data: info
      }, '*')
    }
  } else if (event.data.type === 'GET_SELECTED_TEXT') {
    const selectedInfo = getSelectedText()
    window.postMessage({
      type: 'SELECTED_TEXT_RESPONSE',
      requestId: event.data.requestId,
      data: selectedInfo
    }, '*')
  }
})

// 初始化
function initialize() {
  console.log('[ChatOverleaf] Initializing...')
  initInlineDiff()
  setTimeout(setupSelectionListener, 1000)
  setTimeout(setupRefreshListeners, 1200)

  // 全局快捷键：Ctrl + L 聚焦侧边栏输入框，并携带当前选中文本/路径
  const hotkeyHandler = (event: KeyboardEvent) => {
    if (event.ctrlKey && (event.key === 'l' || event.key === 'L')) {
      event.preventDefault()
      event.stopPropagation()
      const selection = getSelectedText()
      window.postMessage({
        type: 'FOCUS_CHAT_INPUT',
        data: {
          selection
        }
      }, '*')
    }
  }
  window.addEventListener('keydown', hotkeyHandler, { capture: true, passive: false })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

export {}
