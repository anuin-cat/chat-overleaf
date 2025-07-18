import { useState } from "react"

export interface FileInfo {
  name: string
  content: string
  length: number
}

export interface ExtractionResult {
  success: boolean
  files: FileInfo[]
  mode: 'current' | 'all'
  error?: string
}

export const useFileExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedFiles, setExtractedFiles] = useState<FileInfo[]>([])

  // 简化的内容提取函数
  const extractContent = async (mode: 'current' | 'all'): Promise<ExtractionResult> => {
    try {
      // 发送消息到主世界脚本获取内容
      const requestId = Date.now().toString()

      return new Promise((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'OVERLEAF_CONTENT_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handleMessage)

            const { data } = event.data

            if (mode === 'all' && data.files) {
              // 处理所有文件模式
              if (data.success && data.files.length > 0) {
                resolve({
                  success: true,
                  files: data.files.map((file: any) => ({
                    name: file.name,
                    content: file.content,
                    length: file.length
                  })),
                  mode
                })
              } else {
                resolve({
                  success: false,
                  files: [],
                  mode,
                  error: data.error || '无法获取所有文件内容'
                })
              }
            } else {
              // 处理当前文件模式
              if (data.success && data.content) {
                resolve({
                  success: true,
                  files: [{
                    name: data.fileName || 'main.tex',
                    content: data.content,
                    length: data.length || data.content.length
                  }],
                  mode
                })
              } else {
                resolve({
                  success: false,
                  files: [],
                  mode,
                  error: data.error || '无法获取内容'
                })
              }
            }
          }
        }

        window.addEventListener('message', handleMessage)

        // 发送请求，包含模式参数
        window.postMessage({
          type: 'GET_OVERLEAF_CONTENT',
          requestId,
          mode
        }, '*')

        // 30秒超时
        setTimeout(() => {
          window.removeEventListener('message', handleMessage)
          resolve({
            success: false,
            files: [],
            mode,
            error: '请求超时'
          })
        }, 30000)
      })
    } catch (error) {
      return {
        success: false,
        files: [],
        mode,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

  // 处理内容提取结果
  const handleContentExtracted = (result: ExtractionResult) => {
    if (result.success) {
      // 更新提取的文件列表
      if (result.mode === 'current') {
        // 当前文件模式：替换同名文件或添加新文件
        setExtractedFiles(prev => {
          const existingIndex = prev.findIndex(file => file.name === result.files[0]?.name)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = result.files[0]
            return updated
          } else {
            return [...prev, ...result.files]
          }
        })
      } else {
        // 所有文件模式：替换整个列表
        setExtractedFiles(result.files)
      }
    }
  }

  // 提取当前文件
  const handleExtractCurrent = async () => {
    setIsExtracting(true)
    try {
      const result = await extractContent('current')
      handleContentExtracted(result)
    } catch (error) {
      console.error('Failed to extract current file:', error)
    } finally {
      setIsExtracting(false)
    }
  }

  // 提取所有文件
  const handleExtractAll = async () => {
    setIsExtracting(true)
    try {
      const result = await extractContent('all')
      handleContentExtracted(result)
    } catch (error) {
      console.error('Failed to extract all files:', error)
    } finally {
      setIsExtracting(false)
    }
  }

  // 复制文件内容到剪贴板
  const handleCopyFile = async (file: FileInfo) => {
    try {
      await navigator.clipboard.writeText(file.content)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  // 删除文件
  const handleDeleteFile = (fileName: string) => {
    setExtractedFiles(prev => prev.filter(file => file.name !== fileName))
  }

  // 清空所有文件
  const handleClearAllFiles = () => {
    setExtractedFiles([])
  }

  return {
    isExtracting,
    extractedFiles,
    handleExtractCurrent,
    handleExtractAll,
    handleCopyFile,
    handleDeleteFile,
    handleClearAllFiles
  }
}
