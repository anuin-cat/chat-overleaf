/**
 * Overleaf 内联差异模块 - 差异对比算法
 */

import type { DiffResult, WordDiffSegment } from './types'

/**
 * HTML 转义
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 计算两个字符串的首尾相同部分和差异部分
 */
export function computeDiff(oldText: string, newText: string): DiffResult {
  // 计算公共前缀长度
  let prefixLen = 0
  const minLen = Math.min(oldText.length, newText.length)
  while (prefixLen < minLen && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++
  }
  
  // 计算公共后缀长度（不与前缀重叠）
  let suffixLen = 0
  const maxSuffixLen = minLen - prefixLen
  while (
    suffixLen < maxSuffixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++
  }
  
  return {
    commonPrefix: oldText.substring(0, prefixLen),
    commonSuffix: suffixLen > 0 ? oldText.substring(oldText.length - suffixLen) : '',
    oldDiff: oldText.substring(prefixLen, oldText.length - suffixLen),
    newDiff: newText.substring(prefixLen, newText.length - suffixLen)
  }
}

/**
 * 将文本分割成单词和非单词部分
 */
export function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) || []
}

/**
 * 对差异部分进行单词级别的对比
 */
export function computeWordDiff(oldDiff: string, newDiff: string): {
  oldSegments: WordDiffSegment[]
  newSegments: WordDiffSegment[]
} {
  const oldTokens = tokenize(oldDiff)
  const newTokens = tokenize(newDiff)
  
  // 使用 LCS (最长公共子序列) 算法找到相同的 token
  const lcsMatrix: number[][] = []
  for (let i = 0; i <= oldTokens.length; i++) {
    lcsMatrix[i] = []
    for (let j = 0; j <= newTokens.length; j++) {
      if (i === 0 || j === 0) {
        lcsMatrix[i][j] = 0
      } else if (oldTokens[i - 1] === newTokens[j - 1]) {
        lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1
      } else {
        lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1])
      }
    }
  }
  
  // 回溯找到 LCS
  const oldSegments: WordDiffSegment[] = []
  const newSegments: WordDiffSegment[] = []
  
  let i = oldTokens.length
  let j = newTokens.length
  const oldMarked = new Array(oldTokens.length).fill(false)
  const newMarked = new Array(newTokens.length).fill(false)
  
  while (i > 0 && j > 0) {
    if (oldTokens[i - 1] === newTokens[j - 1]) {
      oldMarked[i - 1] = true
      newMarked[j - 1] = true
      i--
      j--
    } else if (lcsMatrix[i - 1][j] > lcsMatrix[i][j - 1]) {
      i--
    } else {
      j--
    }
  }
  
  // 生成分段结果
  for (let k = 0; k < oldTokens.length; k++) {
    oldSegments.push({
      text: oldTokens[k],
      type: oldMarked[k] ? 'same' : 'changed'
    })
  }
  
  for (let k = 0; k < newTokens.length; k++) {
    newSegments.push({
      text: newTokens[k],
      type: newMarked[k] ? 'same' : 'changed'
    })
  }
  
  return { oldSegments, newSegments }
}

/**
 * 将单词差异片段渲染为 HTML（用于弹出框中的新文本）
 */
export function renderNewDiffHtml(segments: WordDiffSegment[]): string {
  return segments.map(seg => {
    if (seg.type === 'changed') {
      return `<span class="co-word-changed">${escapeHtml(seg.text)}</span>`
    }
    return escapeHtml(seg.text)
  }).join('')
}

