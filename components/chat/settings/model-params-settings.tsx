import { useEffect, useState } from "react"
import { Button } from "~components/ui/button"
import { Input } from "~components/ui/input"
import { Label } from "~components/ui/label"
import { useSettings } from "~hooks/useSettings"
import { cn } from "~lib/utils"

const temperaturePresets = [
  { label: "精准", value: 0.2, hint: "更保守，适合代码/公式" },
  { label: "均衡", value: 0.7, hint: "通用对话推荐" },
  { label: "创意", value: 1.0, hint: "更发散的回答" }
]

export const ModelParamsSettings = () => {
  const {
    modelTemperature,
    maxTokens,
    setModelTemperature,
    setMaxTokens
  } = useSettings()

  const [localTemp, setLocalTemp] = useState(modelTemperature ?? 0.36)
  const [localMaxTokens, setLocalMaxTokens] = useState(maxTokens ?? 16384)

  // 当 store 中的值被外部重置时同步本地显示
  useEffect(() => {
    setLocalTemp(modelTemperature ?? 0.36)
  }, [modelTemperature])

  useEffect(() => {
    setLocalMaxTokens(maxTokens ?? 16384)
  }, [maxTokens])

  const handleTempChange = (value: number) => {
    const clamped = Math.min(2, Math.max(0, Number.isFinite(value) ? value : 0.36))
    setLocalTemp(clamped)
    setModelTemperature(clamped)
  }

  const handleMaxTokensChange = (value: number) => {
    const clamped = Math.min(32768, Math.max(256, Math.floor(Number.isFinite(value) ? value : 16384)))
    setLocalMaxTokens(clamped)
    setMaxTokens(clamped)
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">对话参数</h3>
          <p className="text-sm text-gray-500 mt-1">
            自定义模型生成的温度与最大回复长度，实时生效。
          </p>
        </div>

        {/* 温度设置 */}
        <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label className="text-sm font-medium text-gray-800">温度 (Temperature)</Label>
              <p className="text-xs text-gray-500">值越高越有创造性，越低越稳定。</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={localTemp}
                onChange={(e) => handleTempChange(parseFloat(e.target.value))}
                className="w-24"
              />
              <span className="text-xs text-gray-500">0 - 2</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={localTemp}
              onChange={(e) => handleTempChange(parseFloat(e.target.value))}
              className="flex-1 accent-blue-500"
            />
            <div className="text-sm text-gray-700 font-medium w-16 text-right">
              {localTemp.toFixed(2)}
            </div>
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            {temperaturePresets.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handleTempChange(preset.value)}
                className={cn(
                  "justify-start",
                  Math.abs(localTemp - preset.value) < 0.01 && "border-blue-500 text-blue-600 bg-blue-50"
                )}
              >
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-xs font-semibold">{preset.label}</span>
                  <span className="text-[11px] text-gray-500">{preset.hint}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* 最大回复长度 */}
        <div className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label className="text-sm font-medium text-gray-800">最大回复长度 (Max tokens)</Label>
              <p className="text-xs text-gray-500">限制模型单次输出的 token 数，防止过长回复。</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={256}
                max={32768}
                step={256}
                value={localMaxTokens}
                onChange={(e) => handleMaxTokensChange(parseInt(e.target.value, 10))}
                className="w-28"
              />
              <span className="text-xs text-gray-500">256 - 32768</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={256}
              max={32768}
              step={256}
              value={localMaxTokens}
              onChange={(e) => handleMaxTokensChange(parseInt(e.target.value, 10))}
              className="flex-1 accent-blue-500"
            />
            <div className="text-sm text-gray-700 font-medium w-20 text-right">
              {localMaxTokens}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
