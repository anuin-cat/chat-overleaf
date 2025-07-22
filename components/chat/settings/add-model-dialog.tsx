import { useState } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { X, HelpCircle } from "lucide-react"
import { useSettings } from "~hooks/useSettings"
import type { CustomProvider } from "~store/types"

interface AddModelDialogProps {
  provider: CustomProvider
  onClose: () => void
}

export const AddModelDialog = ({ provider, onClose }: AddModelDialogProps) => {
  const { addCustomModel } = useSettings()
  const [formData, setFormData] = useState({
    modelId: "",
    displayName: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 清除对应字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.modelId.trim()) {
      newErrors.modelId = "模型ID不能为空"
    }

    if (!formData.displayName.trim()) {
      newErrors.displayName = "模型名称不能为空"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    const newModel = {
      id: `${provider.id}-${Date.now()}`, // 生成唯一ID
      modelName: formData.modelId.trim(),
      displayName: formData.displayName.trim(),
      providerId: provider.id,
      isCustom: true
    }

    addCustomModel(newModel)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10001] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">添加模型</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* 供应商信息 */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">供应商</div>
            <div className="font-medium text-gray-800">{provider.name}</div>
          </div>

          {/* 模型ID */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center">
              <span className="text-red-500 mr-1">*</span>
              模型ID
              <div className="ml-1 group relative">
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  例如: gpt-3.5-turbo
                </div>
              </div>
            </label>
            <Input
              type="text"
              value={formData.modelId}
              onChange={(e) => handleInputChange("modelId", e.target.value)}
              placeholder="例如: gpt-3.5-turbo"
              className={errors.modelId ? "border-red-500" : ""}
            />
            {errors.modelId && (
              <div className="text-red-500 text-xs mt-1">{errors.modelId}</div>
            )}
          </div>

          {/* 模型名称 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center">
              <span className="text-red-500 mr-1">*</span>
              模型名称
              <div className="ml-1 group relative">
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  例如: GPT-4
                </div>
              </div>
            </label>
            <Input
              type="text"
              value={formData.displayName}
              onChange={(e) => handleInputChange("displayName", e.target.value)}
              placeholder="例如: GPT-4"
              className={errors.displayName ? "border-red-500" : ""}
            />
            {errors.displayName && (
              <div className="text-red-500 text-xs mt-1">{errors.displayName}</div>
            )}
          </div>

          {/* 说明 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">说明</div>
              <ul className="text-xs space-y-1">
                <li>• 模型ID是API调用时使用的标识符</li>
                <li>• 模型名称是在界面中显示的名称</li>
                <li>• 请确保模型ID与供应商API文档一致</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSubmit}>
            添加模型
          </Button>
        </div>
      </div>
    </div>
  )
}
