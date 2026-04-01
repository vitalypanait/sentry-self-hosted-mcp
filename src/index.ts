#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { SentryClient } from './sentry.js';

const config = {
  host: process.env.SENTRY_HOST ?? '',
  token: process.env.SENTRY_TOKEN ?? '',
  orgSlug: process.env.SENTRY_ORG_SLUG ?? '',
};

if (!config.host || !config.token || !config.orgSlug) {
  process.stderr.write(
    'Error: SENTRY_HOST, SENTRY_TOKEN, and SENTRY_ORG_SLUG environment variables are required\n'
  );
  process.exit(1);
}

const client = new SentryClient(config);

const server = new McpServer({ name: 'sentry-self-hosted-mcp', version: '1.0.0' });

server.registerTool(
  'get_event',
  {
    description:
      'Get detailed information about a specific Sentry event by project slug and event ID. Returns exception details, stacktrace, tags, and context.',
    inputSchema: {
      project_slug: z.string().describe('Sentry project slug (e.g. "payout", "billing")'),
      event_id: z.string().describe('Sentry event ID (32-char hex, e.g. "81d30e43f73d45fbada20c887ede80c0")'),
    },
  },
  async ({ project_slug, event_id }) => {
    const event = await client.getEvent(project_slug, event_id);
    return { content: [{ type: 'text', text: client.formatEvent(event) }] };
  }
);

server.registerTool(
  'get_issue',
  {
    description:
      'Get information about a Sentry issue by its numeric ID or short ID (e.g. "PAYOUT-123"). Includes status, event count, first/last seen.',
    inputSchema: {
      issue_id: z.string().describe('Sentry issue ID (numeric) or short ID (e.g. "PAYOUT-A6T")'),
    },
  },
  async ({ issue_id }) => {
    const issue = await client.getIssue(issue_id);
    return { content: [{ type: 'text', text: client.formatIssue(issue) }] };
  }
);

server.registerTool(
  'get_latest_event',
  {
    description: 'Get the latest event for a Sentry issue.',
    inputSchema: {
      issue_id: z.string().describe('Sentry issue ID (numeric) or short ID'),
    },
  },
  async ({ issue_id }) => {
    const event = await client.getLatestEvent(issue_id);
    return { content: [{ type: 'text', text: client.formatEvent(event) }] };
  }
);

server.registerTool(
  'list_issues',
  {
    description:
      'List Sentry issues with optional filters. Supports search queries like "is:unresolved", "level:error", etc.',
    inputSchema: {
      project_slug: z.string().optional().describe('Filter by project slug'),
      query: z.string().optional().describe('Search query (default: "is:unresolved"). E.g. "is:unresolved level:error"'),
      limit: z.number().optional().describe('Max number of results (default: 25)'),
    },
  },
  async (params) => {
    const issues = await client.listIssues(params);

    if (issues.length === 0) {
      return { content: [{ type: 'text', text: 'No issues found.' }] };
    }

    const lines = issues.map((issue) => {
      const assigned = issue.assignedTo ? ` → ${issue.assignedTo.name}` : '';
      return `- **${issue.shortId}** [${issue.level}] ${issue.title}\n  Project: ${issue.project.slug} | Events: ${issue.count} | Last seen: ${issue.lastSeen}${assigned}`;
    });

    return {
      content: [{ type: 'text', text: `## Issues (${issues.length})\n\n${lines.join('\n\n')}` }],
    };
  }
);

server.registerTool(
  'list_projects',
  {
    description: 'List all Sentry projects in the organization.',
    inputSchema: {},
  },
  async () => {
    const projects = await client.listProjects();
    const lines = projects.map((p) => `- **${p.slug}** — ${p.name} (id: ${p.id})`);
    return {
      content: [{ type: 'text', text: `## Projects\n\n${lines.join('\n')}` }],
    };
  }
);

server.registerTool(
  'get_stack_frames',
  {
    description:
      'Extract and format stack frames from a Sentry event. Useful for quickly seeing the call chain without full event details.',
    inputSchema: {
      project_slug: z.string().describe('Sentry project slug'),
      event_id: z.string().describe('Sentry event ID'),
      in_app_only: z.boolean().optional().describe('Show only application frames (exclude vendor/framework frames)'),
    },
  },
  async ({ project_slug, event_id, in_app_only }) => {
    const event = await client.getEvent(project_slug, event_id);
    const frames = client.extractStackFrames(event, in_app_only ?? false);

    if (frames.length === 0) {
      return { content: [{ type: 'text', text: 'No stack frames found.' }] };
    }

    const lines = frames.map((frame, i) => {
      const loc = frame.lineNo ? `:${frame.lineNo}` : '';
      const fn = frame.function ? ` in \`${frame.function}\`` : '';
      const app = frame.inApp ? ' **[app]**' : '';
      return `${i + 1}. \`${frame.filename}${loc}\`${fn}${app}`;
    });

    return {
      content: [{ type: 'text', text: `## Stack Frames — ${event.title}\n\n${lines.join('\n')}` }],
    };
  }
);

server.registerTool(
  'get_issue_with_stacktrace',
  {
    description: 'Get issue metadata and latest event stacktrace in a single call.',
    inputSchema: {
      issue_id: z.string().describe('Sentry issue ID (numeric) or short ID (e.g. "PAYOUT-A6Z")'),
    },
  },
  async ({ issue_id }) => {
    const { issue, event } = await client.getIssueWithStacktrace(issue_id);
    return { content: [{ type: 'text', text: client.formatIssueWithStacktrace(issue, event) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Sentry self-hosted MCP server started\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
