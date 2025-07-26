import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import { useEffect, useState, useRef } from 'react'
import { cn } from "~lib/utils"

interface MarkdownMessageProps {
  content: string
  isUser: boolean
  isStreaming?: boolean
  className?: string
  isWaiting?: boolean
  waitingStartTime?: Date
}

// 创建独立的 marked 实例，避免全局配置冲突
const markedInstance = new Marked({
  breaks: true, // 支持换行符
  gfm: true, // 支持 GitHub Flavored Markdown
}, markedKatex({
  nonStandard: true, // 支持非标准格式（无空格的 $ 符号）
  throwOnError: false, // 遇到错误时不抛出异常
  output: 'html', // 只输出 HTML，避免重复渲染
  displayMode: false, // 默认行内模式
  fleqn: false, // 不左对齐
  macros: {}, // 自定义宏
  strict: false, // 不严格模式，允许一些便利功能
} as any))

export const MarkdownMessage = ({ content, isUser, isStreaming, className, isWaiting, waitingStartTime }: MarkdownMessageProps) => {
  // 等待时间计时器
  const [waitingTime, setWaitingTime] = useState(0)
  // 复制状态管理
  const [copiedBlocks, setCopiedBlocks] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  // 更新等待时间
  useEffect(() => {
    if (isWaiting && waitingStartTime) {
      const interval = setInterval(() => {
        const now = new Date()
        const elapsed = Math.floor((now.getTime() - waitingStartTime.getTime()) / 1000)
        setWaitingTime(elapsed)
      }, 1000)

      return () => clearInterval(interval)
    } else {
      setWaitingTime(0)
    }
  }, [isWaiting, waitingStartTime])

  // 复制代码块内容
  const copyCodeBlock = async (code: string, blockId: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedBlocks(prev => new Set(prev).add(blockId))
      // 2秒后清除复制状态
      setTimeout(() => {
        setCopiedBlocks(prev => {
          const newSet = new Set(prev)
          newSet.delete(blockId)
          return newSet
        })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  // 动态加载 KaTeX CSS 到 Shadow DOM
  useEffect(() => {
    const loadKatexCSS = async () => {
      // 检查是否在 Shadow DOM 中
      const shadowRoot = document.querySelector('plasmo-csui')?.shadowRoot
      const targetDocument = shadowRoot || document

      // 检查是否已经加载了 KaTeX CSS
      const existingStyle = targetDocument.querySelector('style[data-katex]')
      if (existingStyle) return

      try {
        // 获取 KaTeX CSS（使用与安装包一致的版本）
        const response = await fetch('https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css')
        const cssText = await response.text()

        // 创建 style 元素并注入 CSS
        const style = document.createElement('style')
        style.setAttribute('data-katex', 'true')
        style.textContent = cssText

        // 添加到适当的位置
        if (shadowRoot) {
          shadowRoot.appendChild(style)
        } else {
          document.head.appendChild(style)
        }
      } catch (error) {
        console.error('Failed to load KaTeX CSS:', error)
      }
    }
    loadKatexCSS()
  }, [])

  // 为代码块添加复制按钮
  useEffect(() => {
    if (!containerRef.current || isUser || isWaiting) return

    const codeBlocks = containerRef.current.querySelectorAll('pre')

    codeBlocks.forEach((pre, index) => {
      // 避免重复添加按钮
      if (pre.querySelector('.copy-button-container')) return

      const code = pre.querySelector('code')
      if (!code) return

      const codeText = code.textContent || ''
      const blockId = `code-block-${index}`

      // 创建复制按钮容器
      const buttonContainer = document.createElement('div')
      buttonContainer.className = 'copy-button-container absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200'

      // 创建复制按钮
      const copyButton = document.createElement('button')
      copyButton.className = 'flex items-center justify-center w-8 h-8 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors duration-200'
      copyButton.title = '复制代码'

      // 创建图标
      const icon = document.createElement('div')
      icon.className = 'w-4 h-4'

      const updateIcon = (copied: boolean) => {
        icon.innerHTML = copied
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"></polyline></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>'
      }

      updateIcon(false)
      copyButton.appendChild(icon)

      // 点击事件
      copyButton.addEventListener('click', () => {
        copyCodeBlock(codeText, blockId)
      })

      buttonContainer.appendChild(copyButton)

      // 设置pre为相对定位并添加group类
      pre.style.position = 'relative'
      pre.classList.add('group')
      pre.appendChild(buttonContainer)
    })

    // 监听复制状态变化来更新图标
    const updateIcons = () => {
      codeBlocks.forEach((pre, index) => {
        const blockId = `code-block-${index}`
        const button = pre.querySelector('.copy-button-container button')
        const icon = button?.querySelector('div')
        if (icon) {
          const copied = copiedBlocks.has(blockId)
          icon.innerHTML = copied
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20,6 9,17 4,12"></polyline></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>'
        }
      })
    }

    updateIcons()
  }, [content, copiedBlocks, isUser, isWaiting])

  const renderMarkdown = (text: string) => {
    try {
      const html = markedInstance.parse(text)
      return { __html: html }
    } catch (error) {
      console.error('Markdown parsing error:', error)
      return { __html: text }
    }
  }

  return (
    <div className={cn("text-sm", className)}>
      {isUser ? (
        // 用户消息直接显示文本，保留换行符
        <span className="whitespace-pre-wrap">{content}</span>
      ) : isWaiting ? (
        // 等待状态显示等待中
        <div className="flex items-center space-x-2 text-gray-500">
          <span>{waitingTime}s 思考中</span>
          <div className="flex space-x-1">
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      ) : (
        // AI 消息使用 Markdown 渲染
        <div
          ref={containerRef}
          className="markdown-content max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          dangerouslySetInnerHTML={renderMarkdown(content)}
        />
      )}
      {isStreaming && !isWaiting && (
        <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1">|</span>
      )}
    </div>
  )
}
