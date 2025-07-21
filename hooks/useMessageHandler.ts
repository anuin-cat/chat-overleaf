import { useState } from "react"
import { LLMService, type ChatMessage } from "~lib/llm-service"
import { FileContentProcessor } from "~lib/file-content-processor"
import { useSettings } from "./useSettings"
import { useModels } from "./useModels"
import { useToast } from "~components/ui/sonner"
import { type ImageInfo } from "~lib/image-utils"
import { generateId, truncateText } from "~utils/helpers"

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
  isStreaming?: boolean
  selectedText?: string
  images?: ImageInfo[] // 添加图片信息字段
  isWaiting?: boolean
  waitingStartTime?: Date
}

interface ExtractedFile {
  name: string
  content: string
  length: number
}

interface UseMessageHandlerProps {
  messages: Message[]
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  selectedFiles: Set<string>
  extractedFiles: ExtractedFile[]
  llmService: LLMService
  currentChatId?: string
  currentChatName?: string
  onChatNameChange?: (name: string) => void
}

export const useMessageHandler = ({
  messages,
  onMessagesChange,
  selectedFiles,
  extractedFiles,
  llmService,
  currentChatId,
  currentChatName,
  onChatNameChange
}: UseMessageHandlerProps) => {
  const [isStreaming, setIsStreaming] = useState(false)
  const [abortController, setAbortController] = useState<AbortController | null>(null)
  
  const { getModelConfig, selectedModel } = useSettings()
  const { allModels } = useModels()
  const { error } = useToast()

  const handleSendMessage = async (
    inputValue: string,
    selectedText?: string,
    uploadedImages: ImageInfo[] = []
  ) => {
    if (!inputValue.trim() || isStreaming) return

    // 确保有选中的模型，如果没有选中模型，使用第一个可用模型
    const currentModel = selectedModel || allModels[0]

    if (!currentModel) {
      error('没有可用的模型，请在设置中配置模型和API Key。', {
        title: '配置错误'
      })
      return
    }

    // 每次发送消息时重新获取最新的模型配置
    const currentModelConfig = getModelConfig(currentModel)

    // 检查当前模型是否可用
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

    const userMessage: Message = {
      id: generateId(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
      selectedText,
      images: uploadedImages.length > 0 ? uploadedImages : undefined
    }

    // 如果是第一条用户消息且没有设置聊天名称，自动设置名称
    if (onChatNameChange && (!currentChatName || currentChatName === "")) {
      const firstUserMessage = messages.find(msg => msg.isUser)
      if (!firstUserMessage) {
        const name = truncateText(inputValue, 20)
        onChatNameChange(name)
      }
    }

    // 添加用户消息
    onMessagesChange([...messages, userMessage])
    setIsStreaming(true)

    // 创建 AI 回复消息
    const aiMessageId = generateId()
    const aiMessage: Message = {
      id: aiMessageId,
      content: "",
      isUser: false,
      timestamp: new Date(),
      isStreaming: true,
      isWaiting: true,
      waitingStartTime: new Date()
    }
    onMessagesChange([...messages, userMessage, aiMessage])

    try {
      await processStreamingResponse(
        inputValue,
        selectedText,
        uploadedImages,
        currentModelConfig,
        aiMessageId
      )
    } catch (error) {
      await handleStreamingError(error, aiMessageId)
    } finally {
      setIsStreaming(false)
      setAbortController(null)
    }
  }

  const processStreamingResponse = async (
    inputValue: string,
    selectedText: string | undefined,
    uploadedImages: ImageInfo[],
    currentModelConfig: any,
    aiMessageId: string
  ) => {
    // 准备聊天历史
    const chatHistory: ChatMessage[] = []

    // 1. 处理选中的文件内容
    const selectedFilesData = extractedFiles.filter(file => selectedFiles.has(file.name))
    if (selectedFilesData.length > 0) {
      const fileMessages = await FileContentProcessor.processFilesForModel(selectedFilesData)
      chatHistory.push(...fileMessages)
    }
    
    // 2. 添加最近的对话历史（最多10条）
    const recentMessages = messages.slice(-10).filter(msg => !msg.isStreaming)
    recentMessages.forEach(msg => {
      // 如果是用户消息且有选中文本，添加相应的系统消息
      if (msg.isUser && msg.selectedText) {
        chatHistory.push({
          role: 'system',
          content: `用户在 Overleaf 编辑器中选中了：\n\n${msg.selectedText}`
        })
      }

      // 添加基本消息（包含图片）
      if (msg.isUser && msg.images && msg.images.length > 0) {
        // 用户消息包含图片
        const messageContent: Array<{
          type: 'text' | 'image_url'
          text?: string
          image_url?: {
            url: string
            detail?: 'low' | 'high' | 'auto'
          }
        }> = []

        if (msg.content.trim()) {
          messageContent.push({
            type: 'text',
            text: msg.content
          })
        }

        msg.images.forEach(imageInfo => {
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: imageInfo.dataUrl,
              detail: 'auto'
            }
          })
        })

        chatHistory.push({
          role: 'user',
          content: messageContent
        })
      } else {
        // 普通消息（文本或AI回复）
        chatHistory.push({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.content
        })
      }
    })

    // 3. 添加当前选中文本内容
    if (selectedText) {
      chatHistory.push({
        role: 'system',
        content: `用户在 Overleaf 编辑器中选中了以下内容：\n\n${selectedText}`
      })
    }

    // 4. 添加当前用户消息（包含图片）
    // if (uploadedImages.length > 0  && currentModelConfig.multimodal) {
    if (uploadedImages.length > 0) {
      // 多模态消息
      const messageContent: Array<{
        type: 'text' | 'image_url'
        text?: string
        image_url?: {
          url: string
          detail?: 'low' | 'high' | 'auto'
        }
      }> = []

      if (inputValue.trim()) {
        messageContent.push({
          type: 'text',
          text: inputValue
        })
      }

      uploadedImages.forEach(imageInfo => {
        messageContent.push({
          type: 'image_url',
          image_url: {
            url: imageInfo.dataUrl,
            detail: 'auto'
          }
        })
      })

      chatHistory.push({
        role: 'user',
        content: messageContent
      })
    } else {
      chatHistory.push({
        role: 'user',
        content: inputValue
      })
    }

    // 创建 AbortController
    const controller = new AbortController()
    setAbortController(controller)

    // 开始流式对话
    let fullContent = ""
    let hasError = false

    for await (const response of llmService.streamChat(chatHistory, controller.signal)) {
      if (controller.signal.aborted) break

      if (response.error) {
        hasError = true
        fullContent = `❌ **API 调用出错**\n\n**错误信息：**\n${response.error}`
      } else {
        fullContent = response.content
      }

      onMessagesChange(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? {
              ...msg,
              content: fullContent,
              isStreaming: !response.finished,
              isWaiting: false,
              waitingStartTime: undefined
            }
          : msg
      ))

      if (response.finished) {
        break
      }
    }

    if (hasError) {
      console.error('LLM API Error displayed in chat')
    }
  }

  const handleStreamingError = async (error: unknown, aiMessageId: string) => {
    console.error('Chat error:', error)

    const errorMessage = error instanceof Error ? error.message : '未知错误'
    const detailedErrorContent = `❌ **请求处理出错**\n\n**错误信息：**\n${errorMessage}\n\n**可能的原因：**\n- 网络连接中断\n- 服务器响应超时\n- API 服务暂时不可用\n- 请求被中止\n\n**建议解决方案：**\n1. 检查网络连接\n2. 稍后重试\n3. 尝试切换其他模型\n4. 如果问题持续，请联系技术支持`

    onMessagesChange(prev => prev.map(msg =>
      msg.id === aiMessageId
        ? {
            ...msg,
            content: detailedErrorContent,
            isStreaming: false,
            isWaiting: false,
            waitingStartTime: undefined
          }
        : msg
    ))
  }

  const handleStopStreaming = () => {
    if (abortController) {
      abortController.abort()
      setIsStreaming(false)
      setAbortController(null)
    }
  }

  return {
    isStreaming,
    handleSendMessage,
    handleStopStreaming
  }
}
