# Sketch Dialog Vue

独立的 Vue 3 画板弹窗组件。

```bash
npm install
npm run dev
```

组件入口：`src/components/SketchDialog.vue`

```vue
<SketchDialog v-model="isOpen" @download="handleDownload" />
```

样式变量集中在 `src/styles/tokens.css`。绘制使用双 Canvas 分层，平滑笔迹由 `perfect-freehand` 处理。
