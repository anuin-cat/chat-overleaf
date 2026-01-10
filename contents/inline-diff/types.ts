/**
 * Overleaf 内联差异模块 - 类型定义
 */

// CodeMirror 扩展类型定义
export interface OverleafCodeMirror {
  Decoration: any
  EditorView: any
  StateEffect: any
  StateField: any
  ViewPlugin: any
  WidgetType: any
}

// 内联差异建议状态
export interface InlineSuggestion {
  id: string
  from: number
  to: number
  search: string
  replace: string
  matchedText: string
}

// 存储当前活跃的内联差异显示（DOM 方式的后备方案）
export interface InlineDiff {
  id: string
  element: HTMLElement
  from: number
  to: number
  search: string
  replace: string
}

// 差异结果类型
export interface DiffResult {
  commonPrefix: string   // 首部相同部分
  commonSuffix: string   // 尾部相同部分
  oldDiff: string        // 原文中不同的部分
  newDiff: string        // 新文中不同的部分
}

// 单词差异片段
export interface WordDiffSegment {
  text: string
  type: 'same' | 'changed'
}

// 匹配位置
export interface MatchPosition {
  from: number
  to: number
  text: string
}

