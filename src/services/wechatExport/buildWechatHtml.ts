import juice from "juice";
import { isAssetRef, resolveAssetAsDataUrl } from "../assetService";
import { compressDataUrlForWechat, urlToDataUrl } from "../../utils/imageDataUrl";
import {
  WECHAT_CODE_HLJS_CSS,
  convertColorSpansToFont,
  highlightCodeBlocksInHtml,
  preserveCodeBlockWhitespace,
} from "./highlightCodeForWechat";
import { postProcessForWechat } from "./postProcessHtml";
import { markdownUsesLayoutModules, parseLayoutMarkdown } from "./parseLayoutMarkdown";
import { applyThemeWechatDecor, getThemeCss, type WechatThemeId } from "./themes";
import { WECHAT_BASE_CSS } from "./wechatBaseCss";
import { marked } from "marked";

function fixWechatBlackColor(html: string): string {
  return html
    .replace(/color:\s*rgb\(\s*0\s*,\s*0\s*,\s*0\s*\)/gi, "color: rgb(1, 1, 1)")
    .replace(/color:\s*#000\b/gi, "color: #010101")
    .replace(/color:\s*#000000\b/gi, "color: #010101");
}

/** 微信公众号无法拉取本地 / asset 协议图片，需内联为 data URL */
function needsWechatInline(src: string): boolean {
  if (!src || src.startsWith("data:")) return false;
  if (isAssetRef(src)) return true;
  if (/^blob:/i.test(src)) return true;
  if (/^asset:/i.test(src)) return true;
  if (/asset\.localhost/i.test(src)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(src)) return true;
  return false;
}

/** 将图片 src 转为微信可粘贴的 data URL（含自动压缩） */
async function embedImageSrcForWechat(src: string): Promise<string> {
  if (!src) return src;
  if (!src.startsWith("data:") && !isAssetRef(src) && !needsWechatInline(src)) {
    return src;
  }

  if (isAssetRef(src)) {
    return resolveAssetAsDataUrl(src);
  }

  const dataUrl = src.startsWith("data:") ? src : await urlToDataUrl(src);
  return compressDataUrlForWechat(dataUrl);
}

/** 将 asset:// 图片引用嵌入为 data URL */
export async function embedAssetsInMarkdown(markdown: string): Promise<string> {
  const refs = new Set<string>();
  const re = /!\[[^\]]*\]\((asset:\/\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    refs.add(m[1]);
  }

  if (!refs.size) return markdown;

  let result = markdown;
  for (const ref of refs) {
    if (!isAssetRef(ref)) continue;
    try {
      const dataUrl = await resolveAssetAsDataUrl(ref);
      result = result.split(ref).join(dataUrl);
    } catch {
      /* 保留原 ref */
    }
  }
  return result;
}

async function resolveImagesInHtml(html: string): Promise<string> {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const imgs = doc.querySelectorAll("img");
  for (const img of imgs) {
    const src = img.getAttribute("src") ?? "";
    if (!src || src.startsWith("data:")) continue;
    try {
      img.setAttribute("src", await embedImageSrcForWechat(src));
    } catch {
      /* ignore */
    }
  }
  const wrapper = doc.body.firstElementChild;
  return wrapper?.innerHTML ?? html;
}

/** juice 后兜底：内联 HTML 中仍残留的本地图片 */
async function inlineImagesInHtml(html: string): Promise<string> {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs = doc.querySelectorAll("img");
  let changed = false;
  for (const img of imgs) {
    const src = img.getAttribute("src") ?? "";
    if (!needsWechatInline(src)) continue;
    try {
      img.setAttribute("src", await embedImageSrcForWechat(src));
      changed = true;
    } catch {
      /* ignore */
    }
  }
  return changed ? doc.body.innerHTML : html;
}

function renderMarkdownHtml(markdown: string, themeId: WechatThemeId): string {
  if (markdownUsesLayoutModules(markdown)) {
    return parseLayoutMarkdown(markdown, themeId);
  }
  return marked.parse(markdown, { async: false }) as string;
}

/** 构建公众号可粘贴的 HTML 富文本 */
export async function buildWechatArticleHtml(
  markdown: string,
  themeId: WechatThemeId,
): Promise<string> {
  const normalized = (await embedAssetsInMarkdown(markdown)).trim();
  if (!normalized) return "";

  let markdownHtml = renderMarkdownHtml(normalized, themeId);
  markdownHtml = await resolveImagesInHtml(markdownHtml);

  let processedHtml = postProcessForWechat(markdownHtml);
  // juice 之前注入 hljs span，对齐 md-wechat-editor：class → CSS → juice 内联
  processedHtml = highlightCodeBlocksInHtml(processedHtml, themeId);
  // 草案主题：CSS 伪元素装饰转为真实 DOM，供 juice 内联后在微信显示
  processedHtml = applyThemeWechatDecor(processedHtml, themeId);

  const themeCss = getThemeCss(themeId, "#nice");
  const mergedCss = `${WECHAT_BASE_CSS}\n${WECHAT_CODE_HLJS_CSS}\n${themeCss}`;

  let result: string;
  try {
    result = juice.inlineContent(processedHtml, mergedCss, {
      inlinePseudoElements: true,
      preserveImportant: true,
    });
  } catch {
    result = processedHtml.replace("</section>", `<style>${mergedCss}</style></section>`);
  }

  result = preserveCodeBlockWhitespace(result);

  result = await inlineImagesInHtml(result);

  return fixWechatBlackColor(convertColorSpansToFont(result));
}

/** 预览用 HTML（不内联 juice，由容器 CSS 控制） */
export async function buildWechatPreviewHtml(
  markdown: string,
  themeId: WechatThemeId,
): Promise<string> {
  const normalized = markdown.trim();
  if (!normalized) return "";

  let markdownHtml = renderMarkdownHtml(normalized, themeId);
  markdownHtml = await resolveImagesInHtml(markdownHtml);
  let processedHtml = postProcessForWechat(markdownHtml);
  processedHtml = highlightCodeBlocksInHtml(processedHtml, themeId);
  processedHtml = applyThemeWechatDecor(processedHtml, themeId);
  return processedHtml;
}
