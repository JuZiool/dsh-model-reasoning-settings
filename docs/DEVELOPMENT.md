# DSH 第三方模型思考等级插件：开发文档

- **状态：** 技术方案，尚未实现
- **编写日期：** 2026-10-02
- **上游项目：** [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- **首期范围：** DSH 的 `llm-pi-ai` 第三方模型路由

## 1. 要解决的问题

DSH 的第三方模型能力可以配置思考等级，但手动录入的模型默认没有等级选项，用户需要修改 Profile 的 `cordis.patch.yml`。本插件要把常见配置操作做成 DSH 模型设置页里的控件，让用户不必直接编辑 YAML。

首期目标是：用户能在每个第三方提供商卡片上设置默认思考等级；对于手动录入、尚未声明思考能力的模型，能在 UI 中声明可用等级和接口实际接受的值。默认推荐等级为 `high`，但不假设每个模型或接口都支持它。

## 2. DSH 术语与交付形态

- **Cordis 插件（plugin）**：在 DSH Profile 中加载的运行时代码，可注册 Host 服务或 Client UI。
- **Bundle（插件包）**：交给 DSH 插件管理器安装、用于把插件加入 Profile 的分发包。
- 本项目交付物应是一个 **Bundle，其中包含 Host 插件入口和 Client UI 插件**；不是修改 DSH 上游源码，也不是单独的模型适配器。

建议独立目录，不放入上游仓库：

```text
dsh-thinking-levels/
├─ package.json
├─ cordis.patch.yml
├─ index.js
├─ client.js
└─ locale/
   ├─ zh.json
   └─ en.json
```

## 3. 已确认的扩展点

### 3.1 模型设置页 UI

`@deepseek-ai/dsh-client-ui-settings-models` 声明了外部扩展位：

- Slot：`settings.models.provider-card`
- Slot key：设置命名空间 `llm-pi-ai`
- Slot owner props：提供商路由、配置状态、凭据状态

因此插件可注册到这个 slot，在每个 `llm-pi-ai` 提供商卡片中显示自己的思考等级控件。Client 包通过 `dsh.client` 元数据加载，并依赖模型设置页、Client Remote 和 locale 等既有组件。

### 3.2 配置读取与保存

使用 DSH 的 Settings Remote，而不是直接写文件：

- `settings.describe()`：读取当前 Profile 中的配置、schema 和 revision。
- `settings.mutate(ns, ops, expectedRevision)`：按路径更新配置，并用 revision 防止覆盖并发修改。

`llm-pi-ai` 的 `providers` 配置为可由 Settings 表单编辑的 volatile 配置；写入后由适配器刷新配置快照，后续请求使用新值。

## 4. 配置语义

首期只针对 `llm-pi-ai` 路由：

| 配置位置 | 用途 |
|---|---|
| `providers.<route>.reasoning` | 当新会话/请求没有显式选择等级时使用的路由默认值 |
| `providers.<route>.models[].reasoningEfforts` | 手动列出的模型可选等级及其 wire 值 |
| `providers.<route>.modelOverrides.<model>.reasoningEfforts` | 已安装模型目录中某个模型的等级覆盖 |

`reasoningEfforts` 的键是 DSH 展示/接受的等级，值是适配器发送给提供商的实际字符串。例如 `max: ultra` 表示 DSH 中的 `max` 映射为接口值 `ultra`；`off` 可留空。手动模型只有在声明等级后，模型选择器才会显示对应的等级菜单。

## 5. 首期用户体验

1. 在 DSH「设置 → 模型」中打开一个 `llm-pi-ai` 提供商卡片。
2. 插件显示“默认思考等级”选择器：沿用提供商默认、关闭、Low、Medium、High、Max 等可用选项。
3. 对手动配置的模型显示简单的“支持思考等级”设置；用户启用等级，并可调整接口 wire 值。默认建议 `high` → `high`，但明确提示需由接口支持。
4. 保存后给出成功/失败提示；遇到 revision 冲突时重新读取配置，不静默覆盖。
5. 已有会话中显式选择的等级不被改写；插件只设置缺省值，不强制覆盖用户选择。

如果某个接口需要 DeepSeek 风格的 `thinking.type` 格式，后续可提供兼容协议选项（例如 `compat.thinkingFormat: deepseek`）；首期不能默认替所有路由打开该格式。

## 6. 不采用的实现

不通过 `llm/stream` 中间件强行改写请求。DSH 的 Agent Loop 请求会被冻结，且请求内容需要能从 Session 日志重建；运行时改写会破坏该约束，也可能覆盖用户明确选择的 `off`。应通过 Settings Remote 修改适配器支持的默认配置和模型能力声明。

不在安装插件时无确认地把所有未知模型都标记为支持推理。不同提供商/网关的参数名、等级值和协议可能不同，插件不能安全地猜测。

## 7. 代码结构与约束

- `package.json`：声明 `dsh.bundle.patch`、Host/Client exports、`dsh.client` 的 `platform`、`immediately` 和依赖注入顺序。
- `cordis.patch.yml`：插入唯一 ID 的插件条目。
- `index.js`：轻量 Host 插件入口；不需要时不注册额外 Host 服务。
- `client.js`：注册 locale 字典，并通过 `slots.inject('settings.models.provider-card', ...)` 注册到 `key: 'llm-pi-ai'`。
- 保存配置时只写必要的路径操作；不得 replace 整个 `llm-pi-ai` 配置，以免覆盖 API Key 引用或其他用户配置。
- UI 使用 DSH locale 与主题继承；不加载 DSH 内部 React/组件包，不访问或改写页面 DOM。
- 插件配置只写入当前 Profile，不处理凭据值，也不记录 API Key。

## 8. 验收标准

- 插件可作为 Bundle 被 DSH 插件管理器安装/卸载。
- 模型设置页仅在 `llm-pi-ai` 提供商卡片显示扩展控件。
- 路由默认值可通过界面读取、设置、清除；刷新/重启后仍保留。
- 手动模型的等级和 wire 映射可通过界面设置，模型选择器能看到已声明等级。
- 配置写入使用 revision；冲突或拒绝时给出可理解的提示。
- 不覆盖密钥、其他路由或已有模型字段；不强制更改用户已有会话的等级。
- `client.js` 语法检查通过；Bundle manifest 与 patch 校验通过；安装后在 DSH 实际模型设置页完成交互验证。

## 9. 仓库依据

当前设计依据克隆仓库中的以下文件，实施前应再次核对目标 DSH 版本：

- `packages/preset/agent-preset/skills/cordis-plugin-development/SKILL.md`
- `packages/preset/agent-preset/skills/cordis-plugin-development/references/host-plugin.md`
- `packages/preset/agent-preset/skills/cordis-plugin-development/references/ui-plugin.md`
- `packages/client/ui-settings-models/src/client/slot-contract.ts`
- `packages/client/ui-settings-models/src/client/ModelsSection.tsx`
- `packages/client/ui-settings-models/src/client/operations.ts`
- `packages/llm/llm-pi-ai/src/config.ts`
- `packages/llm/llm-pi-ai/README.zh.md`
- `docs/user/guide/providers.zh.md`
