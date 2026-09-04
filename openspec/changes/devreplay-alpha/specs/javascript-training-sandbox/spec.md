## Purpose

定义 Alpha 对纯 JavaScript / TypeScript 代码训练的可执行验收范围和隔离边界，使代码正确性由测试提供硬证据，同时保护本地文件、网络和桌面权限。

## ADDED Requirements

### Requirement: 沙箱只执行受支持的纯代码

系统 SHALL 支持纯 JavaScript 和 TypeScript 代码题；TypeScript SHALL 在内存中转换后执行。题目 MUST NOT 依赖 DOM、Node.js API、外部包或系统命令。

#### Scenario: 题目要求文件系统访问

- **WHEN** 训练定义包含文件系统或 Node.js API 依赖
- **THEN** 系统拒绝创建或运行该代码训练并说明 Alpha 的限制

### Requirement: 代码结果由公开和隐藏测试验证

系统 SHALL 在作答前展示公开测试并保密隐藏测试；提交后 SHALL 分别报告公开与隐藏测试结果，但 MUST NOT 泄露隐藏测试实现。

#### Scenario: 公开测试通过但隐藏测试失败

- **WHEN** 用户代码通过全部公开测试但未通过一个边界条件隐藏测试
- **THEN** 系统判定代码正确性未达标并说明失败类别而不展示隐藏测试源码

### Requirement: 运行环境无宿主权限

用户代码 MUST NOT 访问文件系统、网络、进程、环境变量、Electron API 或宿主全局对象。

#### Scenario: 用户代码尝试发起网络请求

- **WHEN** 提交代码尝试使用网络能力
- **THEN** 沙箱拒绝访问且应用与本地数据保持可用

### Requirement: 运行资源受到限制

系统 MUST 对单次执行设置时间、内存和输出上限，并 SHALL 在超过限制时终止该次运行且返回可理解的错误。

#### Scenario: 用户提交无限循环

- **WHEN** 代码执行超过配置的时间上限
- **THEN** 系统终止沙箱运行并报告超时而不阻塞桌面应用

### Requirement: 测试结果与模型评价分工明确

系统 MUST 以测试结果作为代码正确性的硬证据；Agent SHALL 仅补充思路、复杂度和表达评价，不得推翻失败的必需测试。

#### Scenario: Agent 认为实现思路合理但必需测试失败

- **WHEN** 模型评价正面而必需测试未通过
- **THEN** 系统仍将代码正确性判定为未通过并展示两类评价的区别
