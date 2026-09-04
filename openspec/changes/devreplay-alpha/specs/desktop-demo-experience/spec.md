## Purpose

定义 DevReplay Alpha 的桌面信息架构、中文体验、合成演示模式和 Windows 发布边界，使真实用户与招聘方都能清楚理解并完成核心闭环。

## ADDED Requirements

### Requirement: 一级工作区围绕行动组织

系统 SHALL 提供“今日、面试、训练、画像”四个一级工作区，并将设置放在次级入口；今日页 SHALL 优先展示当前最值得完成的一项任务。

#### Scenario: 存在到期复测

- **WHEN** 用户打开今日页且存在到期复测
- **THEN** 系统展示最高优先级任务及其排序理由，而不是仅展示统计数字

### Requirement: 复盘对话与结构化结果可同时校正

系统 SHALL 在同一复盘体验中提供对话与结构化卡片视图，使用户能在访谈过程中查看并修正已提取内容。

#### Scenario: 发现题目提取错误

- **WHEN** 用户在访谈过程中修正结构化卡片中的题目
- **THEN** 后续追问使用修正后的内容且保留修订来源

### Requirement: 界面正式支持简体中文

系统 SHALL 使用简体中文界面、提示词与内置能力骨架，并 SHALL 接受中英混合的面试问题、代码和回答；Alpha 不承诺英文界面。

#### Scenario: 粘贴英文技术题并用中文回答

- **WHEN** 用户输入英文题目和中文回答
- **THEN** 系统能够将两者保存在同一复盘记录并继续中文工作流

### Requirement: Demo 模式使用隔离的合成数据

系统 SHALL 提供一键载入的合成候选人案例，覆盖复盘、诊断、训练、沙箱验收和画像变化；Demo 数据 MUST 与真实用户数据明确区分且不得包含作者隐私。

#### Scenario: 招聘方启动 Demo

- **WHEN** 用户从空状态选择 Demo 模式
- **THEN** 系统无需私人简历即可展示完整黄金路径，并允许退出后清除 Demo 数据

### Requirement: Alpha 支持目标 Windows 安装环境

系统 SHALL 提供可校验的 Windows x64 NSIS 安装包，目标环境为 Windows 10 22H2 和 Windows 11；系统 SHALL 通过 GitHub Releases 提供版本文件和校验值。

#### Scenario: 在支持的系统安装

- **WHEN** 用户在 Windows 10 22H2 或 Windows 11 x64 运行安装包
- **THEN** 应用能够安装、启动并完成本地数据初始化

### Requirement: 后台能力默认关闭

Alpha MUST NOT 默认启用开机启动、托盘常驻或系统通知，并且可暂不提供这些能力。

#### Scenario: 首次安装后关闭窗口

- **WHEN** 用户关闭应用窗口
- **THEN** 应用退出且不会自行设置开机启动或继续在托盘运行
