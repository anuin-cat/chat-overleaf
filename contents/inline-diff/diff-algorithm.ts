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
  if (!text) return []
  // 更细粒度的分词：CJK 单字、单词/数字、标点、空白分别成块
  const regex = /(\r\n|\r|\n)|(\s+)|(\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul})|([\p{L}\p{M}\p{N}_]+)|(\p{Extended_Pictographic})|([^\s])/gu
  const tokens: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[0])
  }
  return tokens
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
  
  const oldSegments: WordDiffSegment[] = []
  const newSegments: WordDiffSegment[] = []

  const oldMarked = new Array(oldTokens.length).fill(false)
  const newMarked = new Array(newTokens.length).fill(false)

  const markWithLcs = (
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number
  ) => {
    const oldLen = oldEnd - oldStart
    const newLen = newEnd - newStart
    if (oldLen <= 0 || newLen <= 0) return

    const lcsMatrix: number[][] = []
    for (let i = 0; i <= oldLen; i++) {
      lcsMatrix[i] = []
      for (let j = 0; j <= newLen; j++) {
        if (i === 0 || j === 0) {
          lcsMatrix[i][j] = 0
        } else if (oldTokens[oldStart + i - 1] === newTokens[newStart + j - 1]) {
          lcsMatrix[i][j] = lcsMatrix[i - 1][j - 1] + 1
        } else {
          lcsMatrix[i][j] = Math.max(lcsMatrix[i - 1][j], lcsMatrix[i][j - 1])
        }
      }
    }

    let i = oldLen
    let j = newLen
    while (i > 0 && j > 0) {
      const oldToken = oldTokens[oldStart + i - 1]
      const newToken = newTokens[newStart + j - 1]
      if (oldToken === newToken) {
        oldMarked[oldStart + i - 1] = true
        newMarked[newStart + j - 1] = true
        i--
        j--
      } else if (lcsMatrix[i - 1][j] > lcsMatrix[i][j - 1]) {
        i--
      } else if (lcsMatrix[i - 1][j] < lcsMatrix[i][j - 1]) {
        j--
      } else {
        // 平局时优先缩短跨度，避免错位
        const oldPrev = oldTokens[oldStart + i - 1]
        const newPrev = newTokens[newStart + j - 1]
        const oldInNew = newTokens.lastIndexOf(oldPrev, newStart + j - 2)
        const newInOld = oldTokens.lastIndexOf(newPrev, oldStart + i - 2)
        if (oldInNew === -1 && newInOld === -1) {
          i--
        } else if (oldInNew === -1) {
          j--
        } else if (newInOld === -1) {
          i--
        } else {
          const distOld = oldStart + i - 1 - newInOld
          const distNew = newStart + j - 1 - oldInNew
          if (distOld <= distNew) {
            i--
          } else {
            j--
          }
        }
      }
    }
  }

  const getPatienceAnchors = (
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number
  ) => {
    const oldCount = new Map<string, number>()
    const newCount = new Map<string, number>()
    for (let i = oldStart; i < oldEnd; i++) {
      const token = oldTokens[i]
      oldCount.set(token, (oldCount.get(token) || 0) + 1)
    }
    for (let j = newStart; j < newEnd; j++) {
      const token = newTokens[j]
      newCount.set(token, (newCount.get(token) || 0) + 1)
    }

    const newUniqueIndex = new Map<string, number>()
    for (let j = newStart; j < newEnd; j++) {
      const token = newTokens[j]
      if (newCount.get(token) === 1) {
        newUniqueIndex.set(token, j)
      }
    }

    const pairs: Array<{ oldIndex: number; newIndex: number }> = []
    for (let i = oldStart; i < oldEnd; i++) {
      const token = oldTokens[i]
      const newIndex = newUniqueIndex.get(token)
      if (oldCount.get(token) === 1 && newIndex !== undefined) {
        pairs.push({ oldIndex: i, newIndex })
      }
    }

    pairs.sort((a, b) => a.oldIndex - b.oldIndex)
    if (pairs.length === 0) return []

    const dp = new Array(pairs.length).fill(1)
    const prev = new Array(pairs.length).fill(-1)
    let bestIdx = 0

    for (let i = 0; i < pairs.length; i++) {
      for (let j = 0; j < i; j++) {
        if (pairs[j].newIndex < pairs[i].newIndex && dp[j] + 1 > dp[i]) {
          dp[i] = dp[j] + 1
          prev[i] = j
        }
      }
      if (dp[i] > dp[bestIdx]) {
        bestIdx = i
      }
    }

    const anchors: Array<{ oldIndex: number; newIndex: number }> = []
    let k = bestIdx
    while (k !== -1) {
      anchors.push(pairs[k])
      k = prev[k]
    }
    anchors.reverse()
    return anchors
  }

  const markMatches = (
    oldStart: number,
    oldEnd: number,
    newStart: number,
    newEnd: number
  ) => {
    if (oldStart >= oldEnd || newStart >= newEnd) return
    const anchors = getPatienceAnchors(oldStart, oldEnd, newStart, newEnd)
    if (anchors.length === 0) {
      markWithLcs(oldStart, oldEnd, newStart, newEnd)
      return
    }

    let prevOld = oldStart
    let prevNew = newStart
    for (const anchor of anchors) {
      markMatches(prevOld, anchor.oldIndex, prevNew, anchor.newIndex)
      oldMarked[anchor.oldIndex] = true
      newMarked[anchor.newIndex] = true
      prevOld = anchor.oldIndex + 1
      prevNew = anchor.newIndex + 1
    }
    markMatches(prevOld, oldEnd, prevNew, newEnd)
  }

  markMatches(0, oldTokens.length, 0, newTokens.length)
  
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

