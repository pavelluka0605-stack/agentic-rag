export class MemoryOperations {
  constructor(db) {
    this.db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this.stmts = {
      insertMemory: this.db.prepare(`
        INSERT INTO memories (type, title, content, tags, project, importance, related_files)
        VALUES (@type, @title, @content, @tags, @project, @importance, @related_files)
      `),

      searchFTS: this.db.prepare(`
        SELECT m.* FROM memories_fts f
        JOIN memories m ON m.id = f.rowid
        WHERE memories_fts MATCH @query AND m.status = 'active'
        ORDER BY rank
        LIMIT @limit
      `),

      searchFTSByType: this.db.prepare(`
        SELECT m.* FROM memories_fts f
        JOIN memories m ON m.id = f.rowid
        WHERE memories_fts MATCH @query AND m.status = 'active' AND m.type = @type
        ORDER BY rank
        LIMIT @limit
      `),

      searchFTSByProject: this.db.prepare(`
        SELECT m.* FROM memories_fts f
        JOIN memories m ON m.id = f.rowid
        WHERE memories_fts MATCH @query AND m.status = 'active' AND m.project = @project
        ORDER BY rank
        LIMIT @limit
      `),

      searchFTSByTypeAndProject: this.db.prepare(`
        SELECT m.* FROM memories_fts f
        JOIN memories m ON m.id = f.rowid
        WHERE memories_fts MATCH @query AND m.status = 'active' AND m.type = @type AND m.project = @project
        ORDER BY rank
        LIMIT @limit
      `),

      searchLike: this.db.prepare(`
        SELECT * FROM memories
        WHERE status = 'active' AND (title LIKE @query OR content LIKE @query)
        ORDER BY importance DESC
        LIMIT @limit
      `),

      searchLikeByType: this.db.prepare(`
        SELECT * FROM memories
        WHERE status = 'active' AND type = @type AND (title LIKE @query OR content LIKE @query)
        ORDER BY importance DESC
        LIMIT @limit
      `),

      searchLikeByProject: this.db.prepare(`
        SELECT * FROM memories
        WHERE status = 'active' AND project = @project AND (title LIKE @query OR content LIKE @query)
        ORDER BY importance DESC
        LIMIT @limit
      `),

      searchLikeByTypeAndProject: this.db.prepare(`
        SELECT * FROM memories
        WHERE status = 'active' AND type = @type AND project = @project AND (title LIKE @query OR content LIKE @query)
        ORDER BY importance DESC
        LIMIT @limit
      `),

      incrementUsed: this.db.prepare(`
        UPDATE memories SET times_used = times_used + 1, last_used_at = datetime('now') WHERE id = @id
      `),

      getRecentLessons: this.db.prepare(`
        SELECT * FROM memories WHERE type = 'lesson' AND status = 'active'
        ORDER BY importance DESC LIMIT @limit
      `),

      getRecentLessonsByProject: this.db.prepare(`
        SELECT * FROM memories WHERE type = 'lesson' AND status = 'active' AND project = @project
        ORDER BY importance DESC LIMIT @limit
      `),

      getTopPatterns: this.db.prepare(`
        SELECT * FROM memories WHERE type = 'pattern' AND status = 'active'
        ORDER BY times_used DESC LIMIT @limit
      `),

      getTopPatternsByProject: this.db.prepare(`
        SELECT * FROM memories WHERE type = 'pattern' AND status = 'active' AND project = @project
        ORDER BY times_used DESC LIMIT @limit
      `),

      getActiveSession: this.db.prepare(`
        SELECT * FROM sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 1
      `),

      getRecentSessions: this.db.prepare(`
        SELECT * FROM sessions ORDER BY started_at DESC LIMIT @limit
      `),

      getRecentSessionsByProject: this.db.prepare(`
        SELECT * FROM sessions WHERE project = @project ORDER BY started_at DESC LIMIT @limit
      `),

      abandonSession: this.db.prepare(`
        UPDATE sessions SET status = 'abandoned', ended_at = datetime('now') WHERE status = 'active'
      `),

      insertSession: this.db.prepare(`
        INSERT INTO sessions (goal, project) VALUES (@goal, @project)
      `),

      endSession: this.db.prepare(`
        UPDATE sessions SET
          summary = @summary,
          problems = @problems,
          next_steps = @next_steps,
          files_changed = @files_changed,
          memories_created = @memories_created,
          status = 'completed',
          ended_at = datetime('now')
        WHERE id = @id
      `),

      getMemoryById: this.db.prepare(`SELECT * FROM memories WHERE id = @id`),

      getSessionById: this.db.prepare(`SELECT * FROM sessions WHERE id = @id`),

      statsByType: this.db.prepare(`
        SELECT type, COUNT(*) as count, ROUND(AVG(importance), 1) as avg_importance, SUM(times_used) as total_used
        FROM memories WHERE status = 'active'
        GROUP BY type ORDER BY count DESC
      `),

      statsTotals: this.db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM memories WHERE status = 'active') as active,
          (SELECT COUNT(*) FROM memories WHERE status = 'outdated') as outdated,
          (SELECT COUNT(*) FROM memories WHERE status = 'archived') as archived,
          (SELECT COUNT(*) FROM sessions) as total_sessions,
          (SELECT COUNT(*) FROM sessions WHERE status = 'completed') as completed_sessions,
          (SELECT COUNT(*) FROM sessions WHERE status = 'abandoned') as abandoned_sessions
      `),

      topUsed: this.db.prepare(`
        SELECT id, title, times_used, type FROM memories
        WHERE status = 'active' ORDER BY times_used DESC LIMIT 10
      `),

      searchSessionsLike: this.db.prepare(`
        SELECT * FROM sessions
        WHERE goal LIKE @query OR summary LIKE @query
        ORDER BY started_at DESC LIMIT @limit
      `),

      searchErrorsLike: this.db.prepare(`
        SELECT * FROM memories
        WHERE type IN ('lesson', 'error_fix') AND status = 'active'
        AND (content LIKE @query OR tags LIKE @query OR title LIKE @query)
        ORDER BY importance DESC LIMIT @limit
      `),
    };
  }

  saveMemory(params) {
    const tags = Array.isArray(params.tags) ? params.tags.join(', ') : (params.tags || '');
    const relatedFiles = Array.isArray(params.related_files) ? params.related_files.join(', ') : (params.related_files || '');

    const result = this.stmts.insertMemory.run({
      type: params.type,
      title: params.title,
      content: params.content,
      tags,
      project: params.project || 'default',
      importance: params.importance || 5,
      related_files: relatedFiles,
    });

    const id = result.lastInsertRowid;
    return `✅ Сохранено воспоминание #${id}\nТип: ${params.type} | Важность: ${params.importance || 5}/10\nТеги: ${tags || '(нет)'}\nПроект: ${params.project || 'default'}`;
  }

  searchMemory(query, type, project, limit) {
    const lim = Math.min(Math.max(limit || 10, 1), 50);
    let results;

    try {
      const ftsQuery = query.replace(/['"(){}[\]]/g, ' ').trim();
      if (!ftsQuery) throw new Error('empty query');

      const params = { query: ftsQuery, limit: lim };
      if (type && type !== 'all' && project && project !== 'all') {
        results = this.stmts.searchFTSByTypeAndProject.all({ ...params, type, project });
      } else if (type && type !== 'all') {
        results = this.stmts.searchFTSByType.all({ ...params, type });
      } else if (project && project !== 'all') {
        results = this.stmts.searchFTSByProject.all({ ...params, project });
      } else {
        results = this.stmts.searchFTS.all(params);
      }
    } catch {
      const likeQuery = `%${query}%`;
      const params = { query: likeQuery, limit: lim };
      if (type && type !== 'all' && project && project !== 'all') {
        results = this.stmts.searchLikeByTypeAndProject.all({ ...params, type, project });
      } else if (type && type !== 'all') {
        results = this.stmts.searchLikeByType.all({ ...params, type });
      } else if (project && project !== 'all') {
        results = this.stmts.searchLikeByProject.all({ ...params, project });
      } else {
        results = this.stmts.searchLike.all(params);
      }
    }

    for (const r of results) {
      this.stmts.incrementUsed.run({ id: r.id });
    }

    if (results.length === 0) {
      return `🔍 Ничего не найдено по запросу "${query}"`;
    }

    let text = `🔍 Найдено ${results.length} результат(ов) по запросу "${query}":\n`;
    for (const r of results) {
      text += `\n[#${r.id}] ${r.type} | ⭐${r.importance} | 📊 использовано: ${r.times_used} раз\n`;
      text += `${r.title}\n`;
      text += `${r.content.substring(0, 200)}${r.content.length > 200 ? '...' : ''}\n`;
      text += `Теги: ${r.tags || '(нет)'} | Проект: ${r.project}\n`;
      text += `Создано: ${r.created_at}\n`;
    }
    return text;
  }

  getContext(taskDescription, project) {
    // 1. Relevant memories via FTS5
    let relevant = [];
    try {
      const ftsQuery = taskDescription.replace(/['"(){}[\]]/g, ' ').trim();
      if (ftsQuery) {
        const params = { query: ftsQuery, limit: 5 };
        relevant = project && project !== 'all'
          ? this.stmts.searchFTSByProject.all({ ...params, project })
          : this.stmts.searchFTS.all(params);
      }
    } catch {
      const likeQuery = `%${taskDescription.substring(0, 50)}%`;
      const params = { query: likeQuery, limit: 5 };
      relevant = project && project !== 'all'
        ? this.stmts.searchLikeByProject.all({ ...params, project })
        : this.stmts.searchLike.all(params);
    }

    // 2. Recent lessons
    const lessons = project && project !== 'all'
      ? this.stmts.getRecentLessonsByProject.all({ project, limit: 3 })
      : this.stmts.getRecentLessons.all({ limit: 3 });

    // 3. Active session
    const activeSession = this.stmts.getActiveSession.get();

    // 4. Recent sessions
    const recentSessions = project && project !== 'all'
      ? this.stmts.getRecentSessionsByProject.all({ project, limit: 3 })
      : this.stmts.getRecentSessions.all({ limit: 3 });

    // 5. Top patterns
    const patterns = project && project !== 'all'
      ? this.stmts.getTopPatternsByProject.all({ project, limit: 3 })
      : this.stmts.getTopPatterns.all({ limit: 3 });

    // Build response
    let text = `📋 КОНТЕКСТ ДЛЯ ЗАДАЧИ: "${taskDescription}"\n`;

    if (activeSession) {
      text += `\n⚠️ НЕЗАВЕРШЁННАЯ СЕССИЯ #${activeSession.id}:\n`;
      text += `Цель: ${activeSession.goal}\n`;
      text += `Начата: ${activeSession.started_at}\n`;
      text += `→ Рекомендуется завершить или продолжить\n`;
    }

    if (relevant.length > 0) {
      text += `\n📌 РЕЛЕВАНТНЫЕ ВОСПОМИНАНИЯ (${relevant.length}):\n`;
      for (const r of relevant) {
        text += `[#${r.id}] ${r.type} | ⭐${r.importance} | ${r.title}\n`;
        text += `${r.content.substring(0, 150)}${r.content.length > 150 ? '...' : ''}\n\n`;
      }
    }

    if (lessons.length > 0) {
      text += `\n🎓 ПОСЛЕДНИЕ УРОКИ (${lessons.length}):\n`;
      for (const l of lessons) {
        text += `[#${l.id}] ⭐${l.importance} | ${l.title}\n`;
        text += `${l.content.substring(0, 150)}${l.content.length > 150 ? '...' : ''}\n\n`;
      }
    }

    if (patterns.length > 0) {
      text += `\n🔧 ПОЛЕЗНЫЕ ПАТТЕРНЫ (${patterns.length}):\n`;
      for (const p of patterns) {
        text += `[#${p.id}] 📊${p.times_used}x | ${p.title}\n`;
        text += `${p.content.substring(0, 150)}${p.content.length > 150 ? '...' : ''}\n\n`;
      }
    }

    if (recentSessions.length > 0) {
      text += `\n📅 ПОСЛЕДНИЕ СЕССИИ (${recentSessions.length}):\n`;
      for (const s of recentSessions) {
        const icon = s.status === 'completed' ? '✅' : s.status === 'abandoned' ? '⚠️' : '🔄';
        text += `[#${s.id}] ${icon} ${s.goal}`;
        if (s.summary) text += ` → ${s.summary.substring(0, 100)}`;
        text += '\n';
      }
    }

    return text;
  }

  findSimilar(taskDescription) {
    const likeQuery = `%${taskDescription.substring(0, 80)}%`;

    // Similar sessions
    const sessions = this.stmts.searchSessionsLike.all({ query: likeQuery, limit: 5 });

    // Related memories via FTS5
    let memories = [];
    try {
      const ftsQuery = taskDescription.replace(/['"(){}[\]]/g, ' ').trim();
      if (ftsQuery) {
        memories = this.stmts.searchFTS.all({ query: ftsQuery, limit: 10 });
      }
    } catch {
      memories = this.stmts.searchLike.all({ query: likeQuery, limit: 10 });
    }

    // Errors/lessons
    const keywords = taskDescription.split(/\s+/).slice(0, 5).map(w => `%${w}%`);
    let errors = [];
    for (const kw of keywords) {
      const found = this.stmts.searchErrorsLike.all({ query: kw, limit: 5 });
      for (const f of found) {
        if (!errors.find(e => e.id === f.id)) errors.push(f);
      }
    }
    errors = errors.slice(0, 5);

    // Build response
    let text = '';
    if (errors.length > 0) {
      text += `⚠️ Найдено ${errors.length} предупреждений из прошлого опыта:\n\n`;
      for (const e of errors) {
        text += `[#${e.id}] ${e.type} | ⭐${e.importance} | ${e.title}\n`;
        text += `${e.content.substring(0, 200)}...\n\n`;
      }
    } else {
      text += `✅ Похожих проблем в истории не найдено\n\n`;
    }

    if (sessions.length > 0) {
      text += `📅 Похожие сессии (${sessions.length}):\n`;
      for (const s of sessions) {
        text += `[#${s.id}] ${s.goal}\n`;
        if (s.summary) text += `  Итог: ${s.summary.substring(0, 150)}\n`;
        if (s.problems) text += `  Проблемы: ${s.problems.substring(0, 150)}\n`;
        text += '\n';
      }
    }

    if (memories.length > 0) {
      text += `📌 Связанные знания (${memories.length}):\n`;
      for (const m of memories) {
        text += `[#${m.id}] ${m.type} | ${m.title}\n`;
      }
    }

    return text;
  }

  startSession(goal, project) {
    // Abandon any active session
    this.stmts.abandonSession.run();

    const result = this.stmts.insertSession.run({
      goal,
      project: project || 'default',
    });

    const id = result.lastInsertRowid;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    return `🚀 Сессия #${id} начата\nЦель: ${goal}\nПроект: ${project || 'default'}\nВремя: ${now}\n\n💡 Совет: вызови memory_get_context для загрузки релевантного контекста`;
  }

  endSession(params) {
    const session = this.stmts.getSessionById.get({ id: params.session_id });
    if (!session) {
      return `❌ Сессия #${params.session_id} не найдена`;
    }

    this.stmts.endSession.run({
      id: params.session_id,
      summary: params.summary,
      problems: params.problems || null,
      next_steps: params.next_steps || null,
      files_changed: params.files_changed || '',
      memories_created: params.memories_created || '',
    });

    // Calculate duration
    let duration = '';
    if (session.started_at) {
      const start = new Date(session.started_at);
      const end = new Date();
      const diffMs = end - start;
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      duration = hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
    }

    let text = `✅ Сессия #${params.session_id} завершена\n`;
    if (duration) text += `Длительность: ${duration}\n`;
    text += `Итог: ${params.summary}\n`;
    if (params.next_steps) text += `Следующие шаги: ${params.next_steps}\n`;
    return text;
  }

  updateMemory(id, updates) {
    const existing = this.stmts.getMemoryById.get({ id });
    if (!existing) {
      return `❌ Воспоминание #${id} не найдено`;
    }

    let content = updates.content !== undefined ? updates.content : existing.content;

    // If marking outdated with reason, append to content
    if (updates.status === 'outdated' && updates.outdated_reason) {
      const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
      content += `\n\n[УСТАРЕЛО ${now}]: ${updates.outdated_reason}`;
    }

    const tags = updates.tags !== undefined
      ? (Array.isArray(updates.tags) ? updates.tags.join(', ') : updates.tags)
      : existing.tags;

    const stmt = this.db.prepare(`
      UPDATE memories SET
        title = @title,
        content = @content,
        tags = @tags,
        status = @status,
        importance = @importance,
        updated_at = datetime('now')
      WHERE id = @id
    `);

    stmt.run({
      id,
      title: updates.title !== undefined ? updates.title : existing.title,
      content,
      tags,
      status: updates.status !== undefined ? updates.status : existing.status,
      importance: updates.importance !== undefined ? updates.importance : existing.importance,
    });

    const changed = [];
    if (updates.title !== undefined) changed.push('title');
    if (updates.content !== undefined) changed.push('content');
    if (updates.tags !== undefined) changed.push('tags');
    if (updates.status !== undefined) changed.push(`status → ${updates.status}`);
    if (updates.importance !== undefined) changed.push(`importance → ${updates.importance}`);

    return `✅ Воспоминание #${id} обновлено\nИзменения: ${changed.join(', ') || 'content (outdated reason)'}`;
  }

  getStats() {
    const byType = this.stmts.statsByType.all();
    const totals = this.stmts.statsTotals.get();
    const top = this.stmts.topUsed.all();

    let text = '📊 СТАТИСТИКА ПАМЯТИ\n\n📝 По типам (active):\n';
    for (const t of byType) {
      text += `  ${t.type}: ${t.count} шт, средняя важность: ${t.avg_importance}, использований: ${t.total_used}\n`;
    }

    const totalMemories = totals.active + totals.outdated + totals.archived;
    text += `\n📈 Общее:\n`;
    text += `  Всего воспоминаний: ${totalMemories} (active: ${totals.active}, outdated: ${totals.outdated}, archived: ${totals.archived})\n`;
    text += `  Всего сессий: ${totals.total_sessions} (completed: ${totals.completed_sessions}, abandoned: ${totals.abandoned_sessions})\n`;

    if (top.length > 0) {
      text += `\n🏆 Топ-10 самых используемых:\n`;
      for (let i = 0; i < top.length; i++) {
        const t = top[i];
        text += `  ${i + 1}. [#${t.id}] ${t.title} (использовано ${t.times_used} раз)\n`;
      }
    }

    return text;
  }
}
