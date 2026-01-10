import { useMemo, useState } from "react"
import { Button } from "~components/ui/button"
import { Checkbox } from "~components/ui/checkbox"
import { Files, Copy, Trash2, Folder, FolderOpen, FileText, ChevronRight, ChevronDown } from "lucide-react"
import type { FileInfo } from "./file-extraction-service"
import {
  buildFileTree,
  getAllFilesInFolder,
  formatNumber,
  type TreeNode
} from "./file-tree-utils"

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
  onSelectAllFiles: () => void
  className?: string
}

interface TreeNodeItemProps {
  node: TreeNode
  depth: number
  selectedFiles: Set<string>
  extractedFiles: FileInfo[]
  expandedFolders: Set<string>
  onSelectFile: (fileName: string, selected: boolean) => void
  onCopyFile: (file: FileInfo) => void
  onDeleteFile: (fileName: string) => void
  onToggleFolder: (folderPath: string) => void
}

/**
 * 树节点组件
 */
const TreeNodeItem = ({
  node,
  depth,
  selectedFiles,
  extractedFiles,
  expandedFolders,
  onSelectFile,
  onCopyFile,
  onDeleteFile,
  onToggleFolder
}: TreeNodeItemProps) => {
  const isSelected = !node.isFolder && selectedFiles.has(node.path)
  const isExpanded = node.isFolder && expandedFolders.has(node.path)

  const handleClick = () => {
    if (node.isFolder) {
      onToggleFolder(node.path)
    } else {
      onSelectFile(node.path, !isSelected)
    }
  }

  const handleCheckboxChange = (checked: boolean) => {
    if (!node.isFolder) {
      onSelectFile(node.path, checked)
    }
  }

  // 更紧凑的左侧缩进
  const paddingLeft = depth * 12 + 4

  return (
    <>
      <div
        className="flex items-center justify-between py-0.5 hover:bg-blue-50 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${paddingLeft}px`, paddingRight: '4px' }}
        onClick={handleClick}
      >
        <div className="flex items-center gap-0.5 flex-1 min-w-0">
          {node.isFolder ? (
            <>
              {/* 文件夹：展开/折叠图标 + 文件夹图标 */}
              {isExpanded ? (
                <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              ) : (
                <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              )}
            </>
          ) : (
            <>
              {/* 文件：占位对齐 + 文件图标 */}
              <span className="w-3 flex-shrink-0" />
              <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            </>
          )}
          
          <span className="text-xs text-gray-800 truncate flex-1 ml-0.5" title={node.path}>
            {node.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* 显示 token 数 */}
          {node.isFolder ? (
            <span className="text-[10px] text-amber-600 whitespace-nowrap">
              ≈{formatNumber(node.tokenCount)} token
            </span>
          ) : (
            <span className="text-[10px] text-blue-600 whitespace-nowrap">
              ≈{formatNumber(node.tokenCount)} token
            </span>
          )}
          
          {/* 文件操作按钮 */}
          {!node.isFolder && (
            <div className="flex gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (node.file) onCopyFile(node.file)
                }}
                className="h-5 w-5 p-0 text-blue-600 hover:bg-blue-100"
                title="复制内容"
              >
                <Copy className="h-2.5 w-2.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteFile(node.path)
                }}
                className="h-5 w-5 p-0 text-red-600 hover:bg-red-50"
                title="删除文件"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}

          {/* 文件勾选框放在最右侧 */}
          {!node.isFolder && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={handleCheckboxChange}
              className="flex-shrink-0 h-3.5 w-3.5 ml-1"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>
      
      {/* 递归渲染子节点（仅当文件夹展开时） */}
      {node.isFolder && isExpanded && node.children.map((child, index) => (
        <TreeNodeItem
          key={`${child.path}-${index}`}
          node={child}
          depth={depth + 1}
          selectedFiles={selectedFiles}
          extractedFiles={extractedFiles}
          expandedFolders={expandedFolders}
          onSelectFile={onSelectFile}
          onCopyFile={onCopyFile}
          onDeleteFile={onDeleteFile}
          onToggleFolder={onToggleFolder}
        />
      ))}
    </>
  )
}

/**
 * 递归收集所有文件夹路径
 */
const collectAllFolderPaths = (nodes: TreeNode[]): string[] => {
  const paths: string[] = []
  const traverse = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      if (node.isFolder) {
        paths.push(node.path)
        traverse(node.children)
      }
    }
  }
  traverse(nodes)
  return paths
}

/**
 * 自动调整高度的文件树组件
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
  onSelectAllFiles,
  className = ""
}: AutoSizedFileListProps) => {
  const maxHeight = Math.floor(window.innerHeight * 1 / 2)
  const HEADER_HEIGHT = 40

  // 构建文件树
  const fileTree = useMemo(() => {
    return buildFileTree(extractedFiles)
  }, [extractedFiles])

  // 默认展开所有文件夹
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    return new Set(collectAllFolderPaths(fileTree))
  })

  // 当文件树变化时，确保新文件夹也被展开
  useMemo(() => {
    const allFolders = collectAllFolderPaths(fileTree)
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      for (const folder of allFolders) {
        newSet.add(folder)
      }
      return newSet
    })
  }, [fileTree])

  // 切换文件夹展开状态
  const handleToggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath)
      } else {
        newSet.add(folderPath)
      }
      return newSet
    })
  }

  if (extractedFiles.length === 0) {
    return null
  }

  return (
    <div className={className}>
      {/* 头部操作按钮 */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-blue-100 border-b border-blue-200">
        <span className="text-xs font-medium text-blue-800">
          已提取文件 ({extractedFiles.length})
        </span>
        <div className="flex items-center gap-1">
          <Button
            onClick={onExtractAll}
            disabled={isExtracting}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-blue-700 hover:bg-blue-200"
            title="获取所有文件"
          >
            <Files className="h-3 w-3" />
            {isExtracting ? '提取中...' : '提取项目文件'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectAllFiles}
            className="h-6 px-2 text-xs text-blue-600 hover:bg-blue-100"
            title="全选所有文件"
          >
            全选
          </Button>
        </div>
      </div>

      {/* 文件树 */}
      <div
        className="overflow-y-auto bg-white py-0.5"
        style={{ maxHeight: `${maxHeight - HEADER_HEIGHT}px` }}
      >
        {fileTree.map((node, index) => (
          <TreeNodeItem
            key={`${node.path}-${index}`}
            node={node}
            depth={0}
            selectedFiles={selectedFiles}
            extractedFiles={extractedFiles}
            expandedFolders={expandedFolders}
            onSelectFile={onSelectFile}
            onCopyFile={onCopyFile}
            onDeleteFile={onDeleteFile}
            onToggleFolder={handleToggleFolder}
          />
        ))}
      </div>
    </div>
  )
}
