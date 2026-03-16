// =============================================================================
// GitHub Integration Layer
// Converts GitHub events into memory entries
// =============================================================================

export class GitHubMemoryBridge {
  constructor(db) {
    this.db = db;
  }

  // ── Process webhook event ─────────────────────────────────────────────────

  processEvent(event_type, payload) {
    const handler = this.handlers[event_type];
    if (!handler) {
      return this.db.addGithubEvent({
        event_type,
        action: payload.action,
        repo: payload.repository?.full_name || "unknown",
        payload_summary: this._summarize(payload),
      });
    }
    return handler.call(this, payload);
  }

  handlers = {
    // ── Pull Request ──────────────────────────────────────────────────────

    pull_request: (payload) => {
      const repo = payload.repository?.full_name || "unknown";
      const pr = payload.pull_request;
      const action = payload.action;

      const event = this.db.addGithubEvent({
        event_type: "pull_request",
        action,
        repo,
        ref: pr.head?.ref,
        payload_summary: `PR #${pr.number}: ${pr.title}`,
      });

      // Merged PR → solution memory
      if (action === "closed" && pr.merged) {
        const solution = this.db.addSolution({
          project: repo,
          title: `PR #${pr.number}: ${pr.title}`,
          description: pr.body || pr.title,
          pattern_type: "workflow",
          verified: true,
          github_pr: pr.html_url,
          tags: JSON.stringify(pr.labels?.map(l => l.name) || []),
        });
        this.db.addGithubEvent({
          ...event,
          linked_memory_type: "solution",
          linked_memory_id: solution.id,
        });
        return { event, solution };
      }

      return { event };
    },

    // ── Issues ────────────────────────────────────────────────────────────

    issues: (payload) => {
      const repo = payload.repository?.full_name || "unknown";
      const issue = payload.issue;
      const action = payload.action;

      const event = this.db.addGithubEvent({
        event_type: "issues",
        action,
        repo,
        payload_summary: `Issue #${issue.number}: ${issue.title}`,
      });

      // New issue → incident or open loop
      if (action === "opened") {
        const isBug = issue.labels?.some(l => ["bug", "error", "incident"].includes(l.name.toLowerCase()));

        if (isBug) {
          const incident = this.db.addIncident({
            project: repo,
            error_message: issue.title,
            context: issue.body,
            github_issue: issue.html_url,
          });
          return { event, incident };
        } else {
          const episode = this.db.addEpisode({
            project: repo,
            summary: `Issue opened: ${issue.title}`,
            open_loops: JSON.stringify([{ issue: issue.number, title: issue.title, url: issue.html_url }]),
          });
          return { event, episode };
        }
      }

      // Closed issue → resolve open loop
      if (action === "closed") {
        const episode = this.db.addEpisode({
          project: repo,
          summary: `Issue closed: #${issue.number} ${issue.title}`,
          what_done: `Resolved issue #${issue.number}`,
        });
        return { event, episode };
      }

      return { event };
    },

    // ── Workflow Run ──────────────────────────────────────────────────────

    workflow_run: (payload) => {
      const repo = payload.repository?.full_name || "unknown";
      const run = payload.workflow_run;
      const action = payload.action;

      const event = this.db.addGithubEvent({
        event_type: "workflow_run",
        action,
        repo,
        ref: run.head_branch,
        payload_summary: `${run.name}: ${run.conclusion || run.status}`,
      });

      if (action === "completed") {
        if (run.conclusion === "failure") {
          // Failed workflow → incident
          const incident = this.db.addIncident({
            project: repo,
            service: run.name,
            error_message: `Workflow "${run.name}" failed on ${run.head_branch}`,
            context: `Run #${run.run_number}, commit: ${run.head_sha?.slice(0, 8)}`,
            failed_command: `gh run view ${run.id}`,
          });
          return { event, incident };
        }

        if (run.conclusion === "success" && run.run_attempt > 1) {
          // Success after retry → verified solution
          const solution = this.db.addSolution({
            project: repo,
            service: run.name,
            title: `Workflow "${run.name}" fixed (attempt ${run.run_attempt})`,
            description: `Succeeded after ${run.run_attempt} attempts on ${run.head_branch}`,
            pattern_type: "workflow",
            verified: true,
          });
          return { event, solution };
        }
      }

      return { event };
    },

    // ── Push ──────────────────────────────────────────────────────────────

    push: (payload) => {
      const repo = payload.repository?.full_name || "unknown";
      const commits = payload.commits || [];

      return this.db.addGithubEvent({
        event_type: "push",
        action: null,
        repo,
        ref: payload.ref,
        payload_summary: `${commits.length} commits to ${payload.ref}`,
      });
    },
  };

  _summarize(payload) {
    const parts = [];
    if (payload.action) parts.push(`action: ${payload.action}`);
    if (payload.repository?.full_name) parts.push(`repo: ${payload.repository.full_name}`);
    return parts.join(", ") || "event received";
  }
}
