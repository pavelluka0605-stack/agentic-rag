// =============================================================================
// Vector DB — pgvector + OpenAI embeddings
// =============================================================================

import pg from "pg";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

export class VectorDB {
  constructor({ pgUrl, openaiKey }) {
    this.pool = new pg.Pool({ connectionString: pgUrl, max: 5 });
    this.openaiKey = openaiKey;
  }

  // ── Embedding via OpenAI ──────────────────────────────────────────────────

  async embed(text) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI embeddings error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return data.data[0].embedding;
  }

  // ── Вектор → pgvector строка ──────────────────────────────────────────────

  _vecStr(vec) {
    return `[${vec.join(",")}]`;
  }

  // ── Store ─────────────────────────────────────────────────────────────────

  async store({ content, layer, metadata = {} }) {
    const embedding = await this.embed(content);
    const res = await this.pool.query(
      `INSERT INTO embeddings (content, embedding, layer, metadata)
       VALUES ($1, $2::vector, $3, $4)
       RETURNING id, layer, created_at`,
      [content, this._vecStr(embedding), layer, JSON.stringify(metadata)]
    );
    return res.rows[0];
  }

  // ── Search (cosine similarity) ────────────────────────────────────────────

  async search({ query, limit = 5, layer = null, threshold = 0.3 }) {
    const embedding = await this.embed(query);
    const vecStr = this._vecStr(embedding);

    let sql = `
      SELECT id, content, layer, metadata,
             1 - (embedding <=> $1::vector) AS similarity,
             created_at
      FROM embeddings
      WHERE 1 - (embedding <=> $1::vector) >= $2
    `;
    const params = [vecStr, threshold];

    if (layer) {
      sql += ` AND layer = $3`;
      params.push(layer);
    }

    sql += ` ORDER BY embedding <=> $1::vector LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async remove(id) {
    const res = await this.pool.query(
      "DELETE FROM embeddings WHERE id = $1 RETURNING id",
      [id]
    );
    return res.rows[0] || null;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async stats() {
    const res = await this.pool.query(`
      SELECT layer, COUNT(*) AS count
      FROM embeddings
      GROUP BY layer
      ORDER BY count DESC
    `);
    const total = await this.pool.query("SELECT COUNT(*) AS total FROM embeddings");
    return { total: parseInt(total.rows[0].total), by_layer: res.rows };
  }

  // ── Health ────────────────────────────────────────────────────────────────

  async health() {
    try {
      const res = await this.pool.query("SELECT 1 AS ok");
      const ext = await this.pool.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
      );
      return {
        db: "connected",
        pgvector: ext.rows[0]?.extversion || "not installed",
      };
    } catch (e) {
      return { db: "error", error: e.message };
    }
  }

  async close() {
    await this.pool.end();
  }
}
