import { initDatabase } from './database.js';
import { MemoryOperations } from './operations.js';
import fs from 'fs';

const tmpPath = `/tmp/mcp-memory-test-${Date.now()}.db`;
let passed = 0;
let failed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log('🧪 Запуск тестов MCP Memory Server...\n');

const db = initDatabase(tmpPath);
const ops = new MemoryOperations(db);

// Test 1: saveMemory
let savedId1;
test('saveMemory: сохранение воспоминания', () => {
  const result = ops.saveMemory({
    type: 'lesson',
    title: 'Test lesson',
    content: 'This is a test lesson about API rate limits',
    tags: 'test, api',
    project: 'test-project',
    importance: 7,
  });
  assert(result.includes('#'), 'Should contain ID');
  assert(result.includes('lesson'), 'Should contain type');
  savedId1 = parseInt(result.match(/#(\d+)/)[1]);
});

// Test 2: saveMemory with different type and project
let savedId2;
test('saveMemory: сохранение с другим проектом', () => {
  const result = ops.saveMemory({
    type: 'pattern',
    title: 'Retry pattern',
    content: 'Exponential backoff for external API calls',
    tags: 'pattern, retry',
    project: 'other-project',
    importance: 6,
  });
  assert(result.includes('#'), 'Should contain ID');
  savedId2 = parseInt(result.match(/#(\d+)/)[1]);
});

// Test 3: searchMemory
test('searchMemory: полнотекстовый поиск', () => {
  const result = ops.searchMemory('rate limits', null, null, 10);
  assert(result.includes('Test lesson') || result.includes('rate'), 'Should find the test lesson');
});

// Test 4: searchMemory with project filter
test('searchMemory: фильтр по проекту', () => {
  const result = ops.searchMemory('pattern', null, 'other-project', 10);
  assert(!result.includes('test-project'), 'Should not include other project');
});

// Test 5: getContext
test('getContext: загрузка контекста', () => {
  const result = ops.getContext('API integration task', 'test-project');
  assert(result.length > 0, 'Should return non-empty context');
  assert(result.includes('КОНТЕКСТ'), 'Should have context header');
});

// Test 6: findSimilar
test('findSimilar: поиск похожих', () => {
  const result = ops.findSimilar('API rate limit handling');
  assert(typeof result === 'string', 'Should return string');
});

// Test 7: startSession
let sessionId;
test('startSession: начало сессии', () => {
  const result = ops.startSession('Test session', 'test-project');
  assert(result.includes('#'), 'Should contain session ID');
  sessionId = parseInt(result.match(/#(\d+)/)[1]);
});

// Test 8: endSession
test('endSession: завершение сессии', () => {
  const result = ops.endSession({
    session_id: sessionId,
    summary: 'Test completed',
    problems: 'None',
    next_steps: 'Continue testing',
  });
  assert(result.includes('завершена'), 'Should confirm completion');
});

// Test 9: startSession auto-abandon
test('startSession: автозакрытие предыдущей', () => {
  const result1 = ops.startSession('Session A', 'test-project');
  const id1 = parseInt(result1.match(/#(\d+)/)[1]);
  const result2 = ops.startSession('Session B', 'test-project');
  // Check that session A is now abandoned
  const session = db.prepare('SELECT status FROM sessions WHERE id = ?').get(id1);
  assert(session.status === 'abandoned', `Previous session should be abandoned, got: ${session.status}`);
  // End session B
  ops.endSession({ session_id: parseInt(result2.match(/#(\d+)/)[1]), summary: 'Done' });
});

// Test 10: updateMemory importance
test('updateMemory: обновление важности', () => {
  const result = ops.updateMemory(savedId1, { importance: 9 });
  assert(result.includes('обновлено'), 'Should confirm update');
  const mem = db.prepare('SELECT importance FROM memories WHERE id = ?').get(savedId1);
  assert(mem.importance === 9, `Importance should be 9, got: ${mem.importance}`);
});

// Test 11: updateMemory outdated
test('updateMemory: пометка устаревшим', () => {
  const result = ops.updateMemory(savedId2, {
    status: 'outdated',
    outdated_reason: 'Replaced by new approach',
  });
  assert(result.includes('обновлено'), 'Should confirm update');
  const mem = db.prepare('SELECT content, status FROM memories WHERE id = ?').get(savedId2);
  assert(mem.status === 'outdated', 'Status should be outdated');
  assert(mem.content.includes('УСТАРЕЛО'), 'Content should include outdated reason');
});

// Test 12: getStats
test('getStats: статистика', () => {
  const result = ops.getStats();
  assert(result.includes('СТАТИСТИКА'), 'Should contain stats header');
  assert(result.includes('lesson'), 'Should list lesson type');
});

// Test 13: FTS5 fallback with special chars
test('searchMemory: FTS5 fallback при спецсимволах', () => {
  const result = ops.searchMemory('"quotes" AND (parentheses)', null, null, 10);
  assert(typeof result === 'string', 'Should not crash on special characters');
});

// Test 14: Russian text search
test('searchMemory: поиск на русском', () => {
  ops.saveMemory({
    type: 'note',
    title: 'Тестовая заметка на русском',
    content: 'Проверка поиска по русскому тексту в базе знаний',
    tags: 'тест, русский',
    project: 'test-project',
    importance: 5,
  });
  const result = ops.searchMemory('русский текст', null, null, 10);
  assert(result.includes('русском') || result.includes('русский'), 'Should find Russian text');
});

// Cleanup
db.close();
try { fs.unlinkSync(tmpPath); } catch {}
try { fs.unlinkSync(tmpPath + '-wal'); } catch {}
try { fs.unlinkSync(tmpPath + '-shm'); } catch {}

console.log(`\nПройдено ${passed}/${total} тестов`);
process.exit(failed > 0 ? 1 : 0);
