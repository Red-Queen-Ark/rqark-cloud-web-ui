# AGENTS.md

## General Rules
- 你寫代碼不要寫注解，AI Agent 寫注解太丑，如果發現有注解都是主人寫的。
- frontend 必須用 `bun`，不可用 npm/pnpm/yarn
- 不可以運行 git commit/push
- 最憎硬編碼
- Frontend 用 `import.meta.env.VITE_*`（Vite convention）+ 合理 fallback
- 多寫 playwright 測試，檢查介面
- 每次改動都要行 `bun run lint:fix` + `bun run format` + `bun run test`。淨低嘅 lint error 如果係 pre-existing（Alert name、v-html、set:html），可以 accept
- **Styling:** DaisyUI first, Tailwind second（reference: https://daisyui.com/llms.txt）

## Commands

```bash
bun run lint:fix
bun run format
bun run test
```

- `lint:fix`: eslint fix
- `format`: prettier format
- `test`: vitest
