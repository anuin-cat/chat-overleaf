import { Button } from "~components/ui/button"
import { Files } from "lucide-react"
import { useFileExtraction } from "./use-file-extraction"
import { AutoSizedFileList } from "./auto-sized-file-list"

export interface FileExtractionPanelProps {
  onFileSelectionChange?: (selectedFiles: Set<string>) => void
  selectedFiles?: Set<string>
  className?: string
}

/**
 * 文件提取面板组件
 * 纯UI组件，通过props接收配置，通过hook获取状态和操作
 */
export const FileExtractionPanel = ({
  onFileSelectionChange,
  selectedFiles: externalSelectedFiles,
}: FileExtractionPanelProps) => {
  const {
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
    selectFile
  } = useFileExtraction(externalSelectedFiles, onFileSelectionChange)

  return (
    <div className="bg-blue-50 border-b border-blue-200">
      {/* 已提取文件列表 - 使用自动调整高度的组件 */}
      {extractedFiles.length > 0 ? (
        <AutoSizedFileList
          extractedFiles={extractedFiles}
          selectedFiles={selectedFiles}
          isExtracting={isExtracting}
          showFileList={showFileList}
          onExtractAll={extractAll}
          onCopyFile={copyFile}
          onDeleteFile={deleteFile}
          onClearAllFiles={clearAllFiles}
          onSelectFile={selectFile}
        />
      ) : (
        /* 空状态 - 显示获取所有文件按钮 */
        <div className="text-center py-4">
          <p className="text-xs text-gray-500 mb-2">暂无提取的文件</p>
          <Button
            onClick={() => extractAll()}
            disabled={isExtracting}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <Files className="h-3 w-3 mr-1" />
            {isExtracting ? '提取中...' : '获取所有文件'}
          </Button>
        </div>
      )}
    </div>
  )
}
