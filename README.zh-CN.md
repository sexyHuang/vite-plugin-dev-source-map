# vite-plugin-dev-source-map

[English](./README.md)

为 **Vite 开发模式**的原始 TSX、TS、JSX、JS 分配独立的 sourcemap URL，帮助浏览器 DevTools 正确区分原始源码与编译后的 JavaScript。

## 解决什么问题

Vite 开发服务可能让编译文件和 map 中的原始源码都对应 `/src/Component.tsx`。按 URL 打开文件的工具可能选中编译代码，却使用原始源码的行列位置。

插件把原始源码 URL 改成 `vite-source:///src/Component.tsx`，保留编译代码、行列映射、名称和内嵌源码。它用于处理这类 URL 冲突，包括 React DevTools 的 **Rendered by** 调用栈跳转。

## 安装和使用

```sh
npm install -D vite-plugin-dev-source-map
```

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import devSourceMap from 'vite-plugin-dev-source-map'

export default defineConfig({
  plugins: [react(), devSourceMap()],
})
```

要求 Vite 8、Node.js 20.19+（20.x）或 22.12+。提供 ESM 默认导出、`devSourceMap` 命名导出和 TypeScript 类型。Vite 6、7 尚未验证。

添加后重启开发服务并刷新页面，在 Chrome DevTools 中开启 JavaScript source maps。

## 当前支持范围

- 仅处理 Vite 项目根目录 `src/` 下开发响应中的内联 base64 JS sourcemap。
- 支持 `/demo/` 这样的 Vite `base`。
- 保留源码内容、行列映射及交互代码，跳过 `?raw`、`?url` 导入。
- 区分新旧 ETag，避免继续使用旧映射，同时保留 304 缓存。
- 解析失败时保留原响应。
- 生产构建和 `vite preview` 不启用插件。

`vite-source:` 是调试用的虚拟 URL，浏览器从 `sourcesContent` 读取源码。缺少内嵌源码的来源不会改写。首版不处理外部 `.map`、CSS、依赖、`src/` 之外的文件或 indexed sourcemap，也不会开启被其他插件禁用的映射。

插件处理源码 URL 冲突；最终跳转仍取决于 DevTools 扩展是否使用映射后的源码 URL。

## 示例和验证

```sh
git clone https://github.com/sexyHuang/vite-plugin-dev-source-map.git
cd vite-plugin-dev-source-map
npm ci
npm run dev
```

在 React DevTools Components 中选中 `Child`，点击 **Rendered by** 下的 `Parent` 调用位置，预期打开 `vite-source:///src/App.tsx` 中的 `<Child />`。示例包含可点击的计数器。

```sh
npm test
npm pack
```

测试使用真实 Vite HTTP 响应，检查源码坐标、缓存、特殊导入和模块更新。CI 覆盖 Node.js 20、22、24。

## License

MIT
