import axios, { AxiosInstance } from 'axios';

export interface SentryConfig {
  host: string;
  token: string;
  orgSlug: string;
}

export interface SentryEvent {
  id: string;
  eventID: string;
  groupID: string;
  projectID: string;
  title: string;
  message: string;
  dateCreated: string;
  tags: Array<{ key: string; value: string }>;
  entries: SentryEventEntry[];
  user: Record<string, unknown> | null;
  contexts: Record<string, unknown>;
  release: { version: string } | null;
}

export interface SentryEventEntry {
  type: string;
  data: Record<string, unknown>;
}

export interface SentryIssue {
  id: string;
  shortId: string;
  title: string;
  status: string;
  level: string;
  count: string;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  project: { slug: string; name: string };
  permalink: string;
  assignedTo: { name: string; email: string } | null;
}

export interface StackFrame {
  filename: string;
  lineNo: number | null;
  colNo: number | null;
  function: string | null;
  module: string | null;
  inApp: boolean;
  context: Array<[number, string]>;
}

export class SentryClient {
  private http: AxiosInstance;
  private orgSlug: string;

  constructor(config: SentryConfig) {
    this.orgSlug = config.orgSlug;
    this.http = axios.create({
      baseURL: `${config.host.replace(/\/$/, '')}/api/0`,
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  async getEvent(projectSlug: string, eventId: string): Promise<SentryEvent> {
    const { data } = await this.http.get<SentryEvent>(
      `/projects/${this.orgSlug}/${projectSlug}/events/${eventId}/`
    );
    return data;
  }

  async getIssue(issueId: string): Promise<SentryIssue> {
    const { data } = await this.http.get<SentryIssue>(
      `/organizations/${this.orgSlug}/issues/${issueId}/`
    );
    return data;
  }

  async getLatestEvent(issueId: string): Promise<SentryEvent> {
    const { data } = await this.http.get<SentryEvent>(
      `/organizations/${this.orgSlug}/issues/${issueId}/events/latest/`
    );
    return data;
  }

  async listIssues(params: {
    projectSlug?: string;
    query?: string;
    limit?: number;
    cursor?: string;
  }): Promise<SentryIssue[]> {
    const { data } = await this.http.get<SentryIssue[]>(
      `/organizations/${this.orgSlug}/issues/`,
      {
        params: {
          project: params.projectSlug,
          query: params.query ?? 'is:unresolved',
          limit: params.limit ?? 25,
          cursor: params.cursor,
        },
      }
    );
    return data;
  }

  async listProjects(): Promise<Array<{ slug: string; name: string; id: string }>> {
    const { data } = await this.http.get<Array<{ slug: string; name: string; id: string }>>(
      `/organizations/${this.orgSlug}/projects/`
    );
    return data;
  }

  extractStackFrames(event: SentryEvent, inAppOnly = false): StackFrame[] {
    const frames: StackFrame[] = [];

    for (const entry of event.entries) {
      if (entry.type !== 'exception') continue;

      const values = (entry.data as { values?: Array<{ stacktrace?: { frames?: StackFrame[] } }> }).values ?? [];
      for (const exc of values) {
        const excFrames = exc.stacktrace?.frames ?? [];
        for (const frame of excFrames) {
          if (inAppOnly && !frame.inApp) continue;
          frames.push(frame);
        }
      }
    }

    return frames.reverse();
  }

  formatEvent(event: SentryEvent): string {
    const lines: string[] = [];

    lines.push(`# Event ${event.eventID}`);
    lines.push(`**Issue:** ${event.groupID}`);
    lines.push(`**Date:** ${event.dateCreated}`);
    lines.push(`**Title:** ${event.title}`);
    lines.push('');

    for (const entry of event.entries) {
      if (entry.type === 'exception') {
        const values = (entry.data as { values?: Array<{ type: string; value: string; stacktrace?: { frames?: StackFrame[] } }> }).values ?? [];
        for (const exc of values) {
          lines.push(`## Exception: ${exc.type}`);
          lines.push(`**Message:** ${exc.value}`);
          lines.push('');

          const frames = exc.stacktrace?.frames ?? [];
          if (frames.length > 0) {
            lines.push('### Stacktrace');
            for (const frame of frames.slice(-15).reverse()) {
              const loc = frame.lineNo ? `:${frame.lineNo}` : '';
              const fn = frame.function ? ` in ${frame.function}` : '';
              const app = frame.inApp ? ' [app]' : '';
              lines.push(`- \`${frame.filename}${loc}\`${fn}${app}`);

              if (frame.context && frame.context.length > 0 && frame.inApp) {
                for (const [lineNum, code] of frame.context) {
                  const marker = lineNum === frame.lineNo ? '→' : ' ';
                  lines.push(`  ${marker} ${lineNum}| ${code}`);
                }
              }
            }
            lines.push('');
          }
        }
      }
    }

    if (event.tags.length > 0) {
      lines.push('## Tags');
      for (const tag of event.tags) {
        lines.push(`- **${tag.key}:** ${tag.value}`);
      }
    }

    return lines.join('\n');
  }

  formatIssue(issue: SentryIssue): string {
    const lines: string[] = [];
    lines.push(`# Issue ${issue.shortId}`);
    lines.push(`**Title:** ${issue.title}`);
    lines.push(`**Status:** ${issue.status}`);
    lines.push(`**Level:** ${issue.level}`);
    lines.push(`**Project:** ${issue.project.name} (${issue.project.slug})`);
    lines.push(`**Events:** ${issue.count}`);
    lines.push(`**Users affected:** ${issue.userCount}`);
    lines.push(`**First seen:** ${issue.firstSeen}`);
    lines.push(`**Last seen:** ${issue.lastSeen}`);
    if (issue.assignedTo) {
      lines.push(`**Assigned to:** ${issue.assignedTo.name} (${issue.assignedTo.email})`);
    }
    lines.push(`**URL:** ${issue.permalink}`);
    return lines.join('\n');
  }
}
