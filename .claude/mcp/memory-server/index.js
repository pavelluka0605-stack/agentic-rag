#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.resolve(__dirname, "../../memory");

// Ensure memory dir exists
fs.mkdirSync(MEMORY_DIR, { recursive: true });

const MEMORY_FILES = {
  decisions: path.join(MEMORY_DIR, "decisions.jsonl"),
  errors: path.join(MEMORY_DIR, "errors.jsonl"),
  sessions: path.join(MEMORY_DIR, "sessions.jsonl"),
  patterns: path.join(MEMORY_DIR, "patterns.jsonl"),
};

function appendEntry(file, entry) {
  const line = JSON.stringify({ ...entry, ts: new Date().toISOString() }) + "\n";
  fs.appendFileSync(file, line);
  return line.trim();
}

function readEntries(file, limit = 50) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n").filter(Boolean);
  const entries = lines.map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  return entries.slice(-limit);
}

function searchEntries(file, query) {
  if (!fs.existsSync(file)) return [];
  const q = query.toLowerCase();
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n").filter(Boolean);
  return lines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .filter((e) => JSON.stringify(e).toLowerCase().includes(q));
}

const server = new McpServer({
  name: "memory-server",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "add_decision",
  "Record an architectural or implementation decision",
  {
    title: z.string().describe("Short title of the decision"),
    context: z.string().describe("Why this decision was made"),
    alternatives: z.string().optional().describe("Alternatives considered"),
    project: z.string().optional().describe("Project name"),
    tags: z.array(z.string()).optional().describe("Tags for categorization"),
  },
  async ({ title, context, alternatives, project, tags }) => {
    const entry = { type: "decision", title, context, alternatives, project, tags };
    const saved = appendEntry(MEMORY_FILES.decisions, entry);
    return { content: [{ type: "text", text: `Decision recorded: ${saved}` }] };
  }
);

server.tool(
  "add_error",
  "Record an error and its fix for future reference",
  {
    error: z.string().describe("Error message or description"),
    cause: z.string().describe("Root cause"),
    fix: z.string().describe("How it was fixed"),
    project: z.string().optional().describe("Project name"),
    tags: z.array(z.string()).optional().describe("Tags"),
  },
  async ({ error, cause, fix, project, tags }) => {
    const entry = { type: "error", error, cause, fix, project, tags };
    const saved = appendEntry(MEMORY_FILES.errors, entry);
    return { content: [{ type: "text", text: `Error+fix recorded: ${saved}` }] };
  }
);

server.tool(
  "add_pattern",
  "Record a successful pattern or recipe worth reusing",
  {
    name: z.string().describe("Pattern name"),
    description: z.string().describe("What it does and when to use it"),
    code: z.string().optional().describe("Code snippet or command"),
    project: z.string().optional().describe("Project name"),
    tags: z.array(z.string()).optional().describe("Tags"),
  },
  async ({ name, description, code, project, tags }) => {
    const entry = { type: "pattern", name, description, code, project, tags };
    const saved = appendEntry(MEMORY_FILES.patterns, entry);
    return { content: [{ type: "text", text: `Pattern recorded: ${saved}` }] };
  }
);

server.tool(
  "save_session",
  "Save a session summary when ending work",
  {
    summary: z.string().describe("What was accomplished"),
    next_steps: z.string().optional().describe("What to do next"),
    blockers: z.string().optional().describe("Current blockers"),
    project: z.string().optional().describe("Project name"),
  },
  async ({ summary, next_steps, blockers, project }) => {
    const entry = { type: "session", summary, next_steps, blockers, project };
    const saved = appendEntry(MEMORY_FILES.sessions, entry);
    return { content: [{ type: "text", text: `Session saved: ${saved}` }] };
  }
);

server.tool(
  "search_memory",
  "Search across all memory stores for relevant context",
  {
    query: z.string().describe("Search query"),
    store: z.enum(["all", "decisions", "errors", "patterns", "sessions"]).optional()
      .describe("Which store to search (default: all)"),
  },
  async ({ query, store = "all" }) => {
    const results = {};
    const stores = store === "all" ? Object.keys(MEMORY_FILES) : [store];
    for (const s of stores) {
      if (MEMORY_FILES[s]) {
        const found = searchEntries(MEMORY_FILES[s], query);
        if (found.length > 0) results[s] = found;
      }
    }
    const total = Object.values(results).flat().length;
    return {
      content: [{
        type: "text",
        text: total > 0
          ? `Found ${total} results:\n${JSON.stringify(results, null, 2)}`
          : `No results for "${query}"`,
      }],
    };
  }
);

server.tool(
  "get_context",
  "Get recent memory entries for session context loading",
  {
    limit: z.number().optional().describe("Max entries per store (default: 10)"),
  },
  async ({ limit = 10 }) => {
    const context = {};
    for (const [name, file] of Object.entries(MEMORY_FILES)) {
      const entries = readEntries(file, limit);
      if (entries.length > 0) context[name] = entries;
    }
    return {
      content: [{
        type: "text",
        text: Object.keys(context).length > 0
          ? JSON.stringify(context, null, 2)
          : "Memory is empty. Start recording decisions, errors, and patterns.",
      }],
    };
  }
);

// --- Resources ---

server.resource(
  "memory-stats",
  "memory://stats",
  async (uri) => {
    const stats = {};
    for (const [name, file] of Object.entries(MEMORY_FILES)) {
      if (fs.existsSync(file)) {
        const lines = fs.readFileSync(file, "utf-8").trim().split("\n").filter(Boolean);
        stats[name] = lines.length;
      } else {
        stats[name] = 0;
      }
    }
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(stats, null, 2),
      }],
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
