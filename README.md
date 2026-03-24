# 腾讯云翻译助手 - Edge 浏览器插件

一款基于腾讯云机器翻译 API 的 Edge 浏览器翻译插件，支持选中文本即时翻译、术语库管理、主题自定义等功能。

## 目录

- [项目背景](#项目背景)
- [功能特性](#功能特性)
- [技术架构](#技术架构)
- [文件结构](#文件结构)
- [安装使用](#安装使用)
- [配置说明](#配置说明)
- [开发说明](#开发说明)

## 项目背景

### 需求分析

在日常浏览外文网页时，频繁遇到需要翻译的场景。现有翻译插件存在以下痛点：

1. **操作繁琐** - 需要选中文本后手动点击按钮或跳转页面
2. **显示位置固定** - 翻译结果只能在特定区域显示，遮挡原文
3. **术语不统一** - 专业领域词汇翻译不准确，无法自定义
4. **界面单调** - 无法根据个人喜好调整外观

### 设计目标

基于以上痛点，本插件的设计目标为：

- **即选即译** - 选中文本后自动弹出翻译结果
- **跟随光标** - 翻译浮窗跟随鼠标位置显示，不遮挡阅读
- **术语可控** - 支持腾讯云术语库，确保专业词汇准确
- **外观可调** - 支持主题颜色自定义，融入不同网页风格

## 功能特性

### 核心功能

| 功能 | 说明 |
|------|------|
| 选中翻译 | 选中网页文本后自动弹出翻译浮窗 |
| 跟随光标 | 翻译结果显示在鼠标光标旁边 |
| 可拖动 | 浮窗支持鼠标拖动调整位置 |
| 右键翻译 | 右键菜单集成翻译选项 |
| 快捷翻译 | 点击插件图标，在弹出窗口中直接输入翻译 |

### 设置功能

| 功能 | 说明 |
|------|------|
| API 配置 | 填写腾讯云 SecretId 和 SecretKey |
| 语言设置 | 自定义源语言和目标语言 |
| 术语库 | 支持绑定腾讯云术语库，提升专业翻译准确性 |
| 显示原文 | 可选择在翻译弹窗中同时显示原文 |
| 主题颜色 | 自定义弹窗和按钮的主题色 |

### 支持语言

简体中文、繁体中文、英语、日语、韩语、法语、西班牙语、意大利语、德语、土耳其语、俄语、葡萄牙语、越南语、印尼语、泰语、马来语、阿拉伯语、印地语

## 技术架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Edge 浏览器                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Popup 页面 │  │ Options 页面│  │  Content    │      │
│  │  (popup.js) │  │(options.js) │  │  Script     │      │
│  │  快速翻译   │  │  设置配置   │  │(content.js) │      │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘      │
│         │               │               │               │
│         └───────────────┼───────────────┘               │
│                         │                               │
│                         ▼                               │
│              ┌──────────────────┐                       │
│              │  Background      │                       │
│              │  Service Worker  │                       │
│              │  (background.js) │                       │
│              │  API 调用 & 签名 │                       │
│              └────────┬─────────┘                       │
└───────────────────────┼─────────────────────────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │   腾讯云机器翻译 API         │
         │   tmt.tencentcloudapi.com    │
         └──────────────────────────────┘
```

### 关键技术

#### 1. 腾讯云 API 签名

腾讯云 API 采用 TC3-HMAC-SHA256 签名方法，核心流程：

```
1. 拼接规范请求串 (CanonicalRequest)
2. 拼接待签名字符串 (StringToSign)
3. 计算派生签名密钥 (SecretDate → SecretService → SecretSigning)
4. 计算最终签名并拼接 Authorization
```

由于浏览器环境无法使用 Node.js SDK，本插件通过 Web Crypto API 手动实现签名过程。

#### 2. 浮窗定位策略

```javascript
// 定位逻辑：优先右下，溢出则左/上翻转
if (left + 浮窗宽度 > 视口宽度) {
    left = 鼠标X - 浮窗宽度 - 间距;
}
if (top + 浮窗高度 > 视口高度) {
    top = 鼠标Y - 浮窗高度 - 间距;
}
```

#### 3. 滚动隔离

浮窗内部滚动时阻止事件冒泡，避免影响页面滚动：

```javascript
div.addEventListener('wheel', function(e) {
    // 边界检测：已到顶部/底部时阻止默认行为
    if ((delta > 0 && scrollTop + height >= scrollHeight) ||
        (delta < 0 && scrollTop <= 0)) {
        e.preventDefault();
    }
    e.stopPropagation();
}, { passive: false });
```

## 文件结构

```
translator-edge-extension/
├── manifest.json       # 插件配置文件
├── background.js       # 后台服务脚本（API 签名 & 请求）
├── content.js          # 内容脚本（浮窗创建 & 交互）
├── popup.html          # 弹出窗口页面
├── popup.js            # 弹出窗口逻辑
├── options.html        # 设置页面
├── options.js          # 设置页面逻辑
├── styles.css          # 全局样式
└── icons/
    ├── icon16.png      # 16x16 图标
    ├── icon48.png      # 48x48 图标
    └── icon128.png     # 128x128 图标
```

### 文件职责

| 文件 | 职责 |
|------|------|
| `manifest.json` | 声明插件元数据、权限、入口文件 |
| `background.js` | 处理腾讯云 API 签名、发送翻译请求 |
| `content.js` | 创建翻译浮窗、处理选中事件、拖动逻辑 |
| `popup.html/js` | 插件弹出窗口，提供快速翻译入口 |
| `options.html/js` | 设置页面，管理 API 密钥、语言、外观等配置 |
| `styles.css` | 使用 CSS 变量实现主题颜色自定义 |

## 安装使用

### 前置条件

1. Microsoft Edge 浏览器
2. 腾讯云账号并开通机器翻译服务

### 安装步骤

1. 下载或克隆本项目
2. 打开 Edge 浏览器，访问 `edge://extensions/`
3. 开启左下角「开发人员模式」
4. 点击「加载解压缩的扩展」
5. 选择 `translator-edge-extension` 文件夹

### 获取 API 密钥

1. 访问 [腾讯云官网](https://cloud.tencent.com/) 注册账号
2. 完成实名认证
3. 搜索「机器翻译」并开通服务（每月 500 万字符免费）
4. 前往「访问管理」→「API 密钥管理」→ 新建密钥
5. 将 SecretId 和 SecretKey 填入插件设置页面

## 配置说明

### API 配置

| 配置项 | 说明 |
|--------|------|
| SecretId | 腾讯云 API 密钥 ID |
| SecretKey | 腾讯云 API 密钥（请妥善保管） |

### 翻译配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 源语言 | 输入文本的语言 | 自动识别 |
| 目标语言 | 翻译输出的语言 | 简体中文 |
| 术语库 ID | 腾讯云术语库 ID 列表 | 空 |

### 外观配置

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| 主题颜色 | 弹窗和按钮的主题色 | #006eff（蓝色） |
| 显示原文 | 在弹窗中显示选中的原文 | 开启 |
| 启用翻译 | 是否启用选中翻译功能 | 开启 |

### 术语库使用

1. 前往 [腾讯云术语库管理页面](https://console.cloud.tencent.com/tmt/term_bank)
2. 创建术语库，设置语言方向（如：英语 → 中文）
3. 添加术语（支持单条添加或批量导入 CSV/XLSX）
4. 复制术语库 ID 到插件设置页面（每行一个 ID）

## 开发说明

### 本地开发

修改代码后，在 `edge://extensions/` 页面点击插件的刷新按钮即可生效。

### 数据存储

插件使用 `chrome.storage.local` 存储以下数据：

```javascript
{
    secretId: string,       // 腾讯云 SecretId
    secretKey: string,      // 腾讯云 SecretKey
    sourceLang: string,     // 源语言代码
    targetLang: string,     // 目标语言代码
    termRepoIds: string[],  // 术语库 ID 列表
    enabled: boolean,       // 是否启用翻译
    showOriginal: boolean,  // 是否显示原文
    themeColor: string      // 主题颜色（HEX）
}
```

### 消息通信

插件各组件通过 `chrome.runtime.sendMessage` 进行通信：

```
Content Script  ──sendMessage──▶  Background
                 { action: 'translate', text: '...' }
                 
Background      ──sendResponse──▶  Content Script
                 { success: true, result: '翻译结果' }
```

### 自定义主题

样式使用 CSS 变量实现主题切换：

```css
:root {
    --tt-theme: #006eff;           /* 主题色 */
    --tt-theme-dark: #0052cc;      /* 深色主题色 */
}
```

通过 JavaScript 动态修改：

```javascript
document.documentElement.style.setProperty('--tt-theme', newColor);
```

## License

MIT
