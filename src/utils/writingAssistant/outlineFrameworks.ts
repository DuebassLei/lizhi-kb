import type { WaOutlineFormat, WaOutlineFramework } from "../../types/writingAssistant";

/** 大纲结构框架：预填小节骨架，生成时再填实质内容 */
export type OutlineSection = { title: string; bullets?: string[] };

const FRAMEWORKS: Record<WaOutlineFramework, OutlineSection[]> = {
  general: [
    { title: "开篇：为什么现在要谈这个", bullets: ["读者痛点或场景", "本文能带走什么"] },
    { title: "核心观点 / 总述", bullets: ["一句话中心论点", "全文结构预告"] },
    { title: "分论点一", bullets: ["论据或案例", "小结"] },
    { title: "分论点二", bullets: ["论据或案例", "小结"] },
    { title: "落地建议与收束", bullets: ["可行动清单", "结尾金句"] },
  ],
  problemSolution: [
    { title: "现象：读者正在面对的麻烦", bullets: ["具体场景", "代价是什么"] },
    { title: "原因：问题从哪来", bullets: ["表层原因", "深层原因"] },
    { title: "方案：怎么解决", bullets: ["原则或路径", "关键步骤"] },
    { title: "验证：这样做会怎样", bullets: ["前后对比", "注意事项"] },
    { title: "行动清单", bullets: ["今天就能做的 3 件事"] },
  ],
  howto: [
    { title: "写在前面：适合谁、要准备什么", bullets: ["读者画像", "前置条件"] },
    { title: "步骤一", bullets: ["做什么", "为什么", "常见坑"] },
    { title: "步骤二", bullets: ["做什么", "为什么", "常见坑"] },
    { title: "步骤三", bullets: ["做什么", "验收标准"] },
    { title: "复盘与进阶", bullets: ["Checklist", "下一阶段"] },
  ],
  storyCase: [
    { title: "故事开场", bullets: ["人物与冲突", "悬念"] },
    { title: "转折与洞察", bullets: ["关键事件", "可迁移结论"] },
    { title: "方法论抽离", bullets: ["步骤或原则", "适用边界"] },
    { title: "读者如何套用", bullets: ["对照自己的场景"] },
    { title: "结尾回响", bullets: ["呼应开场", "留一句行动号召"] },
  ],
  comparison: [
    { title: "选型背景：我们要比什么", bullets: ["评价维度说明"] },
    { title: "方案 A", bullets: ["优势", "短板", "适合谁"] },
    { title: "方案 B", bullets: ["优势", "短板", "适合谁"] },
    { title: "横向对比表（文字说明）", bullets: ["维度一", "维度二", "维度三"] },
    { title: "建议结论", bullets: ["推荐路径", "不同预算/阶段怎么选"] },
  ],
  listicle: [
    { title: "开篇：为什么要整理这份清单", bullets: ["读者收益"] },
    { title: "要点 1", bullets: ["是什么", "怎么用", "注意点"] },
    { title: "要点 2", bullets: ["是什么", "怎么用", "注意点"] },
    { title: "要点 3", bullets: ["是什么", "怎么用", "注意点"] },
    { title: "要点 4 / 补充", bullets: ["可选扩展"] },
    { title: "怎么选与怎么开始", bullets: ["优先级建议"] },
  ],
};

export const WA_OUTLINE_FRAMEWORK_ORDER: WaOutlineFramework[] = [
  "general",
  "problemSolution",
  "howto",
  "storyCase",
  "comparison",
  "listicle",
];

export function getFrameworkSections(framework: WaOutlineFramework): OutlineSection[] {
  return FRAMEWORKS[framework] ?? FRAMEWORKS.general;
}

/** 按大纲「书写格式」渲染框架骨架 */
export function renderOutlineFramework(
  framework: WaOutlineFramework,
  format: WaOutlineFormat,
  opts?: { title?: string; customHint?: string },
): string {
  const sections = getFrameworkSections(framework);
  const title = opts?.title?.trim();
  const header =
    title != null && title.length > 0
      ? `<!-- 框架基于选题「${title}」，可改标题后点「生成」充实要点 -->\n`
      : `<!-- 预设结构框架，可改小节后点「生成」让 AI 充实 -->\n`;

  let body: string;
  switch (format) {
    case "cn":
      body = renderCn(sections);
      break;
    case "list":
      body = renderList(sections);
      break;
    case "custom":
      body =
        (opts?.customHint?.trim() ? `（格式说明：${opts.customHint.trim()}）\n\n` : "") +
        renderH2(sections);
      break;
    case "h2h3":
    default:
      body = renderH2(sections);
      break;
  }
  return `${header}${body}`.trim() + "\n";
}

function renderH2(sections: OutlineSection[]): string {
  return sections
    .map((s) => {
      const bullets = (s.bullets ?? []).map((b) => `- ${b}`).join("\n");
      return bullets ? `## ${s.title}\n${bullets}` : `## ${s.title}`;
    })
    .join("\n\n");
}

function renderCn(sections: OutlineSection[]): string {
  const nums = ["一", "二", "三", "四", "五", "六", "七", "八"];
  return sections
    .map((s, i) => {
      const head = `${nums[i] ?? String(i + 1)}、${s.title}`;
      const bullets = (s.bullets ?? [])
        .map((b, j) => `（${["一", "二", "三", "四", "五"][j] ?? j + 1}）${b}`)
        .join("\n");
      return bullets ? `${head}\n${bullets}` : head;
    })
    .join("\n\n");
}

function renderList(sections: OutlineSection[]): string {
  return sections
    .map((s, i) => {
      const head = `${i + 1}. ${s.title}`;
      const bullets = (s.bullets ?? []).map((b) => `   - ${b}`).join("\n");
      return bullets ? `${head}\n${bullets}` : head;
    })
    .join("\n");
}

/** 是否仍是空大纲（无实质标题内容） */
export function isOutlineEffectivelyEmpty(text: string | undefined | null): boolean {
  if (text == null) return true;
  const stripped = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, "")
    .trim();
  return stripped.length === 0;
}
