import { useState } from "react"
import { LLMService, type ChatMessage } from "~lib/llm-service"
import { FileContentProcessor } from "~lib/file-content-processor"
import { SYSTEM_PROMPT } from "~lib/system-prompt"
import { buildFileTreePrompt } from "~components/chat/file/file-tree-utils"
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
  selectedText?: SelectedSnippet
  images?: ImageInfo[] // 添加图片信息字段
  isWaiting?: boolean
  waitingStartTime?: Date
  // 思考过程相关
  thinking?: string
  thinkingFinished?: boolean
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

export interface SelectedSnippet {
  text: string
  fileName?: string
  folderPath?: string
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
  
  const { getModelConfig, selectedModel, modelTemperature, maxTokens } = useSettings()
  const { allModels } = useModels()
  const { error } = useToast()

  const handleSendMessage = async (
    inputValue: string,
    selectedText?: SelectedSnippet,
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
    llmService.updateGenerationParams({
      temperature: modelTemperature,
      maxTokens
    })

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

    // 1. 添加系统提示，帮助LLM理解消息格式和文件编辑功能
    chatHistory.push({
      role: 'system',
      content: SYSTEM_PROMPT
    })

    // 2. 处理选中的文件内容
    const selectedFilesData = extractedFiles.filter(file => selectedFiles.has(file.name))
    if (selectedFilesData.length > 0) {
      const fileMessages = await FileContentProcessor.processFilesForModel(selectedFilesData)
      chatHistory.push(...fileMessages)
    }
    
    // 3. 添加最近的对话历史（最多10条）
    const recentMessages = messages.slice(-10).filter(msg => !msg.isStreaming)
    recentMessages.forEach(msg => {
      if (msg.isUser) {
        // 构建用户消息内容，合并选中文本、用户消息和图片
        const messageContent: Array<{
          type: 'text' | 'image_url'
          text?: string
          image_url?: {
            url: string
            detail?: 'low' | 'high' | 'auto'
          }
        }> = []

        // 构建文本内容 - 使用更清晰的分隔格式
        let textContent = ""
        if (msg.selectedText && msg.selectedText.text && msg.content.trim()) {
          // 有选中内容和用户问题的情况
          textContent = `[用户选中内容]\n${msg.selectedText.text}`
          if (msg.selectedText.fileName || msg.selectedText.folderPath) {
            textContent += `\n\n[选中文件路径]\n${msg.selectedText.folderPath || msg.selectedText.fileName || ''}`
          }
          textContent += `\n\n[基于选中内容的问题]\n${msg.content}`
        } else if (msg.selectedText && msg.selectedText.text) {
          // 只有选中内容没有问题的情况
          textContent = `[用户选中内容]\n${msg.selectedText.text}`
          if (msg.selectedText.fileName || msg.selectedText.folderPath) {
            textContent += `\n\n[选中文件路径]\n${msg.selectedText.folderPath || msg.selectedText.fileName || ''}`
          }
        } else if (msg.content.trim()) {
          // 只有问题没有选中内容的情况
          textContent = msg.content
        }

        if (textContent) {
          messageContent.push({
            type: 'text',
            text: textContent
          })
        }

        // 添加图片
        if (msg.images && msg.images.length > 0) {
          msg.images.forEach(imageInfo => {
            messageContent.push({
              type: 'image_url',
              image_url: {
                url: imageInfo.dataUrl,
                detail: 'auto'
              }
            })
          })
        }

        chatHistory.push({
          role: 'user',
          content: messageContent.length === 1 && messageContent[0].type === 'text'
            ? messageContent[0].text
            : messageContent
        })
      } else {
        // AI回复消息
        chatHistory.push({
          role: 'assistant',
          content: msg.content
        })
      }
    })

    // 生成最新文件列表提示（随用户消息一起发送，避免污染前缀缓存）
    const fileListPromptText =
      extractedFiles.length > 0
        ? buildFileTreePrompt(extractedFiles).text
        : ''

    // 4. 添加当前用户消息（合并选中文本、用户消息和图片）
    const currentMessageContent: Array<{
      type: 'text' | 'image_url'
      text?: string
      image_url?: {
        url: string
        detail?: 'low' | 'high' | 'auto'
      }
    }> = []

    // 构建当前消息的文本内容 - 使用特殊标记区分当前选中内容
    let currentTextContent = ""
    if (selectedText && selectedText.text && inputValue.trim()) {
      // 有选中内容和用户问题的情况 - 使用特殊标记强调这是当前消息的选中内容
      currentTextContent = `[当前消息的用户选中内容]\n${selectedText.text}`
      if (selectedText.fileName || selectedText.folderPath) {
        currentTextContent += `\n\n[选中文件路径]\n${selectedText.folderPath || selectedText.fileName || ''}`
      }
      currentTextContent += `\n\n[当前消息的用户问题]\n${inputValue}`
    } else if (selectedText && selectedText.text) {
      // 只有选中内容没有问题的情况
      currentTextContent = `[当前消息的用户选中内容]\n${selectedText.text}`
      if (selectedText.fileName || selectedText.folderPath) {
        currentTextContent += `\n\n[选中文件路径]\n${selectedText.folderPath || selectedText.fileName || ''}`
      }
    } else if (inputValue.trim()) {
      // 只有问题没有选中内容的情况
      currentTextContent = inputValue
    }

    if (currentTextContent) {
      currentMessageContent.push({
        type: 'text',
        text: currentTextContent
      })
    }

    // 添加图片
    if (uploadedImages.length > 0) {
      uploadedImages.forEach(imageInfo => {
        currentMessageContent.push({
          type: 'image_url',
          image_url: {
            url: imageInfo.dataUrl,
            detail: 'auto'
          }
        })
      })
    }

    // 4.1 先推送文件列表提示（作为 user 角色，声明系统自动提供；放在最新用户消息前，避免前缀缓存失效）
    if (fileListPromptText) {
      chatHistory.push({
        role: 'user',
        content: `[系统自动提供的文件列表参考信息]\n${fileListPromptText}\n（此块为系统生成的最新文件/文件夹及 token 信息，若需访问请使用 @ 选择文件或文件夹，或通过顶部文件列表勾选。）`
      })
    }

    chatHistory.push({
      role: 'user',
      content: currentMessageContent.length === 1 && currentMessageContent[0].type === 'text'
        ? currentMessageContent[0].text
        : currentMessageContent
    })

    // 创建 AbortController
    const controller = new AbortController()
    setAbortController(controller)

    // 开始流式对话
    let fullContent = ""
    let fullThinking = ""
    let thinkingFinished = false
    let hasError = false

    for await (const response of llmService.streamChat(chatHistory, controller.signal)) {
      if (controller.signal.aborted) break

      if (response.error) {
        hasError = true
        fullContent = `❌ **API 调用出错**\n\n**错误信息：**\n${response.error}`
      } else {
        fullContent = response.content
        // 处理思考内容
        if (response.thinking) {
          fullThinking = response.thinking
        }
        if (response.thinkingFinished !== undefined) {
          thinkingFinished = response.thinkingFinished
        }
      }

      onMessagesChange(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? {
              ...msg,
              content: fullContent,
              isStreaming: !response.finished,
              isWaiting: false,
              waitingStartTime: undefined,
              thinking: fullThinking || undefined,
              thinkingFinished
            }
          : msg
      ))

      if (response.finished) {
        break
      }
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
