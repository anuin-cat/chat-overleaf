import { Button } from "~components/ui/button"
import { Checkbox } from "~components/ui/checkbox"
import { Files, Copy, Trash2 } from "lucide-react"
import type { FileInfo } from "./file-extraction-service"

interface AutoSizedFileListProps {
  extractedFiles: FileInfo[]
  selectedFiles: Set<string>
  isExtracting: boolean
  showFileList: boolean
  onExtractAll: () => void
  onCopyFile: (file: FileInfo) => void
  onDeleteFile: (fileName: string) => void
  onClearAllFiles: () => void
  onSelectFile: (fileName: string, selected: boolean) => void
  className?: string
}

/**
 * 自动调整高度的文件列表组件
 */
export const AutoSizedFileList = ({
  extractedFiles,
  selectedFiles,
  isExtracting,
  showFileList,
  onExtractAll,
  onCopyFile,
  onDeleteFile,
  onClearAllFiles,
  onSelectFile,
  className = ""
}: AutoSizedFileListProps) => {
  // 计算页面高度的2/3作为最大限制
  const maxHeight = Math.floor(window.innerHeight * 2 / 3)
  const HEADER_HEIGHT = 40 // 头部高度约40px



  if (extractedFiles.length === 0) {
    return null
  }

  return (
    <div className={`border rounded-lg ${showFileList ? 'block' : 'hidden'} ${className}`}>
      {/* 头部操作按钮 */}
      <div className="flex items-center justify-between p-2 bg-gray-50 border-b">
        <span className="text-xs font-medium text-gray-600">
          已提取文件 ({extractedFiles.length})
        </span>
        <div className="flex items-center gap-1">
          <Button
            onClick={onExtractAll}
            disabled={isExtracting}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700"
            title="获取所有文件"
          >
            <Files className="h-3 w-3" />
            {isExtracting ? '提取中...' : '获得所有文件'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAllFiles}
            className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
            title="清空所有文件"
          >
            清空
          </Button>
        </div>
      </div>

      {/* 文件列表 - 使用max-height实现自适应高度 */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: `${maxHeight - HEADER_HEIGHT}px` }}
      >
          {extractedFiles.map((file, index) => {
            const isSelected = selectedFiles.has(file.name)

            return (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-2 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelectFile(file.name, !isSelected)}
              >
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelectFile(file.name, checked as boolean)}
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()} // 防止复选框点击时触发行点击
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-800 truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {file.length} 字符
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation() // 防止按钮点击时触发行点击
                      onCopyFile(file)
                    }}
                    className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                    title="复制内容"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation() // 防止按钮点击时触发行点击
                      onDeleteFile(file.name)
                    }}
                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                    title="删除文件"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
