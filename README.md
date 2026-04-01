# sentry-self-hosted-mcp

MCP (Model Context Protocol) server for integrating self-hosted Sentry with AI assistants — Cursor, Claude Desktop, and any other MCP-compatible clients.

## Tools

| Tool | Description |
|---|---|
| `list_projects` | List all projects in the organization |
| `list_issues` | List issues with filtering by project, status, and level |
| `get_issue` | Issue details by numeric ID or short ID (e.g. `PAYOUT-A6Z`) |
| `get_issue_with_stacktrace` | Issue metadata + latest event stacktrace in a single call |
| `get_latest_event` | Latest event for an issue |
| `get_event` | Specific event by project slug and event ID |
| `get_stack_frames` | Stack frames for an event, with an option to show only in-app frames |

## Requirements

- Node.js 18+
- Self-hosted Sentry instance with API access
- Auth token with `org:read`, `project:read`, `event:read` scopes

## Installation

```bash
npm install
npm run build
```

## Configuration

The server reads three environment variables:

| Variable | Description | Example |
|---|---|---|
| `SENTRY_HOST` | Your Sentry URL | `https://sentry.example.com` |
| `SENTRY_TOKEN` | Auth token | `sntrys_...` |
| `SENTRY_ORG_SLUG` | Organization slug | `my-org` |

Tokens are created in **Settings → Auth Tokens** in Sentry.

## Connecting to Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sentry-selfhosted": {
      "command": "npx",
      "args": ["@vitaliypanait/sentry-self-hosted-mcp"],
      "env": {
        "SENTRY_HOST": "https://sentry.example.com",
        "SENTRY_TOKEN": "sntrys_...",
        "SENTRY_ORG_SLUG": "my-org"
      }
    }
  }
}
```

**Local development alternative** (if running from a cloned repo):

```json
{
  "mcpServers": {
    "sentry-selfhosted": {
      "command": "node",
      "args": ["/absolute/path/to/sentry-mcp/dist/index.js"],
      "env": {
        "SENTRY_HOST": "https://sentry.example.com",
        "SENTRY_TOKEN": "sntrys_...",
        "SENTRY_ORG_SLUG": "my-org"
      }
    }
  }
}
```

## Connecting to Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sentry-selfhosted": {
      "command": "npx",
      "args": ["@vitaliypanait/sentry-self-hosted-mcp"],
      "env": {
        "SENTRY_HOST": "https://sentry.example.com",
        "SENTRY_TOKEN": "sntrys_...",
        "SENTRY_ORG_SLUG": "my-org"
      }
    }
  }
}
```

## Cursor Rule

To make Cursor automatically fetch Sentry context when you mention an issue or ask about a bug, add a rule to your project.

Copy [`examples/cursor-rule.mdc`](examples/cursor-rule.mdc) into your project as `.cursor/rules/sentry.mdc`.

With `alwaysApply: false` the rule activates only when relevant (recommended). Change to `alwaysApply: true` to apply it to every request in the project.

## Development

```bash
# Run the compiler in watch mode
npm run dev

# Type check
npx tsc --noEmit
```

## Stack

- [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) — AI interaction protocol
- [Axios](https://axios-http.com) — HTTP client for the Sentry API
- [Zod](https://zod.dev) — input validation for tools
