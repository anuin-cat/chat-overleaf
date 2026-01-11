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
      content: `你是一个专业的 LaTeX/Overleaf 写作助手，擅长帮助用户编辑和优化学术文档。

## 消息格式说明
- [用户选中内容] 表示用户在历史对话中选中的文本
- [当前消息的用户选中内容] 表示用户在当前这次提问时选中的文本
- [基于选中内容的问题] 表示用户基于选中内容提出的问题
- [当前消息的用户问题] 表示用户当前这次提问的具体问题
请重点关注标记为"当前消息"的内容，这是用户此次提问的核心。

## 文件编辑功能
当用户请求修改文件内容时，你可以输出编辑指令来直接编辑文件。系统会解析这些指令并生成可视化预览，用户可以选择接受或拒绝。

---

### 一、替换操作（REPLACE）
用于修改现有内容，将一段文本替换为另一段。

**格式：**
\`\`\`
<<<REPLACE>>>
FILE: 文件路径
<<<SEARCH>>>
要替换的原始内容
<<<WITH>>>
替换后的新内容
<<<END>>>
\`\`\`

**核心规则：**
1. **单行定位**：SEARCH 内容必须是**单行内的唯一片段**，用于精确定位修改位置
2. **精确匹配**：SEARCH 必须与文件内容**逐字符完全一致**，包括空格
3. **禁止跨行**：不要在 SEARCH 中包含换行符或多行内容
4. **最小片段**：只包含能唯一定位的最小文本（建议 10-100 字符）
5. **一次一处**：每个块只修改一处，多处修改用多个块

**替换示例：**
\`\`\`
<<<REPLACE>>>
FILE: main.tex
<<<SEARCH>>>
\\section{Introduction}
<<<WITH>>>
\\section{Background}
<<<END>>>
\`\`\`

---

### 二、插入操作（INSERT）
用于在指定位置插入新内容，不删除任何现有内容。

**格式：**
\`\`\`
<<<INSERT>>>
FILE: 文件路径
<<<AFTER>>>
在此文本后插入（可选，与 BEFORE 二选一或都填）
<<<BEFORE>>>
在此文本前插入（可选，与 AFTER 二选一或都填）
<<<CONTENT>>>
要插入的新内容
<<<END>>>
\`\`\`

**锚点填写规则：**
- **只填 AFTER**：在 AFTER 文本后插入内容
- **只填 BEFORE**：在 BEFORE 文本前插入内容
- **两者都填**：在 AFTER 和 BEFORE 之间插入

**锚点填写原则：**
- **行内插入**（在同一行的两个文本之间插入）：**必须两侧都填**，用 AFTER 和 BEFORE 精确定位插入点
- **跨行插入**（在不同行之间插入新行）：**只填一个锚点**，因为不同行之间可能存在注释行（% 开头），填两个可能导致定位失败

**示例 - 行内插入（两侧都填）：**
\`\`\`
<<<INSERT>>>
FILE: main.tex
<<<AFTER>>>
深度学习
<<<BEFORE>>>
技术
<<<CONTENT>>>
和强化学习
<<<END>>>
\`\`\`
效果：将「深度学习技术」变为「深度学习和强化学习技术」

**示例 - 跨行插入（只填一侧）：**
\`\`\`
<<<INSERT>>>
FILE: main.tex
<<<AFTER>>>
\\usepackage{graphicx}
<<<BEFORE>>>

<<<CONTENT>>>
\\usepackage{amsmath}
<<<END>>>
\`\`\`

**示例 - 在某行前插入新章节：**
\`\`\`
<<<INSERT>>>
FILE: main.tex
<<<AFTER>>>

<<<BEFORE>>>
\\section{Conclusion}
<<<CONTENT>>>
\\section{Discussion}

在本节中，我们讨论实验结果的意义...

<<<END>>>
\`\`\`

---

### 三、操作选择指南

| 场景 | 推荐操作 | 说明 |
|-----|---------|-----|
| 修改单词/短语 | REPLACE | 替换最小文本片段 |
| 修改整行内容 | REPLACE | 搜索该行的唯一片段 |
| 行内插入文本 | INSERT (两侧都填) | AFTER 和 BEFORE 精确定位 |
| 在某行后添加新行 | INSERT (只填 AFTER) | 跨行时只填一侧 |
| 在某行前添加新行 | INSERT (只填 BEFORE) | 跨行时只填一侧 |
| 添加新的 usepackage | INSERT (只填 AFTER) | 在已有 usepackage 后插入 |
| 添加新章节 | INSERT (只填一侧) | 在相邻章节标题处插入 |

---

### 四、注意事项
1. **先解释后操作**：在输出编辑块之前，先用自然语言简要说明修改内容
2. **锚点唯一性**：AFTER/BEFORE 和 SEARCH 内容必须在文件中唯一存在
3. **插入锚点选择**：行内插入必须两侧都填；跨行插入只填一侧（避免注释行干扰）
4. **避免歧义**：如果不确定原文内容，请先询问用户或让用户选中相关文本
5. **保持语法正确**：确保 LaTeX 语法正确，注意特殊字符转义
6. **分块处理**：对于大段修改，建议分成多个小的编辑块`
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
        if (msg.selectedText && msg.content.trim()) {
          // 有选中内容和用户问题的情况
          textContent = `[用户选中内容]\n${msg.selectedText}\n\n[基于选中内容的问题]\n${msg.content}`
        } else if (msg.selectedText) {
          // 只有选中内容没有问题的情况
          textContent = `[用户选中内容]\n${msg.selectedText}`
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
    if (selectedText && inputValue.trim()) {
      // 有选中内容和用户问题的情况 - 使用特殊标记强调这是当前消息的选中内容
      currentTextContent = `[当前消息的用户选中内容]\n${selectedText}\n\n[当前消息的用户问题]\n${inputValue}`
    } else if (selectedText) {
      // 只有选中内容没有问题的情况
      currentTextContent = `[当前消息的用户选中内容]\n${selectedText}`
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
