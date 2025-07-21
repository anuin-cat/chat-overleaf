<p align="center">
  <img src="./assets/icon.png" alt="Chat Overleaf Logo" width="96" />
</p>

<h1 align="center">Chat Overleaf ✨</h1>

<p align="center"><b>Overleaf AI 助手 | 基于 Plasmo 的 Overleaf AI 对话助手</b></p>

---

## 🚀 基本功能

### 💬 智能对话系统
- 👥 <b>无缝集成</b>：完美融入 Overleaf 界面，不影响正常编辑体验
- 📝 <b>选中文本提问</b>：选中编辑器内容即可直接提问，自动作为上下文
- 🖼️ <b>多模态支持</b>：支持图片上传、粘贴和拖拽，实现图文混合对话
- 📱 <b>响应式设计</b>：支持侧边栏宽度调整，适配不同屏幕尺寸

### 📁 文件内容管理
- 📄 <b>智能提取</b>：自动取当前文件或手动点击即可提取整个项目内容作为 AI 上下文
- 🔄 <b>实时同步</b>：编辑器内容变化时自动更新已提取的文件
- 📋 <b>文件选择</b>：灵活选择需要包含在对话中的文件

### 💾 对话历史管理
- 📚 <b>历史记录</b>：自动保存对话历史，支持加载和管理多个会话
- 🌿 <b>分支对话</b>：支持从历史消息创建新的对话分支
- 🗑️ <b>批量管理</b>：支持删除单个或清空所有历史记录

### 🧠 模型管理
- 🔧 <b>内置模型</b>：预配置多个国内主流 AI 模型（DeepSeek、Kimi、Qwen 等）
- ⚙️ <b>自定义模型</b>：支持添加自定义 AI 服务商和模型
- 📌 <b>模型置顶</b>：常用模型可置顶显示，快速切换

---

##  界面预览

![Chat Overleaf](./assets/img/example.png)
![Settings](./assets/img/setting.png)
![Several](./assets/img/several.png)


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

- [x] ✍️ 支持添加编辑器选中内容对话
- [x] 💾 添加对话历史持久化
- [x] 🔄 支持当前编辑器内容自动更新
- [x] 🧩 优化上下文选中逻辑
- [ ] 📝 支持自定义 prompt 模板
- [x] 🛠️ 支持自定义添加模型
- [x] 🖼️ 支持图文问答

---

### ⚡️ 基于 [Plasmo](https://github.com/PlasmoHQ/plasmo) 构建



