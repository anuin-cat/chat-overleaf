import { useState, useRef, useCallback } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { ScrollArea } from "~components/ui/scroll-area"
import { Send, X, FileText, Files, Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

interface FileInfo {
  name: string
  content: string
  length: number
}

interface ExtractionResult {
  success: boolean
  files: FileInfo[]
  mode: 'current' | 'all'
  error?: string
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
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedFiles, setExtractedFiles] = useState<FileInfo[]>([])
  const [showFileList, setShowFileList] = useState(true)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 简化的内容提取函数
  const extractContent = async (mode: 'current' | 'all'): Promise<ExtractionResult> => {
    try {
      // 发送消息到主世界脚本获取内容
      const requestId = Date.now().toString()

      return new Promise((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'OVERLEAF_CONTENT_RESPONSE' && event.data.requestId === requestId) {
            window.removeEventListener('message', handleMessage)

            const { data } = event.data

            if (mode === 'all' && data.files) {
              // 处理所有文件模式
              if (data.success && data.files.length > 0) {
                resolve({
                  success: true,
                  files: data.files.map((file: any) => ({
                    name: file.name,
                    content: file.content,
                    length: file.length
                  })),
                  mode
                })
              } else {
                resolve({
                  success: false,
                  files: [],
                  mode,
                  error: data.error || '无法获取所有文件内容'
                })
              }
            } else {
              // 处理当前文件模式
              if (data.success && data.content) {
                resolve({
                  success: true,
                  files: [{
                    name: data.fileName || 'main.tex',
                    content: data.content,
                    length: data.length || data.content.length
                  }],
                  mode
                })
              } else {
                resolve({
                  success: false,
                  files: [],
                  mode,
                  error: data.error || '无法获取内容'
                })
              }
            }
          }
        }

        window.addEventListener('message', handleMessage)

        // 发送请求，包含模式参数
        window.postMessage({
          type: 'GET_OVERLEAF_CONTENT',
          requestId,
          mode
        }, '*')

        // 30秒超时
        setTimeout(() => {
          window.removeEventListener('message', handleMessage)
          resolve({
            success: false,
            files: [],
            mode,
            error: '请求超时'
          })
        }, 30000)
      })
    } catch (error) {
      return {
        success: false,
        files: [],
        mode,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  }

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

  // 处理内容提取结果
  const handleContentExtracted = (result: ExtractionResult) => {
    if (result.success) {
      // 更新提取的文件列表
      if (result.mode === 'current') {
        // 当前文件模式：替换同名文件或添加新文件
        setExtractedFiles(prev => {
          const existingIndex = prev.findIndex(file => file.name === result.files[0]?.name)
          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = result.files[0]
            return updated
          } else {
            return [...prev, ...result.files]
          }
        })
      } else {
        // 所有文件模式：替换整个列表
        setExtractedFiles(result.files)
      }

      const filesSummary = result.files.map(file =>
        `${file.name} (${file.length} 字符)`
      ).join(', ')

      const extractMessage: Message = {
        id: Date.now().toString(),
        content: `✅ 已提取 ${result.mode === 'current' ? '当前文件' : '所有文件'}内容：\n文件：${filesSummary}`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, extractMessage])
    } else {
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ 内容提取失败：${result.error || '未知错误'}`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  // 提取当前文件
  const handleExtractCurrent = async () => {
    setIsExtracting(true)
    try {
      const result = await extractContent('current')
      handleContentExtracted(result)
    } catch (error) {
      console.error('Failed to extract current file:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ 提取当前文件失败：${error instanceof Error ? error.message : '未知错误'}`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsExtracting(false)
    }
  }

  // 提取所有文件
  const handleExtractAll = async () => {
    setIsExtracting(true)
    try {
      const result = await extractContent('all')
      handleContentExtracted(result)
    } catch (error) {
      console.error('Failed to extract all files:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ 提取所有文件失败：${error instanceof Error ? error.message : '未知错误'}`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsExtracting(false)
    }
  }

  // 复制文件内容到剪贴板
  const handleCopyFile = async (file: FileInfo) => {
    try {
      await navigator.clipboard.writeText(file.content)
      const copyMessage: Message = {
        id: Date.now().toString(),
        content: `📋 已复制文件 "${file.name}" 的内容到剪贴板`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, copyMessage])
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: `❌ 复制失败：${error instanceof Error ? error.message : '未知错误'}`,
        isUser: false,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  // 删除文件
  const handleDeleteFile = (fileName: string) => {
    setExtractedFiles(prev => prev.filter(file => file.name !== fileName))
    const deleteMessage: Message = {
      id: Date.now().toString(),
      content: `🗑️ 已删除文件 "${fileName}"`,
      isUser: false,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, deleteMessage])
  }

  // 清空所有文件
  const handleClearAllFiles = () => {
    setExtractedFiles([])
    const clearMessage: Message = {
      id: Date.now().toString(),
      content: `🗑️ 已清空所有提取的文件`,
      isUser: false,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, clearMessage])
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
            onClick={handleExtractCurrent}
            disabled={isExtracting}
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
          >
            <FileText className="h-3 w-3 mr-1" />
            {isExtracting ? '提取中...' : '当前文件'}
          </Button>

          <Button
            onClick={handleExtractAll}
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
                onClick={handleClearAllFiles}
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
                        onClick={() => handleCopyFile(file)}
                        className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                        title="复制内容"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteFile(file.name)}
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
