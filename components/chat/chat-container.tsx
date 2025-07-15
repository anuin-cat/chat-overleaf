import { useEffect, useState } from "react"
import iconUrl from "data-base64:~assets/icon.svg"

import { Button } from "~components/ui/button"
import { SidebarChat } from "./sidebar-chat"

interface ChatContainerProps {
  isOverleaf: boolean
}

export const ChatContainer = ({ isOverleaf }: ChatContainerProps) => {
  const [showChat, setShowChat] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(320)

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

  if (!isOverleaf) {
    return null
  }

  return (
    <>
      {/* 浮动按钮 - 只在侧边栏关闭时显示 */}
      {!showChat && (
        <Button
          onClick={handleToggleChat}
          className="fixed bottom-6 right-6 z-[9999] h-14 w-14 rounded-full bg-green-600 p-0 shadow-lg hover:bg-green-700 hover:shadow-xl transition-all duration-200"
        >
          <img 
            src={iconUrl} 
            alt="Chat" 
            className="h-8 w-8"
          />
        </Button>
      )}
      
      {/* 侧边栏 - 只在打开时显示 */}
      {showChat && (
        <div className="fixed top-0 right-0 z-[9999] h-full">
          <SidebarChat onClose={handleCloseChat} onWidthChange={handleWidthChange} />
        </div>
      )}
    </>
  )
}
