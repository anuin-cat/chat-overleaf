import React, { useEffect, useRef, useState } from "react"
import { X, Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react"
import { cn } from "~lib/utils"

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  fileName: string
  imageUrls?: string[]
  isLoading?: boolean
  error?: string
}

/**
 * 文件预览模态框组件
 * 显示文件转换后的图片预览
 */
export const FilePreviewModal = ({
  isOpen,
  onClose,
  fileName,
  imageUrls = [],
  isLoading = false,
  error
}: FilePreviewModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [zoomLevel, setZoomLevel] = useState(1.0) // 默认缩放到 100%，让图片适合窗口
  const imageContainerRef = useRef<HTMLDivElement>(null)

  // 只处理 ESC 键关闭，移除点击外部关闭功能
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      // 防止背景滚动
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // 处理鼠标滚轮缩放
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (imageContainerRef.current && imageContainerRef.current.contains(event.target as Node)) {
        event.preventDefault()
        const delta = event.deltaY > 0 ? -0.1 : 0.1
        setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)))
      }
    }

    if (isOpen) {
      document.addEventListener('wheel', handleWheel, { passive: false })
    }

    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [isOpen])

  // 重置状态当模态框关闭时
  useEffect(() => {
    if (!isOpen) {
      setCurrentImageIndex(0)
      setZoomLevel(1) // 重置到默认的 100%
    }
  }, [isOpen])

  // 导航函数
  const goToPrevious = () => {
    setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : imageUrls.length - 1))
  }

  const goToNext = () => {
    setCurrentImageIndex(prev => (prev < imageUrls.length - 1 ? prev + 1 : 0))
  }

  const zoomIn = () => {
    setZoomLevel(prev => Math.min(3, prev + 0.2))
  }

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(0.5, prev - 0.2))
  }

  const resetZoom = () => {
    setZoomLevel(1) // 重置到默认的 100%
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 - 移除点击事件 */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* 模态框内容 */}
      <div
        ref={modalRef}
        className={cn(
          "relative bg-white rounded-lg shadow-xl max-w-5xl max-h-[90vh] w-full mx-4",
          "flex flex-col overflow-hidden"
        )}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-medium text-gray-900">文件预览</span>
            <span className="text-sm text-gray-500">({fileName})</span>
            {imageUrls.length > 1 && (
              <span className="text-sm text-blue-600">
                {currentImageIndex + 1} / {imageUrls.length}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {/* 缩放控制 */}
            {imageUrls.length > 0 && !isLoading && !error && (
              <>
                <button
                  onClick={zoomOut}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  title="缩小"
                >
                  <ZoomOut className="h-4 w-4 text-gray-500" />
                </button>
                <span className="text-xs text-gray-500 min-w-[3rem] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                  title="放大"
                >
                  <ZoomIn className="h-4 w-4 text-gray-500" />
                </button>
                <button
                  onClick={resetZoom}
                  className="px-2 py-1 text-xs hover:bg-gray-100 rounded-md transition-colors"
                  title="重置缩放"
                >
                  重置
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              title="关闭预览"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 relative overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">正在生成图片预览...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-sm text-red-600 mb-2">预览生成失败</p>
                <p className="text-xs text-gray-500">{error}</p>
              </div>
            </div>
          )}

          {imageUrls.length > 0 && !isLoading && !error && (
            <div className="relative h-full">
              {/* 图片容器 */}
              <div
                ref={imageContainerRef}
                className="flex items-center justify-center h-full p-4 overflow-auto bg-gray-50"
              >
                <img
                  src={imageUrls[currentImageIndex]}
                  alt={`${fileName} 预览 ${currentImageIndex + 1}`}
                  className="rounded-md shadow-sm border border-gray-200 transition-transform duration-200 bg-white"
                  style={{
                    transform: `scale(${zoomLevel})`,
                    transformOrigin: 'center center',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    minWidth: '200px', // 设置最小宽度
                    minHeight: '200px' // 设置最小高度
                  }}
                />
              </div>

              {/* 导航按钮 */}
              {imageUrls.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    title="上一张"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                    title="下一张"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              {/* 图片指示器 */}
              {imageUrls.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {imageUrls.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        index === currentImageIndex
                          ? "bg-blue-500"
                          : "bg-white/50 hover:bg-white/70"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部信息 */}
        {imageUrls.length > 0 && !isLoading && !error && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              💡 这是文件内容转换为 {imageUrls.length} 张图片后的预览，用于优化 AI 模型的 token 使用
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
