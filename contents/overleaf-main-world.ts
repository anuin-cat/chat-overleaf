import type { PlasmoCSConfig } from "plasmo"
import { getFileTreeItems, clickFileTreeItem, waitForFileLoad, getCurrentFileName, type FileTreeItem } from "./overleaf-filetree"

export const config: PlasmoCSConfig = {
  matches: ["*://www.overleaf.com/*", "*://*.overleaf.com/*"],
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
 * 获取 CodeMirror 编辑器实例
 */
function getCodeMirrorEditor(): any | null {
  try {
    const editors = document.querySelectorAll('.cm-editor')

    for (let i = 0; i < editors.length; i++) {
      const editorElement = editors[i]
      const cmContent = editorElement.querySelector('.cm-content') as any

      if (cmContent?.cmView?.view) {
        const editorView = cmContent.cmView.view
        if (editorView.state?.doc) {
          const content = editorView.state.doc.toString()

          // 检查是否是有效的 LaTeX 内容
          if (content.includes('\\documentclass') || content.includes('\\begin') || content.length > 200) {
            return editorView
          }
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error getting CodeMirror editor:', error)
    return null
  }
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

  // 将 content 中任何行带有 % 开头的注释内容去掉
  let cleanedContent = content.replace(/^%.*$/gm, '')

  // 将 任何连续空格接 % 开头的行去掉
  cleanedContent = cleanedContent.replace(/^\s*%.*$/gm, '')

  // 将任意连续的两个空行替换为一个空行
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
      return {
        text: '',
        fileName: '',
        success: false,
        error: 'No editor found'
      }
    }

    const selection = editorView.state.selection
    if (!selection || selection.ranges.length === 0) {
      return {
        text: '',
        fileName: getCurrentFileName(),
        success: true
      }
    }

    // 获取主选择范围
    const mainRange = selection.main
    if (mainRange.empty) {
      return {
        text: '',
        fileName: getCurrentFileName(),
        success: true
      }
    }

    // 提取选中的文本
    const selectedText = editorView.state.doc.sliceString(mainRange.from, mainRange.to)

    return {
      text: selectedText,
      fileName: getCurrentFileName(),
      success: true
    }
  } catch (error) {
    return {
      text: '',
      fileName: '',
      success: false,
      error: createErrorResponse(error)
    }
  }
}

/**
 * 获取完整的编辑器信息
 */
function getOverleafEditorInfo(): OverleafEditorInfo {
  try {
    const content = getCodeMirrorContent()
    const cleanedContent = cleanContent(content || '')

    if (!content) {
      return {
        content: '',
        fileName: '',
        length: 0,
        success: false,
        error: 'No content found'
      }
    }

    return {
      content: cleanedContent,
      fileName: getCurrentFileName(),
      length: cleanedContent.length,
      success: true
    }
  } catch (error) {
    return {
      content: '',
      fileName: '',
      length: 0,
      success: false,
      error: createErrorResponse(error)
    }
  }
}

/**
 * 提取所有文件内容
 */
async function getAllFilesContent(): Promise<AllFilesInfo> {
  try {
    const fileItems = getFileTreeItems()

    if (fileItems.length === 0) {
      return {
        files: [],
        success: false,
        error: '未找到任何文件'
      }
    }

    const files: Array<{ name: string; content: string; length: number }> = []

    for (const fileItem of fileItems) {
      try {
        // 点击文件
        const clicked = await clickFileTreeItem(fileItem)
        if (!clicked) {
          console.warn(`Failed to click file: ${fileItem.name}`)
          continue
        }

        // 等待文件加载
        await waitForFileLoad(2000)

        // 获取内容
        const content = getCodeMirrorContent()
        if (content) {
          const cleanedContent = cleanContent(content)
          files.push({
            name: fileItem.name,
            content: cleanedContent,
            length: cleanedContent.length
          })
        }
      } catch (error) {
        console.error(`Error processing file ${fileItem.name}:`, error)
      }
    }

    return {
      files,
      success: true
    }
  } catch (error) {
    return {
      files: [],
      success: false,
      error: createErrorResponse(error)
    }
  }
}

// 存储选中文本的状态
let currentSelectedText = ''
let selectionChangeTimeout: NodeJS.Timeout | null = null

// 存储编辑器内容状态
let currentEditorContent = ''
let currentFileName = ''
let contentChangeTimeout: NodeJS.Timeout | null = null

/**
 * 检查内容变化
 */
function checkContentChange() {
  try {
    const content = getCodeMirrorContent()
    const fileName = getCurrentFileName()

    if (content && (content !== currentEditorContent || fileName !== currentFileName)) {
      // 简单验证：确保获取到的文件名和编辑器内容是对应的
      // 通过检查内容长度和文件名是否有效来判断
      const isContentValid = content.length > 0
      const isFileNameValid = fileName && fileName.trim().length > 0

      // 只有当文件名和内容都有效时才更新
      if (isContentValid && isFileNameValid) {
        currentEditorContent = content
        currentFileName = fileName

        // 防抖处理，避免频繁更新
        if (contentChangeTimeout) {
          clearTimeout(contentChangeTimeout)
        }

        contentChangeTimeout = setTimeout(() => {
          const cleanedContent = cleanContent(content)

          // 通知插件内容变化
          window.postMessage({
            type: 'OVERLEAF_CONTENT_CHANGED',
            data: {
              fileName: fileName,
              content: cleanedContent,
              length: cleanedContent.length
            }
          }, '*')
        }, 300) // 减少防抖时间到300ms，提高响应速度
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
      console.log('No editor found, retrying in 2 seconds...')
      setTimeout(setupSelectionListener, 2000)
      return
    }

    console.log('Setting up selection listener for CodeMirror editor')

    // 使用 document 事件监听作为备选方案
    let lastSelection = ''

    const checkSelection = () => {
      const selectedInfo = getSelectedText()
      if (selectedInfo.success && selectedInfo.text !== lastSelection) {
        lastSelection = selectedInfo.text
        currentSelectedText = selectedInfo.text

        // 通知插件选择变化
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

    // 监听鼠标和键盘事件
    document.addEventListener('mouseup', () => {
      setTimeout(checkSelection, 10)
    })

    document.addEventListener('keyup', () => {
      setTimeout(checkSelection, 10)
      // 同时检查内容变化
      setTimeout(checkContentChange, 10)
    })

    // 定期检查选择变化和内容变化（作为备选）
    setInterval(() => {
      checkSelection()
      checkContentChange()
    }, 300) // 每0.5秒检查一次，提高响应速度

  } catch (error) {
    console.error('Error setting up selection listener:', error)
  }
}

// 监听消息
window.addEventListener('message', async (event) => {
  if (event.data.type === 'GET_OVERLEAF_CONTENT') {
    const mode = event.data.mode || 'current'

    if (mode === 'all') {
      // 提取所有文件
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
      // 提取当前文件
      const info = getOverleafEditorInfo()
      window.postMessage({
        type: 'OVERLEAF_CONTENT_RESPONSE',
        requestId: event.data.requestId,
        data: info
      }, '*')
    }
  } else if (event.data.type === 'GET_SELECTED_TEXT') {
    // 获取选中文本
    const selectedInfo = getSelectedText()
    window.postMessage({
      type: 'SELECTED_TEXT_RESPONSE',
      requestId: event.data.requestId,
      data: selectedInfo
    }, '*')
  }
})

// 页面加载完成后设置选择监听器
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(setupSelectionListener, 1000) // 延迟1秒确保编辑器加载完成
  })
} else {
  setTimeout(setupSelectionListener, 1000)
}

export {}