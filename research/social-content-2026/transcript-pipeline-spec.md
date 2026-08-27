# Getting transcripts flowing — diagnosis and build spec

Rev 2, 27 Aug 2026. NOTE: I have not seen the ai-content-filer source. This is a
spec against observed behaviour, not a patch against real code.

## STATUS: Notion side is done
Added to data source `387dbadf-c30a-809a-94a6-000b3054e527`:
- `Caption` (text) — verbatim post caption
- `Transcript` (text) — on-screen text and/or spoken ASR, each prefixed by source
- `Capture Status` (select) — Pending / Caption only / OCR done / Transcript done / Failed

`Capture Status` exists so the backfill is resumable. A 279-item run will hit
rate limits partway through; without it you cannot tell what still needs doing.

Text properties cap at 2000 chars. Long transcripts must go in the **page body**,
with the property holding a truncated copy for at-a-glance scanning.

## RESOLVED: the filer runs on the Recreation iMac

Verified 27 Aug by running the check on both machines.

- **Mac mini** (`robsmacmini@howe-agent`): no launchctl output AND no log output.
  `~/ai-content-filer/filer.log` does not exist there. The filer is not on this box.
  The "Howe Family MacMini Agent" Claude session on it is a home-infrastructure
  agent (`~/agents/bin/load-watch.sh`), unrelated to content filing.
- **Recreation iMac** (`recreationdallas@STERLINGs-iMac`): live `filer.log` with
  recent entries. **This is the filing host**, unchanged since 17 Jul.

No double-filing is occurring right now. The 9 historical duplicates trace to the
24 Jun migration window when the laptop instance was still running alongside.

Caveat on the check itself: the command `launchctl print ... | head -5 || echo
"NOT RUNNING HERE"` can never print its fallback, because `head` exits 0 even on
empty input so the `||` never fires. Use `launchctl list | grep -i
ai-content-filer` instead, which also shows the last exit code.

## DIAGNOSIS COMPLETE: the iMac instance is dead; a second, healthy instance is doing the work

### The iMac instance is dead, and the cause is certain
Verified 27 Aug:

    launchctl list | grep -i ai-content-filer   ->  (no output, service not loaded)
    ls -l ~/.gstack/browse-states/              ->  total 8, no instagram.json
    echo "say OK" | claude -p                   ->  OK
    claude --version                            ->  2.1.139
    filer.log last written                      ->  Aug 23 07:50

**Claude is healthy.** That eliminates usage limits and expired CLI auth, the two
leading hypotheses. The cause is the Instagram session: the state file is gone
from `~/.gstack/browse-states/`, and the log says so in plain English.

The failure chain reads straight off the error sequence:

    Could not parse a title/summary from Claude output       (Threads post)
    Instagram post is age-restricted or private              (bot account can't view)
    Instagram session is logged out - re-run the one-time login   x2
    claude exited 1:                                         x3, same URL retried

Session expired, so the browse step failed, so the claude subprocess exited 1
with no usable stderr. The same URL (DcSZ2FNDayc) was retried three times — there
is **no dead-letter handling**, so one poisoned item can block the queue.

Total health over the log's life: 363 successes, 8 failures.

### A second instance exists and is healthy
9 rows were created 24-26 Aug, after the iMac went silent. All 9 carry the
filer's exact output signature, and **all 9 have cover images attached** — versus
only 186 of 270 (69%) of older rows. Downloading an Instagram cover requires a
working Instagram session, which the iMac does not have.

So this is not a race between two filers. The iMac instance died and something
else with its own working IG session has been carrying the load since 23 Aug,
and doing a more complete job than the historical average.

That instance is not on robsmacmini or MacBook-Pro-10 (neither has the directory).
**Its host is still unidentified.**

### Why this matters for the build
Patching the iMac would be patching a corpse. The caption/OCR/ASR changes must go
on the live instance. Identifying its host is the blocking prerequisite.

Two useful side-findings for the build:
- The filer already distinguishes a "bot account" from Rob's own, so some burner
  concept already exists in the code.
- Retry-forever with no dead-letter queue is a real bug. Step 1 should add a
  failure cap and write `Capture Status = Failed` rather than looping.

## What is and is not blocking us

**Instagram is not the blocker.** The filer already drives an authenticated
browser via `~/.claude/skills/gstack/browse/dist/browse` with a saved session.
Proof it reads real logged-in data: summaries quote captions verbatim and cite
engagement only a logged-in viewer sees — "6,974 comments against only 1,540 likes".

**Blocker A — the filer discards its own raw capture.** It fetches, summarises,
writes the summary to a Notion property, drops the rest. All 280 page bodies are
blank. The caption is already being fetched and thrown away. Persistence bug.

**Blocker B — the cloud sandbox has zero egress.** Not IG-specific; example.com
also fails. Chromium and Playwright are installed here but there is no network.
A sandbox browser does not help. The Mac is the right host and already is.

## Capture all three layers — they are complementary, not alternatives

| layer | what it gives | run on |
|---|---|---|
| **Caption** | CTA, keyword, written structure | every item |
| **On-screen text** | the hook, burned into frame 1 | every item with a cover |
| **Spoken transcript** | the actual substance of the reel | **every video item** |

Earlier draft proposed gating ASR to items where OCR came back empty. That was
wrong for this use case and is withdrawn. The report needs what talking-head and
how-to reels actually *say* — the argument, the steps, the framing — not just the
hook. Run ASR on all video. OCR gives the hook; ASR gives the content; the caption
gives the conversion mechanic. The analysis needs all three.

## Build steps

### 1 — Stop discarding (30 min, unblocks everything)
Write `Caption` from the existing capture. Write the full raw capture into the
page body. Set `Capture Status = 'Caption only'`.

While the page is already open, also persist what is currently free and thrown
away: creator handle, like count, comment count, posted-at, follower count.
These cost nothing at capture time and cannot be recovered later.

### 2 — On-screen text (half a day)
The cover image is already downloaded. OCR at capture time, store into
`Transcript` prefixed `[OCR frame 1]`. Sending the image to Claude reads stylised
type better than Tesseract. Set `Capture Status = 'OCR done'`.

### 3 — Spoken transcript (1 day)
`yt-dlp` the reel → `ffmpeg` to 16 kHz mono wav → `whisper.cpp`. On Apple silicon
use `small.en` or `medium.en`; base.en drops too much on fast talking-head
delivery, which is most of this corpus. Store prefixed `[ASR]`, append below the
OCR block. Set `Capture Status = 'Transcript done'`.

Delete the wav after transcription — 279 reels of audio is real disk.

The recipe is already in Rob's own AI repo: Conrad (buildwith.conrad),
"Giving Claude Eyes: Frame-by-Frame Video Analysis Skill" — yt-dlp + FFmpeg.

### 4 — Backfill the 279
One-shot resumable script over rows where `Capture Status` is empty or 'Pending'.
Throttle hard: 5–8 s jitter, randomised order, halt immediately on any checkpoint
or challenge. Expect failures — 3 items are already permanently dead behind auth
walls or deletions. Mark those 'Failed' and move on.

Run the backfill overnight, not alongside live filing.

## Account and credentials

Use the dedicated burner account (handle `@agency.rob`) for all automated
capture. Do NOT run it on @robhowe21 — automated collection of third-party posts
is against Instagram's terms regardless of login, and the realistic penalty is a
checkpoint or action-block on the account doing the fetching. 22,146 followers
should not be the collateral on a scraping job.

**Credential handling — the password was pasted into a chat transcript, so treat
it as already exposed:**
1. Rotate it once the filer is running.
2. Store the new one in macOS Keychain, or in `~/ai-content-filer/.env` with
   `chmod 600`. `.env` is already gitignored in that project — keep it that way.
3. Never commit it. This repo pushes to GitHub; a credential in git history is
   very hard to fully remove.
4. Log into `@agency.rob` interactively once on the filing Mac, from its own IP,
   and save the session — same flow used in June:

       B=~/.claude/skills/gstack/browse/dist/browse
       $B goto "https://www.instagram.com/accounts/login/"
       $B handoff "Log into @agency.rob, then return to Terminal"
       $B resume && $B state save instagram-agency
       chmod 600 ~/.gstack/browse-states/instagram-agency.json

   Point the filer at `instagram-agency`, leaving the existing personal session
   file untouched so nothing accidentally runs as Rob.

5. Warm the account before the backfill. A brand-new account that immediately
   requests 279 posts is the single most checkpoint-prone thing you can do. Give
   it a profile photo, a few follows, and a couple of days of light manual use.

## The sanctioned alternative, and why it is only partial
IG Graph API `business_discovery` legitimately returns another Business/Creator
account's recent media with captions and engagement — no ToS problem, no burner
needed. Limits: roughly the last 25 media per account, **no transcripts at all**,
keyed by username not permalink. Good for a forward-looking creator watchlist;
cannot backfill 279 specific historical posts, and never solves transcripts.

## Division of labour

| task | where |
|---|---|
| Notion schema | **done** — cloud session |
| this spec | **done** — cloud session |
| confirm live host, boot out the loser | Mac |
| capture / OCR / ASR / backfill | **Mac only** — needs egress + IG session |
| analysis once fields populate | cloud session |
