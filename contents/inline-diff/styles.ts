/**
 * Overleaf 内联差异模块 - 样式注入
 */

/**
 * 注入内联差异显示的样式
 */
export function injectInlineDiffStyles() {
  if (document.getElementById('chat-overleaf-inline-diff-styles')) return
  
  const style = document.createElement('style')
  style.id = 'chat-overleaf-inline-diff-styles'
  style.textContent = `
    /* CodeMirror 内联差异样式 */
    .co-cm-inline-diff {
      display: inline;
      position: relative;
    }
    
    .co-cm-diff-del {
      background: #fee2e2;
      color: #b91c1c;
      text-decoration: line-through;
      text-decoration-color: #ef4444;
      padding: 1px 2px;
      border-radius: 2px;
      margin-right: 2px;
    }
    
    .co-cm-diff-add {
      background: #dcfce7;
      color: #15803d;
      padding: 1px 2px;
      border-radius: 2px;
      margin-right: 4px;
      font-weight: 500;
    }
    
    .co-cm-diff-highlight {
      background: rgba(251, 191, 36, 0.3) !important;
      border-radius: 2px;
    }
    
    /* 待替换文本的持久高亮覆盖层 - 淡色背景（未修改部分） */
    .co-replace-highlight-overlay {
      position: absolute;
      background: rgba(253, 165, 165, 0.38);
      pointer-events: none;
      z-index: 5;
      box-sizing: border-box;
    }
    
    /* 被修改/删除的单词 - 深色背景 */
    .co-replace-highlight-word {
      position: absolute;
      background: rgba(246, 131, 131, 0.44);
      pointer-events: none;
      z-index: 6;
      box-sizing: border-box;
      border-radius: 2px;
    }
    
    .co-cm-diff-actions {
      display: inline-flex;
      gap: 2px;
      margin-left: 4px;
      vertical-align: middle;
    }
    
    .co-cm-diff-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border: none;
      border-radius: 3px;
      font-size: 10px;
      cursor: pointer;
      transition: all 0.15s;
      line-height: 1;
    }
    
    .co-cm-diff-btn-accept {
      background: #22c55e;
      color: white;
    }
    
    .co-cm-diff-btn-accept:hover {
      background: #16a34a;
      transform: scale(1.1);
    }
    
    .co-cm-diff-btn-reject {
      background: #ef4444;
      color: white;
    }
    
    .co-cm-diff-btn-reject:hover {
      background: #dc2626;
      transform: scale(1.1);
    }
    
    /* 浮动面板样式 - 超紧凑版，无外边框 */
    .co-inline-diff-container {
      position: absolute;
      z-index: 10000;
      pointer-events: auto;
    }
    
    .co-inline-diff-overlay {
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      max-width: 420px;
      min-width: 120px;
    }
    
    .co-inline-diff-content {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    
    .co-inline-diff-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .co-inline-diff-text {
      flex: 1;
      padding: 4px 6px;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.4;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 11px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    .co-inline-diff-text-add {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #10b981;
    }
    
    /* 差异单词高亮 - 弹出框中新文本的变更单词 */
    .co-word-changed {
      background: #a7f3d0;
      color: #065f46;
      border-radius: 2px;
      padding: 0 1px;
    }
    
    /* 按钮放在文本框外部右下角 */
    .co-inline-diff-actions {
      position: absolute;
      right: 0;
      bottom: -24px;
      display: flex;
      justify-content: flex-end;
      gap: 4px;
    }
    
    .co-inline-diff-btn {
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      border: none;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    }
    
    .co-inline-diff-btn-accept {
      background: #10b981;
      color: white;
    }
    
    .co-inline-diff-btn-accept:hover {
      background: #059669;
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    
    .co-inline-diff-btn-reject {
      background: #fff;
      color: #6b7280;
      border: 1px solid #d1d5db;
    }
    
    .co-inline-diff-btn-reject:hover {
      background: #f3f4f6;
      color: #4b5563;
      transform: translateY(-1px);
    }
    
    /* ========== 悬浮高亮样式 ========== */
    
    /* 可交互的高亮背景（淡红色） */
    .co-hover-highlight-bg {
      position: absolute;
      background: rgba(253, 165, 165, 0.35);
      pointer-events: auto;
      cursor: pointer;
      z-index: 5;
      box-sizing: border-box;
      transition: background 0.15s ease;
    }
    
    .co-hover-highlight-bg:hover {
      background: rgba(253, 165, 165, 0.5);
    }
    
    /* 可交互的单词高亮（深红色） */
    .co-hover-highlight-word {
      position: absolute;
      background: rgba(239, 68, 68, 0.4);
      pointer-events: auto;
      cursor: pointer;
      z-index: 6;
      box-sizing: border-box;
      border-radius: 2px;
      transition: background 0.15s ease;
    }
    
    .co-hover-highlight-word:hover {
      background: rgba(239, 68, 68, 0.55);
    }
    
    /* 悬浮弹出框 */
    .co-hover-popover {
      position: absolute;
      z-index: 10000;
      pointer-events: auto;
      animation: co-popover-fadein 0.12s ease-out;
      display: inline-flex;
      flex-direction: column;
      gap: 4px;
    }
    
    @keyframes co-popover-fadein {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .co-hover-popover-content {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .co-hover-popover-text {
      padding: 5px 8px;
      border-radius: 5px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.4;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 11px;
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #10b981;
      box-shadow: 0 3px 12px rgba(0, 0, 0, 0.15);
      max-width: 400px;
    }
    
    .co-hover-popover-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      align-self: flex-end;
    }
    
    .co-hover-popover-btn {
      padding: 4px 12px;
      border-radius: 5px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      border: none;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    }
    
    .co-hover-popover-btn-accept {
      background: #10b981;
      color: white;
    }
    
    .co-hover-popover-btn-accept:hover {
      background: #059669;
      transform: translateY(-1px);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.18);
    }
    
    .co-hover-popover-btn-reject {
      background: #fff;
      color: #6b7280;
      border: 1px solid #d1d5db;
    }
    
    .co-hover-popover-btn-reject:hover {
      background: #f3f4f6;
      color: #4b5563;
      transform: translateY(-1px);
    }
  `
  document.head.appendChild(style)
}
