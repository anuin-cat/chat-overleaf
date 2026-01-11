import { useState } from "react"
import { Button } from "~components/ui/button"
import { ScrollArea } from "~components/ui/scroll-area"
import { X, Settings, Server, Palette, Shield, SlidersHorizontal } from "lucide-react"
import { useSettings } from "~hooks/useSettings"
import { ModelServiceSettings } from "./settings/model-service-settings"
import { ModelParamsSettings } from "./settings/model-params-settings"
import { cn } from "~lib/utils"

interface SettingsPanelProps {
  onClose: () => void
}

// 设置分类配置
interface SettingsCategory {
  id: string
  name: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}

const settingsCategories: SettingsCategory[] = [
  {
    id: "model-service",
    name: "模型服务",
    icon: Server,
    description: "管理AI模型和API配置"
  },
  {
    id: "model-params",
    name: "对话参数",
    icon: SlidersHorizontal,
    description: "温度与最大回复长度"
  },
  {
    id: "appearance",
    name: "外观设置",
    icon: Palette,
    description: "主题和界面设置"
  },
  {
    id: "privacy",
    name: "隐私安全",
    icon: Shield,
    description: "数据安全和隐私设置"
  }
]

export const SettingsPanel = ({ onClose }: SettingsPanelProps) => {
  const { settingsCategory, setSettingsCategory } = useSettings()
  const [currentCategory, setCurrentCategory] = useState(settingsCategory || "model-service")

  const handleCategoryChange = (categoryId: string) => {
    setCurrentCategory(categoryId)
    setSettingsCategory(categoryId)
  }

  const renderCategoryContent = () => {
    switch (currentCategory) {
      case "model-service":
        return <ModelServiceSettings />
      case "model-params":
        return <ModelParamsSettings />
      case "appearance":
        return <div className="p-4 text-center text-sm text-gray-500">外观设置功能开发中...</div>
      case "privacy":
        return <div className="p-4 text-center text-sm text-gray-500">所有数据都存储在您的浏览器中，不会上传到服务器。</div>
      default:
        return <div className="p-4 text-center text-sm text-gray-500">未知设置分类</div>
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-2/3 max-w-6xl h-2/3 min-h-[500px] max-h-[90vh] flex overflow-hidden">
        {/* 左侧导航 */}
        <div className="w-48 border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                设置
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 分类列表 */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {settingsCategories.map((category) => {
                const Icon = category.icon
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryChange(category.id)}
                    className={cn(
                      "w-full flex items-center px-3 py-2 rounded-lg text-left transition-colors",
                      "hover:bg-gray-100",
                      currentCategory === category.id
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "text-gray-700"
                    )}
                  >
                    <Icon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{category.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {category.description}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* 右侧内容区域 */}
        <div className="flex-1 flex flex-col">
          {/* 内容区域 */}
          <div className="flex-1 overflow-hidden">
            {renderCategoryContent()}
          </div>
        </div>
      </div>
    </div>
  )
}
