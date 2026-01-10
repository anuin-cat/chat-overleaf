import React from 'react'
import { Button } from '~components/ui/button'
import { Copy, Trash2, GitBranch } from 'lucide-react'
import { useToast } from '~components/ui/sonner'
import { useDialog } from '~components/ui/dialog'

interface MessageActionsProps {
  messageId: string
  messageContent: string
  isUser: boolean
  isStreaming?: boolean
  onDeleteMessage: (messageId: string) => void
  onBranchFromMessage: (messageId: string) => void
  className?: string
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  messageId,
  messageContent,
  isUser,
  isStreaming = false,
  onDeleteMessage,
  onBranchFromMessage,
  className = ""
}) => {
  const { success, error } = useToast()
  const { showDialog } = useDialog()

  // 复制消息内容
  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageContent)
      success('消息已复制到剪贴板')
    } catch (err) {
      console.error('Failed to copy message:', err)
      error('复制失败，请重试')
    }
  }

  // 删除消息
  const handleDeleteMessage = async () => {
    const confirmed = await showDialog({
      title: '删除消息',
      description: '确定要删除这条消息吗？此操作无法撤销。',
      confirmText: '删除',
      cancelText: '取消',
      variant: 'destructive'
    })

    if (confirmed) {
      onDeleteMessage(messageId)
      success('消息已删除')
    }
  }

  // 创建分支
  const handleBranchFromMessage = async () => {
    const confirmed = await showDialog({
      title: '创建分支',
      description: '将从此消息开始创建新的对话分支，当前对话将保存为历史记录。确定继续吗？',
      confirmText: '创建分支',
      cancelText: '取消'
    })

    if (confirmed) {
      onBranchFromMessage(messageId)
      success('已创建新的对话分支')
    }
  }

  // 如果消息正在流式传输，不显示操作按钮
  if (isStreaming) {
    return null
  }

  return (
    <div className={`flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${className}`}>
      {/* 复制按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopyMessage}
        className="h-5 w-5 p-0 hover:bg-gray-200/50"
        title="复制消息"
      >
        <Copy className="h-2.5 w-2.5" />
      </Button>

      {/* 删除按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDeleteMessage}
        className="h-5 w-5 p-0 hover:bg-red-100/50 text-red-500 hover:text-red-600"
        title="删除消息"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </Button>

      {/* 分支按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleBranchFromMessage}
        className="h-5 w-5 p-0 hover:bg-green-100/50 text-green-500 hover:text-green-600"
        title="从此处创建分支"
      >
        <GitBranch className="h-2.5 w-2.5" />
      </Button>
    </div>
  )
}
