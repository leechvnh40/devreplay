# 参与 DevReplay 开发

感谢你关注 DevReplay。Alpha 阶段优先保证真实面试复盘闭环可靠，而不是扩展功能数量。

## 开发环境

- Windows 10 22H2 或 Windows 11 x64
- Node.js 22.12 或更高版本
- pnpm 11

```powershell
pnpm install
pnpm dev
```

提交变更前运行：

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

`better-sqlite3` 同时服务于 Node 测试和 Electron 主进程。`pnpm test` 会先执行
`rebuild:node`，`pnpm dev` 会先执行 `rebuild:electron`；在两种运行方式之间切换时应通过
这些入口启动，避免复用错误 ABI 的原生模块。

## OpenSpec 工作流

影响用户可见行为或跨越多个模块的变更，应先创建或更新 OpenSpec change。实现时按 `tasks.md` 逐项工作，只有在对应行为和验证全部完成后才能勾选任务。内部重构和微小样式调整不需要单独的 change。

## 安全与隐私

- 不要提交 API Key、真实简历、真实面试记录、数据库或模型原始日志。
- 测试和 Demo 只能使用虚构、合成且不指向真实个人或公司的材料。
- Renderer 不得直接获得 Node.js、文件系统、数据库、网络代理或任意 IPC channel。
- 新增外部网络请求必须在规格中说明，并提供用户可见的触发动作。

## Pull Request

- 保持改动聚焦，并说明关联的 OpenSpec change 与任务编号。
- 描述用户可见变化、验证命令和已知限制。
- 新行为需要测试；修复问题应尽可能先添加失败用例。
- 不要在同一个 Pull Request 中夹带无关格式化或重构。
