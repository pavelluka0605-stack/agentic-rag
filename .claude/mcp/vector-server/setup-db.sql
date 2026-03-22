-- =============================================================================
-- Vector Memory — pgvector setup
-- Run inside PostgreSQL container: docker exec -i n8n-postgres-1 psql -U postgres < setup-db.sql
-- =============================================================================

-- Create database (run from default 'postgres' db)
SELECT 'CREATE DATABASE vector_memory'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vector_memory')\gexec

\c vector_memory

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),
    layer TEXT NOT NULL DEFAULT 'general',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cosine similarity index (IVFFlat — fast approximate search)
-- lists = ceil(sqrt(n_rows)); start with 50, rebuild when >2500 rows
CREATE INDEX IF NOT EXISTS idx_embeddings_cosine
    ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Layer filter index
CREATE INDEX IF NOT EXISTS idx_embeddings_layer ON embeddings (layer);

-- Timestamp index for pruning
CREATE INDEX IF NOT EXISTS idx_embeddings_created ON embeddings (created_at);

-- Verify
SELECT 'pgvector version: ' || extversion AS status FROM pg_extension WHERE extname = 'vector';
SELECT 'embeddings table: OK' AS status FROM information_schema.tables WHERE table_name = 'embeddings';
