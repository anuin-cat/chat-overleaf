import { useState } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { ScrollArea } from "~components/ui/scroll-area"
import { X, Save, Eye, EyeOff, RotateCcw } from "lucide-react"
import { useSettings } from "~hooks/useSettings"

interface SettingsPanelProps {
  onClose: () => void
}

interface ProviderConfig {
  name: string
  displayName: string
  apiKeyLabel: string
  baseUrlLabel: string
  description: string
}

const providers: ProviderConfig[] = [
  {
    name: "硅基流动",
    displayName: "硅基流动",
    apiKeyLabel: "API Key",
    baseUrlLabel: "Base URL",
    description: "https://cloud.siliconflow.cn/"
  },
  {
    name: "DeepSeek",
    displayName: "DeepSeek",
    apiKeyLabel: "API Key",
    baseUrlLabel: "Base URL",
    description: "https://platform.deepseek.com/api_keys"
  },
  {
    name: "云雾",
    displayName: "云雾",
    apiKeyLabel: "API Key",
    baseUrlLabel: "Base URL",
    description: "https://yunwu.ai/"
  },
]

export const SettingsPanel = ({ onClose }: SettingsPanelProps) => {
  const { apiKeys, baseUrls, setApiKey, setBaseUrl, resetSettings } = useSettings()
  const [localApiKeys, setLocalApiKeys] = useState<Record<string, string>>(apiKeys)
  const [localBaseUrls, setLocalBaseUrls] = useState<Record<string, string>>(baseUrls)
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [hasChanges, setHasChanges] = useState(false)

  const handleApiKeyChange = (provider: string, value: string) => {
    setLocalApiKeys(prev => ({ ...prev, [provider]: value }))
    setHasChanges(true)
  }

  const handleBaseUrlChange = (provider: string, value: string) => {
    setLocalBaseUrls(prev => ({ ...prev, [provider]: value }))
    setHasChanges(true)
  }

  const toggleShowApiKey = (provider: string) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

  const handleSave = () => {
    // 保存所有更改
    Object.entries(localApiKeys).forEach(([provider, apiKey]) => {
      if (apiKey !== apiKeys[provider]) {
        setApiKey(provider, apiKey)
      }
    })

    Object.entries(localBaseUrls).forEach(([provider, baseUrl]) => {
      if (baseUrl !== baseUrls[provider]) {
        setBaseUrl(provider, baseUrl)
      }
    })

    setHasChanges(false)
    onClose()
  }

  const handleReset = () => {
    if (confirm('确定要重置所有设置吗？这将清除所有已保存的 API keys 和 URLs。')) {
      resetSettings()
      setLocalApiKeys({})
      setLocalBaseUrls({})
      setHasChanges(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 shadow-md flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">API 设置</h2>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-red-600 hover:text-red-700"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>
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

        {/* 安全提示 */}
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-start space-x-2">
            <div className="flex-shrink-0 w-5 h-5 text-yellow-600 mt-0.5">
              ⚠️
            </div>
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">安全提示</p>
              <p>请输入您自己的 API Key。API Key 将安全地存储在您的浏览器本地，不会上传到任何服务器。</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {providers.map((provider) => (
              <div key={provider.name} className="border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <h3 className="font-medium text-gray-800">{provider.displayName}</h3>
                  <p className="text-sm text-gray-600">{provider.description}</p>
                </div>

                <div className="space-y-3">
                  {/* API Key */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      {provider.apiKeyLabel}
                    </label>
                    <div className="relative">
                      <Input
                        type={showApiKeys[provider.name] ? "text" : "password"}
                        value={localApiKeys[provider.name] || ""}
                        onChange={(e) => handleApiKeyChange(provider.name, e.target.value)}
                        placeholder="输入 API Key"
                        className="pr-10"
                        autoComplete="off"
                        data-form-type="other"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1 h-8 w-8 p-0"
                        onClick={() => toggleShowApiKey(provider.name)}
                      >
                        {showApiKeys[provider.name] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Base URL */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">
                      {provider.baseUrlLabel}
                    </label>
                    <Input
                      type="text"
                      value={localBaseUrls[provider.name] || ""}
                      onChange={(e) => handleBaseUrlChange(provider.name, e.target.value)}
                      placeholder="输入 Base URL"
                      autoComplete="off"
                      data-form-type="other"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!hasChanges}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-1" />
            保存设置
          </Button>
        </div>
      </div>
    </div>
  )
}
