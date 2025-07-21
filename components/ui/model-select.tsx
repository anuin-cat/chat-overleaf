import { useState, useRef, useEffect } from "react"
import { ChevronDown, Check, Pin, PinOff } from "lucide-react"
import { cn } from "~lib/utils"
import { useModels, type ExtendedModelConfig } from "~hooks/useModels"

interface ModelSelectProps {
  value: string // 模型ID或model_name
  onValueChange: (modelId: string) => void
  placeholder?: string
  className?: string
  showOnlyAvailable?: boolean
}

export const ModelSelect = ({
  value,
  onValueChange,
  placeholder = "选择模型",
  className,
  showOnlyAvailable = true
}: ModelSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    sortedModels = [],
    availableModels = [],
    getModelById,
    handleTogglePin,
    isModelAvailable
  } = useModels()

  // 根据showOnlyAvailable决定显示哪些模型
  const displayModels = showOnlyAvailable ? availableModels : sortedModels

  // 查找当前选中的模型
  const selectedModel = getModelById(value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (model: ExtendedModelConfig) => {
    onValueChange(model.id)
    setIsOpen(false)
  }

  const handleTogglePinClick = (e: React.MouseEvent, modelId: string) => {
    e.preventDefault()
    e.stopPropagation()
    handleTogglePin(modelId)
    // 不关闭下拉菜单，让用户可以继续操作
  }

  const handleTriggerClick = () => {
    setIsOpen(!isOpen)
  }

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleTriggerClick}
        className={cn(
          "flex h-9 items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "min-w-[120px]"
        )}
      >
        <div className="flex items-center min-w-0 flex-1">
          {selectedModel ? (
            <span className="truncate">{selectedModel.display_name}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={cn("ml-2 h-4 w-4 flex-shrink-0 opacity-50 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={cn(
          "absolute top-full left-0 z-50 mt-1",
          "min-w-full whitespace-nowrap",
          "rounded-md border bg-popover text-popover-foreground shadow-md",
          "animate-in fade-in-0 zoom-in-95",
          "max-h-80 overflow-y-auto"
        )}>
          <div className="p-1">
            {displayModels.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-gray-500">
                {showOnlyAvailable ? "暂无可用模型，请先配置API Key" : "暂无模型"}
              </div>
            ) : (
              displayModels.map((model) => {
                const isSelected = selectedModel?.id === model.id
                const available = isModelAvailable(model)
                
                return (
                  <div
                    key={model.id}
                    className={cn(
                      "group relative flex items-center justify-between rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none cursor-pointer",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground",
                      isSelected && "bg-accent text-accent-foreground",
                      !available && "opacity-50"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (available || !showOnlyAvailable) {
                        handleSelect(model)
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* 置顶图标 */}
                      {model.isPinned && (
                        <Pin className="h-3 w-3 text-orange-500 flex-shrink-0" />
                      )}

                      {/* 模型名称 */}
                      <span className="truncate">{model.display_name}</span>

                      {/* 供应商标识 */}
                      <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex-shrink-0">
                        {model.providerDisplayName}
                      </span>

                      {/* 未配置标识 */}
                      {!available && (
                        <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">
                          未配置
                        </span>
                      )}
                    </div>

                    {/* 置顶按钮 */}
                    <button
                      className={cn(
                        "absolute right-8 flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100",
                        "opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      )}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleTogglePinClick(e, model.id)
                      }}
                      title={model.isPinned ? "取消置顶" : "置顶"}
                    >
                      {model.isPinned ? (
                        <PinOff className="h-3 w-3 text-orange-500" />
                      ) : (
                        <Pin className="h-3 w-3 text-gray-400" />
                      )}
                    </button>

                    {/* 选中图标 */}
                    {isSelected && (
                      <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
