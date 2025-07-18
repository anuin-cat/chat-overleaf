import React from "react"
import { X } from "lucide-react"
import { cn } from "~lib/utils"

interface TagProps {
  children: React.ReactNode
  onRemove?: () => void
  variant?: "default" | "file" | "selection"
  className?: string
  removable?: boolean
}

export const Tag = ({ 
  children, 
  onRemove, 
  variant = "default", 
  className,
  removable = true 
}: TagProps) => {
  const baseClasses = "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md font-medium"
  
  const variantClasses = {
    default: "bg-gray-100 text-gray-700 border border-gray-200",
    file: "bg-blue-50 text-blue-700 border border-blue-200",
    selection: "bg-green-50 text-green-700 border border-green-200"
  }

  return (
    <span className={cn(baseClasses, variantClasses[variant], className)}>
      <span className="truncate max-w-[200px]">{children}</span>
      {removable && onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:bg-black/10 rounded-sm p-0.5 transition-colors"
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
    <div className={cn("flex flex-wrap gap-1", className)}>
      {children}
    </div>
  )
}
