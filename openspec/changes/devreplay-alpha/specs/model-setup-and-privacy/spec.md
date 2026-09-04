## Purpose

定义 DevReplay Alpha 如何配置并调用 DeepSeek、保护访问凭据、控制发送到云端的内容，以及在网络或模型不可用时维持可靠且可解释的本地体验。

## ADDED Requirements

### Requirement: DeepSeek 是 Alpha 唯一模型服务

系统 SHALL 只提供一个活动 DeepSeek 模型配置，并允许用户录入 API Key 与模型 ID；系统 MUST 明确说明生成、诊断和评分会把选定内容发送到 DeepSeek 云端。

#### Scenario: 首次配置模型

- **WHEN** 用户首次进入需要 Agent 的功能
- **THEN** 系统要求完成 DeepSeek 配置并展示云端推理说明

### Requirement: API Key 不得进入业务数据

系统 MUST 使用 Windows 安全凭据能力保护 API Key，且 MUST NOT 将其写入 SQLite、普通日志、模型运行记录、Demo 数据或导出文件。

#### Scenario: 查看模型配置

- **WHEN** 用户返回模型设置页
- **THEN** 系统只展示密钥已配置状态而不回显完整 API Key

### Requirement: 云端请求遵循最小上下文原则

系统 SHALL 在本地选择完成当前任务所需的最小上下文，并在请求前向用户提供可展开的发送内容预览；用户 SHALL 能删减可选内容或取消请求。

#### Scenario: 用户删减上下文

- **WHEN** 用户在发送预览中移除一段简历或历史证据
- **THEN** 系统不得在本次 DeepSeek 请求中包含该内容

### Requirement: 模型运行可在本地审计

系统 SHALL 本地记录模型 ID、提示词版本、上下文清单、原始响应、结构化结果、token 用量、耗时和错误；系统 MUST NOT 自动上传这些记录。

#### Scenario: 查看诊断来源

- **WHEN** 用户查看由 Agent 生成的诊断
- **THEN** 系统可定位并展示产生该诊断的本地模型运行记录

### Requirement: 模型故障不得造成数据丢失

系统 SHALL 在无网络、鉴权失败、超时或结构化输出无效时保留用户输入并给出可恢复错误；系统 MUST NOT 自动切换供应商或无限重试。

#### Scenario: 自由回忆后模型超时

- **WHEN** DeepSeek 请求在用户完成自由回忆后超时
- **THEN** 系统保存复盘草稿并将其标记为待分析

### Requirement: 产品保持零遥测

系统 MUST NOT 收集或上传使用统计、崩溃报告、面试内容或设备标识。

#### Scenario: 应用正常运行

- **WHEN** 用户仅执行本地浏览和编辑操作
- **THEN** 系统不向 DevReplay 维护者或第三方分析服务发起遥测请求
