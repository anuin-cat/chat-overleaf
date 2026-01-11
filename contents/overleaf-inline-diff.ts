/**
 * Overleaf 内联差异显示模块
 * 重新导出自拆分后的模块，保持向后兼容
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["https://www.overleaf.com/*", "https://*.overleaf.com/*"]
}

export * from './inline-diff'
