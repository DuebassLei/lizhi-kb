# Settings Visual Align CC · Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align `/settings` visual language with CC workbench settings (titles, nav active, cards, chips, ambient bg) without changing IA or business logic.

**Spec:** `docs/superpowers/specs/2026-07-15-settings-visual-align-cc-design.md`

**Tech stack:** Vue 3 + Tailwind + `src/styles/*.css`

---

### Task 1: Shared CSS

**Files:**
- Create: `src/styles/settings-ui.css`
- Modify: `src/main.ts` (import)

Define: `.settings-page__body`, `.settings-panel__title`, `.settings-panel__desc`, `.settings-nav__item`, `.settings-nav__item--active`, `.settings-list-card`, `.settings-chip`, `.settings-chip--active`, `.settings-select-row--active`

**Verify:** styles load; no TS errors.

### Task 2: Anchor nav + SettingsView shell

**Files:**
- `src/components/settings/SettingsAnchorNav.vue`
- `src/views/SettingsView.vue`

Replace UPPERCASE h2; body ambient; theme tiles use chip active; list cards where applicable.

### Task 3: Settings panels

**Files:**
- `QuickNavSettingsPanel.vue`, `DocumentTemplatesSettingsPanel.vue`, `BackupRestorePanel.vue`, `McpSettingsPanel.vue`, `AiSettingsPanel.vue`, `CcWorkbenchSettingsPanel.vue`

Unify titles/desc; remove `bg-paw/10` selected rows.

### Task 4: Verify

Run `pnpm verify:fe`. Grep settings for leftover `uppercase tracking-wide` / `bg-paw/10`.
