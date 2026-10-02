# DSH 第三方模型思考等级设置

一个 DSH Bundle 插件,为第三方模型(`llm-pi-ai` 路由)提供可视化的思考等级配置,无需手改 YAML。

适用于 DSH Desktop `0.2.0-rc.2` 一带的版本,已在实际桌面环境中完整验证。

## 功能

- **在模型编辑器内直接配置**:打开 设置 → 模型 → 提供商卡片 → 编辑,展开「自定义设置」后,每个模型条目内(「输入类型」下方)会显示一排可点选的思考等级胶囊:**None / Medium / High / XHigh / Max**。
- **点亮即声明,再点取消**:点亮表示该模型支持此等级,接口值默认与等级同名(如 High → `high`);None 表示不思考(不发送思考参数)。
- **新添加的模型立即可选**:还没保存的模型胶囊也能点选,点「保存」后自动写入;未保存前悬停有提示。
- **None 一键清除**:点某模型的 None 会清除它的全部思考等级声明。
- **切换模型保留思考等级**:在一个会话里选定等级后,切换到其他模型会自动沿用该等级(仅当目标模型支持;不支持则用目标模型自己的默认,切回支持的模型时恢复)。手动选择 Default 表示清除记忆。
- 配置通过 DSH Settings Remote 写入,带 revision 冲突保护,持久保存在 Profile 的补丁文件中;不碰 API 密钥,不覆盖已有会话中显式选择的等级。

## 安装

1. 打开 DSH Desktop 侧边栏的 **插件** 页,选择 **添加插件**。
2. 粘贴仓库地址:

   ```text
   https://github.com/JuZiool/dsh-model-reasoning-settings.git
   ```

3. 安装并启用,如提示重启则重启 DSH。
4. 进入 **设置 → 模型**,编辑你的第三方(`llm-pi-ai`)提供商,展开「自定义设置」即可看到各模型的思考等级胶囊。

卸载插件不会删除已写入的模型等级配置;如需彻底清除,在模型条目里点 None,或直接编辑 Profile 的补丁文件删除对应 `reasoningEfforts` 段。

## 使用说明与注意事项

- 胶囊只在编辑器打开时出现;「自定义设置」收起时整个区域自动隐藏。
- 等级的接口值默认与等级同名。若你的网关要求不同的拼写(例如 `high` 要发 `ultra`),目前请直接编辑 Profile 补丁文件中的 `reasoningEfforts` 值。
- 请确认提供商/网关确实支持所选等级:DSH 会在请求前校验,发送不支持的等级会被拒绝。
- 「切换模型保留等级」是客户端内存行为:应用重启后的第一次切换使用各模型默认,重新选一次等级后开始保留。
- 该插件只作用于 `llm-pi-ai` 路由(手动添加的第三方提供商);DeepSeek 官方模型的等级由内置适配器提供。

## 工作原理(简要)

- 插件注册到 DSH 模型设置页的 `settings.models.provider-card` 扩展槽(key 为 `llm-pi-ai`)。
- 等级胶囊通过 React Portal 渲染进原生编辑器的模型条目内,并用 MutationObserver 跟踪条目的展开/收起;「自定义设置」是原生 `<details>`,收起时自动隐藏挂载内容。
- 配置读取与写入走 DSH Settings Remote 的 `describe` / `mutate`(带 expectedRevision,冲突时不静默覆盖)。
- 「切换模型保留等级」通过包装会话远程的 `selectModel` 实现:切换且未显式选等级时,先查模型目录确认目标模型支持,再注入之前记住的等级。

## 开发

```powershell
npm run check   # client.js / index.js 语法检查
npm test        # 冒烟测试
```

设计与扩展点调研见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。
