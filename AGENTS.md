# AGENTS.md

## Contributing
> Issue、commit、PR、release、版本號一律跟 `CONTRIBUTING.md`。

## General Rules

- 你寫代碼不要寫注解，AI Agent 寫注解太丑，如果發現有注解都是主人寫的。
- 禁止 squash merge 同 `git revert`；PR 一律用 merge commit，改錯用新 commit
- frontend 必須用 `bun`，不可用 npm/pnpm/yarn
- 最憎硬編碼
- Frontend 用 `import.meta.env.VITE_*`（Vite convention）+ 合理 fallback
- 多寫 playwright 測試，檢查介面
- 改到邏輯、component 或 type：`bun run lint:fix` + `bun run format` + `bun run test --run` + `bun run build`。淨低嘅 lint error 如果係 pre-existing（Alert name、v-html、set:html），可以 accept。純 style、純文件或 metadata 改動唔需要 `test` 同 `build`，行 `bun run format` 就夠
- **DaisyUI FIRST** — Use semantic classes (`btn btn-primary`) before raw Tailwind
- **Styling:** DaisyUI first, Tailwind second（reference: https://daisyui.com/llms.txt）

## Skills

- 修 bug 前先讀 `skills/bug-fix/SKILL.md`，照佢七步行，唔好未重現就改。
- 改到行為之後，用 `skills/verify-web-ui/SKILL.md` 嘅方式喺真 browser 驗一次，再貼證據落 PR 嘅 `## Verify`。
- 驗證過新功能，就喺 `verify-web-ui` 嘅 Features 清單加一張卡，免得下一個 agent 重新摸一次。

## Commands

```bash
bun run lint:fix
bun run format
bun run test
```

- `lint:fix`: eslint fix
- `format`: prettier format
- `test`: vitest
