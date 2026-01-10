import { Button } from "~components/ui/button"
import { Files } from "lucide-react"
import { AutoSizedFileList } from "./auto-sized-file-list"
import type { FileInfo } from "./file-extraction-service"

export interface FileExtractionPanelProps {
  extractedFiles: FileInfo[]
  selectedFiles: Set<string>
  isExtracting: boolean
  showFileList: boolean
  onExtractAll: () => void
  onCopyFile: (file: FileInfo) => void
  onDeleteFile: (fileName: string) => void
  onClearAllFiles: () => void
  onSelectFile: (fileName: string, selected: boolean) => void
  onSelectAllFiles: () => void
  className?: string
}

/**
 * 文件提取面板组件
 * 纯UI组件，通过props接收配置，通过hook获取状态和操作
 */
export const FileExtractionPanel = ({
  extractedFiles,
  selectedFiles,
  isExtracting,
  showFileList,
  onExtractAll,
  onCopyFile,
  onDeleteFile,
  onClearAllFiles,
  onSelectFile,
  onSelectAllFiles,
}: FileExtractionPanelProps) => {
  return (
    <div className="bg-blue-50 border-b border-blue-200">
      {/* 已提取文件列表 - 使用自动调整高度的组件 */}
      {extractedFiles.length > 0 ? (
        <AutoSizedFileList
          extractedFiles={extractedFiles}
          selectedFiles={selectedFiles}
          isExtracting={isExtracting}
          showFileList={showFileList}
          onExtractAll={onExtractAll}
          onCopyFile={onCopyFile}
          onDeleteFile={onDeleteFile}
          onClearAllFiles={onClearAllFiles}
          onSelectFile={onSelectFile}
          onSelectAllFiles={onSelectAllFiles}
        />
      ) : (
        /* 空状态 - 显示获取所有文件按钮 */
        <div className="text-center py-4">
          <p className="text-xs text-gray-500 mb-2">暂无提取的文件</p>
          <Button
            onClick={() => onExtractAll()}
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
