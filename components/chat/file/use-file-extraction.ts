import { useState } from "react"
import { useToast } from "~components/ui/sonner"
import { FileExtractionService, type FileInfo, type ExtractionResult } from "./file-extraction-service"

/**
 * 文件提取Hook - 管理文件提取状态和操作
 * 不依赖UI组件，可以独立测试
 */
export const useFileExtraction = () => {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedFiles, setExtractedFiles] = useState<FileInfo[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showFileList, setShowFileList] = useState(true)

  const { success, error, info } = useToast()

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
  const extractCurrent = async (onFileSelected?: (fileName: string) => void) => {
    setIsExtracting(true)
    try {
      const result = await FileExtractionService.extractContent('current')
      handleContentExtracted(result, onFileSelected)
    } catch (error) {
      console.error('Failed to extract current file:', error)
    } finally {
      setIsExtracting(false)
    }
  }

  // 提取所有文件
  const extractAll = async () => {
    setIsExtracting(true)
    try {
      const result = await FileExtractionService.extractContent('all')
      handleContentExtracted(result) // 不传递 onFileSelected，所以不会自动选中
    } catch (error) {
      console.error('Failed to extract all files:', error)
    } finally {
      setIsExtracting(false)
    }
  }

  // 复制文件内容到剪贴板
  const copyFile = async (file: FileInfo) => {
    const success_result = await FileExtractionService.copyFileToClipboard(file)
    if (success_result) {
      success(`已复制 ${file.name} 到剪贴板`, { title: '复制成功' })
    } else {
      error('复制到剪贴板失败', { title: '复制失败' })
    }
  }

  // 删除文件
  const deleteFile = (fileName: string) => {
    setExtractedFiles(prev => prev.filter(file => file.name !== fileName))
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      newSet.delete(fileName)
      return newSet
    })
    info(`已删除文件: ${fileName}`, { title: '删除文件' })
  }

  // 清空所有文件
  const clearAllFiles = () => {
    setExtractedFiles([])
    setSelectedFiles(new Set())
    info('已清空所有文件', { title: '清空完成' })
  }

  // 处理文件选择
  const selectFile = (fileName: string, selected: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(fileName)
      } else {
        newSet.delete(fileName)
      }
      return newSet
    })
  }

  // 自动选中文件
  const autoSelectFile = (fileName: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      newSet.add(fileName)
      return newSet
    })
  }

  // 切换文件列表显示状态
  const toggleFileList = () => {
    setShowFileList(prev => !prev)
  }

  return {
    // 状态
    isExtracting,
    extractedFiles,
    selectedFiles,
    showFileList,
    
    // 操作
    extractCurrent,
    extractAll,
    copyFile,
    deleteFile,
    clearAllFiles,
    selectFile,
    autoSelectFile,
    toggleFileList
  }
}
