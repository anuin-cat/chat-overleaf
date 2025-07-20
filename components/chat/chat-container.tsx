import { useEffect, useState } from "react"
import iconUrl from "data-base64:~assets/icon.svg"

import { Button } from "~components/ui/button"
import { SidebarChat } from "./sidebar-chat"
import { SettingsPanel } from "./settings-panel"

interface ChatContainerProps {
  isOverleaf: boolean
}

export const ChatContainer = ({ isOverleaf }: ChatContainerProps) => {
  const [showChat, setShowChat] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(521)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    // 根据 showChat 状态和宽度调整页面 margin
    if (isOverleaf) {
      const body = document.body
      if (body) {
        if (showChat) {
          body.style.marginRight = `${sidebarWidth}px`
        } else {
          body.style.marginRight = ''
        }
        body.style.transition = 'margin-right 0.3s ease'
      }
    }

    // 清理函数
    return () => {
      if (isOverleaf) {
        const body = document.body
        if (body) {
          body.style.marginRight = ''
        }
      }
    }
  }, [isOverleaf, showChat, sidebarWidth])

  const handleToggleChat = () => {
    setShowChat(!showChat)
  }

  const handleCloseChat = () => {
    setShowChat(false)
  }

  const handleWidthChange = (width: number) => {
    setSidebarWidth(width)
  }

  const handleShowSettings = () => {
    setShowSettings(true)
  }

  const handleCloseSettings = () => {
    setShowSettings(false)
  }

  if (!isOverleaf) {
    return null
  }

  return (
    <>
      {/* 浮动按钮 - 只在侧边栏关闭时显示 */}
      {!showChat && (
        <Button
          onClick={handleToggleChat}
          className="
          fixed bottom-6 right-8 z-[9999] h-12 w-12
          rounded-full 
          bg-white p-0 shadow-lg 
          hover:bg-gray-100 
          hover:shadow-xl 
          transition-all duration-200"
        >
          <img 
            src={iconUrl} 
            alt="Chat" 
            className="h-8 w-8"
          />
        </Button>
      )}
      
      {/* 侧边栏 - 通过CSS控制显示/隐藏，避免组件销毁 */}
      <div
        className={`fixed top-0 right-0 z-[9999] h-full transition-transform duration-300 ease-in-out ${
          showChat ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <SidebarChat
          onClose={handleCloseChat}
          onWidthChange={handleWidthChange}
          onShowSettings={handleShowSettings}
        />
      </div>

      {/* 设置面板 - 在最高层级渲染，覆盖整个页面 */}
      {showSettings && (
        <SettingsPanel onClose={handleCloseSettings} />
      )}
    </>
  )
}
