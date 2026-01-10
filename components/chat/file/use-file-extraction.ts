import { useState, useEffect, useCallback, useRef } from "react"
import { useToast } from "~components/ui/sonner"
import { FileExtractionService, type FileInfo, type ExtractionResult } from "./file-extraction-service"
import { storageUtils } from "~utils/storage"

/**
 * 文件提取Hook - 管理文件提取状态和操作
 * 不依赖UI组件，可以独立测试
 */
export const useFileExtraction = (
  externalSelectedFiles?: Set<string>,
  onSelectedFilesChange?: (selectedFiles: Set<string>) => void
) => {
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedFiles, setExtractedFiles] = useState<FileInfo[]>([])
  const [internalSelectedFiles, setInternalSelectedFiles] = useState<Set<string>>(new Set())
  const [showFileList, setShowFileList] = useState(true)
  const [isCacheReady, setIsCacheReady] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const pendingCacheRef = useRef<{
    files: FileInfo[]
    selectedFileNames: string[]
    updatedAt: string
  } | null>(null)
  const lastLoggedFileNamesRef = useRef<string>("")

  const cacheKey = projectId ? `overleaf_file_cache:${projectId}` : null


  useEffect(() => {
    if (typeof window === "undefined") return

    const resolveFromUrl = () => {
      try {
        const url = new URL(window.location.href)
        const parts = url.pathname.split("/").filter(Boolean)
        const projectIndex = parts.indexOf("project")
        if (projectIndex >= 0 && parts[projectIndex + 1]) {
          return parts[projectIndex + 1]
        }
        return null
      } catch {
        return null
      }
    }

    const resolveFromDom = () => {
      const selectors = [
        'a[href*="/project/"]',
        'a[href*="/download/project/"]'
      ]
      const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selectors.join(",")))
      for (const link of links) {
        const href = link.getAttribute("href") || ""
        const match =
          href.match(/\/project\/([a-f0-9]{12,})/i) ||
          href.match(/\/download\/project\/([a-f0-9]{12,})/i)
        if (match?.[1]) return match[1]
      }
      return null
    }

    const tryResolve = () => {
      const fromUrl = resolveFromUrl()
      if (fromUrl) return fromUrl
      return resolveFromDom()
    }

    const resolved = tryResolve()
    if (resolved) {
      setProjectId(resolved)
      return
    }

    let attempts = 0
    const maxAttempts = 20
    const interval = 500

    const observer = new MutationObserver(() => {
      const id = tryResolve()
      if (id) {
        setProjectId(id)
        observer.disconnect()
      }
    })

    observer.observe(document.documentElement, { childList: true, subtree: true })

    const timer = window.setInterval(() => {
      attempts += 1
      const id = tryResolve()
      if (id) {
        setProjectId(id)
        observer.disconnect()
        window.clearInterval(timer)
        return
      }
      if (attempts >= maxAttempts) {
        observer.disconnect()
        window.clearInterval(timer)
      }
    }, interval)

    return () => {
      observer.disconnect()
      window.clearInterval(timer)
    }
  }, [])

  // 使用外部状态或内部状态
  const selectedFiles = externalSelectedFiles || internalSelectedFiles

  // 更新选中文件的函数
  const updateSelectedFiles = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    if (onSelectedFilesChange) {
      // 使用外部状态管理
      const newSet = updater(selectedFiles)
      onSelectedFilesChange(newSet)
    } else {
      // 使用内部状态管理
      setInternalSelectedFiles(updater)
    }
  }, [selectedFiles, onSelectedFilesChange])

  const { success, error, info } = useToast()

  // 启动时从缓存恢复文件列表（按项目 ID）
  useEffect(() => {
    let isMounted = true
    if (!cacheKey) return
    setIsCacheReady(false)
    pendingCacheRef.current = null

    const loadCache = async () => {
      const cached = await storageUtils.get<{
        files: FileInfo[]
        selectedFileNames: string[]
        updatedAt: string
      }>(cacheKey)

      if (!isMounted) return

      if (cached) {
        if (Array.isArray(cached.files)) {
          setExtractedFiles(cached.files)
          const cachedNames = cached.files.map(file => file.name).sort().join("|")
          lastLoggedFileNamesRef.current = cachedNames
          console.log("[file-cache] loaded list:", cached.files.map(file => file.name))
        }

        if (Array.isArray(cached.selectedFileNames) && cached.selectedFileNames.length > 0) {
          const restored = new Set(cached.selectedFileNames)
          if (onSelectedFilesChange) {
            onSelectedFilesChange(restored)
          } else {
            setInternalSelectedFiles(restored)
          }
        }
      }

      setIsCacheReady(true)
    }

    loadCache()

    return () => {
      isMounted = false
    }
  }, [cacheKey, onSelectedFilesChange])

  useEffect(() => {
    if (!cacheKey || !isCacheReady) return
    if (pendingCacheRef.current) {
      storageUtils.set(cacheKey, pendingCacheRef.current)
      pendingCacheRef.current = null
    }
  }, [cacheKey, isCacheReady])

  // 文件列表或选择变化时写入缓存
  useEffect(() => {
    if (!cacheKey) return
    const payload = {
      files: extractedFiles,
      selectedFileNames: Array.from(selectedFiles),
      updatedAt: new Date().toISOString()
    }
    if (isCacheReady) {
      storageUtils.set(cacheKey, payload)
    } else {
      pendingCacheRef.current = payload
    }
    const currentNames = extractedFiles.map(file => file.name).sort().join("|")
    if (currentNames !== lastLoggedFileNamesRef.current) {
      lastLoggedFileNamesRef.current = currentNames
      console.log("[file-cache] saving list:", extractedFiles.map(file => file.name))
    }
  }, [cacheKey, extractedFiles, selectedFiles, isCacheReady])

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
    updateSelectedFiles(prev => {
      const newSet = new Set(prev)
      newSet.delete(fileName)
      return newSet
    })
    info(`已删除文件: ${fileName}`, { title: '删除文件' })
  }

  // 清空所有文件
  const clearAllFiles = () => {
    setExtractedFiles([])
    if (onSelectedFilesChange) {
      onSelectedFilesChange(new Set())
    } else {
      setInternalSelectedFiles(new Set())
    }
    info('已清空所有文件', { title: '清空完成' })
  }

  // 处理文件选择
  const selectFile = (fileName: string, selected: boolean) => {
    updateSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(fileName)
      } else {
        newSet.delete(fileName)
      }
      return newSet
    })
  }

  // 全选所有文件
  const selectAllFiles = () => {
    const allFileNames = extractedFiles.map(file => file.name)
    updateSelectedFiles(() => new Set(allFileNames))
    info(`已全选 ${allFileNames.length} 个文件`, { title: '全选完成' })
  }

  // 自动选中文件
  const autoSelectFile = (fileName: string) => {
    updateSelectedFiles(prev => {
      const newSet = new Set(prev)
      newSet.add(fileName)
      return newSet
    })
  }

  // 切换文件列表显示状态
  const toggleFileList = () => {
    setShowFileList(prev => !prev)
  }

  // 监听编辑器内容变化
  useEffect(() => {
    const handleContentChange = (event: MessageEvent) => {
      if (event.data.type === 'OVERLEAF_CONTENT_CHANGED') {
        const { fileName, content, length } = event.data.data

        // 自动更新已提取文件列表中的对应文件
        setExtractedFiles(prev => {
          const existingIndex = prev.findIndex(file => file.name === fileName)
          const newFile: FileInfo = { name: fileName, content, length }

          if (existingIndex >= 0) {
            // 更新现有文件
            const updated = [...prev]
            updated[existingIndex] = newFile
            return updated
          } else {
            // 添加新文件
            return [...prev, newFile]
          }
        })

        // 如果文件不在选中列表中，自动选中它
        updateSelectedFiles(prev => {
          if (!prev.has(fileName)) {
            const newSet = new Set(prev)
            newSet.add(fileName)
            return newSet
          }
          return prev
        })
      }
    }

    window.addEventListener('message', handleContentChange)
    return () => window.removeEventListener('message', handleContentChange)
  }, [updateSelectedFiles])

  return {
    // 状态
    isExtracting,
    extractedFiles,
    selectedFiles,
    showFileList,

    // 操作
    extractAll,
    copyFile,
    deleteFile,
    clearAllFiles,
    selectFile,
    selectAllFiles,
    autoSelectFile,
    toggleFileList
  }
}
