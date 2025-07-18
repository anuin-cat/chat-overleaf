import { useEffect } from "react"
import { Button } from "~components/ui/button"
import { Checkbox } from "~components/ui/checkbox"
import { FileText, Files, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { useFileExtraction } from "./use-file-extraction"

export interface FileExtractionPanelProps {
  onFileSelectionChange?: (selectedFiles: Set<string>) => void
  className?: string
}

/**
 * 文件提取面板组件
 * 纯UI组件，通过props接收配置，通过hook获取状态和操作
 */
export const FileExtractionPanel = ({ 
  onFileSelectionChange, 
  className = "" 
}: FileExtractionPanelProps) => {
  const {
    // 状态
    isExtracting,
    extractedFiles,
    selectedFiles,
    showFileList,
    
    // 操作
    extractCurrent,
    extractAll,
    copyFile,
    deleteFile,
    clearAllFiles,
    selectFile,
    autoSelectFile,
    toggleFileList
  } = useFileExtraction()

  // 当选中文件发生变化时通知父组件
  useEffect(() => {
    onFileSelectionChange?.(selectedFiles)
  }, [selectedFiles, onFileSelectionChange])

  return (
    <div className={className}>
      {/* 文件提取按钮 */}
      <div className="flex gap-2 mb-3">
        <Button
          onClick={() => extractCurrent(autoSelectFile)}
          disabled={isExtracting}
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
        >
          <FileText className="h-3 w-3 mr-1" />
          {isExtracting ? '提取中...' : '当前文件'}
        </Button>

        <Button
          onClick={() => extractAll()}
          disabled={isExtracting}
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
        >
          <Files className="h-3 w-3 mr-1" />
          {isExtracting ? '提取中...' : '所有文件'}
        </Button>
      </div>

      {/* 已提取文件列表 */}
      {extractedFiles.length > 0 && (
        <div className="border rounded-lg">
          {/* 文件列表头部 */}
          <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFileList}
                className="h-6 w-6 p-0"
              >
                {showFileList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
              <span className="text-xs font-medium text-gray-600">
                已提取文件 ({extractedFiles.length})
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFiles}
              className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
            >
              清空
            </Button>
          </div>

          {/* 文件列表内容 */}
          {showFileList && (
            <div className="max-h-32 overflow-y-auto">
              {extractedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <Checkbox
                      checked={selectedFiles.has(file.name)}
                      onCheckedChange={(checked) => selectFile(file.name, checked as boolean)}
                      className="flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.length} 字符
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyFile(file)}
                      className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                      title="复制内容"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFile(file.name)}
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                      title="删除文件"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
