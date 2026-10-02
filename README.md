# DSH Model Reasoning Settings

A user-friendly DSH Bundle for configuring default reasoning levels on third-party model routes, starting with `llm-pi-ai`.

**Status:** Initial Bundle implementation. It has static smoke coverage but has not yet been validated in a running DSH Desktop installation.

## What the first version does

- Adds a **Default reasoning level** control to `llm-pi-ai` provider cards in **Settings → Models**.
- Persists the route default through DSH's Settings Remote, rather than asking users to edit YAML.
- Lets manually configured models declare **High** reasoning support and adjust its wire value (default: `high`).
- Does **not** override a reasoning level explicitly selected for an existing session.

## Development

```powershell
npm test
npm run check
```

See [the development plan](docs/DEVELOPMENT.md) for the confirmed extension points, configuration semantics, and acceptance criteria.
