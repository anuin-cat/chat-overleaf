import React, { useEffect, useMemo, useRef, useState } from "react"
import { Button } from "../ui/button"
import { Textarea } from "../ui/textarea"
import { ScrollArea } from "../ui/scroll-area"
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

const isCjk = (code: number) =>
  (code >= 0x4e00 && code <= 0x9fff) ||
  (code >= 0x3400 && code <= 0x4dbf) ||
  (code >= 0xf900 && code <= 0xfaff) ||
  (code >= 0x3040 && code <= 0x30ff) ||
  (code >= 0xac00 && code <= 0xd7af)

const estimateTokenWeight = (text: string) => {
  let weight = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === " " || ch === "\n" || ch === "\t" || ch === "\r") {
      weight += 0.25
      continue
    }
    if (isCjk(code)) {
      weight += 1
      continue
    }
    if (code <= 0x007f) {
      if (
        (code >= 0x30 && code <= 0x39) ||
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a)
      ) {
        weight += 0.25
      } else {
        weight += 0.5
      }
      continue
    }
    weight += 0.8
  }
  return weight
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
    clearInput,
    adjustTextareaHeight,
    setInputValue
  } = useInputHandler()

  // 使用 toast hook
  const { info } = useToast()

  // 使用选中文本 hook
  const { selectedText, clearSelectedText, hasSelection } = useSelectedText()

  // @ 文件选择提示状态
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const [isMentionListOpen, setIsMentionListOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const mentionItemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  // 可供 @ 选择的文件名列表（过滤已选文件）
  const mentionOptions = useMemo(() => {
    const available = extractedFiles
      .map(file => file.name)
      .filter(name => !selectedFiles.has(name))

    if (!mentionQuery) return available
    const lower = mentionQuery.toLowerCase()
    return available.filter(name => name.toLowerCase().includes(lower))
  }, [extractedFiles, mentionQuery, selectedFiles])

  const estimatedFileTokens = useMemo(() => {
    if (selectedFiles.size === 0) return 0
    let weight = 0
    for (const file of extractedFiles) {
      if (!selectedFiles.has(file.name)) continue
      if (file.content) {
        weight += estimateTokenWeight(file.content)
      }
    }
    return weight > 0 ? Math.max(1, Math.ceil(weight)) : 0
  }, [selectedFiles, extractedFiles])

  // 输入时更新 @ 状态
  const updateMentionState = (value: string, cursor: number) => {
    if (extractedFiles.length === 0) {
      setIsMentionListOpen(false)
      setMentionStart(null)
      setMentionQuery("")
      return
    }

    const textBeforeCursor = value.slice(0, cursor)
    const match = /(?:^|\s)@([^\s@]*)$/.exec(textBeforeCursor)

    if (match) {
      const query = match[1] || ""
      setMentionQuery(query)
      setMentionStart(cursor - query.length - 1) // 记录 @ 开始位置
      setIsMentionListOpen(true)
      setHighlightedIndex(0)
    } else {
      setIsMentionListOpen(false)
      setMentionStart(null)
      setMentionQuery("")
    }
  }

  // 处理输入变化并同步 @ 状态
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e)
    const cursor = e.target.selectionStart ?? e.target.value.length
    updateMentionState(e.target.value, cursor)
  }

  // 选择 @ 提示项
  const handleMentionSelect = (fileName: string) => {
    if (onFileSelectionChange) {
      const newSelectedFiles = new Set(selectedFiles)
      newSelectedFiles.add(fileName)
      onFileSelectionChange(newSelectedFiles)
      info(`已添加 ${fileName}`, { title: '文件已添加' })
    }

    // 将输入框中的 @ 查询文本删除（不保留在输入框中）
    if (mentionStart !== null) {
      const before = inputValue.slice(0, mentionStart)
      const after = inputValue.slice(mentionStart + mentionQuery.length + 1)
      const newValue = `${before}${after}`
      setInputValue(newValue)
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = before.length
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(newPos, newPos)
          adjustTextareaHeight()
        }
      }, 0)
    }

    setIsMentionListOpen(false)
    setMentionQuery("")
    setMentionStart(null)
    setHighlightedIndex(0)
  }

  // 键盘导航 @ 提示
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMentionListOpen) {
      if (e.key === "ArrowDown" && mentionOptions.length > 0) {
        e.preventDefault()
        setHighlightedIndex(prev => (prev + 1) % mentionOptions.length)
        return
      }
      if (e.key === "ArrowUp" && mentionOptions.length > 0) {
        e.preventDefault()
        setHighlightedIndex(prev => (prev - 1 + mentionOptions.length) % mentionOptions.length)
        return
      }
      if ((e.key === "Enter" || e.key === "Tab") && mentionOptions.length > 0) {
        e.preventDefault()
        handleMentionSelect(mentionOptions[highlightedIndex] || mentionOptions[0])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setIsMentionListOpen(false)
        return
      }
    }

    handleKeyDown(e, onSendMessage, handleStopStreaming, isStreaming)
  }

  // 当候选为空时关闭列表
  useEffect(() => {
    if (isMentionListOpen && mentionOptions.length === 0) {
      setIsMentionListOpen(false)
    }
  }, [isMentionListOpen, mentionOptions.length])

  // 高亮项滚动到可视范围内
  useEffect(() => {
    if (!isMentionListOpen) return
    const targetName = mentionOptions[highlightedIndex]
    if (!targetName) return
    const target = mentionItemRefs.current[targetName]
    if (target) {
      target.scrollIntoView({ block: "nearest" })
    }
  }, [highlightedIndex, mentionOptions, isMentionListOpen])


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
    setIsMentionListOpen(false)
    setMentionQuery("")
    setMentionStart(null)
    setHighlightedIndex(0)

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

  // 清空所有文件
  const handleClearAllFiles = () => {
    if (onFileSelectionChange) {
      onFileSelectionChange(new Set())
      info('已取消所有文件选中', { title: '清空完成' })
    }
  }

  // 发送消息的包装函数
  const onSendMessage = () => {
    const messageSelectedText = hasSelection ? selectedText.text : undefined
    handleSendMessage(inputValue, messageSelectedText, uploadedImages)
    clearInput()
    clearImages()
    clearSelectedText()
    setIsMentionListOpen(false)
    setMentionQuery("")
    setMentionStart(null)
    setHighlightedIndex(0)
  }

  return (
    <div className="p-2 border-t border-gray-200">
      {/* 标签区域 */}
      <ContextTags
        selectedFiles={selectedFiles}
        fileTokenEstimate={estimatedFileTokens}
        selectedText={selectedText}
        uploadedImages={uploadedImages}
        onRemoveFile={handleRemoveFile}
        onRemoveSelectedText={clearSelectedText}
        onImageClick={handleImageClick}
        onRemoveImage={handleRemoveImage}
        onClearAllFiles={handleClearAllFiles}
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
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleTextareaKeyDown}
            onPaste={handlePaste}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            placeholder="Shift + Enter 换行，Enter 发送，支持粘贴或拖拽图片，输入 @ 可快速添加文件"
            className="min-h-[72px] max-h-[200px] overflow-y-auto text-sm resize-none"
            disabled={isStreaming || disabled}
            autoComplete="off"
            data-form-type="other"
            rows={1}
          />
          {isMentionListOpen && (
            <div className="absolute left-0 right-0 bottom-full z-50 mb-2 overflow-hidden rounded-md border bg-white shadow-lg">
              {mentionOptions.length > 0 ? (
                <ScrollArea className="max-h-60">
                  <div className="py-1">
                    {mentionOptions.map((fileName, index) => (
                      <button
                        key={fileName}
                        ref={el => { mentionItemRefs.current[fileName] = el }}
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                          index === highlightedIndex ? "bg-gray-100 text-blue-600" : ""
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleMentionSelect(fileName)
                        }}
                      >
                        <span className="truncate">{fileName}</span>
                        <span className="ml-2 text-[11px] text-gray-400">回车选择</span>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="px-3 py-2 text-xs text-gray-500">暂无可添加的文件</div>
              )}
            </div>
          )}
        </div>
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
