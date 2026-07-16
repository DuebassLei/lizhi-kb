# 题库文档批量整理方案（Playbook）

> **日期**: 2026-07-16  
> **用途**: 新 Word / HTML 错题页 / 图片试卷入库时的标准处理流程与踩坑清单  
> **关联**: [题库设计](../superpowers/specs/2026-07-16-question-bank-design.md)  
> **入库格式**: 题库 JSON（见文末 Schema）→ 应用内「题库数据管理 → 导入」

---

## 1. 目标与原则

| 原则 | 说明 |
|------|------|
| 答案正确优先 | 宁可少导，不可把错误答案配给错误选项 |
| 成套保留 | `(题干 + 选项指纹 + 答案)` 作为原子单元，禁止只按题干去重 |
| 加密库走 UI 导入 | vault 开启加密时，不要直接写 `lizhi-kb.db`，用导出的 JSON 在应用内导入 |
| 可复跑 | 解析脚本可重复执行；同 `source` 可先清空再替换导入 |

---

## 2. 推荐工具链

| 步骤 | 工具 | 备注 |
|------|------|------|
| Word → 文本 | `python-docx`（优先）或 `markitdown` | docx 用段落列表比纯 Markdown 更易对齐「正确答案」 |
| HTML 错题页 | `BeautifulSoup` 按 DOM 抽取 | 答案在 `.question-ans-right`，比 Word 切块更可靠 |
| PDF / 扫描件 | OCR（如系统 OCR / PaddleOCR）→ 纯文本 | 再套 Word 切题逻辑 |
| 截图题干 | 识图 / OCR → 人工校对题干 | 选项常完整、题干易丢 |
| 结构化 | Python 脚本 + 校验 | Word 见 §5.1；HTML 见 §5.2 |
| 入库 | `question-bank-import.json` → 狸知「导入题库」 | 建议 **替换** 或「先清空再合并」 |

本地参考脚本（可复制改用）：

| 格式 | 脚本 | 产出 |
|------|------|------|
| Word | `tmp/rebuild_questions.py` | `tmp/question-bank-import.json` |
| HTML | `tmp/parse_exam_html.py` | `tmp/question-bank-html-import.json` |
| 审计 | `tmp/audit_answers*.py` | 答案对齐报告 |

---

## 3. 标准流程（Checklist）

```
1. 备份原文
2. 抽取内容（docx 段落 / HTML DOM / OCR 文本）
3. 结构摸底（题型、答案标记、是否多套试卷重复）
4. 解析成题（切块或 DOM → 题型 → 选项 → 答案 → 解析）
5. 质检（答案对齐、脏题干、无题干）
6. 生成 JSON
7. 应用内导入（加密库务必走 UI）
8. 抽查 10～20 道 + 排序/搜索冒烟
```

### 3.1 抽取文本

**Word（.docx）**

```bash
# 优先：按段落导出，保留软换行信息
python -c "from docx import Document; ..."
# 或
markitdown "试卷.docx" -o "试卷.md"
```

**注意**：Word 常把一句话拆成多段；`A.` 与选项正文也可能分在不同段。

**图片 / 扫描 PDF**

1. OCR 出纯文本  
2. 统一换行、去掉页眉页脚  
3. 人工扫一眼「正确答案」是否齐全  

**HTML（在线考试错题页，如 es.iwhalecloud.com）**

1. 浏览器打开「查看错题 / exam_error_check」页  
2. **另存为完整网页**（`.html` + `_files/` 资源目录）  
3. 确认页面含 `.question-ans-right`（正确答案区块）  
4. 运行 `python tmp/parse_exam_html.py`（或改脚本内 `HTML_FILES` 路径）

```bash
python tmp/parse_exam_html.py
# 产出：tmp/question-bank-html-import.json
# 报告：tmp/html-parse-report.json
```

**注意**：

- 错题页通常**只含答错的题**，不是整卷；多份 HTML 可合并解析  
- 须用 **DOM 选择器** 取答案，不要对 HTML 做「正确答案：」文本切块（结构已结构化）  
- 判断题去重键必须是 **归一化题干**，不能只用 `(正确, 错误)` 选项指纹（否则 25 道判断题会被合并成 1 道）

### 3.2 结构摸底（必做）

统计并记录：

| 观察项 | 怎么查 | 用途 |
|--------|--------|------|
| `正确答案` 出现次数 | 全文计数 | 上限 ≈ 题目条数（含重复卷） |
| 是否有 `单选题(共 n 题)` / `多选题` / `判断题` | 搜章节标题 | 后半多套模拟卷，易重复 |
| 题号是否重置 | `1.` 是否反复出现 | 说明多卷拼接，不能按全局题号唯一 |
| 空选项模式 | `A.` 后为空，正文在下方 | 需「分离选项」修复 |
| 无题干题 | 只有 `:` + A/B/C/D | **应丢弃**，无法可靠补题干 |
| HTML 题块数 | `div.question-content` 计数 | 应等于 `question-ans-right` 数 |
| HTML 是否错题页 | 页头「共答错 N 道题」 | 题量 ≤ N，非全库 |

### 3.3 解析规则（核心）

#### Word / 纯文本

以 **`正确答案：`** 为切分锚点（比题号更可靠）。

对每一块：

1. **答案**：锚点后第一非空行（或下一行的 `正确`/`错误`/`ABCD`）  
2. **解析**：`解释说明` / `解析` 之后、下一题之前  
3. **题干 + 选项**：锚点之前；需先剥掉「上一题答案字母 + 解释残片」  
4. **题型**：
   - 答案为 `正确`/`错误` → `truefalse`
   - 答案含多个字母 → `multi`
   - 否则 → `single`

**软换行合并（保守）**

- 仅合并：明显被切断的中长句、拉丁单词半截（如 `Concurrent` + `HashMap`）  
- **不要**合并：短独立词（`大于`/`小于`）、完整 PascalCase 选项名后面的另一标识符  

**空选项修复**

```
A.
B.
C.
D.

大于
小于
大于等于
等于
```

→ 按顺序灌回 A–D。

**去重键（重要）**

| ❌ 错误 | ✅ 正确 |
|--------|--------|
| 只按题干去重 | 选择题：按 **选项指纹** `(label, 归一化 text)*` 去重 |
| 同题干不同卷答案取「碰巧留下的那份」 | 同选项指纹下答案冲突 → **多数票** |
| 判断题只按题干模糊匹配 | 判断题：去重键 `("truefalse", 归一化题干)`；冲突仍用多数票 |
| 判断题按 `(正确,错误)` 去重 | **禁止** — 所有判断题选项相同，会误合并 |

#### HTML（DOM 直取）

对每个 `div.question-content`：

| 字段 | 选择器 | 说明 |
|------|--------|------|
| 章节题型 | 父级 `div.questions-title` | 单选题 / 多选题 / 判断题 |
| 题干 | `div.exam-question` | 去掉 `span.question-index`、末尾 `(2.0分)` |
| 选项 | `div.answers div.select span.words` | `A. …` → label + text；判断题为「正确」「错误」 |
| **正确答案** | `div.analysis-content.question-ans-right` | **权威来源**，直接映射 `correctAnswer` |
| 解析 | `div.analysis-content.question-analysis` | 可为空 |
| 考生答案 | `div.question-com-answer` | **忽略**（错题页上的作答，非标准答案） |

**题型判定**：

- 选项为「正确 / 错误」或章节为判断题 → `truefalse`（`correctAnswer`: `["true"]` / `["false"]`）
- 章节为多选题，或答案含多个字母 → `multi`
- 否则 → `single`

**题干特殊处理**：

- 题干内 `<p>` 分段（如代码 `<div>$var</div>` + 问句）→ 用 `\n` 拼接，保留 HTML 实体解码  
- 选项文本去掉尾部 stray `|`（OCR/排版残留）

**去重键**：

- 选择题 / 多选：`((label, norm(text)), …)`  
- 判断题：`("truefalse", norm(title).lower())`  
- 同键多份 HTML 重复出现 → 多数票；解析取更长者

### 3.4 必须丢弃 / 清洗的脏数据

| 现象 | 处理 |
|------|------|
| Word 无题干，仅有选项 | **跳过**（无法编造题干） |
| 题干以 `ABCDEF解释说明：` / `A解释说明：` 开头 | 丢弃（上一题泄漏） |
| 题干是规约原文 + `1）2）3）` 枚举，无问句形态 | 丢弃 |
| 题干含 `反例：` 且选项主题明显无关 | 丢弃（串题） |
| 选项被拼成 8 个、两题揉一起 | 丢弃或拆开重解析 |
| `ConcurrentHashMap` 被裁成 `Concurrent` | 禁止「选项文本互相裁剪」启发式（子串误伤） |

### 3.5 质检（导入前）

至少跑三类检查：

1. **答案标签存在**：`correctAnswer` ⊆ 选项 `label`  
2. **原文对齐**：导入答案 ∈ 该题在原文中的答案变体集合（mismatch 应为 0）  
3. **同选项指纹多数票**：与多数答案不一致应为 0  

**HTML 额外检查**（`html-parse-report.json`）：

- `skipped.*` 全为 0（无漏题）  
- `html_alignment_failures` 为空（逐题回读 `.question-ans-right` 与导出 JSON 一致）  
- `conflicts_resolved` 为 0 或已人工确认多数票结果  

抽查：各题型 5～10 道 + 曾出错类型（判断翻反、hash/equals、NPE 串题、HTML 代码题干）。

### 3.6 入库

1. 生成 JSON（§7）  
2. 狸知 → 解锁 → **题库** → 数据管理 → **导入**  
3. 全量覆盖用 **替换**；追加用 **合并**  
4. 导入前可先 **导出备份** / **一键清空**（均有二次确认）  

加密库：**禁止**直接改 `~/.lizhi-kb/lizhi-kb.db`（明文库可能不是运行时在用的库）。

---

## 4. 常见原文形态对照

### 4.1 标准选择题

```
1.题干……()
A. …
B. …
C. …
D. …
正确答案：C
```

### 4.2 判断题

```
1.陈述句……()
正确
错误
正确答案：
错误
解释说明：
……
```

### 4.3 多选 + 解析

```
正确答案：ABD
解释说明：
……
```

### 4.4 坑：无题干

```
：
A. …
B. …
正确答案：ABCD
```

→ 跳过。

### 4.5 坑：解释泄漏成下一题题干

上一题 `正确答案：ABCDEF` + 长篇「防止 NPE…」  
下一题无题干只有 equals 选项  
→ 解析器若未剥离，会得到「ABCDEF解释说明：防止 NPE…」+ equals 选项（**答案必错配**）。

### 4.6 HTML 错题页（结构化 DOM）

```html
<div class="questions">
  <div class="questions-title">单选题</div>
  <div class="questions-content">
    <div class="question-content" data-id="...">
      <div class="exam-question">
        <span class="question-index">1.</span>
        <p>&lt;div&gt;$var&lt;/div&gt;</p><p>以上这段代码会导致什么安全问题？</p>(2.0分)
      </div>
      <div class="answers">
        <div class="select single-select a.">
          <span class="words">A. XSS跨站脚本攻击 </span>
        </div>
        <!-- B C D ... -->
      </div>
      <div class="analysis">
        <div class="analysis-row">
          <div class="analysis-title">考生答案：</div>
          <div class="analysis-content question-com-answer error">D</div>  <!-- 忽略 -->
        </div>
        <div class="analysis-row">
          <div class="analysis-title">正确答案：</div>
          <div class="analysis-content question-ans-right">A</div>          <!-- 用这个 -->
        </div>
        <div class="analysis-row">
          <div class="analysis-title">解释说明：</div>
          <div class="analysis-content question-analysis"></div>
        </div>
      </div>
    </div>
  </div>
</div>
```

选项 CSS 类：`single-select`（单选）、`multi-select`（多选）、`judge`（判断）。

---

## 5. 解析器伪代码

### 5.1 Word / 纯文本

```
text = load_paragraphs(docx)   # 保留段边界
parts = split(text, /正确答案[：:]/)

for each part after first:
  answer, explanation, next_body = parse_tail(part)
  body = strip_prev_residue(carry) + region_before_answer
  body = soft_join(body)       # 保守
  title, options = extract(body)
  if stemless or bad_title(title): skip
  type, correct = classify(answer, options)
  if choice and correct ⊄ option_labels: skip
  emit { type, title, options, correct, explanation }

group by option_fingerprint (or tf title)
pick majority(correct), prefer richer explanation
write question-bank-import.json
```

### 5.2 HTML（BeautifulSoup）

```
soup = BeautifulSoup(html)
for section in soup.select("div.questions"):
  section_hint = section.select_one("div.questions-title").text
  for qc in section.select("div.question-content"):
    title = extract_title(qc.select_one("div.exam-question"))  # strip index + score
    options = parse_words(qc.select("div.answers span.words"))
    correct = parse_answer(qc.select_one(".question-ans-right").text)  # authoritative
    explanation = qc.select_one(".question-analysis").text
    if correct ⊄ option_labels: skip
    type = infer(section_hint, options, correct)
    if type == truefalse:
      fp = ("truefalse", norm(title).lower())
    else:
      fp = option_fingerprint(options)
    emit { type, title, options, correct, explanation, fp }

group by fp → majority(correct), prefer richer explanation
audit: re-read each .question-ans-right vs export (must be 0 failures)
write question-bank-html-import.json
```

---

## 6. 标签与来源约定

| 字段 | 建议 |
|------|------|
| `source` | 原文件名，如 `五百零二道道考试题目.docx` 或 `JAVA编码规范考试-模拟-2026-01.html` |
| `tags` | `["Java开发手册","考试题"]`；HTML 错题可加 `"HTML错题本"` |
| `difficulty` | 默认 `0`（未标记） |
| `id` | UUID；替换导入可重新生成 |

---

## 7. 导入 JSON Schema（与应用一致）

```json
{
  "version": "1.0.0",
  "exportedAt": "2026-07-16T12:00:00",
  "total": 2,
  "questions": [
    {
      "id": "uuid",
      "type": "single",
      "title": "题干()",
      "options": [
        { "label": "A", "text": "…" },
        { "label": "B", "text": "…" }
      ],
      "correctAnswer": ["A"],
      "explanation": "",
      "tags": ["考试题"],
      "source": "某试卷.docx",
      "difficulty": 0,
      "sortOrder": 0,
      "createdAt": 0,
      "updatedAt": 0
    },
    {
      "id": "uuid2",
      "type": "truefalse",
      "title": "陈述句()",
      "options": [
        { "label": "true", "text": "正确" },
        { "label": "false", "text": "错误" }
      ],
      "correctAnswer": ["false"],
      "explanation": "",
      "tags": [],
      "source": "某试卷.docx",
      "difficulty": 0,
      "sortOrder": 1,
      "createdAt": 0,
      "updatedAt": 0
    }
  ]
}
```

字段均为 **camelCase**。`type`: `single` | `multi` | `truefalse`。

---

## 8. 新文档快速上手（复制即用）

**Word / docx**

> 按 `docs/design/2026-07-16-question-bank-doc-ingest-playbook.md` 处理：  
> 1）用 python-docx 抽段落；2）按「正确答案」切题；3）选项指纹去重 + 多数票；  
> 4）丢弃无题干与解释泄漏题；5）出 JSON；6）提醒我用应用内「替换导入」。  
> 源文件：`<路径>`。

**HTML 错题页**

> 按 playbook §3.1（HTML）/ §3.3（DOM 直取）/ §5.2 处理 HTML 考试错题页：  
> 1）BeautifulSoup 按 `div.question-content` 逐题解析；  
> 2）正确答案只取 `.question-ans-right`（忽略 `.question-com-answer`）；  
> 3）判断题去重键用归一化题干，禁止按选项指纹；  
> 4）跑 `html_alignment_failures` 审计必须为 0；5）出 JSON；6）应用内导入。  
> 源目录：`<考试记录/*.html>`。

---

## 9. 已知限制

- 原文无题干的题无法自动补全，只能跳过或人工补录  
- 多套试卷「同题干不同选项/答案」必须靠选项指纹区分，不能合并成一题  
- 扫描件 OCR 错误会导致答案字母识别错，导入前务必抽查  
- HTML 错题页**仅含答错题目**，不能替代 Word 全库导入；可与 docx 全库 **合并导入**  
- HTML 须「完整网页另存为」；若只有裸 HTML 无 `_files/`，题干样式可能丢但 DOM 通常仍可解析  
- 应用内「AI 粘贴解析」目前是规则 demo，大批量仍建议本 playbook 离线脚本  

---

## 10. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-16 | 首版：基于「五百零二道」docx 实操沉淀 |
| 2026-07-16 | 增补 HTML 错题页流程（`parse_exam_html.py`、DOM 选择器、判断题去重键） |
