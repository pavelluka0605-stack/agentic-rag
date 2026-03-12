import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.MEMORY_DB_PATH || '/opt/mcp-memory/data/memory.db';
const BACKUP_DIR = process.env.MEMORY_BACKUP_DIR || '/opt/mcp-memory/backups';
const MAX_BACKUPS = parseInt(process.env.MAX_BACKUPS || '30', 10);

if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Файл БД не найден: ${DB_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, '');
const backupName = `memory-${timestamp}.db`;
const backupPath = path.join(BACKUP_DIR, backupName);

fs.copyFileSync(DB_PATH, backupPath);

// Copy WAL file if exists
const walPath = DB_PATH + '-wal';
if (fs.existsSync(walPath)) {
  fs.copyFileSync(walPath, backupPath + '-wal');
}

console.log(`✅ Бекап создан: ${backupPath}`);

// Rotation
const backups = fs.readdirSync(BACKUP_DIR)
  .filter(f => f.endsWith('.db') && f.startsWith('memory-'))
  .sort();

if (backups.length > MAX_BACKUPS) {
  const toDelete = backups.slice(0, backups.length - MAX_BACKUPS);
  for (const f of toDelete) {
    const fp = path.join(BACKUP_DIR, f);
    fs.unlinkSync(fp);
    // Also remove WAL if exists
    const walFp = fp + '-wal';
    if (fs.existsSync(walFp)) fs.unlinkSync(walFp);
  }
  console.log(`🗑️ Удалено старых бекапов: ${toDelete.length}`);
}

const remaining = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.db') && f.startsWith('memory-'));
console.log(`📊 Всего бекапов: ${remaining.length}`);
