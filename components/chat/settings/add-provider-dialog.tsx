import { useState } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { X, HelpCircle } from "lucide-react"
import { useSettings } from "~hooks/useSettings"
import type { CustomProvider } from "~store/types"

interface AddProviderDialogProps {
  onClose: () => void
}

export const AddProviderDialog = ({ onClose }: AddProviderDialogProps) => {
  const { addCustomProvider } = useSettings()
  const [formData, setFormData] = useState({
    name: "",
    baseUrl: ""
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

    if (!formData.name.trim()) {
      newErrors.name = "供应商名称不能为空"
    }

    if (!formData.baseUrl.trim()) {
      newErrors.baseUrl = "Base URL不能为空"
    } else {
      // 简单的URL格式验证
      try {
        new URL(formData.baseUrl.trim())
      } catch {
        newErrors.baseUrl = "请输入有效的URL格式"
      }
    }



    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return

    const newProvider: CustomProvider = {
      id: `custom-${Date.now()}`, // 生成唯一ID
      name: formData.name.trim(),
      baseUrl: formData.baseUrl.trim(),
      apiKeyLabel: "API Key",
      isCustom: true
    }

    addCustomProvider(newProvider)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10001] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">添加供应商</h3>
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
          {/* 供应商名称 */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center">
              <span className="text-red-500 mr-1">*</span>
              供应商名称
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="例如: 我的AI服务"
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <div className="text-red-500 text-xs mt-1">{errors.name}</div>
            )}
          </div>

          {/* Base URL */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block flex items-center">
              <span className="text-red-500 mr-1">*</span>
              Base URL
              <div className="ml-1 group relative">
                <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  API服务的基础URL
                </div>
              </div>
            </label>
            <Input
              type="text"
              value={formData.baseUrl}
              onChange={(e) => handleInputChange("baseUrl", e.target.value)}
              placeholder="例如: https://api.example.com/v1"
              className={errors.baseUrl ? "border-red-500" : ""}
            />
            {errors.baseUrl && (
              <div className="text-red-500 text-xs mt-1">{errors.baseUrl}</div>
            )}
          </div>



          {/* 说明 */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800">
              <div className="font-medium mb-1">说明</div>
              <ul className="text-xs space-y-1">
                <li>• Base URL是API服务的基础地址</li>
                <li>• 添加后可以在该供应商下创建自定义模型</li>
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
            添加供应商
          </Button>
        </div>
      </div>
    </div>
  )
}
