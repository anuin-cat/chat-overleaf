import { useState } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { ScrollArea } from "~components/ui/scroll-area"
import { Switch } from "~components/ui/switch"
import { Plus, Eye, EyeOff, Trash2, Edit, Pin, PinOff } from "lucide-react"
import { useSettings } from "~hooks/useSettings"
import { useModels } from "~hooks/useModels"
import { useDialog } from "~components/ui/dialog"
import { builtinProviders, getAllProviders } from "~lib/providers"
import { AddModelDialog } from "./add-model-dialog"
import { AddProviderDialog } from "./add-provider-dialog"
import { EditProviderDialog } from "./edit-provider-dialog"
import { cn } from "~lib/utils"

export const ModelServiceSettings = () => {
  const {
    apiKeys,
    setApiKey,
    customProviders,
    removeCustomProvider,
    removeCustomModel,
    isProviderEnabled,
    toggleProviderEnabled
  } = useSettings()

  const { allModels = [], handleTogglePin } = useModels()
  const { showDialog } = useDialog()

  const [selectedProvider, setSelectedProvider] = useState<string>(builtinProviders[0]?.id || "")
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})
  const [showAddModel, setShowAddModel] = useState(false)
  const [showAddProvider, setShowAddProvider] = useState(false)
  const [showEditProvider, setShowEditProvider] = useState(false)
  const [editingProvider, setEditingProvider] = useState<any>(null)
  const [localApiKeys, setLocalApiKeys] = useState<Record<string, string>>(apiKeys)

  const allProviders = getAllProviders(customProviders)
  const currentProvider = allProviders.find(p => p.id === selectedProvider)

  // 获取当前供应商下的所有模型（内置 + 自定义）
  const providerModels = allModels.filter(model => {
    if (!currentProvider) return false
    // 匹配供应商名称
    return model.provider === currentProvider.name ||
           (model.isCustom && model.id.startsWith(`${currentProvider.id}-`))
  })

  const handleApiKeyChange = (providerId: string, value: string) => {
    setLocalApiKeys(prev => ({ ...prev, [providerId]: value }))
  }

  const handleApiKeySave = (providerId: string) => {
    const apiKey = localApiKeys[providerId] || ""
    const provider = allProviders.find(p => p.id === providerId)
    if (provider) {
      // 使用供应商名称作为key来保持向后兼容性
      setApiKey(provider.name, apiKey)
    }
  }

  const toggleShowApiKey = (providerId: string) => {
    setShowApiKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }))
  }

  const handleAddCustomProvider = () => {
    setShowAddProvider(true)
  }

  const handleEditProvider = (provider: any) => {
    setEditingProvider(provider)
    setShowEditProvider(true)
  }

  const handleRemoveProvider = async (providerId: string) => {
    const confirmed = await showDialog({
      title: "删除供应商",
      description: "确定要删除这个供应商吗？这将同时删除该供应商下的所有模型。",
      confirmText: "删除",
      cancelText: "取消",
      variant: "destructive"
    })

    if (confirmed) {
      removeCustomProvider(providerId)
      if (selectedProvider === providerId) {
        setSelectedProvider(builtinProviders[0]?.id || "")
      }
    }
  }

  return (
    <div className="flex h-full">
      {/* 左侧供应商列表 */}
      <div className="w-64 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-800 mb-2">供应商</h4>
          <Button
            onClick={handleAddCustomProvider}
            size="sm"
            className="w-full"
            variant="outline"
          >
            <Plus className="h-4 w-4 mr-2" />
            添加供应商
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {allProviders.map((provider) => (
              <div key={provider.id} className="mb-1">
                <button
                  onClick={() => setSelectedProvider(provider.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors",
                    "hover:bg-gray-100",
                    selectedProvider === provider.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700"
                  )}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <div className="text-sm font-medium truncate">{provider.name}</div>
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded flex-shrink-0",
                      provider.isCustom
                        ? "text-green-600 bg-green-50"
                        : "text-blue-600 bg-blue-50"
                    )}>
                      {provider.isCustom ? "自定义" : "内置"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {provider.isCustom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveProvider(provider.id)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    {/* 启用开关 */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={isProviderEnabled(provider.id)}
                        onCheckedChange={(checked) => {
                          toggleProviderEnabled(provider.id)
                        }}
                        size="sm"
                        className="mr-1"
                      />
                    </div>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧配置区域 */}
      <div className="flex-1 flex flex-col min-h-0">
        {currentProvider ? (
          <>
            {/* 供应商信息 */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-800">{currentProvider.name}</h4>
                {currentProvider.isCustom && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditProvider(currentProvider)}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    编辑
                  </Button>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Base URL: {currentProvider.baseUrl}
              </div>
            </div>

            {/* API Key 配置 */}
            <div className="p-4 border-b border-gray-200">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKeys[currentProvider.id] ? "text" : "password"}
                    value={localApiKeys[currentProvider.id] || apiKeys[currentProvider.name] || ""}
                    onChange={(e) => handleApiKeyChange(currentProvider.id, e.target.value)}
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
                    onClick={() => toggleShowApiKey(currentProvider.id)}
                  >
                    {showApiKeys[currentProvider.id] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  onClick={() => handleApiKeySave(currentProvider.id)}
                  disabled={localApiKeys[currentProvider.id] === apiKeys[currentProvider.name]}
                >
                  保存
                </Button>
              </div>
            </div>

            {/* 模型管理 */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-800">模型管理</h4>
                <Button
                  onClick={() => setShowAddModel(true)}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加模型
                </Button>
              </div>

              <ScrollArea className="flex-1 p-3 min-h-0">
                <div className="space-y-1">
                  {providerModels.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      该供应商下暂无模型
                    </div>
                  ) : (
                    providerModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* 置顶图标 */}
                          {model.isPinned && (
                            <Pin className="h-3 w-3 text-orange-500 flex-shrink-0" />
                          )}

                          {/* 模型信息 */}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-800 truncate leading-tight">
                              {model.display_name}
                            </div>
                            <div className="text-xs text-gray-500 truncate leading-tight">
                              {model.model_name}
                            </div>
                          </div>

                          {/* 标识 */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {model.isCustom && (
                              <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                                自定义
                              </span>
                            )}
                            {model.multimodal && (
                              <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                多模态
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTogglePin(model.id)}
                            title={model.isPinned ? "取消置顶" : "置顶"}
                            className="h-7 w-7 p-0"
                          >
                            {model.isPinned ? (
                              <PinOff className="h-3 w-3 text-orange-500" />
                            ) : (
                              <Pin className="h-3 w-3 text-gray-400" />
                            )}
                          </Button>

                          {model.isCustom && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                const confirmed = await showDialog({
                                  title: "删除模型",
                                  description: `确定要删除模型"${model.display_name}"吗？`,
                                  confirmText: "删除",
                                  cancelText: "取消",
                                  variant: "destructive"
                                })

                                if (confirmed) {
                                  removeCustomModel(model.id)
                                }
                              }}
                              className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              请选择一个供应商
            </div>
          </div>
        )}
      </div>

      {/* 添加模型对话框 */}
      {showAddModel && currentProvider && (
        <AddModelDialog
          provider={currentProvider}
          onClose={() => setShowAddModel(false)}
        />
      )}

      {/* 添加供应商对话框 */}
      {showAddProvider && (
        <AddProviderDialog
          onClose={() => setShowAddProvider(false)}
        />
      )}

      {/* 编辑供应商对话框 */}
      {showEditProvider && editingProvider && (
        <EditProviderDialog
          provider={editingProvider}
          onClose={() => {
            setShowEditProvider(false)
            setEditingProvider(null)
          }}
        />
      )}
    </div>
  )
}
