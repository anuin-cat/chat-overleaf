import { useState } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { Trash2, Edit3, MessageCircle } from "lucide-react"
import { useDialog } from "~components/ui/dialog"
import { truncateText } from "~utils/helpers"
import type { ChatHistory } from "~hooks/useChatHistory"

interface ChatHistoryListProps {
  chatHistories: ChatHistory[]
  showHistoryList: boolean
  isLoading: boolean
  onLoadHistory: (history: ChatHistory) => void
  onDeleteHistory: (historyId: string) => void
  onUpdateHistoryName: (historyId: string, newName: string) => void
  onClearAllHistories: () => void
  className?: string
}

/**
 * 聊天历史列表组件
 * 参照文件列表样式设计
 */
export const ChatHistoryList = ({
  chatHistories,
  showHistoryList,
  isLoading,
  onLoadHistory,
  onDeleteHistory,
  onUpdateHistoryName,
  onClearAllHistories,
  className = ""
}: ChatHistoryListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const { showDialog } = useDialog()

  // 计算页面高度的1/2作为最大限制
  const maxHeight = Math.floor(window.innerHeight * 1 / 2)
  const HEADER_HEIGHT = 40 // 头部高度约40px

  // 开始编辑名称
  const startEditing = (history: ChatHistory) => {
    setEditingId(history.id)
    setEditingName(history.name)
  }

  // 保存编辑
  const saveEditing = () => {
    if (editingId && editingName.trim()) {
      onUpdateHistoryName(editingId, editingName.trim())
    }
    setEditingId(null)
    setEditingName("")
  }

  // 取消编辑
  const cancelEditing = () => {
    setEditingId(null)
    setEditingName("")
  }

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEditing()
    } else if (e.key === "Escape") {
      cancelEditing()
    }
  }

  // 处理删除单个历史记录的确认
  const handleDeleteHistory = async (historyId: string, historyName: string) => {
    const confirmed = await showDialog({
      title: "删除对话历史",
      description: `确定要删除对话"${historyName}"吗？此操作无法撤销。`,
      confirmText: "删除",
      cancelText: "取消",
      variant: "destructive"
    })

    if (confirmed) {
      onDeleteHistory(historyId)
    }
  }

  // 处理清空所有历史记录的确认
  const handleClearAllHistories = async () => {
    const confirmed = await showDialog({
      title: "清空所有历史",
      description: `确定要清空所有聊天历史吗？这将删除 ${chatHistories.length} 条对话记录，此操作无法撤销。`,
      confirmText: "清空",
      cancelText: "取消",
      variant: "destructive"
    })

    if (confirmed) {
      onClearAllHistories()
    }
  }

  // 格式化时间显示
  const formatTime = (date: Date): string => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return "刚刚"
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString()
  }

  // 截断显示名称
  const truncateName = (name: string, maxWidth: number): string => {
    // 简单的字符长度截断，实际应用中可能需要更精确的宽度计算
    const maxChars = Math.floor(maxWidth / 8) // 假设每个字符约8px宽度
    return truncateText(name, maxChars)
  }

  // 移除这个条件，让组件始终渲染

  return (
    <div className={`bg-green-50 border-b border-green-200 ${className}`}>
      {/* 头部操作按钮 */}
      <div className="flex items-center justify-between px-3 py-2 bg-green-100 border-b border-green-200">
        <span className="text-xs font-medium text-green-800">
          聊天历史 ({chatHistories.length})
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAllHistories}
            className="h-6 px-2 text-xs text-red-600 hover:bg-red-50"
            title="清空所有历史"
            disabled={chatHistories.length === 0}
          >
            清空
          </Button>
        </div>
      </div>

      {/* 历史记录列表 */}
      <div
        className="overflow-y-auto bg-white"
        style={{ maxHeight: `${maxHeight - HEADER_HEIGHT}px` }}
      >
        {isLoading ? (
          <div className="p-4 text-center text-xs text-gray-500">
            加载中...
          </div>
        ) : chatHistories.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-500">
            暂无聊天历史
          </div>
        ) : (
          chatHistories.map((history, index) => (
            <div
              key={`${history.id}-${index}`}
              className="flex items-center justify-between px-3 py-2 border-b border-green-100 last:border-b-0 hover:bg-green-50 cursor-pointer transition-colors"
              onClick={() => editingId !== history.id && onLoadHistory(history)}
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <MessageCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    {editingId === history.id ? (
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveEditing}
                        onKeyDown={handleKeyDown}
                        className="h-5 text-xs px-1 py-0 border-0 bg-white shadow-sm"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span 
                        className="text-xs font-medium text-gray-800 truncate"
                        style={{ maxWidth: "50%" }}
                        title={history.name}
                      >
                        {truncateName(history.name, 120)}
                      </span>
                    )}
                    <div className="flex items-center gap-1 text-xs text-green-600 ml-2 flex-shrink-0">
                      <span>{history.messageCount} 条</span>
                      <span>•</span>
                      <span>{formatTime(history.lastUpdated)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEditing(history)
                  }}
                  className="h-6 w-6 p-0 text-green-600 hover:bg-green-100"
                  title="重命名"
                >
                  <Edit3 className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteHistory(history.id, history.name)
                  }}
                  className="h-6 w-6 p-0 text-red-600 hover:bg-red-50"
                  title="删除历史"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
