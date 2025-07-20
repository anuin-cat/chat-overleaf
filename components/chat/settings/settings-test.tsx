import { useEffect } from "react"
import { useSettings } from "~hooks/useSettings"
import { useModels } from "~hooks/useModels"

// 这是一个测试组件，用于验证设置系统的功能
export const SettingsTest = () => {
  const { 
    apiKeys, 
    baseUrls, 
    customProviders, 
    customModels, 
    pinnedModels,
    initializeSettings 
  } = useSettings()
  
  const { allModels, sortedModels, availableModels } = useModels()

  useEffect(() => {
    // 初始化设置
    initializeSettings()
  }, [initializeSettings])

  useEffect(() => {
    console.log("=== Settings Test Debug Info ===")
    console.log("API Keys:", apiKeys)
    console.log("Base URLs:", baseUrls)
    console.log("Custom Providers:", customProviders)
    console.log("Custom Models:", customModels)
    console.log("Pinned Models:", pinnedModels)
    console.log("All Models:", allModels)
    console.log("Sorted Models:", sortedModels)
    console.log("Available Models:", availableModels)
    console.log("=== End Debug Info ===")
  }, [apiKeys, baseUrls, customProviders, customModels, pinnedModels, allModels, sortedModels, availableModels])

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="font-bold mb-2">设置系统测试</h3>
      <div className="space-y-2 text-sm">
        <div>API Keys: {Object.keys(apiKeys).length} 个</div>
        <div>Base URLs: {Object.keys(baseUrls).length} 个</div>
        <div>自定义供应商: {customProviders.length} 个</div>
        <div>自定义模型: {customModels.length} 个</div>
        <div>置顶模型: {pinnedModels.length} 个</div>
        <div>所有模型: {allModels.length} 个</div>
        <div>可用模型: {availableModels.length} 个</div>
      </div>
    </div>
  )
}
