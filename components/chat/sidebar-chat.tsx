import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "~components/ui/button"
import { ScrollArea } from "~components/ui/scroll-area"
import { ModelSelect } from "~components/ui/model-select"
import { DialogProvider } from "~components/ui/dialog"
import { MessageContextTags } from "./context-tags"
import { MessageActions } from "./message/message-actions"
import { X, Settings, ChevronDown, ChevronUp } from "lucide-react"
import { FileExtractionPanel } from "./file/file-extraction-panel"
import { useFileExtraction } from "./file/use-file-extraction"
import { ChatHistoryList } from "./history/chat-history-list"
import { useChatHistory } from "~hooks/useChatHistory"
import { LLMService } from "~lib/llm-service"

import { useModels } from "~hooks/useModels"
import { useSettings } from "~hooks/useSettings"
import { useReplaceHandler } from "~hooks/useReplaceHandler"

import { MarkdownMessage } from "./message/markdown-message"
import { useToast } from "~components/ui/sonner"
import { ChatInput } from "./chat-input"
import { generateId } from "~utils/helpers"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isStreaming?: boolean
  selectedText?: string // 添加选中文本字段
  images?: import("~lib/image-utils").ImageInfo[] // 添加图片信息字段
  isWaiting?: boolean // 是否在等待第一个token
  waitingStartTime?: Date // 等待开始时间
  // 思考过程相关
  thinking?: string
  thinkingFinished?: boolean
}

interface SidebarChatProps {
  onClose?: () => void
  onWidthChange?: (width: number) => void
  onShowSettings?: () => void
}

export const SidebarChat = ({ onClose, onWidthChange, onShowSettings }: SidebarChatProps) => {
  // 当前聊天会话状态
  const [currentChatId, setCurrentChatId] = useState<string>(() =>
    `chat_${generateId()}`
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
  const [width, setWidth] = useState(521) // 默认宽度 400px
  const [isResizing, setIsResizing] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  const sidebarRef = useRef<HTMLDivElement>(null)

  // 使用设置 hook
  const { initializeSettings, selectedModel, setSelectedModel } = useSettings()

  // 使用模型管理 hook
  const { getModelById, getFullModelConfig, allModels } = useModels()

  // 创建一个临时的默认模型配置用于初始化 LLMService
  const defaultModelForInit = allModels[0] || {
    model_name: "temp",
    display_name: "临时模型",
    provider: "临时",
    base_url: "",
    api_key: "",
    multimodal: false
  }

  const [llmService] = useState<LLMService>(new LLMService(defaultModelForInit))

  // 使用 toast hook
  const { success } = useToast()

  // 使用文件提取 hook（用于获取提取的文件信息）
  const {
    extractedFiles,
    selectedFiles: syncedSelectedFiles,
    showFileList,
    isExtracting,
    extractAll,
    copyFile,
    deleteFile,
    clearAllFiles,
    selectFile,
    selectAllFiles,
    toggleFileList: originalToggleFileList
  } = useFileExtraction(selectedFiles, setSelectedFiles)

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

  // 使用替换处理 hook
  const {
    replaceCommands,
    updateCommandStatus,
    getFileContent,
    navigateToFile,
    applyReplace,
    showInlineDiff,
    applyingCommandId
  } = useReplaceHandler({ extractedFiles })

  // 初始化设置
  useEffect(() => {
    initializeSettings()
  }, [initializeSettings])

  // 初始化选中的模型（如果还没有选择的话）
  useEffect(() => {
    if (!selectedModel && allModels.length > 0) {
      // 优先选择默认模型，如果找不到则选择第一个可用模型
      const defaultModel = allModels.find(m => m.id === "硅基流动::moonshotai/Kimi-K2-Instruct") || allModels[0]
      setSelectedModel(defaultModel)
    }
  }, [selectedModel, setSelectedModel, allModels])

  // 初始化时同步宽度
  useEffect(() => {
    onWidthChange?.(width)
  }, []) // 只在组件挂载时执行一次

  const handleModelChange = (modelId: string) => {
    const model = getModelById(modelId)

    if (model) {
      // 获取完整的模型配置
      const modelConfig = getFullModelConfig(model)
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
      // 恢复选中的文本内容
      selectedText: msg.selectedText,
      // 恢复图片信息
      images: msg.images,
      // 恢复思考过程
      thinking: msg.thinking,
      thinkingFinished: true, // 恢复时思考已完成
      // 恢复时不需要临时状态
      isStreaming: false,
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
    e.stopPropagation()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = width

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      const deltaX = startX - e.clientX // 向左拖拽为正值
      const newWidth = Math.max(280, Math.min(800, startWidth + deltaX)) // 限制宽度范围
      setWidth(newWidth)
      onWidthChange?.(newWidth)
    }

    const cleanup = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove, true)
      document.removeEventListener('mouseup', handleMouseUp, true)
      document.removeEventListener('mouseleave', handleMouseLeave, true)
      // 移除窗口级别的事件监听器作为备用清理
      window.removeEventListener('mouseup', handleMouseUp, true)
      window.removeEventListener('blur', cleanup, true)
    }

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault()
      cleanup()
    }

    const handleMouseLeave = (e: MouseEvent) => {
      // 当鼠标离开文档时也停止拖拽
      if (e.target === document.documentElement) {
        cleanup()
      }
    }

    // 使用捕获模式添加事件监听器，提高兼容性
    document.addEventListener('mousemove', handleMouseMove, true)
    document.addEventListener('mouseup', handleMouseUp, true)
    document.addEventListener('mouseleave', handleMouseLeave, true)
    // 添加窗口级别的备用事件监听器
    window.addEventListener('mouseup', handleMouseUp, true)
    window.addEventListener('blur', cleanup, true)
  }, [width, onWidthChange])

  // 组件卸载时清理拖拽状态
  useEffect(() => {
    return () => {
      if (isResizing) {
        setIsResizing(false)
        // 清理可能残留的事件监听器
        const cleanup = () => {
          document.removeEventListener('mousemove', () => {}, true)
          document.removeEventListener('mouseup', () => {}, true)
          document.removeEventListener('mouseleave', () => {}, true)
          window.removeEventListener('mouseup', () => {}, true)
          window.removeEventListener('blur', () => {}, true)
        }
        cleanup()
      }
    }
  }, [isResizing])

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
      <div className="p-2 border-b border-gray-200 relative">
        {/* 关闭按钮 + 设置按钮 + 模型选择 */}
        <div className="flex items-center justify-between mb-0 gap-1.5">
          {/* 模型选择 */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <ModelSelect
              value={selectedModel?.id || (allModels[0]?.id || "")}
              onValueChange={handleModelChange}
              placeholder="选择模型"
              className="flex-1"
              showOnlyAvailable={true}
            />
          </div>
          {/* 文件列表展开按钮 + 聊天历史按钮 + 设置按钮 + 关闭按钮 */}
          <div className="flex items-center space-x-0.5">
            {/* 文件列表展开按钮 - 只有当有提取的文件时才显示 */}
            {extractedFiles.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFileList}
                className={`h-7 px-1.5 flex items-center gap-0.5 transition-all relative z-10 ${
                  showFileList
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 rounded-b-none'
                    : 'hover:bg-gray-100 hover:shadow-sm'
                }`}
                title={showFileList ? "收起文件列表" : "展开文件列表"}
              >
                {showFileList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span className="text-xs font-medium">文件列表</span>
                {/* 展开时向下延伸的连接条 */}
                {showFileList && <div className="absolute -bottom-[9px] left-0 right-0 h-[10px] bg-blue-100 rounded-b-none" />}
              </Button>
            )}
            {/* 聊天历史展开按钮 - 始终显示 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleHistoryListMutex}
              className={`h-7 px-1.5 flex items-center gap-0.5 transition-all relative z-10 ${
                showHistoryList
                  ? 'bg-green-100 text-green-700 hover:bg-green-100 rounded-b-none'
                  : 'hover:bg-gray-100 hover:shadow-sm'
              }`}
              title={showHistoryList ? "收起聊天历史" : "展开聊天历史"}
            >
              {showHistoryList ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="text-xs font-medium">聊天历史</span>
              {/* 展开时向下延伸的连接条 */}
              {showHistoryList && <div className="absolute -bottom-[9px] left-0 right-0 h-[10px] bg-green-100 rounded-b-none" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onShowSettings}
              className="h-7 w-7 p-0"
              title="设置"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-7 w-7 p-0"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 文件提取面板 - 添加过渡动画 */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        showFileList ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
      }`}>
        <FileExtractionPanel
          extractedFiles={extractedFiles}
          selectedFiles={syncedSelectedFiles}
          isExtracting={isExtracting}
          showFileList={showFileList}
          onExtractAll={extractAll}
          onCopyFile={copyFile}
          onDeleteFile={deleteFile}
          onClearAllFiles={clearAllFiles}
          onSelectFile={selectFile}
          onSelectAllFiles={selectAllFiles}
        />
      </div>

      {/* 聊天历史面板 - 添加过渡动画 */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
        showHistoryList ? "max-h-[50vh] opacity-100" : "max-h-0 opacity-0"
      }`}>
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

      {/* Messages */}
      <ScrollArea className="flex-1 px-2.5 py-2">
        <div className="space-y-1">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex flex-col group ${message.isUser ? "items-end" : "items-start"}`}
            > 
              {/* 消息气泡 */}
              <div
                className={`max-w-[90%] rounded-xl px-3 py-1.5 transition-shadow ${
                  message.isUser
                    ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm"
                    : "bg-white border border-gray-100 text-gray-700 shadow-sm"
                }`}
              >
                <MarkdownMessage
                  content={message.content}
                  isUser={message.isUser}
                  isStreaming={message.isStreaming}
                  className={message.isUser ? "text-white" : "text-gray-700"}
                  isWaiting={message.isWaiting}
                  waitingStartTime={message.waitingStartTime}
                  thinking={message.thinking}
                  thinkingFinished={message.thinkingFinished}
                  // 替换相关 props
                  replaceCommands={replaceCommands}
                  onAcceptReplace={async (cmd) => {
                    const result = await applyReplace(cmd)
                    if (result.success) {
                      success(`已成功替换 ${cmd.file} 中的内容`, { title: '替换成功' })
                    } else {
                      // 错误已在 hook 中处理
                    }
                  }}
                  onRejectReplace={(cmd) => {
                    updateCommandStatus(cmd.id, 'rejected')
                  }}
                  onNavigateToFile={async (filePath) => {
                    const result = await navigateToFile(filePath)
                    if (!result.success) {
                      console.error('Navigate to file failed:', result.error)
                    }
                  }}
                  onShowInlineDiff={async (cmd) => {
                    const result = await showInlineDiff(cmd)
                    if (result.success) {
                      success(`已在编辑器中显示差异预览 (${result.matchCount} 处匹配)`, { title: '预览' })
                    } else {
                      console.error('Show inline diff failed:', result.error)
                    }
                  }}
                  getFileContent={getFileContent}
                  applyingCommandId={applyingCommandId}
                />
                {/* 显示上下文标签（选中文本和图片） */}
                {message.isUser && (message.selectedText || message.images) && (
                  <div className="mt-1">
                    <MessageContextTags
                      selectedText={message.selectedText}
                      images={message.images}
                      className="text-[10px]"
                    />
                  </div>
                )}
              </div>
              {/* 操作按钮 - 在气泡下方 */}
              <MessageActions
                messageId={message.id}
                messageContent={message.content}
                isUser={message.isUser}
                isStreaming={message.isStreaming}
                onDeleteMessage={handleDeleteMessage}
                onBranchFromMessage={handleBranchFromMessage}
                className="mt-0.5"
              />
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        messages={messages}
        onMessagesChange={setMessages}
        selectedFiles={syncedSelectedFiles}
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

  </DialogProvider>
  )
}
