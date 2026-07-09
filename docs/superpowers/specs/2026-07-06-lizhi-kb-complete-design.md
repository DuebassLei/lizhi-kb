# 狸知知识库 完整产品设计与定位包装方案

**文档版本**：v2.1.0  
**更新日期**：2026-07-06  
**品牌短名**：狸知 · **Lizhi Knowledge**  
**产品全称**：狸知知识库 — 个人加密知识库  
**基于文档**：`docs/design/初版设计.md` v1.5.0  
**文档性质**：产品战略 + 品牌包装 + PRD 精炼 + TDD 补充  

---

## 0. 设计决策摘要

### 0.1 三种定位路线对比

| 维度 | A. 安全笔记工具 | B. 个人加密知识库 ✅ | C. 隐私写作保险箱 |
|------|----------------|------------------------|------------------|
| **一句话** | 带锁的 Markdown 编辑器 | 本地优先、端到端加密的深度思考环境 | 只写不联、绝对私密的写作舱 |
| **对标** | Standard Notes / Joplin | Obsidian + 1Password 安全层 | iA Writer + VeraCrypt |
| **核心用户** | 隐私意识普通用户 | 研究者、顾问、创作者、安全从业者 | 作家、日记用户 |
| **知识网络** | 弱（文件夹为主） | 强（双链 + 图谱） | 无 |
| **差异化** | 加密 | 加密 × 知识网络 × 防窥 | 极致写作体验 |
| **商业化** | 订阅制功能解锁 | 买断 + 专业版订阅 | 一次性买断 |
| **开发风险** | 低 | 中高 | 低 |

**推荐路线：B — 个人加密知识库**

理由：与 v1.5 功能集一致；Obsidian 已验证「知识网络」需求；**狸知知识库** 占据 Obsidian 知识深度 + Standard Notes 安全深度的交叉空白，并以猫系品牌建立识别。

### 0.2 版本策略（MoSCoW）

| 优先级 | 版本 | 代号 | 核心交付 |
|--------|------|------|----------|
| **Must** | v1.0 | **Vault** | 加密库、主密码解锁、Markdown 编辑器、目录树、热力图、MD/PDF 导出 |
| **Must** | v1.5 | **Network** | 双链、反向链接、局部图谱、App Lock 完善、界面/导出水印 |
| **Could** | v2.0 | **Shadow** | 诱饵库、盲水印、防截屏 API、红蓝对抗审计包 |
| **Won't (v1.x)** | — | — | 云同步、多人协作、插件市场、移动端 |

---

## 1. 品牌与定位包装

### 1.1 品牌核心

| 要素 | 内容 |
|------|------|
| **品牌短名** | **狸知** |
| **产品全称** | **狸知知识库** |
| **英文名** | **Lizhi Knowledge**（副标 *Encrypted Knowledge Base*） |
| **品类定义** | 个人加密知识库 / Encrypted Personal Knowledge Base |
| **Slogan（主）** | **你的加密知识库，猫一样安静。** |
| **Slogan（联结）** | **私密如猫，知识成网。** / *Private as a cat. Knowledge as a web.* |
| **Slogan（英文）** | *Think in your nest. Link your knowledge.* |
| **吉祥物** | **守夜**（几何黑猫，见品牌 spec） |

### 1.2 价值主张金字塔

```
                    ┌─────────────────────┐
                    │   绝对数据主权       │  ← 情感层：我的思想只属于我
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │  本地加密 + 零网络 + 防窥水印    │  ← 功能层：安全护城河
              └────────────────┬────────────────┘
                               │
        ┌──────────────────────┴──────────────────────┐
        │  双链 · 图谱 · 专注写作 · 安全导出     │  ← 体验层：知识库能力
        └─────────────────────────────────────────────┘
```

### 1.3 目标用户画像

#### Persona 1：林研究员（Primary）
- **角色**：高校/智库研究员，处理敏感访谈笔记与未发表观点
- **痛点**：Obsidian 功能强但数据明文落盘；云端笔记不敢写真话
- **场景**：田野调查笔记、论文素材、引用关系梳理
- **付费意愿**：高（$49–99 买断）

#### Persona 2：陈独立顾问（Primary）
- **角色**：战略/法律/财务顾问，客户资料极度敏感
- **痛点**：开会时旁人瞟屏；导出 PDF 被转发无法溯源
- **场景**：客户会议纪要、方案文档、合规文档导出
- **付费意愿**：极高（企业可谈批量授权）

#### Persona 3：赵深度写作者（Secondary）
- **角色**：专栏作者、独立开发者，长期知识沉淀
- **痛点**：需要双链与写作流，但不想被云厂商绑定
- **场景**：每日写作、热力图自我追踪、主题图谱
- **付费意愿**：中（$29–49 买断）

#### Persona 4：周安全从业者（Secondary）
- **角色**：安全研究员、渗透测试工程师
- **痛点**：需要可审计、零外联、可验证的安全笔记工具
- **场景**：漏洞笔记、方法论沉淀、红队报告草稿
- **付费意愿**：高（重视可验证安全声明）

### 1.4 竞争定位矩阵

```
                    知识网络能力
                         ▲
                         │
           Obsidian ●    │    ● 狸知知识库
                         │
         Notion ●        │
                         │
    ─────────────────────┼─────────────────────► 安全/隐私能力
                         │
      Apple Notes ●      │    ● Standard Notes
                         │
           Bear ●        │    ● Joplin
                         │
```

**差异化一句话**：狸知知识库是唯一在「知识网络化」与「可验证本地加密」两个维度同时拉满的个人知识库，并以猫系品牌传递「安静、警觉、私密」。

### 1.5 品牌调性

| 维度 | 应做 | 不应做 |
|------|------|--------|
| **视觉** | 深色为主、克制留白、暖爪色 `#d4a574` 点缀、猫耳/巢形 Logo | 霓虹黑客风、低幼卡通猫、过度「军事化」 |
| **文案** | 冷静、可验证、具体（Argon2id、零网络） | 恐吓营销、「军方级」「绝对无法破解」 |
| **信任** | 开源加密核心、安全白皮书、第三方审计计划 | 闭源吹噓、无法证伪的安全声明 |

### 1.6 视觉识别建议（VI）

| 元素 | 规范 |
|------|------|
| **Logo 概念** | 巢中眼：猫耳 + 节点眼 + 盾形巢 + 三节点连线 |
| **主色** | `#1A1D23` 墨巢 + `#5b9fd4` 联结蓝 + `#d4a574` 暖爪 |

---

## 2. 产品信息架构（IA）

### 2.1 应用结构

```
狸知知识库
├── 🔐 解锁层（App Lock Screen）
│   ├── 主密码输入
│   ├── 生物识别快捷入口
│   └── 防暴破倒计时提示
│
├── 📚 工作区（Main Workspace）
│   ├── 侧边栏
│   │   ├── 快速搜索（Cmd+K）
│   │   ├── 目录树（收件箱 / 知识库）
│   │   ├── 标签过滤
│   │   └── 收藏 / 最近
│   ├── 编辑区
│   │   ├── Markdown 双模式编辑器
│   │   ├── 反向链接面板（右栏可折叠）
│   │   └── 面包屑 + 双链悬浮预览
│   ├── 视图切换
│   │   ├── 编辑视图
│   │   └── 局部图谱视图
│   └── 状态栏
│       ├── 字数 / 保存状态
│       ├── 加密状态指示器 🔒
│       └── 锁定倒计时（可选显示）
│
├── 📊 洞察（Insights Dashboard）
│   ├── 写作热力图
│   ├── 链接统计（节点数、孤岛文档）
│   └── 审计摘要（导出次数、锁定次数）
│
├── ⚙️ 设置
│   ├── 安全与隐私（App Lock / 水印 / 防截屏）
│   ├── 编辑器（主题 / 打字机 / 专注模式）
│   ├── 导出默认值
│   └── 关于（版本 / 安全白皮书链接）
│
└── 🛡️ 全局层
    ├── 防窥水印 Canvas  overlay
    └── 锁定模糊遮罩
```

### 2.2 首次使用流程（FTUE）

```
安装 → 欢迎页（3 屏价值主张）→ 创建主密码 → 生成恢复密钥 PDF
     → 选择主题 → 创建第一篇文档 / 导入 Markdown → 完成引导
```

**关键设计原则**：
- 恢复密钥必须在 FTUE 强制展示，用户确认已保存才能继续
- 不默认开启诱饵库（v2.0 功能），避免复杂度吓退新用户
- 水印默认关闭，在「安全与隐私」设置中推荐开启（带场景说明）

### 2.3 核心交互原则

1. **安全不打断思考**：生物识别日常解锁 ≤ 1 次点击；锁定模糊而非关闭窗口
2. **链接即呼吸**：`[[` 自动补全延迟 < 50ms，悬浮预览不打断编辑焦点
3. **导出即承诺**：每次导出显示「已清洗元数据 ✓」确认，敏感词过滤结果可预览
4. **可验证隐私**：设置页提供「网络活动：0 请求」实时指示（基于 Rust 层拦截计数）

---

## 3. 功能规格（按版本）

### 3.1 v1.0 Vault — 安全写作基座

| 模块 | 功能 | 验收标准 |
|------|------|----------|
| Vault 创建 | Argon2id + AES-256-GCM，恢复密钥 | 错误密码 100% 无法解密 |
| 编辑器 | TipTap MD 双模式、打字机、专注模式 | 10 万字文档滚动 ≥ 55fps |
| 目录 | 收件箱 / 知识库 树形结构、拖拽排序 | 1000 文档树展开 < 200ms |
| 热力图 | GitHub 风格，按日编辑次数 | 与 audit_logs 一致 |
| 导出 | MD + PDF，元数据清洗 | PDF 无 Author/Creator 元数据 |
| 主题 | 浅色 / 深色 / 护眼 | 系统跟随 |

### 3.2 v1.5 Network — 知识网络 + 安全防御

| 模块 | 功能 | 验收标准 |
|------|------|----------|
| 双链 | `[[` 搜索、Cmd+Click 跳转、悬浮预览 | 拼音匹配、< 50ms |
| 反向链接 | Linked / Unlinked Mentions | 保存后 500ms 内更新 |
| 局部图谱 | 2-depth、SVG 力导向布局 | 1000 节点 ≥ 55fps |
| App Lock | 主密码 + 生物识别 + 自动锁定 | 休眠锁定 < 100ms |
| 界面水印 | Canvas overlay、可配置样式 | 帧率下降 < 5% |
| 导出水印 | PDF/长图强制或询问 | 水印不可轻易移除 |
| 防暴破 | 阶梯延迟 | 第 3/5/10 次错规则生效 |

### 3.3 v2.0 Shadow — 高级安全（实验性）

| 模块 | 功能 | 备注 |
|------|------|------|
| 诱饵库 | 双 vault 隔离 | 需独立安全审计 |
| 盲水印 | DCT 频域嵌入 + 提取工具 | 标注「最佳努力」，不承诺抗裁剪 |
| 防截屏 | OS 级 API | macOS 兼容性因版本而异 |
| 安全审计包 | 开源核心 + 白皮书 + 审计报告 | GTM 信任资产 |

---

## 4. 技术架构（精炼版）

### 4.1 系统分层

```
┌─────────────────────────────────────────────────────────┐
│  Presentation (Vue 3 + Pinia + Tailwind)                │
│  ├── Editor (TipTap Vue)  ├── Graph (PixiJS)  ├── Canvas│
│  └── Watermark Canvas Overlay                           │
├─────────────────────────────────────────────────────────┤
│  Tauri IPC Bridge (Commands + Events)                   │
├─────────────────────────────────────────────────────────┤
│  Domain Services (Rust)                                 │
│  ├── VaultService      (unlock/lock/zero memory)        │
│  ├── CryptoService     (Argon2id, AES-GCM)              │
│  ├── DocumentService   (CRUD, encrypt/decrypt files)    │
│  ├── LinkIndexService  (incremental [[wiki]] parsing)   │
│  ├── SearchService     (FTS5 + pinyin)                  │
│  ├── ExportService     (PDF/MD/HTML, metadata strip)    │
│  ├── WatermarkService  (screen + export + blind)        │
│  ├── AuditService      (logs, no content)               │
│  └── NetworkGuard      (block all outbound by default)  │
├─────────────────────────────────────────────────────────┤
│  Storage                                                │
│  ├── SQLCipher (vault.db)                               │
│  └── Encrypted files (workspace/*.md.enc)               │
└─────────────────────────────────────────────────────────┘
```

### 4.2 关键架构决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 双链索引来源 | **写入时增量更新 `links` 表** | 避免启动全量扫盘；启动仅校验 checksum |
| 正文存储 | **加密文件 + DB 元数据** | 便于 Git 式备份整个 workspace 目录 |
| 生物识别 | **OS 验证通过后解密 `keys.enc` 中缓存的 wrapped DEK** | DEK 不存 OS Keychain 明文 |
| 水印防篡改 | **Rust 心跳 + 前端校验 + 锁定** | 前端 alone 不够，但足够威慑普通用户 |
| 网络 | **Rust 层默认 deny all sockets** | 比前端不请求更可靠 |

### 4.3 Tauri Command 清单（核心）

```rust
// Vault
create_vault(password, hint) -> VaultMeta
unlock_vault(password | biometric) -> SessionToken
lock_vault() -> ()
get_lock_status() -> LockState

// Documents
list_documents(filter) -> Vec<DocumentMeta>
read_document(id) -> DecryptedContent  // 仅 unlocked 状态
save_document(id, content) -> SaveResult
delete_document(id) -> ()

// Links & Search
get_backlinks(id) -> Vec<LinkMention>
get_local_graph(id, depth) -> GraphPayload
search(query, options) -> Vec<SearchHit>

// Export
export_document(id, format, options) -> ExportPath
strip_metadata(file) -> ()

// Security
get_audit_logs(filter) -> Vec<AuditEntry>
get_network_stats() -> { blocked: u64 }
verify_watermark_integrity() -> bool
```

### 4.4 数据库补充表

```sql
-- 版本与迁移
CREATE TABLE schema_version (version INTEGER PRIMARY KEY);

-- 标签（规范化，避免 JSON 查询性能问题）
CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT
);
CREATE TABLE document_tags (
    document_id TEXT REFERENCES documents(id),
    tag_id TEXT REFERENCES tags(id),
    PRIMARY KEY (document_id, tag_id)
);

-- 编辑活动（热力图数据源）
CREATE TABLE edit_activity (
    date TEXT NOT NULL,          -- YYYY-MM-DD
    edit_count INTEGER DEFAULT 0,
    PRIMARY KEY (date)
);

-- 会话与锁定
CREATE TABLE lock_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT,             -- 'LOCK', 'UNLOCK', 'FAIL'
    timestamp INTEGER,
    method TEXT                  -- 'password', 'biometric', 'auto'
);
```

### 4.5 加密参数（固定写入白皮书）

| 参数 | 值 |
|------|-----|
| KDF | Argon2id |
| KDF 内存 | 64 MB |
| KDF 迭代 | 3 |
| KDF 并行 | 4 |
| 对称加密 | AES-256-GCM |
| 盐长度 | 32 bytes |
| DEK 长度 | 32 bytes |

### 4.6 前端技术栈（Vue 3 — 自研路线）✅

**决策日期**：2026-07-06 · **主导**：单人全栈 · **理由**：开发者 Vue 熟练度更高，Tauri/Pixi/Rust 层与框架无关

| 层级 | 选型 | 版本建议 | 说明 |
|------|------|----------|------|
| 桌面壳 | **Tauri** | 2.x | Rust 后端 + WebView |
| 框架 | **Vue 3** | 3.5+ | Composition API + `<script setup lang="ts">` |
| 构建 | **Vite** | 6.x | Tauri 官方模板内置 |
| 路由 | **Vue Router** | 4.x | 解锁层 / 工作区 / 设置 |
| 状态 | **Pinia** | 2.x | vault、文档树、编辑器、UI 锁态 |
| 样式 | **Tailwind CSS** | 4.x | 与设计原型 token 对齐 |
| 编辑器 | **TipTap** | 2.x | `@tiptap/vue-3` + 自定义 WikiLink 扩展 |
| 图谱 | **SVG + composable** | — | `useGraphCanvas` 构建局部图谱 |
| Tauri 绑定 | `@tauri-apps/api` | 2.x | invoke / listen |
| 类型 | **TypeScript** | 5.x | 前后端 DTO 共享约定 |

**刻意不选**：Nuxt（无需 SSR）、Options API（新代码统一 Composition API）、Vuex（用 Pinia）

### 4.7 前端目录结构

```
src/
├── App.vue
├── main.ts
├── router/
│   └── index.ts              # /unlock /workspace /insights /settings
├── stores/
│   ├── vault.ts              # 锁定态、解锁、DEK 会话（仅 UI 态，密钥在 Rust）
│   ├── documents.ts          # 目录树、当前文档、保存队列
│   ├── editor.ts             # 模式 wysiwyg|source、打字机、未保存
│   ├── links.ts              # 双链索引、反向链接缓存
│   └── ui.ts                 # 水印、面板折叠、主题
├── composables/
│   ├── useTauriCommand.ts    # 统一 invoke + 错误映射
│   ├── useAutoSave.ts        # debounce 保存
│   ├── useWikiSuggest.ts     # [[ 补全
│   ├── useGraphCanvas.ts     # 局部图谱数据构建
│   └── useWatermark.ts       # Canvas 水印层
├── components/
│   ├── vault/                # UnlockScreen, LockOverlay
│   ├── workspace/            # Sidebar, EditorToolbar, BacklinksPanel
│   ├── editor/               # TipTapEditor, SourceEditor, FormatBar
│   ├── graph/                # LocalGraphView
│   ├── insights/             # Dashboard tabs
│   └── common/               # CommandPalette, Modal, Toggle
├── views/
│   ├── WelcomeView.vue       # FTUE
│   ├── UnlockView.vue
│   ├── WorkspaceView.vue     # 组合层，不放业务逻辑
│   ├── InsightsView.vue
│   └── SettingsView.vue
├── extensions/               # TipTap 插件
│   └── WikiLink.ts
└── styles/
    └── tokens.css            # 与 prototype Vault Noir 对齐
```

### 4.8 Pinia Store 职责边界

| Store | 状态 | 绝不存放 |
|-------|------|----------|
| `vault` | `isLocked`, `lockCountdown`, `biometricEnabled` | 主密码、DEK 明文 |
| `documents` | 树形列表、activeId、meta | 解密后全文（离开编辑器即清） |
| `editor` | mode、isDirty、wordCount | — |
| `links` | backlinkMap、orphanIds | — |
| `ui` | theme、watermarkOn、panelState | — |

解密后的文档正文：**仅在 Editor 组件内存中**持有，锁定事件触发时 `editor` store 调用 `clear()`。

---

## 5. 安全叙事包装（对外沟通）

### 5.1 可公开声称（Honest Security Claims）

✅ **可以说**：
- 「所有笔记内容在落盘时使用 AES-256-GCM 加密」
- 「应用默认不发起任何网络请求，可在 Wireshark 下验证」
- 「主密码通过 Argon2id 派生密钥，抗 GPU 暴力破解」
- 「锁定后内存中的密钥与明文会被主动清零」
- 「导出文件自动剥离 EXIF 与 PDF 元数据」

❌ **不应说**：
- 「绝对无法被破解」
- 「NSA 也无法读取」
- 「盲水印 100% 溯源任何泄露」
- 「所有截图工具均无法截取」（macOS 限制）

### 5.2 安全白皮书目录（GTM 资产）

1. 威胁模型（STRIDE 简版）
2. 加密方案与参数
3. 密钥生命周期（创建 → 解锁 → 锁定 → 销毁）
4. 网络隔离实现
5. 已知限制与缓解措施
6. 第三方审计计划与时间线
7. 漏洞披露政策（security@lizhi.app）

### 5.3 信任徽章（官网 / 关于页）

- 🔒 Local-Only · Zero Cloud
- 🛡️ AES-256-GCM + Argon2id
- 📡 Network Requests: 0 by Default
- 📄 Open Crypto Core (GitHub link, v2.0)

---

## 6. 商业化与 GTM 包装

### 6.1 定价策略（建议）

| 版本 | 价格 | 包含 |
|------|------|------|
| **流浪 Tramp**（Free） | $0 | 1 Vault、500 文档上限、基础编辑器、MD 导出 |
| **家猫 Housecat**（Pro） | $49 买断 | 无限文档、双链/图谱、App Lock、水印、PDF 导出 |
| **狸猫 Li Cat**（Pro+） | $79 买断 | Pro + 盲水印 + 优先支持 |
| **猫群 Colony**（Team） | $39/席位/年 | 批量部署、统一审计日志导出、IT 部署指南 |

> 不做订阅制功能阉割（与「数据主权」叙事一致），订阅仅用于 Team 支持与更新。

### 6.2 发布渠道

| 渠道 | 策略 |
|------|------|
| 官网 | 主阵地，直接下载 + 安全白皮书 |
| GitHub Releases | 开源加密模块 + 签名安装包 |
| Product Hunt | 「Obsidian meets Standard Notes」叙事 |
| Hacker News | Show HN，强调零网络可验证 |
| 中文社区 | V2EX / 少数派 / 即刻 — 「狸知知识库：本地 Obsidian + 真加密 + 守夜猫」 |
| 安全社区 | 赠送 Pro 给安全 KOL 评测 |

### 6.3 官网信息架构

```
Home
├── Hero（Slogan + 下载 CTA + 零网络徽章）
├── Features（3 列：加密 / 联结 / 防窥）
├── Comparison（vs Obsidian / Standard Notes / Notion）
├── Security（白皮书摘要 + 审计状态）
├── Pricing
├── Changelog
└── Download（Win / macOS / Linux 签名包）
```

### 6.4 Launch 文案示例

**Product Hunt Tagline**  
> Lizhi Knowledge — encrypted knowledge base with wiki links, local graph, zero network.

**HN Show 标题**  
> Show HN: Lizhi Knowledge – Local-first encrypted knowledge base with wiki links

**少数派一句话**  
> 狸知知识库：把 Obsidian 的知识网络，装进本地加密的猫窝里。

---

## 7. 项目排期（修订版）

| 阶段 | 周期 | 交付 | 人力假设 |
|------|------|------|----------|
| **M0: Spike** | 第 1 周 | Tauri + SQLCipher POC、单文件加解密 | 1 全栈 |
| **M1: Vault** | 第 2–5 周 | v1.0 完整功能 | 1 Rust + 1 前端 |
| **M2: Network** | 第 6–10 周 | 双链、图谱、App Lock、水印 | 同上 |
| **M3: Launch** | 第 11–12 周 | 官网、白皮书、PH 发布 | +0.5 设计/运营 |
| **M4: Shadow** | 第 13–18 周 | v2.0 高级安全（可选） | 视反馈 |

**总计**：v1.5 可发布 ≈ **12 周**（原 14 周 + 2 周缓冲）

---

## 8. 成功指标（KPI）

| 阶段 | 指标 | 目标（发布后 90 天） |
|------|------|----------------------|
| 获客 | 官网下载量 | 10,000+ |
| 转化 | Free → Pro | 8–12% |
| 留存 | D30 活跃 | 40%+ |
| 口碑 | Product Hunt 排名 | Top 5 of the day |
| 信任 | 安全白皮书下载 | 2,000+ |
| 质量 | 崩溃率 | < 0.1% sessions |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 诱饵库实现泄露真实库存在 | 高 | 推迟至 v2.0 + 独立审计 |
| macOS 防截屏不一致 | 中 | 文档标注平台差异，主推 Windows |
| 14 周 scope 膨胀 | 高 | 严格 MoSCoW，Shadow 功能不进 v1.5 |
| 「零网络」被更新检查打破 | 高 | 更新仅手动下载，应用内无 auto-update |
| 与 Obsidian 正面竞争 | 中 | 定位「安全优先」，不做插件生态 |

---

## 10. 附录

### 10.1 命名与域名（定稿）

| 字段 | 内容 |
|------|------|
| 品牌短名 | **狸知** |
| 产品全称 | **狸知知识库** |
| 英文 | **Lizhi Knowledge** |
| 数据目录 | `~/.lizhi-kb/` |
| Repo / 包名 | `lizhi-kb` |
| 安全联系 | security@lizhi.app |

### 10.2 与初版设计.md 的主要变更

1. 明确 **MoSCoW 版本切分**，诱饵库/盲水印/防截屏移入 v2.0
2. 补充 **品牌、GTM、定价、官网 IA**
3. 双链索引改为 **增量更新**
4. 排期 **12 周** 可发布 v1.5
5. **前端栈 Vue 3 + Pinia + TipTap Vue**
6. **品牌定为狸知知识库 / Lizhi Knowledge**（替代 SecureNote，2026-07-06）

---

**下一步**：执行 M0 Vue 脚手架（`lizhi-kb`）→ 通过后进入 M1 Vault 实现。
