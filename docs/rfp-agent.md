# RDRA — Recreation Dallas RFP Agent

A design for a two-stage RFP response agent for Recreation Dallas, modeled on
Levata's LENORA pattern but built on the Claude + Google Drive MCP + Teamwork
MCP stack.

## Goal

Cut the time from "RFP arrives" to "first reviewable draft" from days to
hours, while keeping a human-in-the-loop checkpoint at every stage. Past
winning RFP responses are the knowledge base — the agent grounds every answer
in what Recreation Dallas has already said and won with.

## Architecture at a glance

```
┌─────────────────┐   ┌────────────────────┐   ┌──────────────────────┐
│ Teamwork        │   │ Claude (Agent SDK) │   │ Google Drive          │
│  • RFP project  │◄─►│  • RDRA 1.0 intake │◄─►│  • RFP source files   │
│  • Tasks/owners │   │  • RDRA 2.0 draft  │   │  • Past responses (KB)│
│  • Comments     │   │                    │   │  • Generated drafts   │
└─────────────────┘   └────────────────────┘   └──────────────────────┘
        ▲                       │                        ▲
        └───── notifications ───┴──── new docs linked ───┘
```

Two MCP servers do all the I/O:

- **Teamwork MCP** — read RFP task + metadata, post comments, assign reviewers,
  attach links to generated docs, move tasks between stages.
- **Google Drive MCP** — read the source RFP, search the "win library" of past
  responses, create new Docs in the project folder, set sharing permissions.

Claude is the orchestration layer. Each agent run is a stateless invocation
that reads context from Teamwork + Drive, does the work, writes results back,
and notifies humans.

## Stage 1 — RDRA 1.0: Intake & clarifying questions

**Trigger:** new task in the "RFP Intake" Teamwork tasklist, with the RFP PDF
attached or linked in a Drive folder.

**Flow:**

1. Teamwork MCP: read the task, its description, attached files, and the
   linked Drive folder ID.
2. Drive MCP: download the RFP source document(s).
3. Claude analyzes the RFP:
   - Extracts scope, deadlines, evaluation criteria, mandatory sections,
     page/word limits.
   - Cross-references the win library (see below) for similar past RFPs.
   - Identifies gaps — what does Recreation Dallas need to decide or gather
     before drafting can start? (pricing assumptions, staffing model,
     subcontractor commitments, references to cite, etc.)
4. Drive MCP: create `RFP-{name}-Intake-Questions.docx` in the project folder
   with the structured question list, due dates, and suggested owners.
5. Teamwork MCP:
   - Attach the new doc URL to the task.
   - Post a comment summarizing the RFP (one paragraph) and linking the
     questions doc.
   - Move the task to "Awaiting Answers" and assign to the RFP lead.

**Human checkpoint:** the RFP lead fills in answers in the Doc and marks the
task ready for drafting.

## Stage 2 — RDRA 2.0: First draft

**Trigger:** the intake task transitions to "Ready to Draft" (or a button /
comment-mention like `@rdra draft`).

**Flow:**

1. Teamwork MCP: pull the task, its linked intake questions doc, and the
   project folder ID.
2. Drive MCP: read the answered questions doc + the original RFP.
3. Claude drafts each section of the response:
   - For every section, retrieves the top-N most relevant excerpts from the
     win library (see retrieval section below).
   - Drafts in Recreation Dallas's voice, citing past-response provenance in
     comments so reviewers can verify.
   - Flags any section where the knowledge base had no good precedent — these
     get a `[NEEDS SME INPUT]` marker instead of a guess.
4. Drive MCP: create `RFP-{name}-Draft-v1.docx` in the project folder.
5. Teamwork MCP: attach the draft URL, post a comment with a section-by-section
   confidence summary, assign reviewers.

**Human checkpoint:** SMEs review, edit, and either approve or send back with
comments. (A future RDRA 3.0 could ingest review comments and produce v2.)

## Knowledge base: the win library

This is the piece that makes the output usable instead of generic.

**Source:** a Google Drive folder (e.g. `Recreation Dallas / RFPs / Won/`)
containing past winning responses, organized by year and RFP type
(programming, facility management, capital, grants, etc.).

**Indexing options, in order of effort:**

1. **MVP — direct retrieval via Drive MCP search.** Have the agent issue
   targeted Drive searches per RFP section ("staffing model youth programming",
   "safety plan aquatics", etc.) and read the top hits inline. Zero infra,
   works on day one, but search quality depends on filenames + Drive's
   built-in indexing.
2. **Better — pre-built embeddings index.** A nightly job chunks every doc in
   the win library, embeds it (Voyage or OpenAI embeddings), and stores
   vectors in a small SQLite/Turso or pgvector instance. The agent retrieves
   by semantic similarity instead of keyword. Adds one moving part but
   dramatically improves relevance.
3. **Best — curated Q&A pairs.** Extract the question-answer structure from
   past RFPs into a structured store (Google Sheet or DB). Each entry has the
   question, the canonical answer, the RFP it came from, and the outcome.
   The agent retrieves whole answers and adapts them. Highest upfront work,
   highest output quality.

Recommend starting at level 1 to validate the workflow end-to-end, then moving
to level 2 once there's evidence the agent is being used regularly.

## Human-in-the-loop, by design

Every stage ends at a Teamwork task assignment, not a "done." The agent never
sends anything externally, never marks an RFP submitted, and never overwrites
a human-edited document — it always creates a new versioned file
(`-v1.docx`, `-v2.docx`).

## Build options

**Option A — Claude Agent SDK (recommended for a v1).**
A small Python or TypeScript service that runs the two agents. Triggers come
from Teamwork webhooks (RFP intake, status change) hitting an endpoint. Both
MCPs are configured in the agent definition. Cheap to host (Fly.io, Render,
or a single Cloud Run service). Full control over prompts, model choice, and
logging.

**Option B — Copilot Studio equivalent (Levata's path).**
Use a no-code agent platform that natively speaks MCP. Faster to stand up if
the team already lives in Microsoft 365, but Recreation Dallas is on Google
Workspace, so the natural equivalent is something like Glean Agents, or
keeping it Claude-native via the Claude apps surface.

**Recommendation:** Option A. The Recreation Dallas stack is already
Google-centric; introducing Copilot Studio would add a Microsoft tenant for
no real gain. The Agent SDK route is also what makes the "win library"
indexing pluggable later.

## Open questions before building

1. Where do RFPs arrive today (email inbox, portal, manual upload)? That
   determines whether intake can be fully automated or starts with a human
   pasting into Teamwork.
2. How is the win library currently organized in Drive? If it's a flat dump,
   we'll want a one-time tagging pass before indexing.
3. Which Teamwork projects/tasklists should the agent watch? Need a scoped
   API token rather than full-workspace access.
4. Who is the default reviewer for each RFP category? Maps to assignment
   logic in stage 1.
5. Are there RFPs (e.g. sealed bids) where AI-assisted drafting is
   contractually disallowed? Need an opt-out flag on the Teamwork task.

## Suggested next steps

1. Inventory the win library — one afternoon with the RFP lead to confirm
   scope and organization.
2. Stand up a throwaway Agent SDK script that does only the read half of
   stage 1: pull a Teamwork task, read the linked RFP, print a summary +
   question list to the terminal. Proves the MCP wiring before anything is
   written back.
3. Add the Drive write + Teamwork comment to close the loop on stage 1.
4. Ship to one real RFP with the RFP lead watching, iterate on prompts.
5. Build stage 2 once stage 1 has been used on three real RFPs.
