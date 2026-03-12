import { initDatabase } from './database.js';
import { MemoryOperations } from './operations.js';

const db = initDatabase(process.env.MEMORY_DB_PATH);
const ops = new MemoryOperations(db);

console.log(ops.getStats());

db.close();
