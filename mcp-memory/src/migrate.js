import { initDatabase } from './database.js';

console.log('🔧 Запуск миграции базы данных...');

const dbPath = process.env.MEMORY_DB_PATH || '/opt/mcp-memory/data/memory.db';
const db = initDatabase(dbPath);

const memoriesCount = db.prepare('SELECT COUNT(*) as count FROM memories').get().count;
const sessionsCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;

console.log(`✅ База данных готова: ${dbPath}`);
console.log(`📊 Воспоминаний: ${memoriesCount}, Сессий: ${sessionsCount}`);

db.close();
