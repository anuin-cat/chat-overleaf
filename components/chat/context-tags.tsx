import { Tag, TagList } from "~components/ui/tag"
import type { ImageInfo } from "~lib/image-utils"
import { Button } from "../ui/button"

interface ContextTagsProps {
  selectedFiles: Set<string>
  selectedText?: {
    text: string
    fileName: string
    hasSelection: boolean
  }
  uploadedImages?: ImageInfo[]
  onRemoveFile?: (fileName: string) => void
  onRemoveSelectedText?: () => void
  onFileClick?: (fileName: string) => void
  onImageClick?: (imageInfo: ImageInfo) => void
  onRemoveImage?: (imageId: string) => void
  onClearAllFiles?: () => void
  showFileNames?: boolean
  showSelectedText?: boolean
  showImages?: boolean
  className?: string
}

/**
 * 上下文标签组件 - 显示文件、图片和选中内容标签
 */
export const ContextTags = ({
  selectedFiles,
  selectedText,
  uploadedImages = [],
  onRemoveFile,
  onRemoveSelectedText,
  onFileClick,
  onImageClick,
  onRemoveImage,
  onClearAllFiles,
  showFileNames = true,
  showSelectedText = true,
  showImages = true,
  className
}: ContextTagsProps) => {
  const selectedFileNames = Array.from(selectedFiles)
  const hasSelection = selectedText?.hasSelection || false

  // 如果没有任何标签要显示，返回 null
  if ((!showFileNames || selectedFileNames.length === 0) &&
      (!showSelectedText || !hasSelection) &&
      (!showImages || uploadedImages.length === 0)) {
    return null
  }

  return (
    <div className={className}>
      <TagList>
        {/* 清空文件按钮 - 当有文件时显示在最左侧 */}
        {showFileNames && selectedFileNames.length > 0 && onClearAllFiles && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAllFiles}
            className="h-6 px-2 text-xs text-red-600 bg-red-50 hover:bg-red-100 "
            title="清空所有文件"
          >
            清空
          </Button>
        )}
        
        {/* 文件标签 */}
        {showFileNames && selectedFileNames.map((fileName) => (
          <Tag
            key={fileName}
            variant="file"
            onRemove={onRemoveFile ? () => onRemoveFile(fileName) : undefined}
            removable={!!onRemoveFile}
            clickable={false}
          >
            📄 {fileName}
          </Tag>
        ))}

        {/* 图片标签 */}
        {showImages && uploadedImages.map((imageInfo) => (
          <Tag
            key={imageInfo.id}
            variant="image"
            onRemove={onRemoveImage ? () => onRemoveImage(imageInfo.id) : undefined}
            onClick={onImageClick ? () => onImageClick(imageInfo) : undefined}
            removable={!!onRemoveImage}
            clickable={!!onImageClick}
          >
            🖼️ {imageInfo.name}
          </Tag>
        ))}

        {/* 选中内容标签 */}
        {showSelectedText && hasSelection && (
          <Tag
            variant="selection"
            onRemove={onRemoveSelectedText}
            removable={!!onRemoveSelectedText}
          >
            ✂️ 选中内容 ({selectedText?.text.length || 0} 字符)
          </Tag>
        )}
      </TagList>
    </div>
  )
}

interface MessageContextTagsProps {
  selectedText?: string
  images?: import("~lib/image-utils").ImageInfo[]
  className?: string
}

/**
 * 消息上下文标签组件 - 用于消息气泡中显示选中内容和图片标签
 */
export const MessageContextTags = ({
  selectedText,
  images,
  className
}: MessageContextTagsProps) => {
  const hasSelectedText = selectedText && selectedText.length > 0
  const hasImages = images && images.length > 0

  if (!hasSelectedText && !hasImages) {
    return null
  }

  return (
    <div className="flex items-center gap-1">
      {hasSelectedText && (
        <Tag
          variant="selection"
          className={className}
          removable={false}
        >
          ✂️ {selectedText.length} 字符
        </Tag>
      )}
      {hasImages && (
        <Tag
          variant="selection"
          className={className}
          removable={false}
        >
          🖼️ {images.length} 张图片
        </Tag>
      )}
    </div>
  )
}
