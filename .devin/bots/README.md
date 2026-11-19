# Devin Bots — setup guide

Three Devin Bots own the growth loop for Pine Script Pro:

| Bot | File | Owns |
| --- | --- | --- |
| **Pine Scout** | `pine-scout.md` | Market research → sourced GitHub issues labeled `from-research` |
| **Pine Builder** | `pine-builder.md` | Implements `from-research`/`bug` issues, QA, opens PRs |
| **Pine Reviewer** | `pine-reviewer.md` | Reviews every PR + weekly codebase audit |

## How to create each bot (app.devin.ai)

1. Sidebar → **Bots** → **Create new Bot** → **Start from scratch**.
2. Name it (Pine Scout / Pine Builder / Pine Reviewer).
3. In the bot's chat, paste the **Outcome message** from its file.
4. Bot settings → **General** → **Instructions**: paste the **Instructions** block from its file.
5. Bot settings → **Connections**: grant the GitHub connection access to
   `revanthpobala/pinescript-vscode-extension` (all three bots need it).
6. Bot settings → **Automations**: ask the bot in chat to create the
   schedules listed in its file, then approve them.

## Prerequisites

- **Repo environment**: a working `environment.yaml` blueprint for
  `revanthpobala/pinescript-vscode-extension` so child sessions can
  build + run the test suite (see `environment.yaml` in this directory).
- **Labels** (create once on the repo): `from-research`, `bug`,
  `tech-debt`, `feature-request`, `ready`.
- The pipeline only works if labels are respected: Scout files issues
  as `from-research`; Builder only implements issues marked `ready`
  (or `from-research` you approve by adding `ready`); Reviewer reviews
  every PR regardless of author.

## The loop

```
Pine Scout ──(GitHub issues, label: from-research)──▶ you triage ──▶ label: ready
                                                                       │
Pine Reviewer ◀──(PR review)── Pine Builder ◀──(implements)────────────┘
     │
     └──(weekly audit → issues labeled tech-debt)
```
