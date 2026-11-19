# Testing the bot orchestration + shared memory

## Key architecture fact

There is **no shared memory across bots**. Each bot has its own memory
(files it writes, listed under Settings → Memory). The shared state in
this pipeline is **GitHub itself** — issues, labels, PR bodies, and
comments are the message bus. Optionally, grant Builder access to Scout
(Scout's settings → "What it can access" → Your Bots) so Builder can
read Scout's research conversation, but GitHub remains the durable handoff.

So "testing shared memory" means two different things:

1. **Per-bot memory** — does each bot remember across its own sessions?
   (e.g., Scout must not re-file already-filed pain points.)
2. **Cross-bot state** — do the GitHub handoffs work?
   (issue → `ready` → PR → review → merge.)

## Phase 0 — Access smoke tests (do first, ~10 min in each bot's chat)

Before any automation, send each bot one message:

- **Scout**: "Verify your access: run `gh issue list --repo revanthpobala/pinescript-vscode-extension` and load one reddit.com/r/pinescript page. Report what worked."
- **Builder**: "Verify your access: clone the repo, run `cd pine-script-extension/server && npm run build && node out/test/test_runner.js`. Report pass/fail counts." — this also validates the environment.yaml blueprint.
- **Reviewer**: "Verify your access: run `gh pr list --repo revanthpobala/pinescript-vscode-extension` and summarize open PRs."

Pass = each reports real data, not permission errors. Check the child
session transcripts to confirm commands actually ran.

## Phase 1 — Unit-test each bot (manually triggered, no automations yet)

### Scout — mini-sweep
- Prompt: "Do a 15-minute sweep of r/pinescript only. File at most 1 issue."
- Verify: issue has `from-research` label, body follows template, and
  **every URL/quote is real** (click them). Check the session transcript
  shows it ran `gh issue list --search` dedupe checks first.
- Fail mode to watch: fabricated sources, issues with no evidence.

### Builder — seeded issue
- Seed already exists: issue #8 (`ready` + `bug`) — a real one-line
  schema/doc fix. Prompt: "Pick up the open `ready` issue and implement it."
- Verify: it comments on #8, adds/edits a cases.json case FIRST (TDD),
  test runner passes in its transcript, PR links "Closes #8", branch
  named `bot/8-*`, QA checklist in PR body.
- Fail mode to watch: claims tests pass without running them (check
  transcript), no new test case, scope creep.

### Reviewer — adversarial PR (the important test)
- Open a **deliberately flawed draft PR** yourself: e.g., add a
  diagnostic in analyzer.ts that reports an error on identifiers inside
  ERROR nodes — a clear no-noise-policy violation — WITH passing tests.
- Prompt: "Review PR #N."
- Pass = it flags the false-positive risk specifically and requests
  changes. If it approves a no-noise violation, its instructions need
  tightening before it goes near real PRs.
- Also open one clean PR → expect an approve after it runs the test
  suite itself.

## Phase 2 — End-to-end handoff test (one full cycle)

1. Scout files a `from-research` issue (from Phase 1, or rerun).
2. You triage: add `ready`.
3. Tell Builder to pick it up → PR opens.
4. Confirm Reviewer is triggered (or prompt it) → review lands on the PR.
5. Tell Builder to address review comments → pushes fixes.
6. You merge.

You're testing the **seams**, not the bots:
- Was Scout's issue actionable enough that Builder didn't have to guess?
- Did Builder's PR give Reviewer enough context (linked issue, evidence)?
- Did the label conventions hold, or did bots work around them?

## Phase 3 — Memory tests

- **Scout persistence**: run the mini-sweep twice. Second run should
  produce zero/fewer duplicates. Check Settings → Memory for files it
  wrote (e.g., a sources-swept / pain-points-seen index). If it re-files
  the same themes, tell it in chat "maintain a memory file of filed
  topics and check it before filing" and rerun.
- **Reviewer persistence**: correct it once in chat ("always verify
  definitions.json signatures against the Pine v6 reference page").
  On the next review, check whether that behavior shows up unprompted
  and whether a memory file records it.
- **Cross-bot**: after granting Builder → Scout access, ask Builder
  "what did Scout's research say about <topic>?" — it should read
  Scout's conversation rather than re-researching.

## Phase 4 — Enable automations (only after 0–3 pass)

Turn on schedules one at a time, a few days apart, so a misbehaving bot
is attributable: Scout's Monday sweep first, then Reviewer's PR trigger,
then Builder's daily pickup last (it's the one that writes code).

## What to monitor ongoing

- **Needs you** queue — permission requests and PR reviews landing there.
- **ACU burn** — research sweeps can be expensive; if Scout's weekly run
  costs too much, cap its source list or issue count.
- **Memory page** — prune stale/wrong memories; bots compound errors.
- **Duplicate rate** — Scout filing dupes means memory isn't being used.
