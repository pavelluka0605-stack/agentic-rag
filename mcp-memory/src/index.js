import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { initDatabase } from './database.js';
import { MemoryOperations } from './operations.js';

const db = initDatabase(process.env.MEMORY_DB_PATH);
const ops = new MemoryOperations(db);

const server = new McpServer({
  name: 'memory-server',
  version: '1.0.0',
});

// --- memory_save ---
server.tool(
  'memory_save',
  'Сохранить новое воспоминание в базу знаний (урок, паттерн, решение, фикс, сниппет, заметка)',
  {
    type: z.enum(['lesson', 'pattern', 'decision', 'error_fix', 'snippet', 'note']),
    title: z.string().max(200),
    content: z.string(),
    tags: z.string().optional(),
    project: z.string().optional(),
    importance: z.number().min(1).max(10).optional(),
    related_files: z.string().optional(),
  },
  async (params) => {
    try {
      const result = ops.saveMemory(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in memory_save:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- memory_search ---
server.tool(
  'memory_search',
  'Полнотекстовый поиск по базе знаний (русский и английский)',
  {
    query: z.string(),
    type: z.enum(['all', 'lesson', 'pattern', 'decision', 'error_fix', 'snippet', 'note']).optional(),
    project: z.string().optional(),
    limit: z.number().min(1).max(50).optional(),
  },
  async (params) => {
    try {
      const result = ops.searchMemory(params.query, params.type, params.project, params.limit);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in memory_search:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- memory_get_context ---
server.tool(
  'memory_get_context',
  'Загрузить полный контекст перед началом задачи — релевантные воспоминания, уроки, паттерны, сессии',
  {
    task_description: z.string(),
    project: z.string().optional(),
  },
  async (params) => {
    try {
      const result = ops.getContext(params.task_description, params.project);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in memory_get_context:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- memory_find_similar ---
server.tool(
  'memory_find_similar',
  'Найти похожие задачи из прошлого опыта и потенциальные проблемы',
  {
    task_description: z.string(),
  },
  async (params) => {
    try {
      const result = ops.findSimilar(params.task_description);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in memory_find_similar:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- session_start ---
server.tool(
  'session_start',
  'Начать новую рабочую сессию (автоматически закрывает предыдущую)',
  {
    goal: z.string(),
    project: z.string().optional(),
  },
  async (params) => {
    try {
      const result = ops.startSession(params.goal, params.project);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in session_start:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- session_end ---
server.tool(
  'session_end',
  'Завершить текущую сессию с итогами, проблемами и следующими шагами',
  {
    session_id: z.number(),
    summary: z.string(),
    problems: z.string().optional(),
    next_steps: z.string().optional(),
    files_changed: z.string().optional(),
    memories_created: z.string().optional(),
  },
  async (params) => {
    try {
      const result = ops.endSession(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in session_end:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- memory_update ---
server.tool(
  'memory_update',
  'Обновить существующее воспоминание или пометить устаревшим',
  {
    id: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
    tags: z.string().optional(),
    status: z.enum(['active', 'outdated', 'archived']).optional(),
    importance: z.number().min(1).max(10).optional(),
    outdated_reason: z.string().optional(),
  },
  async (params) => {
    try {
      const result = ops.updateMemory(params.id, params);
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in memory_update:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- memory_stats ---
server.tool(
  'memory_stats',
  'Статистика базы знаний — количество по типам, использования, топ записей',
  {},
  async () => {
    try {
      const result = ops.getStats();
      return { content: [{ type: 'text', text: result }] };
    } catch (error) {
      console.error('ERROR in memory_stats:', error);
      return { content: [{ type: 'text', text: `❌ Ошибка: ${error.message}` }] };
    }
  }
);

// --- Start server ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🧠 MCP Memory Server запущен (stdio)');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
