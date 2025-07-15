import type { PlasmoCSConfig } from "plasmo"
import { getFileTreeItems, clickFileTreeItem, waitForFileLoad, getCurrentFileName, type FileTreeItem } from "~dom/overleaf-filetree"

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

/**
 * 获取 CodeMirror 编辑器内容
 */
function getCodeMirrorContent(): string | null {
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
            return content
          }
        }
      }
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
  }
})

export {}