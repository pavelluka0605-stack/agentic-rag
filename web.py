"""
Web UI — FastAPI + встроенный HTML.
Таймлайн шагов, golden path, поиск, экспорт — всё в браузере.
"""

import os
import tempfile
from fastapi import FastAPI, Query, UploadFile, File, Form
from fastapi.responses import HTMLResponse, PlainTextResponse
import memory_store
import retriever
import reasoning_agent
import exporter
import agents
import devops_mem
import knowledge_base
import wiki as wiki_mod

app = FastAPI(title="Agentic RAG", version="3.0")


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


@app.get("/api/category/{category}")
def api_by_category(category: str, project: str | None = None):
    return memory_store.get_by_category(category, project)


@app.get("/api/kind/{kind}")
def api_by_kind(kind: str, project: str | None = None):
    return memory_store.get_by_kind(kind, project)


@app.post("/api/devops/command")
def api_devops_command(command: str, output: str = "", status: str = "success", tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return devops_mem.save_command(command, output, status, tags=tag_list, project=project)


@app.post("/api/devops/config")
def api_devops_config(name: str, content: str, context: str = "", tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return devops_mem.save_config(name, content, context, tag_list, project)


@app.post("/api/devops/incident")
def api_devops_incident(title: str, description: str, resolution: str = "", severity: int = 3, tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return devops_mem.save_incident(title, description, resolution, severity, tag_list, project)


@app.post("/api/kb/decision")
def api_kb_decision(title: str, decision: str, reasoning: str = "", alternatives: str = "", tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return knowledge_base.save_decision(title, decision, reasoning, alternatives, tag_list, project)


@app.post("/api/kb/pattern")
def api_kb_pattern(name: str, description: str, when_to_use: str = "", example: str = "", tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return knowledge_base.save_pattern(name, description, example, when_to_use, tag_list, project)


@app.post("/api/kb/lesson")
def api_kb_lesson(title: str, what_happened: str, lesson: str, tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return knowledge_base.save_lesson(title, what_happened, lesson, tag_list, project)


@app.post("/api/wiki/note")
def api_wiki_note(title: str, content: str, tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return wiki_mod.save_note(title, content, tag_list, project)


@app.post("/api/wiki/link")
def api_wiki_link(title: str, url: str, description: str = "", tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return wiki_mod.save_link(title, url, description, tag_list, project)


@app.post("/api/wiki/snippet")
def api_wiki_snippet(title: str, code: str, language: str = "", description: str = "", tags: str = "", project: str = "default"):
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
    return wiki_mod.save_snippet(title, code, language, description, tag_list, project)


# ─── Voice / Text intake (for iOS Shortcuts → n8n → here) ────

@app.post("/api/voice/text")
def api_voice_text(
    text: str = Form(...),
    project: str = Form("default"),
    source: str = Form("voice"),
):
    """Accept already-transcribed text (from iOS Shortcuts via n8n).
    Auto-categorizes with GPT and saves to memory."""
    import json as _json
    from openai import OpenAI
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

    text = text.strip()
    if not text:
        return {"error": "Empty text"}

    # Auto-categorize
    cat_response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Categorize the voice note. Reply ONLY with JSON:
{"category":"wiki|devops|knowledge|step","kind":"note|command|config|incident|decision|pattern|lesson|howto|snippet|action","title":"short title in Russian","tags":["tag1","tag2"],"priority":0}

Rules:
- Commands, configs, deploys, incidents → devops
- Architecture decisions, patterns, lessons → knowledge
- Notes, links, how-tos, tips, ideas → wiki
- Action steps, tasks, todos → step
- priority: 0=info, 1-2=normal, 3=important, 4-5=critical"""},
            {"role": "user", "content": text},
        ],
        temperature=0,
    )
    try:
        cat = _json.loads(cat_response.choices[0].message.content)
    except (_json.JSONDecodeError, IndexError):
        cat = {"category": "wiki", "kind": "note", "title": text[:50], "tags": [], "priority": 0}

    tags = cat.get("tags", [])
    if "voice" not in tags:
        tags.append("voice")

    step = memory_store.add_step(
        action=f"{cat.get('kind', 'note')}: {cat.get('title', text[:50])}",
        result=text,
        status="success",
        context=f"voice input via {source}",
        tags=tags,
        project=project,
        source=source,
        category=cat.get("category", "wiki"),
        kind=cat.get("kind", "note"),
        priority=cat.get("priority", 0),
    )

    return {
        "ok": True,
        "id": step["id"],
        "text": text,
        "category": cat.get("category"),
        "kind": cat.get("kind"),
        "title": cat.get("title"),
        "tags": tags,
        "priority": cat.get("priority", 0),
    }


@app.post("/api/voice/text/raw")
def api_voice_text_raw(
    text: str = Form(...),
    project: str = Form("default"),
):
    """Save text as-is without GPT categorization (faster, no API cost)."""
    tags = ["voice"]
    step = memory_store.add_step(
        action=f"note: {text[:60]}",
        result=text,
        status="success",
        context="voice input (raw)",
        tags=tags,
        project=project,
        source="voice",
        category="wiki",
        kind="note",
        priority=0,
    )
    return {"ok": True, "id": step["id"], "text": text}


@app.post("/api/voice")
async def api_voice(
    audio: UploadFile = File(...),
    project: str = Form("default"),
    auto_categorize: bool = Form(True),
):
    """Voice input: record → Whisper transcribe → GPT categorize → save."""
    from openai import OpenAI
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

    # Save uploaded audio to temp file
    suffix = ".webm"
    if audio.filename:
        suffix = "." + audio.filename.rsplit(".", 1)[-1] if "." in audio.filename else ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Transcribe with Whisper
        with open(tmp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language="ru",
            )
        text = transcript.text.strip()

        if not text:
            return {"error": "Empty transcription"}

        # Auto-categorize with GPT
        if auto_categorize:
            cat_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": """Categorize the voice note. Reply ONLY with JSON:
{"category":"wiki|devops|knowledge|step","kind":"note|command|config|incident|decision|pattern|lesson|howto|snippet|action","title":"short title","tags":["tag1","tag2"],"priority":0-5}

Rules:
- Commands, configs, deploys, incidents → devops
- Architecture decisions, patterns, lessons → knowledge
- Notes, links, how-tos, tips → wiki
- Action steps, tasks → step
- priority: 0=info, 1-2=normal, 3=important, 4-5=critical"""},
                    {"role": "user", "content": text},
                ],
                temperature=0,
            )
            import json
            try:
                cat = json.loads(cat_response.choices[0].message.content)
            except (json.JSONDecodeError, IndexError):
                cat = {"category": "wiki", "kind": "note", "title": text[:50], "tags": ["voice"], "priority": 0}
        else:
            cat = {"category": "wiki", "kind": "note", "title": text[:50], "tags": ["voice"], "priority": 0}

        # Save to memory
        tags = cat.get("tags", [])
        if "voice" not in tags:
            tags.append("voice")

        step = memory_store.add_step(
            action=f"{cat.get('kind', 'note')}: {cat.get('title', text[:50])}",
            result=text,
            status="success",
            context="voice input",
            tags=tags,
            project=project,
            source="voice",
            category=cat.get("category", "wiki"),
            kind=cat.get("kind", "note"),
            priority=cat.get("priority", 0),
        )

        return {
            "id": step["id"],
            "text": text,
            "category": cat.get("category"),
            "kind": cat.get("kind"),
            "title": cat.get("title"),
            "tags": tags,
            "priority": cat.get("priority", 0),
        }
    finally:
        os.unlink(tmp_path)


@app.post("/api/voice/transcribe")
async def api_voice_transcribe(audio: UploadFile = File(...)):
    """Only transcribe, don't save — for preview."""
    from openai import OpenAI
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", ""))

    suffix = ".webm"
    if audio.filename:
        suffix = "." + audio.filename.rsplit(".", 1)[-1] if "." in audio.filename else ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await audio.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                language="ru",
            )
        return {"text": transcript.text.strip()}
    finally:
        os.unlink(tmp_path)


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
    # Steps
    for a, r, s, c, t in [
        ("npm init", "package.json создан", "success", "Начало проекта", ["setup"]),
        ("npm install react", "react@18.2.0", "success", "", ["react"]),
        ("webpack build", "config не найден", "error", "Забыли конфиг", ["webpack"]),
        ("Создал webpack.config.js", "Сборка работает", "success", "path.resolve", ["webpack"]),
    ]:
        memory_store.add_step(a, r, s, c, t)
    # DevOps
    devops_mem.save_config("nginx.conf", "worker_processes auto;", tags=["nginx"])
    devops_mem.save_command("docker compose up -d", "3 services started", tags=["docker"])
    devops_mem.save_incident("Redis OOM", "Killed by OOM", "maxmemory 512mb", severity=4, tags=["redis"])
    devops_mem.save_deploy("api", "v2.1.0", "production", notes="Rolling update")
    # Knowledge
    knowledge_base.save_decision("PostgreSQL вместо MongoDB", "PostgreSQL", reasoning="ACID, joins", tags=["db"])
    knowledge_base.save_pattern("Circuit Breaker", "Wrap external calls", when_to_use="External APIs", tags=["resilience"])
    knowledge_base.save_lesson("N+1 queries", "Page load 8s", "Use select_related", tags=["perf"])
    # Wiki
    wiki_mod.save_note("Git aliases", "co=checkout, br=branch, st=status")
    wiki_mod.save_snippet("retry", "def retry(fn, n=3): ...", language="python", tags=["utils"])
    wiki_mod.save_howto("SSL renew", "1. certbot renew\n2. nginx -t\n3. reload", tags=["ssl"])


# ─── Frontend ─────────────────────────────────────────

HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agentic RAG v3</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0d1117; color: #c9d1d9; }
  .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
  h1 { color: #58a6ff; margin-bottom: 8px; }
  .subtitle { color: #8b949e; margin-bottom: 24px; }
  .nav { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
  .nav button {
    padding: 7px 14px; border: 1px solid #30363d; border-radius: 6px;
    background: #161b22; color: #c9d1d9; cursor: pointer; font-size: 13px;
  }
  .nav button:hover { border-color: #58a6ff; color: #58a6ff; }
  .nav button.active { background: #1f6feb; border-color: #1f6feb; color: #fff; }
  .nav .sep { border-left: 1px solid #30363d; margin: 0 4px; }
  .input-bar { display: flex; gap: 8px; margin-bottom: 16px; }
  .input-bar input, .input-bar select {
    padding: 10px 14px; border: 1px solid #30363d; border-radius: 6px;
    background: #0d1117; color: #c9d1d9; font-size: 14px;
  }
  .input-bar input { flex: 1; }
  .input-bar button {
    padding: 10px 20px; border: none; border-radius: 6px;
    background: #238636; color: #fff; cursor: pointer; font-size: 14px;
  }
  .input-bar button:hover { background: #2ea043; }
  .timeline { position: relative; padding-left: 28px; }
  .timeline::before {
    content: ''; position: absolute; left: 10px; top: 0; bottom: 0;
    width: 2px; background: #30363d;
  }
  .step {
    position: relative; padding: 12px 16px; margin-bottom: 10px;
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
  .step .result { color: #8b949e; margin-top: 4px; white-space: pre-wrap; }
  .step .meta { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
  .tag {
    font-size: 11px; padding: 2px 8px; border-radius: 12px;
    background: #1f2937; color: #7ee787; border: 1px solid #30363d;
  }
  .cat-badge {
    font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600;
  }
  .cat-badge.devops { background: #1a1a2e; color: #a78bfa; }
  .cat-badge.knowledge { background: #1a2e1a; color: #34d399; }
  .cat-badge.wiki { background: #2e2a1a; color: #fbbf24; }
  .cat-badge.step { background: #1a2e2e; color: #67e8f9; }
  .status-badge { font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600; }
  .status-badge.success { background: #0d2818; color: #3fb950; }
  .status-badge.error { background: #2d1315; color: #f85149; }
  .status-badge.rollback { background: #2d2000; color: #d29922; }
  .prio { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #2d1315; color: #f85149; font-weight: 700; }
  .result-panel {
    padding: 20px; background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; white-space: pre-wrap; line-height: 1.6;
    max-height: 600px; overflow-y: auto;
  }
  .stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat-card {
    padding: 10px 16px; background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; text-align: center; min-width: 80px;
  }
  .stat-card .num { font-size: 24px; font-weight: 700; color: #58a6ff; }
  .stat-card .label { font-size: 11px; color: #8b949e; }
  .loading { color: #8b949e; font-style: italic; }
  .hidden { display: none; }
  .context-text { color: #6e7681; font-size: 12px; margin-top: 4px; }

  /* Voice UI */
  .voice-area { text-align: center; padding: 30px 0; }
  .voice-btn {
    width: 120px; height: 120px; border-radius: 50%; border: 4px solid #30363d;
    background: #161b22; color: #c9d1d9; font-size: 40px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    transition: all 0.2s; -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  .voice-btn:active, .voice-btn.recording {
    background: #da3633; border-color: #da3633; transform: scale(1.1);
  }
  .voice-btn.recording { animation: pulse 1.5s infinite; }
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(218,54,51,0.6); }
    70% { box-shadow: 0 0 0 20px rgba(218,54,51,0); }
    100% { box-shadow: 0 0 0 0 rgba(218,54,51,0); }
  }
  .voice-status { margin-top: 16px; font-size: 16px; min-height: 24px; }
  .voice-timer { font-size: 32px; font-weight: 700; color: #f85149; margin-top: 8px; }
  .voice-result {
    margin-top: 20px; padding: 16px; background: #161b22; border: 1px solid #30363d;
    border-radius: 8px; text-align: left;
  }
  .voice-result .transcript { font-size: 16px; line-height: 1.6; margin-bottom: 12px; }
  .voice-result .cat-info { font-size: 13px; color: #8b949e; }
</style>
</head>
<body>
<div class="container">
  <h1>Agentic RAG v3</h1>
  <p class="subtitle">Steps + DevOps + Knowledge Base + Wiki + AI Agents</p>

  <div class="stats" id="stats"></div>

  <div class="nav">
    <button onclick="showPanel('timeline')" class="active" id="btn-timeline">All</button>
    <button onclick="showCat('step')" id="btn-steps">Steps</button>
    <button onclick="showCat('devops')" id="btn-devops">DevOps</button>
    <button onclick="showCat('knowledge')" id="btn-knowledge">Knowledge</button>
    <button onclick="showCat('wiki')" id="btn-wiki">Wiki</button>
    <div class="sep"></div>
    <button onclick="showPanel('golden')" id="btn-golden">Golden Path</button>
    <button onclick="showPanel('search')" id="btn-search">Search</button>
    <button onclick="showPanel('agents')" id="btn-agents">Agents</button>
    <button onclick="showPanel('export')" id="btn-export">Export</button>
    <button onclick="showPanel('voice')" id="btn-voice" style="background:#da3633;border-color:#da3633;color:#fff">Voice</button>
    <button onclick="loadDemo()" style="margin-left:auto;background:#1f6feb;color:#fff">Demo</button>
  </div>

  <!-- Timeline (all or filtered) -->
  <div id="panel-timeline">
    <div class="timeline" id="timeline"></div>
  </div>

  <!-- Golden Path -->
  <div id="panel-golden" class="hidden">
    <div class="input-bar">
      <input id="golden-input" placeholder="Задача (опционально)..." />
      <button onclick="runGolden()">Extract</button>
    </div>
    <div class="result-panel" id="golden-result">Press Extract...</div>
  </div>

  <!-- Search -->
  <div id="panel-search" class="hidden">
    <div class="input-bar">
      <input id="search-input" placeholder="Что ищем..." />
      <button onclick="runSearch()">Search</button>
    </div>
    <div class="result-panel" id="search-result"></div>
  </div>

  <!-- Agents -->
  <div id="panel-agents" class="hidden">
    <div class="input-bar">
      <input id="agents-input" placeholder="Задача для агентов..." />
      <button onclick="runAgents()">Chain</button>
      <button onclick="runCritic()" style="background:#d29922">Critic</button>
    </div>
    <div id="agents-result">
      <div class="result-panel" id="agents-plan" style="margin-bottom:12px"></div>
      <div class="result-panel" id="agents-critique" style="margin-bottom:12px"></div>
      <div class="result-panel" id="agents-execution"></div>
    </div>
  </div>

  <!-- Voice -->
  <div id="panel-voice" class="hidden">
    <div class="voice-area">
      <button class="voice-btn" id="voiceBtn" onclick="toggleVoice()">&#127908;</button>
      <div class="voice-timer hidden" id="voiceTimer">0:00</div>
      <div class="voice-status" id="voiceStatus">Tap to record</div>
    </div>
    <div class="voice-result hidden" id="voiceResult">
      <div class="transcript" id="voiceTranscript"></div>
      <div class="cat-info" id="voiceCatInfo"></div>
    </div>
    <div id="voiceHistory"></div>
  </div>

  <!-- Export -->
  <div id="panel-export" class="hidden">
    <div class="nav">
      <button onclick="doExport('markdown')">Markdown</button>
      <button onclick="doExport('bash')">Bash</button>
      <button onclick="doExport('checklist')">Checklist</button>
    </div>
    <div class="result-panel" id="export-result" style="margin-top:12px"></div>
  </div>
</div>

<script>
const API = '';
let currentCat = null;

async function fetchJSON(url) { return (await fetch(url)).json(); }

function renderStep(s) {
  const cat = s.category || 'step';
  const kind = s.kind ? `(${s.kind})` : '';
  const prio = (s.priority || 0) > 0 ? `<span class="prio">P${s.priority}</span>` : '';
  const ctx = s.context ? `<div class="context-text">${s.context.substring(0,200)}</div>` : '';
  return `
    <div class="step ${s.status}">
      <div class="action">#${s.id} ${s.action}</div>
      <div class="result">${s.result.substring(0,300)}</div>
      ${ctx}
      <div class="meta">
        <span class="cat-badge ${cat}">${cat}${kind}</span>
        <span class="status-badge ${s.status}">${s.status}</span>
        ${prio}
        ${(s.tags||[]).map(t => `<span class="tag">${t}</span>`).join('')}
      </div>
    </div>`;
}

async function loadStats() {
  const s = await fetchJSON(`${API}/api/stats`);
  const bs = s.by_status || {};
  const bc = s.by_category || {};
  document.getElementById('stats').innerHTML = `
    <div class="stat-card"><div class="num">${s.total}</div><div class="label">Total</div></div>
    <div class="stat-card"><div class="num" style="color:#67e8f9">${bc.step||0}</div><div class="label">Steps</div></div>
    <div class="stat-card"><div class="num" style="color:#a78bfa">${bc.devops||0}</div><div class="label">DevOps</div></div>
    <div class="stat-card"><div class="num" style="color:#34d399">${bc.knowledge||0}</div><div class="label">Knowledge</div></div>
    <div class="stat-card"><div class="num" style="color:#fbbf24">${bc.wiki||0}</div><div class="label">Wiki</div></div>
    <div class="stat-card"><div class="num" style="color:#3fb950">${bs.success||0}</div><div class="label">OK</div></div>
    <div class="stat-card"><div class="num" style="color:#f85149">${bs.error||0}</div><div class="label">Err</div></div>
  `;
}

async function loadTimeline(category) {
  const url = category ? `${API}/api/category/${category}` : `${API}/api/steps`;
  const steps = await fetchJSON(url);
  const el = document.getElementById('timeline');
  if (!steps.length) { el.innerHTML = '<p class="loading">Empty. Click "Demo" to load sample data.</p>'; return; }
  el.innerHTML = steps.map(renderStep).join('');
}

function showPanel(name) {
  currentCat = null;
  document.querySelectorAll('[id^="panel-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.remove('hidden');
  const btn = document.getElementById('btn-' + name);
  if (btn) btn.classList.add('active');
  if (name === 'timeline') loadTimeline();
}

function showCat(cat) {
  currentCat = cat;
  document.querySelectorAll('[id^="panel-"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-timeline').classList.remove('hidden');
  const btn = document.getElementById('btn-' + (cat === 'step' ? 'steps' : cat));
  if (btn) btn.classList.add('active');
  loadTimeline(cat);
}

async function loadDemo() {
  await fetch(`${API}/api/demo`, {method:'POST'});
  loadStats(); loadTimeline(currentCat);
}

async function runGolden() {
  const q = document.getElementById('golden-input').value;
  document.getElementById('golden-result').innerHTML = '<p class="loading">Analyzing...</p>';
  const r = await fetchJSON(`${API}/api/golden?query=${encodeURIComponent(q)}`);
  document.getElementById('golden-result').textContent = r.result;
}

async function runSearch() {
  const q = document.getElementById('search-input').value;
  document.getElementById('search-result').innerHTML = '<p class="loading">Searching...</p>';
  const r = await fetchJSON(`${API}/api/search?q=${encodeURIComponent(q)}`);
  document.getElementById('search-result').textContent = r.result;
}

async function runAgents() {
  const q = document.getElementById('agents-input').value;
  document.getElementById('agents-plan').innerHTML = '<p class="loading">Planner...</p>';
  document.getElementById('agents-critique').innerHTML = '';
  document.getElementById('agents-execution').innerHTML = '';
  const r = await fetchJSON(`${API}/api/agents/chain?task=${encodeURIComponent(q)}`);
  document.getElementById('agents-plan').textContent = '=== PLAN ===\\n' + r.plan;
  document.getElementById('agents-critique').textContent = '=== CRITIC ===\\n' + r.critique;
  document.getElementById('agents-execution').textContent = '=== EXECUTOR ===\\n' + r.execution;
}

async function runCritic() {
  document.getElementById('agents-plan').innerHTML = '<p class="loading">Critic...</p>';
  const r = await fetchJSON(`${API}/api/agents/critic`);
  document.getElementById('agents-plan').textContent = r.result;
}

async function doExport(fmt) {
  const text = await (await fetch(`${API}/api/export/${fmt}`)).text();
  document.getElementById('export-result').textContent = text;
}

// ─── Voice Recording ─────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let voiceTimerInterval = null;
let voiceStartTime = 0;

function toggleVoice() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopVoice();
  } else {
    startVoice();
  }
}

async function startVoice() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    // Use mp4 on iOS Safari, webm elsewhere
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
    const options = mimeType ? {mimeType} : {};
    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      sendVoice();
    };

    mediaRecorder.start();
    document.getElementById('voiceBtn').classList.add('recording');
    document.getElementById('voiceStatus').textContent = 'Recording...';
    document.getElementById('voiceResult').classList.add('hidden');

    // Timer
    voiceStartTime = Date.now();
    document.getElementById('voiceTimer').classList.remove('hidden');
    voiceTimerInterval = setInterval(() => {
      const sec = Math.floor((Date.now() - voiceStartTime) / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      document.getElementById('voiceTimer').textContent = m + ':' + String(s).padStart(2, '0');
    }, 200);
  } catch (err) {
    document.getElementById('voiceStatus').textContent = 'Microphone access denied';
  }
}

function stopVoice() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
  document.getElementById('voiceBtn').classList.remove('recording');
  clearInterval(voiceTimerInterval);
  document.getElementById('voiceTimer').classList.add('hidden');
  document.getElementById('voiceStatus').textContent = 'Transcribing...';
}

async function sendVoice() {
  const ext = (mediaRecorder && mediaRecorder.mimeType.includes('mp4')) ? 'mp4' : 'webm';
  const blob = new Blob(audioChunks, {type: mediaRecorder ? mediaRecorder.mimeType : 'audio/webm'});
  const formData = new FormData();
  formData.append('audio', blob, 'voice.' + ext);
  formData.append('project', 'default');
  formData.append('auto_categorize', 'true');

  try {
    const res = await fetch(`${API}/api/voice`, {method: 'POST', body: formData});
    const data = await res.json();

    if (data.error) {
      document.getElementById('voiceStatus').textContent = 'Error: ' + data.error;
      return;
    }

    document.getElementById('voiceStatus').textContent = 'Saved! #' + data.id;
    document.getElementById('voiceResult').classList.remove('hidden');
    document.getElementById('voiceTranscript').textContent = data.text;
    document.getElementById('voiceCatInfo').innerHTML =
      `<span class="cat-badge ${data.category}">${data.category}(${data.kind})</span> ` +
      (data.tags||[]).map(t => `<span class="tag">${t}</span>`).join(' ') +
      (data.priority > 0 ? ` <span class="prio">P${data.priority}</span>` : '');

    loadStats();
    loadTimeline(currentCat);
  } catch (err) {
    document.getElementById('voiceStatus').textContent = 'Network error';
  }
}

loadStats(); loadTimeline();
</script>
</body>
</html>"""


@app.get("/", response_class=HTMLResponse)
def index():
    return HTML
