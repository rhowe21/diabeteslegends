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

## FIRST: confirm which machine is actually filing

Known state as of 17 Jul was `STERLINGs-iMac`. Rob believes it has since moved to
the Mac mini. This must be verified, not assumed, because **double-filing is a
known failure mode that has already happened once.**

Evidence from the library: 9 duplicate source links. Two were filed 72 seconds
and 4 minutes apart. Four more cluster 2.2–2.6 h apart on 24 Jun — the exact day
the filer was installed on the iMac while the laptop instance was still running.
(The remaining two are ~7 days apart and are genuine re-saves, not bugs.)

The original install notes already flagged this: "Step 3 — Cut over (prevents
double-filing)". It was flagged and it still happened.

Run on BOTH machines before changing anything:

    launchctl print gui/$(id -u)/com.robhowe.ai-content-filer 2>/dev/null \
      | head -5 || echo "NOT RUNNING ON THIS MACHINE"
    ls -la ~/ai-content-filer/filer.log 2>/dev/null
    tail -3 ~/ai-content-filer/filer.log 2>/dev/null

Whichever machine shows a log with a recent timestamp is the live one. If BOTH
are running, boot out the loser before doing anything else:

    launchctl bootout gui/$(id -u)/com.robhowe.ai-content-filer

Only then apply the changes below, on the surviving host.

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
