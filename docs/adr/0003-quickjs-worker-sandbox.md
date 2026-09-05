# ADR 0003：QuickJS Worker 沙箱

- 状态：Accepted
- 日期：2026-09-04

## 决策

JavaScript/TypeScript 训练代码在独立 Worker 内的 QuickJS WebAssembly 运行时执行，只注入最小测试协议；父线程执行硬超时，隐藏测试源码不进入 renderer 或模型上下文。

## 原因与后果

直接使用 Node `vm` 不能作为安全边界，子进程又增加安装和资源控制成本。QuickJS 能隔离 Node、Electron、文件、环境变量和网络；代价是包体更大、DOM/Node 题型暂不支持，并需同时维护运行时内存限制和 Worker 终止。
