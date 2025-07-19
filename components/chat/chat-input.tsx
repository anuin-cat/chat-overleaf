import React, { useState, useRef, useEffect } from "react"
import { Button } from "~components/ui/button"
import { Textarea } from "~components/ui/textarea"
import { ContextTags } from "./context-tags"
import { Send, Square, Eraser } from "lucide-react"
import { LLMService, type ChatMessage } from "~lib/llm-service"
import { useSettings } from "~hooks/useSettings"
import { useToast } from "~components/ui/sonner"
import { useSelectedText } from "~hooks/useSelectedText"
import { defaultModel } from "~lib/models"

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

interface ExtractedFile {
  name: string
  content: string
}

interface ChatInputProps {
  messages: Message[]
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  selectedFiles: Set<string>
  extractedFiles: ExtractedFile[]
  llmService: LLMService
  disabled?: boolean
  onFileSelectionChange?: (selectedFiles: Set<string>) => void
}

export const ChatInput = ({
  messages,
  onMessagesChange,
  selectedFiles,
  extractedFiles,
  llmService,
  disabled = false,
  onFileSelectionChange
}: ChatInputProps) => {
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  const [currentSelectedText, setCurrentSelectedText] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 使用设置 hook
  const { getModelConfig, selectedModel } = useSettings()

  // 使用 toast hook
  const { success, error, info } = useToast()

  // 使用选中文本 hook
  const { selectedText, clearSelectedText, hasSelection } = useSelectedText()

  // 自适应高度函数
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    // 重置高度以获取正确的 scrollHeight
    textarea.style.height = 'auto'

    // 获取内容高度
    const scrollHeight = textarea.scrollHeight

    // 设置最小和最大高度（基于 CSS 中的设置）
    const minHeight = 36 // min-h-[36px]
    const maxHeight = 240 // max-h-[240px]

    // 设置高度，限制在最小和最大高度之间
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight)
    textarea.style.height = `${newHeight}px`
  }

  // 监听输入值变化，自动调整高度
  useEffect(() => {
    adjustTextareaHeight()
  }, [inputValue])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return

    // 确保有选中的模型
    const currentModel = selectedModel || defaultModel

    // 每次发送消息时重新获取最新的模型配置（包含最新的 API key 和 base URL）
    const currentModelConfig = getModelConfig(currentModel)

    // 检查当前模型是否可用（有 API key）
    if (!currentModelConfig.api_key || !currentModelConfig.base_url) {
      error(`当前模型 ${currentModel.display_name} 未配置 API Key 或 Base URL，请在设置中配置后再使用。`, {
        title: '配置错误'
      })
      return
    }

    // 使用最新的模型配置更新 LLM 服务
    llmService.updateModel(currentModelConfig)

    // 调试信息
    console.log('Sending message with model:', currentModelConfig.display_name)
    console.log('API Key available:', !!currentModelConfig.api_key)
    console.log('Base URL:', currentModelConfig.base_url)

    // 保存当前选中的文本（如果有的话）
    const messageSelectedText = hasSelection ? selectedText.text : undefined

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
      selectedText: messageSelectedText
    }

    // 添加用户消息
    onMessagesChange([...messages, userMessage])
    const currentInput = inputValue
    setInputValue("")
    // 重置 textarea 高度
    setTimeout(() => adjustTextareaHeight(), 0)
    setIsStreaming(true)

    // 创建 AI 回复消息
    const aiMessageId = (Date.now() + 1).toString()
    const aiMessage: Message = {
      id: aiMessageId,
      content: "",
      isUser: false,
      timestamp: new Date(),
      isStreaming: true,
      isWaiting: true, // 所有模型都显示等待状态
      waitingStartTime: new Date() // 记录等待开始时间
    }
    onMessagesChange([...messages, userMessage, aiMessage])

    try {
      // 准备聊天历史
      const chatHistory: ChatMessage[] = []

      // 添加选中的文件内容作为上下文（持续提供）
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

      // 添加选中文本内容（仅本次消息）
      if (messageSelectedText) {
        chatHistory.push({
          role: 'system',
          content: `用户在编辑器中选中了以下内容：\n\n${messageSelectedText}`
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
      let isFirstToken = true
      for await (const response of llmService.streamChat(chatHistory, controller.signal)) {
        if (controller.signal.aborted) break

        fullContent = response.content

        onMessagesChange(prev => prev.map(msg =>
          msg.id === aiMessageId
            ? {
                ...msg,
                content: fullContent,
                isStreaming: !response.finished,
                isWaiting: false, // 收到第一个token后取消等待状态
                waitingStartTime: undefined
              }
            : msg
        ))

        isFirstToken = false

        if (response.finished) {
          break
        }
      }
    } catch (error) {
      console.error('Chat error:', error)
      error('发生了错误，请稍后重试', { title: '请求失败' })
      onMessagesChange(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? {
              ...msg,
              content: "抱歉，发生了错误，请稍后重试。",
              isStreaming: false,
              isWaiting: false,
              waitingStartTime: undefined
            }
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

  // 清理所有对话内容
  const handleClearChat = () => {
    onMessagesChange([
      {
        id: "1",
        content: "你好！我是你 Overleaf 助手，有什么可以帮助你的吗？",
        isUser: false,
        timestamp: new Date()
      }
    ])
    setInputValue("")
    // 重置 textarea 高度
    setTimeout(() => adjustTextareaHeight(), 0)
    info('对话记录已清空', { title: '清空完成' })
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }

  // 处理文件删除
  const handleRemoveFile = (fileName: string) => {
    if (onFileSelectionChange) {
      const newSelectedFiles = new Set(selectedFiles)
      newSelectedFiles.delete(fileName)
      onFileSelectionChange(newSelectedFiles)
    }
  }

  return (
    <div className="p-4 border-t border-gray-200">
      {/* 标签区域 */}
      <ContextTags
        selectedFiles={selectedFiles}
        selectedText={selectedText}
        onRemoveFile={handleRemoveFile}
        onRemoveSelectedText={clearSelectedText}
        className="mb-3"
      />

      <div className="flex items-end space-x-2">
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Shift + Enter 换行，Enter 发送"
          className="flex-1 min-h-[72px] max-h-[240px] overflow-y-auto text-sm resize-none"
          disabled={isStreaming || disabled}
          autoComplete="off"
          data-form-type="other"
          rows={1}
        />
        <div className="flex flex-col space-y-2">
          <Button
            onClick={handleClearChat}
            size="sm"
            variant="outline"
            title="清理对话"
            disabled={isStreaming || disabled}
          >
            <Eraser className="h-4 w-4" />
          </Button>
          <Button
            onClick={isStreaming ? handleStopStreaming : handleSendMessage}
            size="sm"
            variant={isStreaming ? "destructive" : "default"}
            title="发送消息"
            disabled={disabled}
          >
            {isStreaming ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
