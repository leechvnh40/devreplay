# Windows Alpha 实机验收清单

## 发布阻断检查

| 环境 | 安装 | 启动 | Demo 黄金路径 | 重启恢复 | 卸载 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| Windows 10 22H2 x64 | 通过 | 通过 | 通过 | 通过 | 通过 | 通过（2026-09-05） |
| Windows 11 x64 | 待实机 | 待实机 | 待实机 | 待实机 | 待实机 | 未验收 |

每个环境必须从 NSIS 安装包全新安装，核对 SHA-256，完成 README 的 Demo 路径，退出并重启确认当前阶段恢复，再执行卸载。卸载后记录应用文件与用户数据是否保留；任何崩溃、无法启动、数据库迁移失败或沙箱失效均为发布阻断。

## 已知问题

- Alpha prerelease：`https://github.com/leechvnh40/devreplay/releases/tag/v0.1.0-alpha.0`，包含 Windows x64 安装包与 SHA-256 校验文件。
- Alpha 安装包未签名，SmartScreen 可能拦截；README 已提供来源与摘要核验步骤。
- Windows 10 22H2 x64 使用 `DevReplay-0.1.0-alpha.0-windows-x64-setup.exe` 实测：静默安装和卸载退出码均为 0，已安装应用完成 onboarding、Demo、面试复盘、诊断确认、解释训练验收、复测安排与重启恢复；卸载后主程序和卸载器均不存在。E2E 使用独立临时用户数据目录并在结束时清除，没有改动真实用户数据。
- 本次 Windows 10 验收安装包 SHA-256：`90ff437911a28f3941ba5caae93aeb78c70aa5d16bef1b1d228feb5149b7797d`。
- Windows 11 x64 仍需实机验收；不能以 Windows 10 或 CI 打包成功替代该结论。
