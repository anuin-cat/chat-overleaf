/**
 * 图片处理工具类
 * 用于处理用户上传的图片，包括压缩和格式转换
 */

export interface ImageInfo {
  id: string
  name: string
  dataUrl: string
  originalSize: { width: number; height: number }
  compressedSize: { width: number; height: number }
  fileSize: number
}

export class ImageUtils {
  private static readonly MAX_SIZE = 1024
  private static readonly QUALITY = 0.8

  /**
   * 压缩图片到指定尺寸
   * @param file 图片文件
   * @param maxSize 最大尺寸（长边）
   * @param quality 压缩质量 (0-1)
   * @returns Promise<ImageInfo>
   */
  static async compressImage(
    file: File,
    maxSize: number = this.MAX_SIZE,
    quality: number = this.QUALITY
  ): Promise<ImageInfo> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('无法创建Canvas上下文'))
        return
      }

      img.onload = () => {
        const { width: originalWidth, height: originalHeight } = img
        
        // 计算压缩后的尺寸，保持长宽比
        let { width, height } = this.calculateCompressedSize(
          originalWidth,
          originalHeight,
          maxSize
        )

        // 设置canvas尺寸
        canvas.width = width
        canvas.height = height

        // 绘制压缩后的图片
        ctx.drawImage(img, 0, 0, width, height)

        // 转换为数据URL
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        
        // 计算文件大小（估算）
        const fileSize = Math.round((dataUrl.length * 3) / 4)

        const imageInfo: ImageInfo = {
          id: this.generateId(),
          name: file.name,
          dataUrl,
          originalSize: { width: originalWidth, height: originalHeight },
          compressedSize: { width, height },
          fileSize
        }

        resolve(imageInfo)
      }

      img.onerror = () => {
        reject(new Error('图片加载失败'))
      }

      // 读取文件
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string
        }
      }
      reader.onerror = () => {
        reject(new Error('文件读取失败'))
      }
      reader.readAsDataURL(file)
    })
  }

  /**
   * 从粘贴事件中提取图片
   * @param clipboardData 剪贴板数据
   * @returns Promise<ImageInfo[]>
   */
  static async extractImagesFromClipboard(
    clipboardData: DataTransfer
  ): Promise<ImageInfo[]> {
    const images: ImageInfo[] = []
    const files = Array.from(clipboardData.files)

    for (const file of files) {
      if (file.type.startsWith('image/')) {
        try {
          const imageInfo = await this.compressImage(file)
          images.push(imageInfo)
        } catch (error) {
          console.error('处理图片失败:', error)
        }
      }
    }

    return images
  }

  /**
   * 从拖拽事件中提取图片
   * @param dataTransfer 拖拽数据
   * @returns Promise<ImageInfo[]>
   */
  static async extractImagesFromDrop(
    dataTransfer: DataTransfer
  ): Promise<ImageInfo[]> {
    return this.extractImagesFromClipboard(dataTransfer)
  }

  /**
   * 从文件输入中提取图片
   * @param files 文件列表
   * @returns Promise<ImageInfo[]>
   */
  static async extractImagesFromFiles(
    files: FileList
  ): Promise<ImageInfo[]> {
    const images: ImageInfo[] = []
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      if (file.type.startsWith('image/')) {
        try {
          const imageInfo = await this.compressImage(file)
          images.push(imageInfo)
        } catch (error) {
          console.error('处理图片失败:', error)
        }
      }
    }

    return images
  }

  /**
   * 计算压缩后的尺寸
   * @param originalWidth 原始宽度
   * @param originalHeight 原始高度
   * @param maxSize 最大尺寸
   * @returns 压缩后的尺寸
   */
  private static calculateCompressedSize(
    originalWidth: number,
    originalHeight: number,
    maxSize: number
  ): { width: number; height: number } {
    // 如果图片尺寸已经小于等于最大尺寸，不需要压缩
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      return { width: originalWidth, height: originalHeight }
    }

    // 计算缩放比例
    const ratio = Math.min(maxSize / originalWidth, maxSize / originalHeight)
    
    return {
      width: Math.round(originalWidth * ratio),
      height: Math.round(originalHeight * ratio)
    }
  }

  /**
   * 生成唯一ID
   * @returns 唯一ID字符串
   */
  private static generateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 验证图片文件
   * @param file 文件
   * @returns 是否为有效的图片文件
   */
  static isValidImageFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    return validTypes.includes(file.type)
  }

  /**
   * 格式化文件大小
   * @param bytes 字节数
   * @returns 格式化后的文件大小字符串
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * 创建图片预览URL
   * @param imageInfo 图片信息
   * @returns 预览URL
   */
  static createPreviewUrl(imageInfo: ImageInfo): string {
    return imageInfo.dataUrl
  }
}
