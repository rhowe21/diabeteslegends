# Getting transcripts flowing — diagnosis and build spec

Written 27 Aug 2026. NOTE: I have not seen the ai-content-filer source. This is a
spec against its observed behaviour, not a patch against real code.

## Diagnosis: what is actually blocking us

Three separate things get conflated. Only two are real.

### 1. "Does Instagram block us?" — No. Already solved, in production since June.
`~/ai-content-filer` runs 24/7 on STERLINGs-iMac as launchd service
`com.robhowe.ai-content-filer`. It drives an authenticated browser via
`~/.claude/skills/gstack/browse/dist/browse` with a saved IG session at
`~/.gstack/browse-states/instagram.json` (logged in 24 Jun from the iMac's own IP).

Proof it is already reading real post data: the Notion summaries quote captions
verbatim and cite exact engagement that is only visible to a logged-in viewer —
"6,974 comments against only 1,540 likes", "865 comments on 1,153 likes",
"1,450 comments against 1,854 likes". That data came from the page, not a guess.

**So the capture tool exists and works. It is not an Instagram problem.**

### 2. The real blocker A: the filer discards its own raw capture
It fetches the post, generates a Hook/Format/Takeaway summary, writes the summary
into a Notion *property*, and drops everything else. Evidence: all 280 Notion page
bodies are blank (`<blank-page>`), and the only text stored anywhere is `Summary`.

The caption is being fetched and thrown away. That is a persistence bug, not a
capability gap.

### 3. The real blocker B: this cloud sandbox has zero network egress
Not an IG restriction — `example.com` also returns 000. Chromium and Playwright
are pre-installed here but there is nothing to browse. A sandbox browser does not
help. Separately, running IG automation from a datacenter IP invites checkpoints;
the setup notes already say "fresh login from its own IP" for exactly this reason.
The iMac is the right machine to run this on and already is.

## Three different things called "transcript" — pick the right one

| tier | what it is | cost to add | value for hook analysis |
|---|---|---|---|
| **Caption** | the post's text | ~zero, already fetched | high — carries the CTA, keyword, structure |
| **On-screen text** | words burned into frame 1 | low — OCR the cover | **highest** — for most reels the hook IS the on-screen text, not speech |
| **Spoken transcript** | ASR of the audio | medium — download + Whisper | medium — matters for talking-head, less for text-led |

The instinct is to reach for spoken transcript. For this corpus that is third-best.
68% of the library is Reels and the hook nearly always lives in the first frame as
on-screen text. The cover image already stored on every row is approximately that
frame — it is the cheapest large win available.

## Build spec

### Step 1 — stop discarding (30 min, unblocks everything)
Two new Notion properties on `387dbadf-c30a-809a-94a6-000b3054e527`:
- `Caption` (text) — verbatim post caption
- `Transcript` (text) — on-screen text and/or ASR, prefixed by source
Then write the raw capture into the **page body** as well, not just properties
(Notion text properties cap at 2000 chars; bodies do not).

Also persist, while the page is already open: `like_count`, `comment_count`,
`posted_at`, `creator_handle`, `follower_count`. All free at capture time,
all currently thrown away.

### Step 2 — on-screen text (half a day)
The cover is already downloaded. Run OCR on it at capture time and store as
`Transcript` with prefix `[OCR frame 1]`. Tesseract locally, or send the image to
Claude, which reads it directly and handles stylised type better than Tesseract.

### Step 3 — spoken transcript, only where it earns it (1 day)
`yt-dlp` the reel, `ffmpeg` to 16kHz mono wav, `whisper.cpp` base.en locally.
Store with prefix `[ASR]`. Gate it: only run for items where OCR returns under
~15 characters, i.e. genuinely talking-head posts. That is maybe a third of the
corpus and keeps runtime and disk sane.

The recipe is already in Rob's own AI repo — Conrad (buildwith.conrad),
"Giving Claude Eyes: Frame-by-Frame Video Analysis Skill", yt-dlp + FFmpeg.

### Step 4 — backfill the 279
One-shot script over existing rows, throttled hard (5-8s jitter between posts,
random order, stop on any checkpoint). Expect some 404s: 3 items are already
permanently unreadable behind auth walls or deleted posts.

## Two honest caveats

**ToS.** Automated collection of third-party posts is against Instagram's terms
regardless of being logged in. The practical risk is a checkpoint or action-block
on the authenticated account. Do not run this on @robhowe21 — use a burner
Business account with no audience to lose. That is the real exposure: 22,146
followers should not be the collateral on a scraping job.

**The sanctioned alternative, and why it is only partial.** IG Graph API
`business_discovery` legitimately returns another Business/Creator account's
recent media with captions and engagement — no ToS problem. Limits that matter
here: roughly the last 25 media per account, no transcripts at all, keyed by
username rather than permalink, so it cannot cleanly backfill 279 specific
historical posts. Good for going forward on a watchlist of creators; poor for
the backfill.

## What can be done from the cloud session vs. the iMac

| task | where |
|---|---|
| add the Notion properties | cloud session (Notion MCP) — can do now |
| write the backfill spec | cloud session — this file |
| capture, OCR, ASR, backfill | **iMac only** — needs egress + IG session |
| analyse whatever lands in Notion | cloud session |

The division is clean: the iMac fills the fields, this session reads them.
