import React from "react"
import { Button } from "~components/ui/button"
import { Textarea } from "~components/ui/textarea"
import { ContextTags } from "./context-tags"
import { FilePreviewModal } from "./file-preview-modal"
import { Send, Square, Eraser } from "lucide-react"
import { LLMService } from "~lib/llm-service"
import { type ImageInfo } from "~lib/image-utils"
import { useToast } from "~components/ui/sonner"
import { useSelectedText } from "~hooks/useSelectedText"
import { useMessageHandler } from "~hooks/useMessageHandler"
import { useImageHandler } from "~hooks/useImageHandler"
import { useInputHandler } from "~hooks/useInputHandler"
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
}

interface ExtractedFile {
  name: string
  content: string
  length: number
}

interface ChatInputProps {
  messages: Message[]
  onMessagesChange: React.Dispatch<React.SetStateAction<Message[]>>
  selectedFiles: Set<string>
  extractedFiles: ExtractedFile[]
  llmService: LLMService
  disabled?: boolean
  onFileSelectionChange?: (selectedFiles: Set<string>) => void
  onSaveChatHistory?: (messages: Message[]) => Promise<any>
  isOnlyInitialMessage?: (messages: Message[]) => boolean
  currentChatId?: string
  currentChatName?: string
  onChatNameChange?: (name: string) => void
  onChatIdChange?: (id: string) => void
}

export const ChatInput = ({
  messages,
  onMessagesChange,
  selectedFiles,
  extractedFiles,
  llmService,
  disabled = false,
  onFileSelectionChange,
  onSaveChatHistory,
  isOnlyInitialMessage,
  currentChatId,
  currentChatName,
  onChatNameChange,
  onChatIdChange
}: ChatInputProps) => {
  // 使用消息处理 hook
  const { isStreaming, handleSendMessage, handleStopStreaming } = useMessageHandler({
    messages,
    onMessagesChange,
    selectedFiles,
    extractedFiles,
    llmService,
    currentChatId,
    currentChatName,
    onChatNameChange
  })

  // 使用图片处理 hook
  const {
    uploadedImages,
    previewModal,
    handleImageClick,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleRemoveImage,
    handleClosePreview,
    clearImages
  } = useImageHandler()

  // 使用输入框处理 hook
  const {
    inputValue,
    textareaRef,
    handleInputChange,
    handleKeyDown,
    clearInput
  } = useInputHandler()

  // 使用 toast hook
  const { info } = useToast()

  // 使用选中文本 hook
  const { selectedText, clearSelectedText, hasSelection } = useSelectedText()





  // 清理所有对话内容
  const handleClearChat = async () => {
    // 如果当前对话不是只有初始消息，先保存当前对话
    if (onSaveChatHistory && !isOnlyInitialMessage(messages)) {
      await onSaveChatHistory(messages)
    }

    // 重置消息列表和图片
    onMessagesChange([
      {
        id: "1",
        content: "你好！我是你的 Overleaf 助手，有什么可以帮助你的吗？",
        isUser: false,
        timestamp: new Date()
      }
    ])
    clearImages() // 清空图片
    clearSelectedText() // 清空选中文本

    // 重置聊天ID和名称，创建新的聊天会话
    if (onChatIdChange) {
      const newChatId = `chat_${generateId()}`
      onChatIdChange(newChatId)
    }
    if (onChatNameChange) {
      onChatNameChange("")
    }

    clearInput()
    info('对话记录已清空', { title: '清空完成' })
  }

  // 处理文件删除
  const handleRemoveFile = (fileName: string) => {
    if (onFileSelectionChange) {
      const newSelectedFiles = new Set(selectedFiles)
      newSelectedFiles.delete(fileName)
      onFileSelectionChange(newSelectedFiles)
    }
  }

  // 发送消息的包装函数
  const onSendMessage = () => {
    const messageSelectedText = hasSelection ? selectedText.text : undefined
    handleSendMessage(inputValue, messageSelectedText, uploadedImages)
    clearInput()
    clearImages()
    clearSelectedText()
  }

  return (
    <div className="p-2 border-t border-gray-200">
      {/* 标签区域 */}
      <ContextTags
        selectedFiles={selectedFiles}
        selectedText={selectedText}
        uploadedImages={uploadedImages}
        onRemoveFile={handleRemoveFile}
        onRemoveSelectedText={clearSelectedText}
        onImageClick={handleImageClick}
        onRemoveImage={handleRemoveImage}
        className="mb-1.5"
      />

      {/* 图片预览模态框 */}
      <FilePreviewModal
        isOpen={previewModal.isOpen}
        onClose={handleClosePreview}
        fileName={previewModal.fileName}
        imageUrls={previewModal.imageUrls}
        isLoading={previewModal.isLoading}
        error={previewModal.error}
      />
      
      <div className="flex items-end space-x-2">
        <Textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => handleKeyDown(e, onSendMessage, handleStopStreaming, isStreaming)}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          placeholder="Shift + Enter 换行，Enter 发送，支持粘贴或拖拽图片"
          className="flex-1 min-h-[72px] max-h-[200px] overflow-y-auto text-sm resize-none"
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
            onClick={isStreaming ? handleStopStreaming : onSendMessage}
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
