"""
Web UI — FastAPI + встроенный HTML.
Таймлайн шагов, golden path, поиск, экспорт — всё в браузере.
"""

from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse, PlainTextResponse
import memory_store
import retriever
import reasoning_agent
import exporter
import agents

app = FastAPI(title="Agentic RAG", version="2.0")


# ─── API ──────────────────────────────────────────────

@app.get("/api/steps")
def api_steps(project: str | None = None):
    return memory_store.get_all(project)


@app.get("/api/stats")
def api_stats(project: str | None = None):
    return memory_store.stats(project)


@app.get("/api/projects")
def api_projects():
    return memory_store.list_projects()


@app.post("/api/remember")
def api_remember(
    action: str,
    result: str,
    status: str = "success",
    context: str = "",
    tags: str = "",
    project: str = "default",
):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return memory_store.add_step(action, result, status, context, tag_list, project)


@app.get("/api/golden")
def api_golden(query: str = "", project: str | None = None):
    if project:
        steps = memory_store.get_all(project)
    else:
        steps = memory_store.get_all()
    if not steps:
        return {"result": "No steps in memory."}
    if query:
        steps = retriever.search(query, steps, top_k=30)
    result = reasoning_agent.extract_golden_path(steps, task_description=query)
    return {"result": result}


@app.get("/api/search")
def api_search(q: str, project: str | None = None):
    steps = memory_store.get_all(project)
    if not steps:
        return {"result": "No steps in memory."}
    relevant = retriever.search(q, steps, top_k=20)
    if not relevant:
        return {"result": f"Nothing found for: {q}"}
    result = reasoning_agent.smart_search(relevant, q)
    return {"result": result}


@app.get("/api/analyze")
def api_analyze(q: str, project: str | None = None):
    steps = memory_store.get_all(project)
    if not steps:
        return {"result": "No steps in memory."}
    relevant = retriever.search(q, steps, top_k=20)
    if not relevant:
        relevant = steps[-20:]
    result = reasoning_agent.analyze(relevant, q)
    return {"result": result}


@app.get("/api/agents/chain")
def api_agent_chain(task: str, project: str | None = None):
    steps = memory_store.get_all(project)
    if not steps:
        return {"error": "No steps in memory."}
    return agents.run_full_chain(steps, task)


@app.get("/api/agents/critic")
def api_agent_critic(project: str | None = None):
    steps = memory_store.get_all(project)
    if not steps:
        return {"result": "No steps."}
    return {"result": agents.run_critic(steps)}


@app.get("/api/export/markdown")
def api_export_md(query: str = "", project: str | None = None):
    steps = memory_store.get_all(project)
    if not steps:
        return PlainTextResponse("No steps.")
    if query:
        steps = retriever.search(query, steps, top_k=30)
    golden = reasoning_agent.extract_golden_path(steps, query)
    md = exporter.to_markdown(golden, title=query or "Runbook")
    return PlainTextResponse(md, media_type="text/markdown")


@app.get("/api/export/bash")
def api_export_bash(project: str | None = None):
    steps = memory_store.get_all(project)
    if not steps:
        return PlainTextResponse("# No steps.")
    script = exporter.to_bash_script(steps)
    return PlainTextResponse(script, media_type="text/x-shellscript")


@app.get("/api/export/checklist")
def api_export_checklist(project: str | None = None):
    steps = memory_store.get_all(project)
    if not steps:
        return PlainTextResponse("No steps.")
    return PlainTextResponse(exporter.to_checklist(steps), media_type="text/markdown")


@app.delete("/api/clear")
def api_clear(project: str | None = None):
    memory_store.clear(project)
    return {"status": "cleared"}


@app.post("/api/demo")
def api_demo():
    _load_demo()
    return {"status": "loaded", "count": len(memory_store.get_all())}


# ─── Demo data ────────────────────────────────────────

def _load_demo():
    memory_store.clear()
    demo = [
        ("Инициализация проекта: npm init", "package.json создан", "success", "Начало проекта", ["setup"]),
        ("Установка React: npm install react", "react@18.2.0 установлен", "success", "", ["setup", "react"]),
        ("Настройка webpack", "Ошибка: webpack.config.js не найден", "error", "Забыли создать конфиг", ["setup", "webpack"]),
        ("Создание webpack.config.js вручную", "Конфиг создан, но с ошибкой в путях", "error", "Неправильный output path", ["setup", "webpack"]),
        ("Исправление путей в webpack.config.js", "Конфиг работает, сборка проходит", "success", "path.resolve(__dirname, 'dist')", ["setup", "webpack"]),
        ("Добавление TypeScript", "tsconfig.json создан", "success", "", ["setup", "typescript"]),
        ("Компиляция TS — ошибка strict mode", "Ошибки типизации в 12 файлах", "error", "strict: true слишком строгий", ["typescript"]),
        ("Откат strict mode", "Компиляция прошла", "rollback", "strictNullChecks only", ["typescript"]),
        ("Настройка ESLint", "ESLint работает", "success", "@typescript-eslint/parser", ["setup", "lint"]),
        ("Запуск тестов — Jest не видит TS", "ModuleFileExtensions error", "error", "Jest не настроен для .tsx", ["tests"]),
        ("Добавление ts-jest", "Тесты проходят", "success", "npm install ts-jest", ["tests"]),
        ("Деплой на Vercel", "Деплой успешен", "success", "vercel --prod", ["deploy"]),
        ("Настройка CI/CD", "Pipeline работает", "success", "GitHub Actions", ["ci", "deploy"]),
    ]
    for a, r, s, c, t in demo:
        memory_store.add_step(a, r, s, c, t)


# ─── Frontend ─────────────────────────────────────────

HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agentic RAG</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #c9d1d9; }
  .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
  h1 { color: #58a6ff; margin-bottom: 8px; }
  .subtitle { color: #8b949e; margin-bottom: 24px; }

  /* Nav */
  .nav { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .nav button {
    padding: 8px 16px; border: 1px solid #30363d; border-radius: 6px;
    background: #161b22; color: #c9d1d9; cursor: pointer; font-size: 14px;
  }
  .nav button:hover { border-color: #58a6ff; color: #58a6ff; }
  .nav button.active { background: #1f6feb; border-color: #1f6feb; color: #fff; }

  /* Input area */
  .input-bar {
    display: flex; gap: 8px; margin-bottom: 20px;
  }
  .input-bar input {
    flex: 1; padding: 10px 14px; border: 1px solid #30363d; border-radius: 6px;
    background: #0d1117; color: #c9d1d9; font-size: 14px;
  }
  .input-bar button {
    padding: 10px 20px; border: none; border-radius: 6px;
    background: #238636; color: #fff; cursor: pointer; font-size: 14px;
  }
  .input-bar button:hover { background: #2ea043; }

  /* Steps timeline */
  .timeline { position: relative; padding-left: 28px; }
  .timeline::before {
    content: ''; position: absolute; left: 10px; top: 0; bottom: 0;
    width: 2px; background: #30363d;
  }
  .step {
    position: relative; padding: 12px 16px; margin-bottom: 12px;
    background: #161b22; border: 1px solid #30363d; border-radius: 8px;
  }
  .step::before {
    content: ''; position: absolute; left: -23px; top: 16px;
    width: 12px; height: 12px; border-radius: 50%; border: 2px solid #30363d;
  }
  .step.success::before { background: #238636; border-color: #238636; }
  .step.error::before { background: #da3633; border-color: #da3633; }
  .step.rollback::before { background: #d29922; border-color: #d29922; }
  .step .action { font-weight: 600; color: #e6edf3; }
  .step .result { color: #8b949e; margin-top: 4px; }
  .step .meta { display: flex; gap: 8px; margin-top: 6px; }
  .step .tag {
    font-size: 11px; padding: 2px 8px; border-radius: 12px;
    background: #1f2937; color: #7ee787; border: 1px solid #30363d;
  }
  .step .status-badge {
    font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600;
  }
  .status-badge.success { background: #0d2818; color: #3fb950; }
  .status-badge.error { background: #2d1315; color: #f85149; }
  .status-badge.rollback { background: #2d2000; color: #d29922; }

  /* Result panel */
  .result-panel {
    padding: 20px; background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; white-space: pre-wrap; line-height: 1.6;
    max-height: 600px; overflow-y: auto;
  }
  .result-panel h2 { color: #58a6ff; }

  /* Stats bar */
  .stats {
    display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
  }
  .stat-card {
    padding: 12px 20px; background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; text-align: center; min-width: 100px;
  }
  .stat-card .num { font-size: 28px; font-weight: 700; color: #58a6ff; }
  .stat-card .label { font-size: 12px; color: #8b949e; }

  .loading { color: #8b949e; font-style: italic; }
  .hidden { display: none; }
</style>
</head>
<body>
<div class="container">
  <h1>Agentic RAG</h1>
  <p class="subtitle">Memory + Retrieval + Reasoning Agents</p>

  <div class="stats" id="stats"></div>

  <div class="nav">
    <button onclick="showPanel('timeline')" class="active" id="btn-timeline">Timeline</button>
    <button onclick="showPanel('golden')" id="btn-golden">Golden Path</button>
    <button onclick="showPanel('search')" id="btn-search">Search</button>
    <button onclick="showPanel('analyze')" id="btn-analyze">Analyze</button>
    <button onclick="showPanel('agents')" id="btn-agents">Agents</button>
    <button onclick="showPanel('export')" id="btn-export">Export</button>
    <button onclick="loadDemo()" style="margin-left:auto;background:#1f6feb;color:#fff">Load Demo</button>
  </div>

  <!-- Timeline -->
  <div id="panel-timeline">
    <div class="timeline" id="timeline"></div>
  </div>

  <!-- Golden Path -->
  <div id="panel-golden" class="hidden">
    <div class="input-bar">
      <input id="golden-input" placeholder="Описание задачи (опционально)..." />
      <button onclick="runGolden()">Extract Golden Path</button>
    </div>
    <div class="result-panel" id="golden-result">Press the button to extract...</div>
  </div>

  <!-- Search -->
  <div id="panel-search" class="hidden">
    <div class="input-bar">
      <input id="search-input" placeholder="Что ищем..." />
      <button onclick="runSearch()">Search</button>
    </div>
    <div class="result-panel" id="search-result"></div>
  </div>

  <!-- Analyze -->
  <div id="panel-analyze" class="hidden">
    <div class="input-bar">
      <input id="analyze-input" placeholder="Задай вопрос по памяти..." />
      <button onclick="runAnalyze()">Analyze</button>
    </div>
    <div class="result-panel" id="analyze-result"></div>
  </div>

  <!-- Agents -->
  <div id="panel-agents" class="hidden">
    <div class="input-bar">
      <input id="agents-input" placeholder="Новая задача для агентов..." />
      <button onclick="runAgents()">Run Chain</button>
      <button onclick="runCritic()" style="background:#d29922">Critic Only</button>
    </div>
    <div id="agents-result">
      <div class="result-panel" id="agents-plan" style="margin-bottom:12px"></div>
      <div class="result-panel" id="agents-critique" style="margin-bottom:12px"></div>
      <div class="result-panel" id="agents-execution"></div>
    </div>
  </div>

  <!-- Export -->
  <div id="panel-export" class="hidden">
    <div class="nav">
      <button onclick="doExport('markdown')">Markdown Runbook</button>
      <button onclick="doExport('bash')">Bash Script</button>
      <button onclick="doExport('checklist')">Checklist</button>
    </div>
    <div class="result-panel" id="export-result" style="margin-top:12px"></div>
  </div>
</div>

<script>
const API = '';

async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function loadStats() {
  const s = await fetchJSON(`${API}/api/stats`);
  const bs = s.by_status || {};
  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="num">${s.total}</div><div class="label">Total Steps</div></div>
    <div class="stat-card"><div class="num" style="color:#3fb950">${bs.success||0}</div><div class="label">Success</div></div>
    <div class="stat-card"><div class="num" style="color:#f85149">${bs.error||0}</div><div class="label">Errors</div></div>
    <div class="stat-card"><div class="num" style="color:#d29922">${bs.rollback||0}</div><div class="label">Rollbacks</div></div>
    <div class="stat-card"><div class="num">${(s.projects||[]).length}</div><div class="label">Projects</div></div>
  `;
}

async function loadTimeline() {
  const steps = await fetchJSON(`${API}/api/steps`);
  const el = document.getElementById('timeline');
  if (!steps.length) { el.innerHTML = '<p class="loading">No steps yet. Click "Load Demo" to start.</p>'; return; }
  el.innerHTML = steps.map(s => `
    <div class="step ${s.status}">
      <div class="action">#${s.id} ${s.action}</div>
      <div class="result">${s.result}</div>
      <div class="meta">
        <span class="status-badge ${s.status}">${s.status}</span>
        ${(s.tags||[]).map(t => `<span class="tag">${t}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

function showPanel(name) {
  document.querySelectorAll('[id^="panel-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.remove('hidden');
  const btn = document.getElementById('btn-' + name);
  if (btn) btn.classList.add('active');
}

async function loadDemo() {
  await fetch(`${API}/api/demo`, {method:'POST'});
  loadStats();
  loadTimeline();
}

async function runGolden() {
  const q = document.getElementById('golden-input').value;
  document.getElementById('golden-result').innerHTML = '<p class="loading">GPT-4o analyzing...</p>';
  const r = await fetchJSON(`${API}/api/golden?query=${encodeURIComponent(q)}`);
  document.getElementById('golden-result').textContent = r.result;
}

async function runSearch() {
  const q = document.getElementById('search-input').value;
  document.getElementById('search-result').innerHTML = '<p class="loading">Searching...</p>';
  const r = await fetchJSON(`${API}/api/search?q=${encodeURIComponent(q)}`);
  document.getElementById('search-result').textContent = r.result;
}

async function runAnalyze() {
  const q = document.getElementById('analyze-input').value;
  document.getElementById('analyze-result').innerHTML = '<p class="loading">Analyzing...</p>';
  const r = await fetchJSON(`${API}/api/analyze?q=${encodeURIComponent(q)}`);
  document.getElementById('analyze-result').textContent = r.result;
}

async function runAgents() {
  const q = document.getElementById('agents-input').value;
  document.getElementById('agents-plan').innerHTML = '<p class="loading">Planner working...</p>';
  document.getElementById('agents-critique').innerHTML = '';
  document.getElementById('agents-execution').innerHTML = '';
  const r = await fetchJSON(`${API}/api/agents/chain?task=${encodeURIComponent(q)}`);
  document.getElementById('agents-plan').textContent = '=== PLAN ===\\n' + r.plan;
  document.getElementById('agents-critique').textContent = '=== CRITIC ===\\n' + r.critique;
  document.getElementById('agents-execution').textContent = '=== EXECUTOR ===\\n' + r.execution;
}

async function runCritic() {
  document.getElementById('agents-plan').innerHTML = '<p class="loading">Critic reviewing...</p>';
  const r = await fetchJSON(`${API}/api/agents/critic`);
  document.getElementById('agents-plan').textContent = r.result;
}

async function doExport(fmt) {
  const res = await fetch(`${API}/api/export/${fmt}`);
  const text = await res.text();
  document.getElementById('export-result').textContent = text;
}

// Init
loadStats();
loadTimeline();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
def index():
    return HTML
