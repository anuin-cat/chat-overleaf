import cssText from "data-text:~globals.css"
import type { PlasmoCSConfig } from "plasmo"
import { Provider } from "react-redux"
import { PersistGate } from "@plasmohq/redux-persist/integration/react"
import { useEffect, useState } from "react"

import { ChatContainer } from "~components/chat"
import { ToastProvider } from "~components/ui/sonner"
import { DialogProvider } from "~components/ui/dialog"
import { store, persistor } from "~store"
import { chatHistoryStorage } from "~utils/indexeddb-storage"

// 调试工具将在开发环境中自动可用

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const styleElement = document.createElement("style")

/**
 * Generates a style element with adjusted CSS to work correctly within a Shadow DOM.
 *
 * Tailwind CSS relies on `rem` units, which are based on the root font size (typically defined on the <html>
 * or <body> element). However, in a Shadow DOM (as used by Plasmo), there is no native root element, so the
 * rem values would reference the actual page's root font size—often leading to sizing inconsistencies.
 *
 * To address this, we:
 * 1. Replace the `:root` selector with `:host(plasmo-csui)` to properly scope the styles within the Shadow DOM.
 * 2. Convert all `rem` units to pixel values using a fixed base font size, ensuring consistent styling
 *    regardless of the host page's font size.
 */
export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16

  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)")
  const remRegex = /([\d.]+)rem/g
  updatedCssText = updatedCssText.replace(remRegex, (_, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize

    return `${pixelsValue}px`
  })

  styleElement.textContent = updatedCssText

  return styleElement
}

const CSUIExample = () => {
  const [isOverleaf, setIsOverleaf] = useState(false)

  useEffect(() => {
    // 检测是否是 Overleaf 网页
    const checkOverleaf = () => {
      const hostname = window.location.hostname
      const isOverleafSite = hostname.includes('overleaf.com') || hostname.includes('overleaf')
      setIsOverleaf(isOverleafSite)
    }

    // 初始化 IndexedDB（异步，不阻塞界面）
    const initStorage = async () => {
      try {
        await chatHistoryStorage.init()
        console.log('IndexedDB initialized successfully')
      } catch (error) {
        console.error('Failed to initialize IndexedDB:', error)
      }
    }

    checkOverleaf()
    initStorage()
  }, [])

  return (
    <Provider store={store}>
      <PersistGate loading={<div>加载中...</div>} persistor={persistor}>
        <DialogProvider>
          <ToastProvider>
            {/* 聊天容器组件 */}
            <ChatContainer isOverleaf={isOverleaf} />
          </ToastProvider>
        </DialogProvider>
      </PersistGate>
    </Provider>
  )
}

export default CSUIExample
