import React from "react"
import { X } from "lucide-react"
import { cn } from "~lib/utils"

interface TagProps {
  children: React.ReactNode
  onRemove?: () => void
  onClick?: () => void
  variant?: "default" | "file" | "selection" | "image"
  className?: string
  removable?: boolean
  clickable?: boolean
  title?: string
}

export const Tag = ({
  children,
  onRemove,
  onClick,
  variant = "default",
  className,
  removable = true,
  clickable = false,
  title
}: TagProps) => {
  const baseClasses = "inline-flex items-center gap-0.5 px-1.5 py-0 text-[11px] rounded-full font-medium whitespace-nowrap leading-5"

  const variantClasses = {
    default: "bg-gray-100 text-gray-700 border border-gray-200",
    file: "bg-blue-50 text-blue-700 border border-blue-200",
    selection: "bg-green-50 text-green-700 border border-green-200",
    image: "bg-purple-50 text-purple-700 border border-purple-200"
  }

  const clickableClasses = clickable ? "cursor-pointer hover:opacity-80 transition-opacity" : ""

  const handleTagClick = (e: React.MouseEvent) => {
    // 如果点击的是删除按钮，不触发标签点击
    if ((e.target as HTMLElement).closest('button')) {
      return
    }
    if (onClick) {
      onClick()
    }
  }

  return (
    <span
      className={cn(baseClasses, variantClasses[variant], clickableClasses, className)}
      onClick={clickable ? handleTagClick : undefined}
      title={title}
    >
      {children}
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation() // 防止触发标签点击
            onRemove()
          }}
          className="ml-0 hover:bg-black/10 rounded-full p-0 transition-colors flex-shrink-0"
          type="button"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

interface TagListProps {
  children: React.ReactNode
  className?: string
}

export const TagList = ({ children, className }: TagListProps) => {
  return (
    <div className={cn("flex flex-wrap gap-1 items-center", className)}>
      {children}
    </div>
  )
}
