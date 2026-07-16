# 知识卡片内置主题

每个内置主题由一对文件组成：

- `{id}.ts` — 主题元数据（颜色、字体、间距等），通过 `defineTheme()` 导出
- `{id}.css` — 视觉样式（外壳装饰、标题、引用、列表等）

TS 侧用 Vite 的 `?raw` 导入 CSS 字符串：

```ts
import themeCss from "./cartoon-sticker.css?raw";

export default defineTheme({
  id: "cartoon-sticker",
  customCSS: themeCss,
  skin: "plain",
});
```

**注意：** CSS 文件中不要写 `/* 注释 */`，否则会被 `sanitizeThemeCss` 剥掉并破坏作用域选择器拼接。

列表重置与自定义 marker 请直接写在 `.css` 里（参考各主题的 `.card-block.block-list` 规则），或在 TS 中 `customCSS: themeCss + listResetCss('"▸"')`。

新增主题：复制一对 ts+css，在 `index.ts` 的 `buildBuiltinThemes()` 数组中注册即可。

设计参考：`docs/demo/knowledge-card-theme-gallery.html`
