## Context

仓库当前只有 OpenSpec 规划文件，没有既有应用代码或兼容负担。产品范围、行为边界和四周 Alpha 验收标准见 `proposal.md` 与七个能力规格。

这是一个单人维护、Windows-first、local-first 的 Electron 项目。业务数据留在本机但不加密；需要智能能力时，由用户明确触发 DeepSeek 云端调用。项目既要供作者真实长期使用，也要通过合成 Demo 向招聘方展示 Agent 可靠性、桌面安全和可测试领域建模。

## Goals / Non-Goals

**Goals:**

- 用一个可纵向交付的 monorepo 隔离领域规则、Agent 工作流、桌面权限和代码沙箱。
- 让核心状态变化由确定性领域代码控制，模型只生成候选结构化内容。
- 使复盘、证据、训练和画像的每一步可追踪、可恢复、可自动测试。
- 在 Windows 10 22H2 / Windows 11 x64 上产出可安装的 Alpha。
- 将四周工作拆成每周都有端到端可见成果的任务，而不是先完成全部基础设施。

**Non-Goals:**

- 不为假想的第二客户端设计远程 API、服务端或微服务。
- 不为未来插件提前冻结公共 SDK；只保留仓库内部 TypeScript 端口。
- 不在领域包中复制数据库行模型或 UI ViewModel。
- 不承诺恶意软件已取得当前 Windows 用户权限后的数据保密性。
- 不在 Alpha 阶段建立复杂 CQRS / Event Sourcing 框架、消息总线或依赖注入容器。

## Decisions

### 1. 使用轻量 pnpm monorepo

目录边界：

```text
apps/desktop/       Electron main、preload、React renderer 与桌面 E2E
packages/domain/    领域实体、状态机、证据投影、优先级和完成门槛
packages/agent/     DeepSeek 端口、提示词版本、结构化输出和 Agent 工作流
packages/sandbox/   TypeScript 转换、QuickJS Worker 与测试协议
packages/shared/    IPC schema、错误契约及跨边界 DTO
```

`apps/desktop` 使用 `electron-vite` 的 React + TypeScript 约定组织 main、preload 和 renderer，并由 `electron-builder` 单独负责安装包。`domain` 不依赖 Electron、数据库或网络；`agent` 依赖领域端口但不直接访问 UI；Electron main 负责组合适配器。选择 pnpm workspace 而非单包，是为了让安全边界和纯领域测试真实存在；不引入 Nx/Turborepo，避免四周 Alpha 的工具负担。

`electron-vite` 只承担开发服务器、热更新和三个 Electron 入口的构建，不拥有业务架构。选择它而非手工拼接多套 Vite 配置，可缩短 Alpha 搭建时间；选择 `electron-builder` 而非 Electron Forge，是为了保持已确定的 NSIS 发布路径。模板生成后删除示例 IPC 和宽泛 preload API，只保留本项目的白名单契约。

### 2. Electron 采用三层权限边界

- **Renderer**：React + TypeScript，由 `electron-vite` 构建，只处理视图状态，不启用 Node integration。
- **Preload**：在 `contextIsolation` 下仅暴露白名单领域命令。
- **Main**：负责 SQLite、文件选择、密钥、DeepSeek SDK 适配、导入导出和沙箱 Worker 生命周期。

IPC 使用 `packages/shared` 中的 Zod schema 双向校验，按 `interview.create`、`review.confirmDiagnosis`、`training.submit` 等领域动作命名。不得暴露通用 SQL、任意文件路径、任意 channel 或网络代理。替代方案是 tRPC/通用 RPC，但它会扩大 preload 暴露面并掩盖桌面权限边界，因此不采用。

### 3. SQLite 是持久化模型，领域对象保持独立

使用 `better-sqlite3` + Drizzle ORM，所有访问只发生在 main。核心表按以下聚合组织：

- 上下文：`resume_snapshots`、`job_descriptions`、`target_profiles`、`target_capability_weights`；
- 复盘：`interviews`、`review_sessions`、`review_turns`、`review_items`、`diagnostic_hypotheses`；
- 画像：`capability_nodes`、`evidence_entries`、`capability_projection`；
- 训练：`training_tasks`、`assessment_contracts`、`training_attempts`、`review_schedules`；
- Agent：`model_runs`、`prompt_versions`、`context_manifest_items`；
- 系统：`settings`、`schema_migrations`。

原始证据采用 append-only：修正记录通过 `supersedes_id` 或 `retracts_id` 指向旧证据。`capability_projection` 是可重建缓存，不作为事实来源。所有聚合写入使用事务；数据库启用 foreign keys 和 WAL。数据库与业务文本按用户决定保持明文。

Drizzle schema 只是持久化定义，必须经过 repository 映射为领域对象，防止 UI 或 Agent 直接改数据库状态。替代方案是 Prisma，但原生桌面打包体积、引擎进程和迁移复杂度更高。

### 4. Agent 是显式状态机，不是开放式工具调用循环

复盘状态机：

```text
draft_context → free_recall → extract_review → targeted_questions
→ propose_diagnoses → user_resolution → evidence_preview
→ training_decision → completed
```

每个模型步骤拥有独立版本化提示词、最小输入 DTO 与 Zod 输出 schema。无效输出最多进行一次带校验错误的修复请求；再次失败则保存 `model_runs` 错误并回到可重试状态。模型只产生候选复盘项、追问、诊断和训练内容；完成门槛、活跃任务上限、能力转移和优先级全部由 `domain` 计算。

选择显式状态机而非 LangChain/LangGraph，是因为 Alpha 流程有限且需要确定恢复点、明确用户确认与可回放测试。内部保留 `ModelProvider`、`EventSource`、`TrainingType`、`ArtifactParser` 和 `Exporter` 端口，但只有 DeepSeek、真实面试、文本输入、两类训练和 JSON 导出具有具体实现。

### 5. DeepSeek 请求由上下文清单和薄 SDK 适配器驱动

模型设置只包含 DeepSeek API Key、可编辑模型 ID 和非敏感显示配置。API Key 使用 Electron `safeStorage` 在 Windows 上经 DPAPI 保护，加密后的值存入独立 secrets 文件，不进入 SQLite或导出。

`ModelProvider` 的 DeepSeek 实现使用 OpenAI JavaScript SDK 并配置 DeepSeek Base URL，不手写底层 HTTP、流解析或响应类型。适配器只负责把领域请求映射为 SDK 参数、传递取消信号、规范化 token usage/错误以及生成审计记录。SDK 的自动重试设置为 0，由显式工作流决定用户是否重试，避免产生未经确认的重复云端请求。Alpha 不引入 LangChain、LangGraph、Vercel AI SDK 或 XState；Agent 状态转换保持为 `domain` 中的可序列化纯 TypeScript 规则。

每次运行先在本地创建 `ContextManifest`，把内容分为必需和可选片段，并显示字符/token 近似量。用户删除可选片段后，main 才通过 SDK 发起请求。模型响应和 token usage 写入本地 `model_runs`；日志拦截器必须在记录前移除 Authorization header。请求不后台自动重试，也不自动换模型。

Alpha 不使用 embedding。相关证据通过 capability id、interview id、时间、状态、标签和 SQLite 全文/文本查询选择，以保持可解释性。

### 6. 证据账本驱动能力画像

`EvidenceEntry` 至少包含：来源类型、来源记录 ID、目标 capability、方向（支持/反驳）、强度档位、发生时间、确认者、创建原因及撤销关系。诊断假设与证据分离，包含替代解释、模型置信度和验证计划。

投影器以固定规则得到“未知、待验证、薄弱、基本可靠、稳定”。首次训练通过最多产生支持“基本可靠”的证据；只有变式复测或真实面试正向证据可支持“稳定”。投影规则必须是纯函数并能从账本全量重建。

任务排序使用版本化的确定性评分函数，输入为岗位相关度、证据强度、重复次数、影响、验证间隔、临近面试和预计成本。UI 展示各因素而非仅展示总分。具体初始权重作为可测试常量保留，Alpha 使用后再校准，不交给模型实时生成。

### 7. 训练契约与尝试记录分离

创建训练时先持久化版本化 `AssessmentContract`，之后才允许展示答题界面。解释题包含必备点、允许变体、常见误区、通过规则和最多两次追问；代码题额外包含公开/隐藏测试。每次提交生成新的 `TrainingAttempt`，复核生成关联记录，不覆盖原结果。

全局活跃任务上限和候选队列由领域服务在同一事务中维护。复测计划以本地日期存储，Alpha 在“今日”页打开时计算到期状态，不依赖后台调度器。

### 8. QuickJS WebAssembly 在专用 Worker 中运行用户代码

使用 `quickjs-emscripten` 作为执行边界，TypeScript 通过 `typescript.transpileModule` 在内存中转为 JavaScript。每次运行创建隔离 runtime/context，只注入题目约定函数、序列化测试数据和受控结果收集器，不注入网络、文件、Node、Electron 或宿主对象。

沙箱位于 main 创建的独立 Worker Thread 中：QuickJS runtime 设置内存与中断处理器，父线程另设硬超时并在必要时终止 Worker；stdout/序列化结果设长度上限。公开与隐藏测试使用同一执行协议，renderer 只能收到隐藏测试的通过状态和安全错误类别。

Node `vm` 不是安全边界，普通 child process 仍暴露宿主能力，Docker 又不适合零配置 Windows Alpha，因此均不采用。

### 9. UI 采用行为优先的桌面布局

React renderer 提供“今日、面试、训练、画像”四个一级路由。复盘页采用对话区与结构化卡片区的响应式双栏布局；窗口变窄时切为页签。服务端状态通过 IPC query/command hooks 管理，编辑草稿先乐观显示并在 main 事务成功后确认。

界面文案通过 i18n key 管理但 Alpha 只提供简体中文资源。Demo 使用独立 `dataset_kind=demo` 标识和确定性合成种子，可一键装载和清除，禁止引用真实数据。Demo 默认使用预录模型结果以确保无 API Key 时也能演示；用户主动选择“重新运行”时才调用 DeepSeek并进入发送预览。

### 10. 测试与发布按风险分层

- Vitest：领域纯函数、状态机、优先级、证据投影、上下文清单与 schema；
- 临时 SQLite：repository、migration、事务、JSON 导入导出；
- Agent fixtures：合成输入、录制响应、结构化失败及禁止臆测案例；
- 沙箱测试：无限循环、内存/输出上限、宿主逃逸尝试、公开/隐藏测试；
- Playwright Electron E2E：黄金路径、草稿恢复、重启持久化和 Demo；
- Windows-only GitHub Actions：format、lint、typecheck、test、build；发布标签额外构建 NSIS 和 SHA-256。

使用 `electron-builder` 打包。Alpha 不做静默更新；应用只展示版本并提供打开 GitHub Releases 的用户动作。未签名安装包的 SmartScreen 限制必须在 README 明示。

### 11. OpenSpec 是行为规格的唯一事实来源

稳定行为归档到 `openspec/specs/`；跨模块或改变外部行为的后续功能使用独立 change，完成后归档。README 只负责定位、运行和演示，ADR 只记录少数需要长期解释的技术取舍，不复制规格正文。微小样式与内部重构不创建 change。

## Risks / Trade-offs

- **[四周范围仍然偏大]** → 以黄金路径为唯一发布门槛；每周交付纵向切片，非门槛功能不得提前实现。
- **[DeepSeek 输出不能稳定满足 schema]** → 使用小而独立的 DTO、一次修复请求、用户可编辑候选结果及录制 fixture；失败时保留草稿。
- **[DeepSeek API 或模型 ID 演进]** → 模型 ID 配置化，HTTP 适配器与领域隔离；Alpha 兼容性声明只覆盖实际测试配置。
- **[明文 SQLite 暴露敏感材料]** → 首次保存前明确提示，文档建议使用 Windows 磁盘保护；API Key 仍单独安全保存。
- **[better-sqlite3 原生模块打包失败]** → 固定 Electron/Node ABI 组合，在 Windows CI 执行 rebuild、安装包冒烟测试和干净环境验证。
- **[QuickJS/WASM 被误认为支持完整前端代码]** → UI 和题目生成 schema 明确禁止 DOM/Node/外部依赖；不支持的题型在生成与运行两端拒绝。
- **[隐藏测试内容被模型或 UI 泄露]** → 测试定义只在 main/数据库侧使用，renderer 只接收安全摘要；模型评价不接收隐藏测试实现。
- **[事件账本让数据模型变复杂]** → 只对画像证据使用 append-only，不建立通用事件总线；保留可重建投影测试。
- **[Demo 与真实数据混淆]** → 数据集级标识、明显视觉提示和独立清除动作；演示默认使用确定性 fixture。
- **[OpenSpec 维护成本超过收益]** → 仅对行为或跨模块变更使用；不重复维护 PRD、架构路线图和规格正文。

## Migration Plan

1. Alpha 从空数据库初始化 schema version 1，并插入内置能力骨架与提示词版本。
2. 每次后续启动在打开业务界面前执行事务化 migration；对无法完全事务化的变更先创建单次迁移安全副本。
3. migration 或投影重建失败时停止写入，保留原数据库并向用户显示恢复路径。
4. 发布采用预发布版本号和 GitHub Release；回滚应用版本不得自动降级数据库，需恢复对应迁移安全副本或使用 JSON 导出重新导入兼容版本。

## Open Questions

- 首批内置能力树的细分节点和初始岗位权重可在第 2 周用合成案例校准，只要不改变状态集合与证据规则。
- 间隔复测的默认天数可通过早期个人使用调整，Alpha 初值作为版本化领域常量。
- 视觉组件库与最终配色可在不改变信息架构和可访问性的前提下于实现阶段选择。
