import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { ScrollArea } from "~components/ui/scroll-area"
import { SimpleSelect } from "~components/ui/simple-select"
import { Checkbox } from "~components/ui/checkbox"
import { Send, X, FileText, Files, Copy, Trash2, ChevronDown, ChevronUp, Square, Settings } from "lucide-react"
import { useFileExtraction, type FileInfo } from "./file-extraction"
import { LLMService, type ChatMessage } from "~lib/llm-service"
import { allModels, defaultModel, type ModelConfig } from "~lib/models"
import { useSettings } from "~hooks/useSettings"
import { SettingsPanel } from "./settings-panel"
import { MarkdownMessage } from "./markdown-message"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isStreaming?: boolean
}

interface SidebarChatProps {
  onClose?: () => void
  onWidthChange?: (width: number) => void
}

export const SidebarChat = ({ onClose, onWidthChange }: SidebarChatProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "你好！我是你 Overleaf 助手，有什么可以帮助你的吗？\n\n⚠️ **首次使用提示**：请先在设置中配置您的 API Key 才能开始对话。",
      // \n\n我支持 **Markdown** 格式，可以显示：\n- 列表项\n- `代码`\n- **粗体** 和 *斜体*\n- 行内数学公式：$E = mc^2$\n- 块级数学公式：\n\n$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$\n\n```javascript\nconsole.log('Hello World!');\n```",
      isUser: false,
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState("")
  const [width, setWidth] = useState(320) // 默认宽度 320px
  const [isResizing, setIsResizing] = useState(false)
  const [showFileList, setShowFileList] = useState(true)
  const [selectedModel, setSelectedModel] = useState<ModelConfig>(defaultModel)
  const [llmService] = useState<LLMService>(new LLMService(defaultModel))
  const [isStreaming, setIsStreaming] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showSettings, setShowSettings] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // 使用设置 hook
  const { initializeSettings, getModelConfig, isModelAvailable } = useSettings()

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

  // 初始化设置
  useEffect(() => {
    initializeSettings()
  }, [initializeSettings])

  // 初始化时同步宽度
  useEffect(() => {
    onWidthChange?.(width)
  }, []) // 只在组件挂载时执行一次


  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return

    // 每次发送消息时重新获取最新的模型配置（包含最新的 API key 和 base URL）
    const currentModelConfig = getModelConfig(selectedModel)

    // 检查当前模型是否可用（有 API key）
    if (!currentModelConfig.api_key || !currentModelConfig.base_url) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: `当前模型 ${selectedModel.display_name} 未配置 API Key 或 Base URL，请在设置中配置后再使用。`,
        isUser: false,
        timestamp: new Date()
      }])
      return
    }

    // 使用最新的模型配置更新 LLM 服务
    llmService.updateModel(currentModelConfig)

    // 调试信息
    console.log('Sending message with model:', currentModelConfig.display_name)
    console.log('API Key available:', !!currentModelConfig.api_key)
    console.log('Base URL:', currentModelConfig.base_url)

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date()
    }

    // 添加用户消息
    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue("")
    setIsStreaming(true)

    // 创建 AI 回复消息
    const aiMessageId = (Date.now() + 1).toString()
    const aiMessage: Message = {
      id: aiMessageId,
      content: "",
      isUser: false,
      timestamp: new Date(),
      isStreaming: true
    }
    setMessages(prev => [...prev, aiMessage])

    try {
      // 准备聊天历史
      const chatHistory: ChatMessage[] = []

      // 添加选中的文件内容作为上下文
      const selectedFileContents = extractedFiles
        .filter(file => selectedFiles.has(file.name))
        .map(file => `文件 ${file.name}:\n${file.content}`)
        .join('\n\n')

      if (selectedFileContents) {
        chatHistory.push({
          role: 'system',
          content: `以下是用户提供的文件内容作为上下文：\n\n${selectedFileContents}`
        })
      }

      // 添加最近的对话历史（最多10条）
      const recentMessages = messages.slice(-10).filter(msg => !msg.isStreaming)
      recentMessages.forEach(msg => {
        chatHistory.push({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content
        })
      })

      // 添加当前用户消息
      chatHistory.push({
        role: 'user',
        content: currentInput
      })

      // 创建 AbortController
      const controller = new AbortController()
      setAbortController(controller)

      // 开始流式对话
      let fullContent = ""
      for await (const response of llmService.streamChat(chatHistory, controller.signal)) {
        if (controller.signal.aborted) break

        fullContent = response.content

        setMessages(prev => prev.map(msg =>
          msg.id === aiMessageId
            ? { ...msg, content: fullContent, isStreaming: !response.finished }
            : msg
        ))

        if (response.finished) {
          break
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? { ...msg, content: "抱歉，发生了错误，请稍后重试。", isStreaming: false }
          : msg
      ))
    } finally {
      setIsStreaming(false)
      setAbortController(null)
    }
  }

  const handleStopStreaming = () => {
    if (abortController) {
      abortController.abort()
      setIsStreaming(false)
      setAbortController(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (isStreaming) {
        handleStopStreaming()
      } else {
        handleSendMessage()
      }
    }
  }

  const handleModelChange = (modelName: string) => {
    const model = allModels.find(m => m.model_name === modelName)
    if (model) {
      // 使用设置系统获取完整的模型配置
      const modelConfig = getModelConfig(model)
      setSelectedModel(modelConfig)
      llmService.updateModel(modelConfig)

      // 调试信息
      console.log('Model changed to:', modelConfig.display_name)
      console.log('API Key available:', !!modelConfig.api_key)
      console.log('Base URL:', modelConfig.base_url)
    }
  }

  const handleFileSelection = (fileName: string, checked: boolean) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(fileName)
      } else {
        newSet.delete(fileName)
      }
      return newSet
    })
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
              value={selectedModel.model_name}
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

        {/* 文件提取按钮 */}
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
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedFiles.has(file.name)}
                        onCheckedChange={(checked) => handleFileSelection(file.name, checked as boolean)}
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
                  <p className="text-xs opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                  {!message.isUser && !message.isStreaming && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-gray-200"
                      onClick={() => {
                        navigator.clipboard.writeText(message.content)
                      }}
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
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            className="flex-1"
            disabled={isStreaming}
            autoComplete="off"
            data-form-type="other"
          />
          <Button
            onClick={isStreaming ? handleStopStreaming : handleSendMessage}
            size="sm"
            variant={isStreaming ? "destructive" : "default"}
          >
            {isStreaming ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>


    </div>

    {/* 设置面板 */}
    {showSettings && (
      <SettingsPanel onClose={() => setShowSettings(false)} />
    )}
  </>
  )
}
