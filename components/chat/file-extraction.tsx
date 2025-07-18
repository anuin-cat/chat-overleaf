import { useState } from "react"
import { useToast } from "~components/ui/sonner"

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

  // 直接在 hook 内部使用 toast
  const { success, error, info } = useToast()

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
  const handleContentExtracted = (result: ExtractionResult, onFileSelected?: (fileName: string) => void) => {
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
        // 自动选中当前文件
        if (result.files[0] && onFileSelected) {
          onFileSelected(result.files[0].name)
        }
        success(`已提取文件: ${result.files[0]?.name}`, { title: '提取成功' })
      } else {
        // 所有文件模式：替换整个列表，不自动选中
        setExtractedFiles(result.files)
        success(`已提取 ${result.files.length} 个文件`, { title: '提取成功' })
      }
    } else {
      error(result.error || '提取失败', { title: '提取失败' })
    }
  }

  // 提取当前文件
  const handleExtractCurrent = async (onFileSelected?: (fileName: string) => void) => {
    setIsExtracting(true)
    try {
      const result = await extractContent('current')
      handleContentExtracted(result, onFileSelected)
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
      handleContentExtracted(result) // 不传递 onFileSelected，所以不会自动选中
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
      success(`已复制 ${file.name} 到剪贴板`, { title: '复制成功' })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      error('复制到剪贴板失败', { title: '复制失败' })
    }
  }

  // 删除文件
  const handleDeleteFile = (fileName: string) => {
    setExtractedFiles(prev => prev.filter(file => file.name !== fileName))
    info(`已删除文件: ${fileName}`, { title: '删除文件' })
  }

  // 清空所有文件
  const handleClearAllFiles = () => {
    setExtractedFiles([])
    info('已清空所有文件', { title: '清空完成' })
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
