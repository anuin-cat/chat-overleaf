import type { PlasmoCSConfig } from "plasmo"
import { getFileTreeItems, clickFileTreeItem, waitForFileLoad, getCurrentFileName, isActiveTreeItemFile, expandAllFolders, collapseFolders, expandPathFolders } from "./overleaf-filetree"
import { 
  getCodeMirrorEditor, 
  replaceInEditor, 
  highlightInEditor, 
  showInlineDiff, 
  removeInlineDiff, 
  removeAllInlineDiffs,
  initInlineDiff 
} from "./overleaf-inline-diff"

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
 * 清理内容（去除注释和多余空行）
 */
function cleanContent(content: string): string {
  if (!content) return ''
  let cleanedContent = content.replace(/^%.*$/gm, '')
  cleanedContent = cleanedContent.replace(/^\s*%.*$/gm, '')
  cleanedContent = cleanedContent.replace(/^\s*[\r\n]\s*[\r\n]/gm, '\n')
  return cleanedContent
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
      return { text: '', fileName: '', success: false, error: 'No editor found' }
    }

    const selection = editorView.state.selection
    if (!selection || selection.ranges.length === 0) {
      return { text: '', fileName: getCurrentFileName(), success: true }
    }

    const mainRange = selection.main
    if (mainRange.empty) {
      return { text: '', fileName: getCurrentFileName(), success: true }
    }

    const selectedText = editorView.state.doc.sliceString(mainRange.from, mainRange.to)
    return { text: selectedText, fileName: getCurrentFileName(), success: true }
  } catch (error) {
    return { text: '', fileName: '', success: false, error: createErrorResponse(error) }
  }
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
        currentEditorContent = content
        currentFileName = fileName

        if (contentChangeTimeout) clearTimeout(contentChangeTimeout)

        contentChangeTimeout = setTimeout(() => {
          const cleanedContent = cleanContent(content)
          window.postMessage({
            type: 'OVERLEAF_CONTENT_CHANGED',
            data: { fileName, content: cleanedContent, length: cleanedContent.length }
          }, '*')
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
      if (selectedInfo.success && selectedInfo.text !== lastSelection) {
        lastSelection = selectedInfo.text
        window.postMessage({
          type: 'OVERLEAF_SELECTION_CHANGED',
          data: {
            text: selectedInfo.text,
            fileName: selectedInfo.fileName,
            hasSelection: selectedInfo.text.length > 0
          }
        }, '*')
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
    const { search, replace, isRegex } = event.data
    const result = replaceInEditor(search, replace, isRegex)
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
  
  if (event.data.type === 'SHOW_INLINE_DIFF') {
    const { id, search, replace, isRegex } = event.data
    console.log('[ChatOverleaf] Received SHOW_INLINE_DIFF:', { id, search: search?.substring(0, 30) })
    const result = showInlineDiff(id, search, replace, isRegex)
    window.postMessage({
      type: 'SHOW_INLINE_DIFF_RESPONSE',
      requestId: event.data.requestId,
      data: result
    }, '*')
    return
  }
  
  if (event.data.type === 'REMOVE_INLINE_DIFF') {
    const { id } = event.data
    const success = removeInlineDiff(id)
    window.postMessage({
      type: 'REMOVE_INLINE_DIFF_RESPONSE',
      requestId: event.data.requestId,
      data: { success }
    }, '*')
    return
  }
  
  if (event.data.type === 'REMOVE_ALL_INLINE_DIFFS') {
    const count = removeAllInlineDiffs()
    window.postMessage({
      type: 'REMOVE_ALL_INLINE_DIFFS_RESPONSE',
      requestId: event.data.requestId,
      data: { success: true, count }
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize)
} else {
  initialize()
}

export {}
