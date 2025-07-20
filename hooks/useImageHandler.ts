import { useState } from "react"
import { ImageUtils, type ImageInfo } from "~lib/image-utils"
import { useToast } from "~components/ui/sonner"

interface PreviewModal {
  isOpen: boolean
  fileName: string
  imageUrls?: string[]
  isLoading: boolean
  error?: string
}

export const useImageHandler = () => {
  const [uploadedImages, setUploadedImages] = useState<ImageInfo[]>([])
  const [previewModal, setPreviewModal] = useState<PreviewModal>({
    isOpen: false,
    fileName: '',
    isLoading: false
  })

  const { success, error } = useToast()

  // 处理图片点击预览
  const handleImageClick = (imageInfo: ImageInfo) => {
    setPreviewModal({
      isOpen: true,
      fileName: imageInfo.name,
      imageUrls: [imageInfo.dataUrl],
      isLoading: false
    })
  }

  // 处理图片粘贴
  const handlePaste = async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData
    if (!clipboardData) return

    try {
      const images = await ImageUtils.extractImagesFromClipboard(clipboardData)
      if (images.length > 0) {
        setUploadedImages(prev => [...prev, ...images])
        success(`已添加 ${images.length} 张图片`, { title: '图片上传成功' })
      }
    } catch (err) {
      console.error('处理粘贴图片失败:', err)
      error('处理粘贴图片失败', { title: '上传失败' })
    }
  }

  // 处理图片拖拽
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const dataTransfer = e.dataTransfer
    if (!dataTransfer) return

    try {
      const images = await ImageUtils.extractImagesFromDrop(dataTransfer)
      if (images.length > 0) {
        setUploadedImages(prev => [...prev, ...images])
        success(`已添加 ${images.length} 张图片`, { title: '图片上传成功' })
      }
    } catch (err) {
      console.error('处理拖拽图片失败:', err)
      error('处理拖拽图片失败', { title: '上传失败' })
    }
  }

  // 删除图片
  const handleRemoveImage = (imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId))
  }

  // 关闭预览模态框
  const handleClosePreview = () => {
    setPreviewModal({
      isOpen: false,
      fileName: '',
      isLoading: false
    })
  }

  // 清空所有图片
  const clearImages = () => {
    setUploadedImages([])
  }

  // 处理拖拽悬停
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  return {
    uploadedImages,
    previewModal,
    handleImageClick,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleRemoveImage,
    handleClosePreview,
    clearImages,
    setUploadedImages
  }
}
