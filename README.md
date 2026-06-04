# Leadtime Cursor Plugin

Leadtime Cursor plugin marketplace. It bundles Leadtime skills and the OAuth-enabled Leadtime MCP server for Cursor.

## Source Of Truth

Edit this package in the Leadtime monorepo:

```bash
libs/integrations/cursor-leadtime-plugin
```

The public repository is generated from this package:

```text
https://github.com/workcio/cursor-leadtime-plugin
```

## Development

```bash
npx nx lint cursor-leadtime-plugin
npx nx build cursor-leadtime-plugin
CURSOR_PLUGIN_SYNC_DRY_RUN=true npx nx run cursor-leadtime-plugin:integration-sync
```

Deploy workflows run:

```bash
npx nx affected --target=integration-sync
```

so this public repository is synced only when this integration package is affected.

## Installation

In Cursor, run:

```text
/add-plugin leadtime@https://github.com/workcio/cursor-leadtime-plugin
```

Install the Leadtime plugin and authorize Leadtime when Cursor opens the browser for MCP OAuth.

## CI Secret

Set `AGENT_PLUGIN_SYNC_TOKEN` in CI to a token that can write to all public agent plugin repositories:

- `workcio/codex-leadtime-plugin`
- `workcio/claude-leadtime-plugin`
- `workcio/cursor-leadtime-plugin`

For backward compatibility, sync scripts also accept `CODEX_PLUGIN_SYNC_TOKEN`.
