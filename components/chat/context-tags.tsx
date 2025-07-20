import { Tag, TagList } from "~components/ui/tag"
import type { ImageInfo } from "~lib/image-utils"

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
  className?: string
}

/**
 * 消息上下文标签组件 - 用于消息气泡中显示选中内容标签
 */
export const MessageContextTags = ({
  selectedText,
  className
}: MessageContextTagsProps) => {
  if (!selectedText) {
    return null
  }

  return (
    <Tag
      variant="selection"
      className={className}
      removable={false}
    >
      ✂️ {selectedText.length} 字符
    </Tag>
  )
}
