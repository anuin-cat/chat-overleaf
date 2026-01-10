import { useMemo, useState } from "react"
import { Tag, TagList } from "~components/ui/tag"
import type { ImageInfo } from "~lib/image-utils"
import { Folder } from "lucide-react"
import {
  buildFileTree,
  analyzeMergedSelection,
  type MergedSelection
} from "./file/file-tree-utils"
import type { FileInfo } from "./file/file-extraction-service"

interface ContextTagsProps {
  selectedFiles: Set<string>
  extractedFiles?: FileInfo[]
  fileTokenEstimate?: number
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
 * 文件夹悬浮提示组件
 */
const FolderTooltip = ({ files }: { files: string[] }) => {
  return (
    <div className="absolute bottom-full left-0 mb-1 z-50 bg-gray-900 text-white text-[10px] rounded-md px-2 py-1.5 max-w-[300px] max-h-[200px] overflow-y-auto shadow-lg">
      <div className="font-medium mb-1 text-gray-300">包含文件 ({files.length}):</div>
      {files.map((file, index) => (
        <div key={index} className="truncate text-gray-100">
          {file}
        </div>
      ))}
    </div>
  )
}

/**
 * 上下文标签组件 - 显示文件、图片和选中内容标签
 */
export const ContextTags = ({
  selectedFiles,
  extractedFiles = [],
  fileTokenEstimate,
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
  const [hoveredFolder, setHoveredFolder] = useState<string | null>(null)
  
  const hasSelection = selectedText?.hasSelection || false
  const getBaseName = (fileName: string) => fileName.split(/[\/]/).pop() || fileName

  // 分析选中文件，构建合并后的显示结构
  const mergedSelection: MergedSelection = useMemo(() => {
    if (selectedFiles.size === 0 || extractedFiles.length === 0) {
      return { folders: [], files: Array.from(selectedFiles) }
    }
    
    const tree = buildFileTree(extractedFiles)
    return analyzeMergedSelection(tree, selectedFiles, extractedFiles)
  }, [selectedFiles, extractedFiles])

  // 处理移除文件夹（移除其下所有文件）
  const handleRemoveFolder = (folderFiles: string[]) => {
    if (!onRemoveFile) return
    for (const file of folderFiles) {
      onRemoveFile(file)
    }
  }

  // 计算显示名称（处理重名）
  const getDisplayInfo = (files: string[]) => {
    const baseNameTotals = files.reduce<Map<string, number>>((acc, fileName) => {
      const baseName = getBaseName(fileName)
      acc.set(baseName, (acc.get(baseName) || 0) + 1)
      return acc
    }, new Map())
    const baseNameIndexes = new Map<string, number>()

    return files.map(fileName => {
      const baseName = getBaseName(fileName)
      const nextIndex = (baseNameIndexes.get(baseName) || 0) + 1
      baseNameIndexes.set(baseName, nextIndex)
      const needsIndex = (baseNameTotals.get(baseName) || 0) > 1
      const displayName = needsIndex ? `${baseName} ${nextIndex}` : baseName
      return { fileName, displayName }
    })
  }

  const independentFilesDisplay = getDisplayInfo(mergedSelection.files)

  // 如果没有任何标签要显示，返回 null
  if ((!showFileNames || selectedFiles.size === 0) &&
      (!showSelectedText || !hasSelection) &&
      (!showImages || uploadedImages.length === 0)) {
    return null
  }

  return (
    <div className={className}>
      <TagList>
        {/* 清空文件按钮 - 当有文件时显示在最左侧 */}
        {showFileNames && selectedFiles.size > 0 && onClearAllFiles && (
          <button
            onClick={onClearAllFiles}
            className="inline-flex items-center px-1.5 py-0 text-[11px] rounded-full font-medium leading-5 text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
            title="清空所有文件"
          >
            清空
          </button>
        )}
        
        {/* Token 估算显示 */}
        {showFileNames && selectedFiles.size > 0 && fileTokenEstimate && fileTokenEstimate > 0 && (
          <Tag
            variant="default"
            removable={false}
          >
            约 {fileTokenEstimate} token
          </Tag>
        )}
        
        {/* 文件夹标签（合并显示） */}
        {showFileNames && mergedSelection.folders.map((folder) => (
          <div
            key={folder.path}
            className="relative"
            onMouseEnter={() => setHoveredFolder(folder.path)}
            onMouseLeave={() => setHoveredFolder(null)}
          >
            <Tag
              variant="file"
              onRemove={onRemoveFile ? () => handleRemoveFolder(folder.files) : undefined}
              removable={!!onRemoveFile}
              clickable={false}
              title={`${folder.path} (${folder.files.length} 个文件)`}
              className="bg-amber-50 text-amber-700 border-amber-200"
            >
              {/* <span className="inline-flex items-center"> */}
                <Folder className="h-3 w-3 mr-0.5 text-amber-500 flex-shrink-0" />
                <span>{folder.name}</span>
                {/* <span className="ml-1 text-[10px] text-amber-500">({folder.files.length})</span> */}
              {/* </span> */}
            </Tag>
            {hoveredFolder === folder.path && (
              <FolderTooltip files={folder.files} />
            )}
          </div>
        ))}

        {/* 独立文件标签（未被任何文件夹完全覆盖） */}
        {showFileNames && independentFilesDisplay.map(({ fileName, displayName }) => (
          <Tag
            key={fileName}
            variant="file"
            onRemove={onRemoveFile ? () => onRemoveFile(fileName) : undefined}
            removable={!!onRemoveFile}
            clickable={false}
            title={fileName}
          >
            📄 {displayName}
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
