import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "~components/ui/button"
import { ScrollArea } from "~components/ui/scroll-area"
import { SimpleSelect } from "~components/ui/simple-select"
import { DialogProvider } from "~components/ui/dialog"
import { MessageContextTags } from "./context-tags"
import { MessageActions } from "./message/message-actions"
import { X, Settings, ChevronDown, ChevronUp, History } from "lucide-react"
import { FileExtractionPanel } from "./file/file-extraction-panel"
import { useFileExtraction } from "./file/use-file-extraction"
import { ChatHistoryList } from "./history/chat-history-list"
import { useChatHistory } from "~hooks/useChatHistory"
import { LLMService } from "~lib/llm-service"
import { allModels, defaultModel } from "~lib/models"
import { useSettings } from "~hooks/useSettings"
import { SettingsPanel } from "./settings-panel"
import { MarkdownMessage } from "./message/markdown-message"
import { useToast } from "~components/ui/sonner"
import { ChatInput } from "./chat-input"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isStreaming?: boolean
  selectedText?: string // 添加选中文本字段
  isWaiting?: boolean // 是否在等待第一个token
  waitingStartTime?: Date // 等待开始时间
}

interface SidebarChatProps {
  onClose?: () => void
  onWidthChange?: (width: number) => void
}

export const SidebarChat = ({ onClose, onWidthChange }: SidebarChatProps) => {
  // 当前聊天会话状态
  const [currentChatId, setCurrentChatId] = useState<string>(() =>
    `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  )
  const [currentChatName, setCurrentChatName] = useState<string>("")
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "你好！我是你的 Overleaf 助手，有什么可以帮助你的吗？",
      isUser: false,
      timestamp: new Date()
    }
  ])
  const [width, setWidth] = useState(420) // 默认宽度 400px
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
  const { extractedFiles, showFileList, toggleFileList: originalToggleFileList } = useFileExtraction(selectedFiles, setSelectedFiles)

  // 使用聊天历史 hook
  const {
    chatHistories,
    showHistoryList,
    isLoading: isHistoryLoading,
    saveChatHistory,
    deleteChatHistory,
    updateHistoryName,
    clearAllHistories,
    toggleHistoryList,
    createBranchChat,
    isOnlyInitialMessage
  } = useChatHistory()

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

  // 删除消息
  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId))
  }, [])

  // 从消息创建分支
  const handleBranchFromMessage = useCallback(async (messageId: string) => {
    // 找到消息在数组中的索引
    const messageIndex = messages.findIndex(msg => msg.id === messageId)
    if (messageIndex === -1) return

    // 先保存当前对话为历史记录
    if (!isOnlyInitialMessage(messages)) {
      await saveChatHistory(messages, currentChatName, currentChatId)
    }

    // 创建分支
    const branchResult = await createBranchChat(messages, messageIndex, currentChatName || "新对话")

    if (branchResult) {
      // 更新当前聊天状态为分支状态
      setCurrentChatId(branchResult.branchId)
      setCurrentChatName(branchResult.branchName)
      setMessages(branchResult.branchMessages)
    }
  }, [messages, currentChatName, currentChatId, saveChatHistory, createBranchChat, isOnlyInitialMessage])

  // 加载历史对话
  const handleLoadHistory = async (history: any) => {
    // 如果当前对话不是只有初始消息，先保存当前对话
    if (!isOnlyInitialMessage(messages)) {
      await saveChatHistory(messages, currentChatName, currentChatId)
    }

    // 将 StoredMessage 转换为 Message 格式
    const convertedMessages: Message[] = history.messages.map((msg: any) => ({
      id: msg.id,
      content: msg.content,
      isUser: msg.isUser,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
      // 恢复时不需要临时状态
      isStreaming: false,
      selectedText: undefined,
      isWaiting: false,
      waitingStartTime: undefined
    }))

    // 设置当前聊天的ID和名称
    setCurrentChatId(history.id)
    setCurrentChatName(history.name)

    // 加载历史对话
    setMessages(convertedMessages)

    // 不再自动收起历史列表，让用户手动控制

    success(`已加载历史对话: ${history.name}`, { title: '加载成功' })
  }

  // 互斥的切换函数
  const toggleFileList = () => {
    // 如果聊天历史列表是打开的，先关闭它
    if (showHistoryList) {
      toggleHistoryList()
    }
    originalToggleFileList()
  }

  const toggleHistoryListMutex = () => {
    // 如果文件列表是打开的，先关闭它
    if (showFileList) {
      originalToggleFileList()
    }
    toggleHistoryList()
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
    <DialogProvider>
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
        <div className="flex items-center justify-between mb-0 gap-2">
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
          </div>
          {/* 文件列表展开按钮 + 聊天历史按钮 + 设置按钮 + 关闭按钮 */}
          <div className="flex items-center space-x-1">
            {/* 文件列表展开按钮 - 只有当有提取的文件时才显示 */}
            {extractedFiles.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFileList}
                className={`h-8 px-2 flex items-center gap-1 ${
                  showFileList
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'hover:bg-gray-100'
                }`}
                title={showFileList ? "收起文件列表" : "展开文件列表"}
              >
                {showFileList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span className="text-xs font-medium">文件列表</span>
              </Button>
            )}
            {/* 聊天历史展开按钮 - 始终显示 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHistoryListMutex}
              className={`h-8 px-2 flex items-center gap-1 ${
                showHistoryList
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : 'hover:bg-gray-100'
              }`}
              title={showHistoryList ? "收起聊天历史" : "展开聊天历史"}
            >
              {showHistoryList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="text-xs font-medium">聊天历史</span>
            </Button>
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
      </div>

      {/* 文件提取面板 - 始终渲染，通过样式控制显示/隐藏 */}
      <div className={showFileList ? "block" : "hidden"}>
        <FileExtractionPanel
          selectedFiles={selectedFiles}
          onFileSelectionChange={setSelectedFiles}
        />
      </div>

      {/* 聊天历史面板 - 始终渲染，通过样式控制显示/隐藏 */}
      <div className={showHistoryList ? "block" : "hidden"}>
        <div className="m-4">
          <ChatHistoryList
            chatHistories={chatHistories}
            showHistoryList={showHistoryList}
            isLoading={isHistoryLoading}
            onLoadHistory={handleLoadHistory}
            onDeleteHistory={deleteChatHistory}
            onUpdateHistoryName={(historyId, newName) => {
              // 如果更新的是当前聊天的历史记录，同步更新当前聊天名称
              if (historyId === currentChatId) {
                setCurrentChatName(newName)
              }
              return updateHistoryName(historyId, newName)
            }}
            onClearAllHistories={clearAllHistories}
          />
        </div>
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
                className={`${message.isUser ? "max-w-[80%]" : "max-w-full"} rounded-lg px-3 py-2 relative group ${
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
                  isWaiting={message.isWaiting}
                  waitingStartTime={message.waitingStartTime}
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
                  {/* 消息操作按钮 */}
                  <MessageActions
                    messageId={message.id}
                    messageContent={message.content}
                    isUser={message.isUser}
                    isStreaming={message.isStreaming}
                    onDeleteMessage={handleDeleteMessage}
                    onBranchFromMessage={handleBranchFromMessage}
                  />
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
        onSaveChatHistory={(messages) => saveChatHistory(messages, currentChatName, currentChatId)}
        isOnlyInitialMessage={isOnlyInitialMessage}
        currentChatId={currentChatId}
        currentChatName={currentChatName}
        onChatNameChange={setCurrentChatName}
        onChatIdChange={setCurrentChatId}
      />
    </div>

    {/* 设置面板 */}
    {showSettings && (
      <SettingsPanel onClose={() => setShowSettings(false)} />
    )}
  </DialogProvider>
  )
}
