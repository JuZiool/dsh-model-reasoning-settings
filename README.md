# DSH Model Reasoning Settings

[中文说明](README.zh.md)

A DSH Bundle that adds visual reasoning-level configuration for third-party models (`llm-pi-ai` routes) — no YAML editing required.

Verified in a running DSH Desktop installation (`0.2.0-rc.2` release line).

## Features

- **Chips inside the provider editor**: Settings → Models → edit a third-party provider, expand 自定义设置, and every model entry shows a row of toggle chips: **None / Medium / High / XHigh / Max**.
- **Tap to declare, tap again to remove.** The wire value defaults to the level name (High → `high`); None clears the model's whole declaration.
- **New models work immediately**: chips on unsaved drafts are selectable and are written to the model when you save the provider.
- **Effort survives model switches**: once you pick a level in a session, switching models re-applies it whenever the target model supports that level; picking Default explicitly clears the memory.
- Configuration goes through DSH's Settings Remote with revision protection — API keys and existing sessions' explicit picks are never touched.

## Install

1. In DSH Desktop, open the **Plugins** page and choose **Add plugin**.
2. Paste:

   ```text
   https://github.com/JuZiool/dsh-model-reasoning-settings.git
   ```

3. Install, enable, and restart DSH if prompted.
4. Open **Settings → Models**, edit your third-party (`llm-pi-ai`) provider, and expand 自定义设置.

## Notes

- Wire values default to the level name; if your gateway needs a different spelling, edit the `reasoningEfforts` values in your profile patch file directly.
- Only declare levels your provider actually supports — DSH validates before dispatch.
- Keeping the effort across switches is a client-side memory: after an app restart the first switch falls back to per-model defaults until you pick a level once.

## Development

```powershell
npm run check   # syntax check for index.js / client.js
npm test        # smoke tests
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the extension-point research and configuration semantics.
