import { Marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import { useEffect } from 'react'
import { cn } from "~lib/utils"

interface MarkdownMessageProps {
  content: string
  isUser: boolean
  isStreaming?: boolean
  className?: string
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

export const MarkdownMessage = ({ content, isUser, isStreaming, className }: MarkdownMessageProps) => {
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
      ) : (
        // AI 消息使用 Markdown 渲染
        <div
          className="markdown-content max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          dangerouslySetInnerHTML={renderMarkdown(content)}
        />
      )}
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-current opacity-75 animate-pulse ml-1">|</span>
      )}
    </div>
  )
}
