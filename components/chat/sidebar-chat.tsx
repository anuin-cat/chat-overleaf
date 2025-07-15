import { useState, useRef, useCallback } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { ScrollArea } from "~components/ui/scroll-area"
import { Send, X, FileText, Files, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { useFileExtraction, type FileInfo } from "./file-extraction"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

interface SidebarChatProps {
  onClose?: () => void
  onWidthChange?: (width: number) => void
}

export const SidebarChat = ({ onClose, onWidthChange }: SidebarChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "你好！我是你的AI助手，有什么可以帮助你的吗？",
      isUser: false,
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState("")
  const [width, setWidth] = useState(320) // 默认宽度 320px
  const [isResizing, setIsResizing] = useState(false)
  const [showFileList, setShowFileList] = useState(true)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 使用文件提取 hook
  const {
    isExtracting,
    extractedFiles,
    handleExtractCurrent,
    handleExtractAll,
    handleCopyFile,
    handleDeleteFile,
    handleClearAllFiles
  } = useFileExtraction()



  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue("")

    // 模拟AI回复
    setTimeout(() => {
      const aiReply: Message = {
        id: (Date.now() + 1).toString(),
        content: `我收到了你的消息："${inputValue}"。这是一个简单的演示回复。`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, aiReply])
    }, 1000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }



  // 拖拽调整大小的处理函数
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX // 向左拖拽为正值
      const newWidth = Math.max(280, Math.min(800, startWidth + deltaX)) // 限制宽度范围
      setWidth(newWidth)
      onWidthChange?.(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [width, onWidthChange])

  return (
    <div
      ref={sidebarRef}
      className="flex h-screen flex-col bg-white border-l border-gray-200 shadow-lg relative"
      style={{ width: `${width}px` }}
    >
      {/* 拖拽条 */}
      <div
        className={`absolute left-0 top-0 w-1 h-full bg-transparent hover:bg-blue-500 cursor-col-resize transition-colors ${
          isResizing ? 'bg-blue-500' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">AI 助手</h2>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 内容提取按钮 */}
        <div className="flex gap-2 mb-3">
          <Button
            onClick={() => handleExtractCurrent(setMessages)}
            disabled={isExtracting}
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            {isExtracting ? '提取中...' : '当前文件'}
          </Button>

          <Button
            onClick={() => handleExtractAll(setMessages)}
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
                  onClick={() => setShowFileList(!showFileList)}
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
                onClick={() => handleClearAllFiles(setMessages)}
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
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-800 truncate">
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {file.length} 字符
                      </div>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyFile(file, setMessages)}
                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                        title="复制内容"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(file.name, setMessages)}
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

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-3 py-2 ${
                  message.isUser
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <p className="text-sm">{message.content}</p>
                <p className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1"
          />
          <Button onClick={handleSendMessage} size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
