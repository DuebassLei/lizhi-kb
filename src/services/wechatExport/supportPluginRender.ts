/** 点赞 / 转发 / 推荐分享插件正文字段 */
type SupportBody = {
  label?: string;
  fields: Record<string, string>;
};

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 三色水彩心 SVG（小装饰） */
function heartSvg(size: number, fill: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    `style="display:inline-block;vertical-align:middle">` +
    `<path fill="${fill}" d="M12 21s-6.7-4.3-9.3-8.1C.6 9.7 1.7 6.2 4.6 5.1c1.7-.7 3.6-.2 4.8 1.1L12 9l2.6-2.8c1.2-1.3 3.1-1.8 4.8-1.1 2.9 1.1 4 4.6 1.9 7.8C18.7 16.7 12 21 12 21z"/>` +
    `</svg>`
  );
}

/** 点赞手势图标 */
function likeIconSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" style="display:block;margin:0 auto">` +
    `<path fill="#F4A261" d="M18 42V20l8-14c1.2-2 3.8-2.2 5.2-.4.8 1 1 2.4.5 3.6L28 18h12c2.2 0 4 1.8 4 4v2c0 .4 0 .8-.1 1.2l-3.5 14c-.5 2-2.3 3.4-4.4 3.4H22c-2.2 0-4-1.8-4-4z"/>` +
    `<rect x="8" y="20" width="8" height="22" rx="2" fill="#E76F51"/>` +
    `</svg>`
  );
}

/** 转发箭头图标 */
function shareIconSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" style="display:block;margin:0 auto">` +
    `<path fill="none" stroke="#E8919A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" ` +
    `d="M28 14l10 10-10 10M14 24h24M20 10c-6 2-10 8-10 14s4 12 10 14"/>` +
    `</svg>`
  );
}

/** 推荐爱心图标 */
function recommendIconSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 48 48" style="display:block;margin:0 auto">` +
    `<path fill="#E86A5A" d="M24 42S8 31 4 22C1.5 16.5 4 10 10 8c3.5-1.2 7.2.2 9.4 3L24 18l4.6-7c2.2-2.8 5.9-4.2 9.4-3 6 2 8.5 8.5 6 14C40 31 24 42 24 42z"/>` +
    `</svg>`
  );
}

/**
 * 参考图字幕条：淡黄油画荧光高光 + 手写字 + 尾心
 * 用略不规则胶囊路径，避免 CSS 亮渐变 pill 的「按钮感」
 */
function subtitleBadge(text: string): string {
  const chars = Array.from(text).length;
  const w = Math.min(420, Math.max(220, chars * 13 + 56));
  const h = 30;
  const midY = h / 2;
  /* 轻微波浪长胶囊，接近马克笔描边 */
  const path =
    `M${h / 2},2 ` +
    `C${w * 0.22},0.5 ${w * 0.45},0 ${w * 0.5},0.8 ` +
    `C${w * 0.62},1.6 ${w * 0.78},1 ${w - h / 2},2.2 ` +
    `C${w - 4},${midY * 0.55} ${w - 1},${midY} ${w - 4},${midY * 1.45} ` +
    `C${w - h / 2},${h - 2} ${w * 0.78},${h - 1} ${w * 0.5},${h - 0.6} ` +
    `C${w * 0.35},${h} ${w * 0.2},${h - 0.8} ${h / 2},${h - 2.2} ` +
    `C4,${midY * 1.5} 1,${midY} 4,${midY * 0.5} Z`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" ` +
    `style="display:block;margin:0 auto;max-width:96%">` +
    `<path d="${path}" fill="#FFE9A0"/>` +
    `<path d="${path}" fill="#FFF6D0" opacity="0.45"/>` +
    `<text x="${w / 2 - 7}" y="${midY + 4.5}" text-anchor="middle" fill="#5C4033" ` +
    `font-size="12" font-weight="500" ` +
    `font-family="KaiTi,STKaiti,PingFang SC,Microsoft YaHei,serif">` +
    `${esc(text)}</text>` +
    `<path transform="translate(${w - 20},${midY - 6}) scale(0.52)" ` +
    `fill="#E85D4C" d="M12 21s-6.7-4.3-9.3-8.1C.6 9.7 1.7 6.2 4.6 5.1c1.7-.7 3.6-.2 4.8 1.1L12 9l2.6-2.8c1.2-1.3 3.1-1.8 4.8-1.1 2.9 1.1 4 4.6 1.9 7.8C18.7 16.7 12 21 12 21z"/>` +
    `</svg>`
  );
}

/**
 * 喵咪抱心插画（简化水彩风，公众号内联 SVG 可用）
 */
function mascotSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="128" viewBox="0 0 140 160" style="display:block;margin:0 auto">` +
    /* 小花 */
    `<g opacity="0.9">` +
    `<circle cx="18" cy="118" r="5" fill="#F2C14E"/><circle cx="26" cy="114" r="5" fill="#F2C14E"/>` +
    `<circle cx="22" cy="122" r="5" fill="#E8B84A"/><circle cx="22" cy="117" r="2.2" fill="#C9892E"/>` +
    `<path d="M12 130c6-8 14-6 18 2" fill="none" stroke="#7BA36A" stroke-width="2" stroke-linecap="round"/>` +
    `<circle cx="122" cy="124" r="4.5" fill="#F2C14E"/><circle cx="130" cy="120" r="4.5" fill="#E8B84A"/>` +
    `<circle cx="126" cy="128" r="4.5" fill="#F2C14E"/><circle cx="126" cy="123" r="2" fill="#C9892E"/>` +
    `<path d="M110 136c8-10 18-6 22 4" fill="none" stroke="#7BA36A" stroke-width="2" stroke-linecap="round"/>` +
    `</g>` +
    /* 气泡：加宽并左移，避免「有」被裁切 / 右侧被容器裁掉 */
    `<ellipse cx="96" cy="26" rx="38" ry="16" fill="#FFF9F0" stroke="#F0D9C2" stroke-width="1.5"/>` +
    `<path d="M82 40l5 9 9-7" fill="#FFF9F0" stroke="#F0D9C2" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<text x="96" y="30" text-anchor="middle" fill="#8B5E3C" font-size="11" ` +
    `font-family="PingFang SC,Microsoft YaHei,sans-serif" font-weight="600">有你真好！</text>` +
    /* 猫头耳朵 */
    `<path d="M42 52 L50 22 L68 48 Z" fill="#F3D2A8" stroke="#E0B889" stroke-width="1"/>` +
    `<path d="M48 48 L52 32 L60 46 Z" fill="#F7E6CF"/>` +
    `<path d="M98 52 L90 22 L72 48 Z" fill="#F3D2A8" stroke="#E0B889" stroke-width="1"/>` +
    `<path d="M92 48 L88 32 L80 46 Z" fill="#E8A070"/>` +
    /* 头 */
    `<ellipse cx="70" cy="68" rx="34" ry="30" fill="#F7E6CF" stroke="#E8C9A0" stroke-width="1.2"/>` +
    /* 花斑 */
    `<ellipse cx="48" cy="62" rx="10" ry="8" fill="#E8A070" opacity="0.85"/>` +
    `<ellipse cx="88" cy="72" rx="9" ry="7" fill="#C47A4A" opacity="0.75"/>` +
    `<ellipse cx="70" cy="86" rx="7" ry="5" fill="#E8A070" opacity="0.6"/>` +
    /* 闭眼笑 */
    `<path d="M54 68q6 6 12 0" fill="none" stroke="#5C4030" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M74 68q6 6 12 0" fill="none" stroke="#5C4030" stroke-width="2.2" stroke-linecap="round"/>` +
    /* 鼻嘴 */
    `<ellipse cx="70" cy="76" rx="3" ry="2.2" fill="#E8919A"/>` +
    `<path d="M70 78v6" stroke="#5C4030" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M70 84q-6 5-12 2" fill="none" stroke="#5C4030" stroke-width="1.4" stroke-linecap="round"/>` +
    `<path d="M70 84q6 5 12 2" fill="none" stroke="#5C4030" stroke-width="1.4" stroke-linecap="round"/>` +
    /* 腮红 */
    `<ellipse cx="50" cy="78" rx="5" ry="3" fill="#F5B7B1" opacity="0.55"/>` +
    `<ellipse cx="90" cy="78" rx="5" ry="3" fill="#F5B7B1" opacity="0.55"/>` +
    /* 大红心 */
    `<path d="M70 148c-22-14-34-28-34-42 0-12 8-20 18-20 6 0 11 3 16 9 5-6 10-9 16-9 10 0 18 8 18 20 0 14-12 28-34 42z" fill="#E85D4C"/>` +
    `<path d="M70 148c-18-12-28-24-28-36 0-8 5-14 12-14 4 0 8 2 12 7" fill="#F07868" opacity="0.45"/>` +
    `<text x="70" y="118" text-anchor="middle" fill="#fff" font-size="13" font-weight="700" font-family="PingFang SC,Microsoft YaHei,sans-serif">谢谢你</text>` +
    `<text x="70" y="132" text-anchor="middle" fill="#fff" font-size="10">♡ ♡</text>` +
    `</svg>`
  );
}

function actionCard(opts: {
  bg: string;
  tagBg: string;
  tagColor: string;
  iconBg: string;
  iconHtml: string;
  tag: string;
  desc: string;
}): string {
  return (
    `<td style="width:33%;vertical-align:top;padding:4px">` +
    `<section style="background:${opts.bg};border-radius:14px;padding:14px 10px 12px;text-align:center;` +
    `box-shadow:0 4px 12px rgba(139,94,60,0.08);border:1px solid rgba(255,255,255,0.8)">` +
    `<section style="width:46px;height:46px;margin:0 auto 10px;border-radius:50%;background:${opts.iconBg};` +
    `line-height:46px;text-align:center">` +
    `<span style="display:inline-block;vertical-align:middle;line-height:0">${opts.iconHtml}</span>` +
    `</section>` +
    `<section style="display:inline-block;margin:0 auto 8px;padding:3px 14px;border-radius:999px;` +
    `background:${opts.tagBg};color:${opts.tagColor};font-size:13px;font-weight:700;letter-spacing:0.06em">` +
    `${esc(opts.tag)}</section>` +
    `<p style="margin:0;padding:0 2px;font-size:11px;line-height:1.55;color:#7A5C45">${esc(opts.desc)}</p>` +
    `</section></td>`
  );
}

/**
 * 「喜欢就支持一下吧」水彩风分享插件
 * 微信兼容：table 布局 + 内联样式 + 内联 SVG
 */
export function renderSupportPlugin(body: SupportBody): string {
  const title = body.fields.title || body.label || "喜欢就支持一下吧！";
  const subtitle =
    body.fields.subtitle ||
    body.fields.desc ||
    "你的每一次互动，都是我持续创作的动力～";
  const bubble = body.fields.bubble || "有你真好！";
  const thanks = body.fields.thanks || "谢谢你";

  const likeTag = body.fields["like-tag"] || body.fields.like || "点赞";
  const likeDesc = body.fields["like-desc"] || "喜欢就点个赞吧！感谢你的支持！";
  const shareTag = body.fields["share-tag"] || body.fields.share || "转发";
  const shareDesc = body.fields["share-desc"] || "分享给更多朋友，让美好一起传递！";
  const recTag = body.fields["rec-tag"] || body.fields.recommend || "推荐";
  const recDesc = body.fields["rec-desc"] || "推荐给身边的人，让更多人看到！";

  /* 替换气泡文案到 SVG（mascotSvg 内写死了默认，重新拼一段气泡） */
  const mascot = mascotSvg().replace(">有你真好！<", `>${esc(bubble)}<`).replace(">谢谢你<", `>${esc(thanks)}<`);

  const header =
    `<section style="text-align:center;margin:0 0 16px;position:relative">` +
    `<p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#6B4423;` +
    `font-family:'KaiTi','STKaiti','PingFang SC','Microsoft YaHei',serif;letter-spacing:0.04em">` +
    `${heartSvg(16, "#E8919A")}&nbsp;${esc(title)}&nbsp;${heartSvg(14, "#F2C14E")}</p>` +
    subtitleBadge(subtitle) +
    `</section>`;

  const cards =
    `<table style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 4px">` +
    `<tr>` +
    actionCard({
      bg: "#FFFCF7",
      tagBg: "#F7D774",
      tagColor: "#6B4423",
      iconBg: "#FFF1C2",
      iconHtml: likeIconSvg(),
      tag: likeTag,
      desc: likeDesc,
    }) +
    actionCard({
      bg: "#FFFCF7",
      tagBg: "#F5B7B1",
      tagColor: "#7A3B3B",
      iconBg: "#FCE4E1",
      iconHtml: shareIconSvg(),
      tag: shareTag,
      desc: shareDesc,
    }) +
    actionCard({
      bg: "#FFFCF7",
      tagBg: "#E8919A",
      tagColor: "#FFF9F5",
      iconBg: "#F9D4D0",
      iconHtml: recommendIconSvg(),
      tag: recTag,
      desc: recDesc,
    }) +
    `</tr></table>`;

  const footerDecor =
    `<section style="text-align:center;margin-top:2px;line-height:1;opacity:0.9">` +
    `<span style="display:inline-block;margin:0 3px">${heartSvg(10, "#F2C14E")}</span>` +
    `<span style="color:#7BA36A;font-size:11px;letter-spacing:0.2em">····· ✿ ·····</span>` +
    `<span style="display:inline-block;margin:0 3px">${heartSvg(10, "#E8919A")}</span>` +
    `</section>`;

  return (
    `<section class="layout-module layout-support-plugin" style="margin:24px 0;padding:20px 14px 14px;` +
    `border-radius:18px;background-color:#FFF8EC;` +
    `background-image:linear-gradient(180deg,#FFF8EC 0%,#FFF3DF 55%,#FFEFD6 100%);` +
    `border:1px solid #F0D9B8">` +
    header +
    `<table style="width:100%;border-collapse:collapse"><tr>` +
    `<td style="vertical-align:middle;width:68%">${cards}</td>` +
    `<td style="vertical-align:bottom;width:32%;padding-left:4px;text-align:center">${mascot}</td>` +
    `</tr></table>` +
    footerDecor +
    `</section>`
  );
}
