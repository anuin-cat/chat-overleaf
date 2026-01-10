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
    
    /* 待替换文本的持久高亮覆盖层 */
    .co-replace-highlight-overlay {
      position: absolute;
      background: rgba(254, 202, 202, 0.6);
      border: 1px solid rgba(239, 68, 68, 0.5);
      border-radius: 2px;
      pointer-events: none;
      z-index: 5;
      box-sizing: border-box;
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
    
    /* 浮动面板样式 - 超紧凑版 */
    .co-inline-diff-container {
      position: absolute;
      z-index: 10000;
      pointer-events: auto;
    }
    
    .co-inline-diff-overlay {
      background: #fff;
      border: 1px solid #10b981;
      border-radius: 4px;
      padding: 4px 6px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      max-width: 380px;
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
      padding: 2px 4px;
      border-radius: 3px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.3;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 11px;
    }
    
    .co-inline-diff-text-add {
      background: #ecfdf5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    
    /* 差异单词高亮 - 弹出框中新文本的变更单词 */
    .co-word-changed {
      background: #a7f3d0;
      color: #065f46;
      border-radius: 2px;
      padding: 0 1px;
    }
    
    
    .co-inline-diff-actions {
      display: flex;
      justify-content: flex-start;
      gap: 3px;
      margin-top: 3px;
      padding-top: 0;
      border-top: none;
    }
    
    .co-inline-diff-btn {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      border: none;
    }
    
    .co-inline-diff-btn-accept {
      background: #10b981;
      color: white;
    }
    
    .co-inline-diff-btn-accept:hover {
      background: #059669;
    }
    
    .co-inline-diff-btn-reject {
      background: #f3f4f6;
      color: #6b7280;
      border: 1px solid #e5e7eb;
    }
    
    .co-inline-diff-btn-reject:hover {
      background: #e5e7eb;
      color: #4b5563;
    }
  `
  document.head.appendChild(style)
}

