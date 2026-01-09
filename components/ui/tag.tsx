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
}

export const Tag = ({
  children,
  onRemove,
  onClick,
  variant = "default",
  className,
  removable = true,
  clickable = false
}: TagProps) => {
  const baseClasses = "inline-flex items-center gap-0.5 px-0.5 py-0.5 text-xs rounded-md font-medium"

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
    >
      <span className="truncate max-w-[200px]">{children}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation() // 防止触发标签点击
            onRemove()
          }}
          className="ml-0 hover:bg-black/10 rounded-sm p-0.5 transition-colors"
          type="button"
        >
          <X className="h-3 w-3" />
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
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {children}
    </div>
  )
}
