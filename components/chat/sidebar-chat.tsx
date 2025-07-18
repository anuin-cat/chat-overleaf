import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "~components/ui/button"
import { ScrollArea } from "~components/ui/scroll-area"
import { SimpleSelect } from "~components/ui/simple-select"
import { MessageContextTags } from "./context-tags"
import { X, Settings, Copy } from "lucide-react"
import { FileExtractionPanel } from "./file/file-extraction-panel"
import { useFileExtraction } from "./file/use-file-extraction"
import { LLMService } from "~lib/llm-service"
import { allModels, defaultModel } from "~lib/models"
import { useSettings } from "~hooks/useSettings"
import { SettingsPanel } from "./settings-panel"
import { MarkdownMessage } from "./markdown-message"
import { useToast } from "~components/ui/sonner"
import { ChatInput } from "./chat-input"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isStreaming?: boolean
  selectedText?: string // 添加选中文本字段
}

interface SidebarChatProps {
  onClose?: () => void
  onWidthChange?: (width: number) => void
}

export const SidebarChat = ({ onClose, onWidthChange }: SidebarChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "你好！我是你 Overleaf 助手，有什么可以帮助你的吗？",
      // \n\n⚠️ **首次使用提示**：请先在设置中配置您的 API Key 才能开始对话。",
      // \n\n我支持 **Markdown** 格式，可以显示：\n- 列表项\n- `代码`\n- **粗体** 和 *斜体*\n- 行内数学公式：$E = mc^2$\n- 块级数学公式：\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\n```javascript\nconsole.log('Hello World!');\n```",
      isUser: false,
      timestamp: new Date()
    }
  ])
  const [width, setWidth] = useState(320) // 默认宽度 320px
  const [isResizing, setIsResizing] = useState(false)
  const [llmService] = useState<LLMService>(new LLMService(defaultModel))
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 使用设置 hook
  const { initializeSettings, getModelConfig, isModelAvailable, selectedModel, setSelectedModel } = useSettings()

  // 使用 toast hook
  const { success, error, info } = useToast()

  // 使用文件提取 hook（用于获取提取的文件信息）
  const { extractedFiles } = useFileExtraction()

  // 初始化设置
  useEffect(() => {
    initializeSettings()
  }, [initializeSettings])

  // 初始化选中的模型（如果还没有选择的话）
  useEffect(() => {
    if (!selectedModel) {
      setSelectedModel(defaultModel)
    }
  }, [selectedModel, setSelectedModel])

  // 初始化时同步宽度
  useEffect(() => {
    onWidthChange?.(width)
  }, []) // 只在组件挂载时执行一次

  const handleModelChange = (modelName: string) => {
    const model = allModels.find(m => m.model_name === modelName)
    if (model) {
      // 使用设置系统获取完整的模型配置
      const modelConfig = getModelConfig(model)
      setSelectedModel(modelConfig)
      llmService.updateModel(modelConfig)

      success(`已切换到 ${modelConfig.display_name}`, { title: '模型切换' })

      // 调试信息
      console.log('Model changed to:', modelConfig.display_name)
      console.log('API Key available:', !!modelConfig.api_key)
      console.log('Base URL:', modelConfig.base_url)
    }
  }

  // 复制消息内容
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      success('消息已复制到剪贴板', { title: '复制成功' })
    } catch (error) {
      console.error('Failed to copy message:', error)
      error('复制消息失败', { title: '复制失败' })
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
    <>
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
        {/* 关闭按钮 + 设置按钮 + 模型选择 */}
        <div className="flex items-center justify-between mb-3 gap-2">
          {/* 模型选择 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <SimpleSelect
              value={selectedModel?.model_name || defaultModel.model_name}
              onValueChange={handleModelChange}
              placeholder="选择模型"
              className="min-w-[120px]"
              options={allModels.map((model) => {
                const available = isModelAvailable(model)
                return {
                  value: model.model_name,
                  label: model.display_name,
                  extra: (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {model.free && (
                        <span className="text-xs text-green-600 whitespace-nowrap">免费</span>
                      )}
                      {!available && (
                        <span className="text-xs text-red-600 whitespace-nowrap">未配置</span>
                      )}
                    </div>
                  )
                }
              })}
            />
            {/* <h2 className="text-lg font-semibold text-gray-800 whitespace-nowrap">Chat Overleaf</h2> */}
          </div>
          {/* 设置按钮 + 关闭按钮 */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="h-8 w-8 p-0"
              title="设置"
            >
              <Settings className="h-4 w-4" />
            </Button>
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
        </div>

        {/* 文件提取面板 */}
        <FileExtractionPanel
          selectedFiles={selectedFiles}
          onFileSelectionChange={setSelectedFiles}
        />
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
                className={`max-w-[70%] rounded-lg px-3 py-2 relative group ${
                  message.isUser
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                <MarkdownMessage
                  content={message.content}
                  isUser={message.isUser}
                  isStreaming={message.isStreaming}
                  className={message.isUser ? "text-white" : "text-gray-800"}
                />
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                    {/* 显示选中文本标签（仅用户消息且有选中文本时） */}
                    {message.isUser && message.selectedText && (
                      <MessageContextTags
                        selectedText={message.selectedText}
                        className="text-xs"
                      />
                    )}
                  </div>
                  {!message.isUser && !message.isStreaming && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-gray-200"
                      onClick={() => handleCopyMessage(message.content)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        messages={messages}
        onMessagesChange={setMessages}
        selectedFiles={selectedFiles}
        extractedFiles={extractedFiles}
        llmService={llmService}
        onFileSelectionChange={setSelectedFiles}
      />
    </div>

    {/* 设置面板 */}
    {showSettings && (
      <SettingsPanel onClose={() => setShowSettings(false)} />
    )}
  </>
  )
}
