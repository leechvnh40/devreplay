## Why

程序员在真实面试后往往只留下零散题目和模糊感受，缺少从事实复盘、能力诊断到训练验证的长期闭环。DevReplay Alpha 要在四周内交付一个可安装、可演示且能供作者本人持续试用的 Windows 桌面 Agent，用可追溯证据代替一次性总结，用实际训练结果校正长期能力画像。

## What Changes

- 新建面向前端、全栈及 AI 应用工程师的简体中文 Electron 桌面应用，正式支持 Windows 10 22H2 / Windows 11 x64。
- 支持绑定简历文本快照和可选 JD，通过“自由回忆 → 定向追问 → 结构化复盘卡”完成真实面试复盘。
- 严格区分用户陈述、原始材料、Agent 总结、Agent 推断、训练结果和用户修订；未经确认或验证的诊断只能进入待验证状态。
- 以追加式证据账本推导能力画像，并以目标岗位画像决定缺口优先级；不使用伪精确掌握度分数。
- 每次复盘默认生成一个主训练任务，全局最多三个活跃任务；支持解释题及无 DOM、无 Node API 的纯 JavaScript / TypeScript 代码题。
- 在用户作答前冻结评分标准；首次通过只进入“基本可靠”，必须经间隔复测或后续真实面试证据才能进入“稳定”。
- 仅接入 DeepSeek 云端 API。数据持久化在本地 SQLite，API Key 使用系统安全凭据保护；云端调用发送最小必要上下文，并提供发送内容预览与删减。
- 支持离线创建、编辑、浏览和恢复草稿；模型不可用时将复盘标记为待分析，不丢失用户输入。
- 提供合成数据 Demo 模式，完整展示复盘、诊断、训练、验收和画像更新，不使用作者私人数据。
- 以 Apache-2.0 开源，通过 GitHub Releases 发布 Windows x64 NSIS 安装包；Alpha 不收集遥测或自动上传崩溃信息。

### Non-goals

- 不支持录音、实时转写、OCR、PDF / DOCX 自动解析；Alpha 使用粘贴文本。
- 不支持模拟面试、公共题库、自动投递、职位爬取或招聘流程管理。
- 不支持账号、多用户、云同步、官方后端、本地模型推理或多模型路由。
- 不支持向量数据库、第三方插件运行时或稳定公共插件 SDK。
- 不支持 DOM、React、Node.js 或多语言代码沙箱。
- 不承诺 macOS、Linux、ARM64 或 32 位支持。
- Alpha 不包含系统通知、开机启动、托盘常驻、完整备份恢复、费用估算、主题系统或高级可视化。

## Capabilities

### New Capabilities

- `model-setup-and-privacy`: DeepSeek 配置、密钥保护、最小上下文预览、调用审计和离线降级。
- `interview-review`: 面试创建、不可变上下文快照、两阶段访谈、结构化复盘卡、草稿恢复与完成门槛。
- `evidence-capability-profile`: 来源可追溯的证据账本、诊断确认、能力状态投影、岗位权重和确定性优先级。
- `training-loop`: 活跃任务限制、解释题追问、冻结验收契约、评分复核、间隔复测与闭环率。
- `javascript-training-sandbox`: 纯 JavaScript / TypeScript 代码执行、公开及隐藏测试与资源隔离。
- `local-data-lifecycle`: SQLite 本地持久化、明文数据声明、JSON 导入导出、迁移安全和数据清除。
- `desktop-demo-experience`: 今日、面试、训练、画像工作区，合成 Demo 模式及 Windows 安装包体验。

### Modified Capabilities

无；这是一个空仓库中的首个产品变更。

## Impact

- 新建 pnpm workspace，包含 Electron 桌面应用以及领域、Agent、沙箱和共享协议包。
- 新增 React、TypeScript、Vite、Electron、Zod、Drizzle ORM、SQLite 驱动、QuickJS WebAssembly 和测试/打包工具链。
- 新增严格白名单 IPC 边界；渲染进程不直接访问 Node.js、文件系统、数据库或模型密钥。
- 新增 DeepSeek 外部网络依赖。除用户主动触发的模型请求外，应用不向项目维护者或其他服务发送数据。
- 新增 Windows-only GitHub Actions 检查与 GitHub Releases 发布流程。
