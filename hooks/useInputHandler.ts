import { useState, useRef, useEffect } from "react"

export const useInputHandler = () => {
  const [inputValue, setInputValue] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // 跟踪输入法是否处于编辑状态（composition）
  const isComposingRef = useRef(false)

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

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }

  // 处理输入法组合开始
  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  // 处理输入法组合结束
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false
    // 更新输入值，确保拼音被正确输入到输入框
    setInputValue(e.currentTarget.value)
  }

  // 处理键盘事件
  const handleKeyDown = (
    e: React.KeyboardEvent,
    onSend: () => void,
    onStop: () => void,
    isStreaming: boolean
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // 如果输入法正在编辑中，不处理回车事件，让输入法自己处理
      // 这样按回车会将拼音输入到输入框，而不是发送消息
      if (isComposingRef.current) {
        return
      }
      e.preventDefault()
      if (isStreaming) {
        onStop()
      } else {
        onSend()
      }
    }
  }

  // 清空输入
  const clearInput = () => {
    setInputValue("")
    // 重置 textarea 高度
    setTimeout(() => adjustTextareaHeight(), 0)
  }

  return {
    inputValue,
    textareaRef,
    handleInputChange,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
    clearInput,
    adjustTextareaHeight,
    setInputValue
  }
}
