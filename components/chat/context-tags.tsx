import React from "react"
import { Tag, TagList } from "~components/ui/tag"

interface ContextTagsProps {
  selectedFiles: Set<string>
  selectedText?: {
    text: string
    fileName: string
    hasSelection: boolean
  }
  onRemoveFile?: (fileName: string) => void
  onRemoveSelectedText?: () => void
  showFileNames?: boolean
  showSelectedText?: boolean
  className?: string
}

/**
 * 上下文标签组件 - 显示文件和选中内容标签
 */
export const ContextTags = ({
  selectedFiles,
  selectedText,
  onRemoveFile,
  onRemoveSelectedText,
  showFileNames = true,
  showSelectedText = true,
  className
}: ContextTagsProps) => {
  const selectedFileNames = Array.from(selectedFiles)
  const hasSelection = selectedText?.hasSelection || false

  // 如果没有任何标签要显示，返回 null
  if ((!showFileNames || selectedFileNames.length === 0) && 
      (!showSelectedText || !hasSelection)) {
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
          >
            📄 {fileName}
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
