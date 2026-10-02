# DSH Model Reasoning Settings

A user-friendly DSH Bundle for configuring default reasoning levels on third-party model routes, starting with `llm-pi-ai`.

**Status:** Initial Bundle implementation. It has static smoke coverage but has not yet been validated in a running DSH Desktop installation.

## What the first version does

- Adds a **Default reasoning level** control to `llm-pi-ai` provider cards in **Settings → Models**.
- Persists the route default through DSH's Settings Remote, rather than asking users to edit YAML.
- Lets manually configured models declare **High** reasoning support and adjust its wire value (default: `high`).
- Does **not** override a reasoning level explicitly selected for an existing session.

## Install in DSH Desktop

This project is designed for the DSH release line represented by the `0.2.0-rc.2` upstream source checkout.

1. Open the **Plugins** page in the DSH Desktop sidebar and choose **Add plugin**.
2. Paste this Git URL:

   ```text
   https://github.com/JuZiool/dsh-model-reasoning-settings.git
   ```

3. Install it, then choose **Enable now**.
4. Open **Settings → Models**, expand a third-party (`llm-pi-ai`) provider card, and set the default reasoning level.
5. For manually entered models, enable **High** reasoning support and confirm that the provider accepts the `high` wire value (or replace it with the value your gateway requires).

If installation reports that DSH must restart, restart it before checking the Models page. Do not enable a level your gateway/model does not support.

## Development

```powershell
npm test
npm run check
npm pack --dry-run --json
```

See [the development plan](docs/DEVELOPMENT.md) for the confirmed extension points, configuration semantics, and acceptance criteria.
