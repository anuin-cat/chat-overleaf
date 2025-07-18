<p align="center">
  <img src="./assets/icon.png" alt="Chat Overleaf Logo" width="96" />
</p>

<h1 align="center">Chat Overleaf ✨</h1>

<p align="center"><b>Overleaf AI 助手 | 基于 Plasmo 的 Overleaf 谷歌插件脚手架</b></p>

---

## 🚀 基本功能

- 🤖 <b>智能对话</b>：在 Overleaf 页面右侧添加 AI 聊天面板，支持 LaTeX 相关问题咨询
- 📄 <b>内容提取</b>：可选择提取当前文件或整个项目的 LaTeX 内容，作为上下文提供给 AI
- 👥 <b>低耦合性</b>：无缝集成到 Overleaf 界面，不影响正常编辑体验
- 🧠 <b>多模型支持</b>：均为国内供应商，只需按照网址获取 API Key 即可使用

---

## 🛠️ 本地开发

### 环境要求
- Node.js 16+
- pnpm

### 开发步骤

1. 克隆项目

   ```bash
   git clone <your-repo-url>
   cd chat-overleaf
   ```

2. 安装依赖

   ```bash
   pnpm install
   ```

3. 启动开发服务器

   ```bash
   pnpm dev
   ```

4. 加载插件到浏览器
   - 打开 Chrome 扩展管理页面（`chrome://extensions/`）
   - 开启开发者模式
   - 点击「加载已解压的扩展程序」
   - 选择 `build/chrome-mv3-dev` 文件夹

5. 访问 Overleaf 网站测试功能

---

## 📦 构建生产版本

```bash
pnpm build
```

---

## 📦 直接加载 zip

1. 下载 github Releases 中的 zip 文件并解压

2. 在 Chrome 浏览器中加载插件
   - 打开 Chrome 扩展管理页面（`chrome://extensions/`）
   - 开启右上角的「开发者模式」
   - 点击「加载已解压的扩展程序」
   - 选择解压目录下的 `chrome-mv3-prod` 文件夹

3. 完成加载后，访问 Overleaf 网站点击右下角图标即可（注意先添加模型秘钥）

---

## 📋 TODO

- [√] ✍️ 支持添加编辑器选中内容对话
- [ ] 💾 添加对话历史持久化
- [√] 🔄 支持当前编辑器内容自动更新
- [√] 🧩 优化上下文选中逻辑
- [ ] 📝 支持自定义 prompt 模板
- [ ] 🛠️ 支持自定义添加模型

---

### ⚡️ 基于 [Plasmo](https://github.com/PlasmoHQ/plasmo) 构建



