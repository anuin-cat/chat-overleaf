import { useState, useEffect } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { X, HelpCircle } from "lucide-react"
import { useSettings } from "~hooks/useSettings"
import type { CustomProvider } from "~store/types"

interface EditProviderDialogProps {
  provider: CustomProvider
  onClose: () => void
}

export const EditProviderDialog = ({ provider, onClose }: EditProviderDialogProps) => {
  const { updateCustomProvider } = useSettings()
  const [formData, setFormData] = useState({
    name: "",
    baseUrl: ""
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // 初始化表单数据
  useEffect(() => {
    if (provider) {
      setFormData({
        name: provider.name,
        baseUrl: provider.baseUrl
      })
    }
  }, [provider])

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

    const updatedProvider: CustomProvider = {
      ...provider,
      name: formData.name.trim(),
      baseUrl: formData.baseUrl.trim()
    }

    updateCustomProvider(updatedProvider)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10001] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">编辑供应商</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 表单内容 */}
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
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
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
                  API服务的基础URL地址
                </div>
              </div>
            </label>
            <Input
              type="url"
              value={formData.baseUrl}
              onChange={(e) => handleInputChange("baseUrl", e.target.value)}
              placeholder="例如: https://api.example.com/v1"
              className={errors.baseUrl ? "border-red-500" : ""}
            />
            {errors.baseUrl && (
              <p className="text-red-500 text-xs mt-1">{errors.baseUrl}</p>
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={handleCancel}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
          >
            保存
          </Button>
        </div>
      </div>
    </div>
  )
}
