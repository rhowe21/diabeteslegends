# Step 1 patch brief — persist what the filer already fetches

Self-contained brief. Hand this to a Claude session with ssh access to
`howe-agent` (the Mac mini agent already works in `~/agents/`).

## Target — verified 27 Aug 2026

    host              howe-agent (Mac mini)
    service label     com.rhv.ai-content-filer
    plist             /Users/robsmacmini/Library/LaunchAgents/com.rhv.ai-content-filer.plist
    working dir       /Users/robsmacmini/Projects/ai-content-filer
    entry point       src/listener.js
    node              /usr/local/bin/node          (Intel)
    log (stdout+stderr, same file)
                      /Users/robsmacmini/agents/logs/ai-content-filer.log
    launchd props     keepalive | runatload | inferred program

Do NOT patch the iMac copy at `~/ai-content-filer` — it is disabled and
superseded. Only the mini runs.

Restart after changes:

    launchctl kickstart -k gui/$(id -u)/com.rhv.ai-content-filer

## Notion target — already prepared, no schema work needed

Data source `collection://387dbadf-c30a-809a-94a6-000b3054e527`
(database "Rob's Content Inspo and Content Strategy Content").

Fields added 27 Aug and currently empty on all 280 rows:

| field | type | purpose |
|---|---|---|
| `Caption` | text | verbatim post caption |
| `Transcript` | text | on-screen text and/or spoken ASR, each prefixed by source |
| `Capture Status` | select | Pending / Caption only / OCR done / Transcript done / Failed |

Notion text properties cap at 2000 characters. Anything longer goes in the
**page body**; keep a truncated copy in the property for scanning.

## The three changes

### 1. Stop discarding the caption
The filer already fetches the caption — the existing summaries quote captions
verbatim and cite logged-in-only engagement counts. It generates the
Hook/Format/Takeaway summary, writes that to `Summary`, and drops the raw
capture. All 280 page bodies are blank as a result.

Write the caption to `Caption`, write the full raw capture into the page body,
and set `Capture Status = 'Caption only'`.

While the page is open and free, also persist: creator handle, like count,
comment count, posted-at, follower count. These cost nothing at capture time and
cannot be recovered later.

### 2. Capture claude's stderr
Current failures log as `claude exited 1:` with nothing after the colon. The
child's stderr is being lost, which is why a four-day outage on the iMac went
unnoticed. stdout and stderr already share one file at the launchd level, so
this is purely a code fix: capture the child process's stderr and include it in
the `❌` line.

### 3. Add a dead-letter cap
`https://www.instagram.com/p/DcSZ2FNDayc/` was retried three times and never
given up on. One poisoned item can block the queue indefinitely.

Cap retries (3 is fine), then write `Capture Status = 'Failed'` with the reason
and move to the next item.

## Test before backfilling
Post one Instagram link into `#content-inspiration` and confirm the new row has
`Caption` populated, a non-empty page body, and `Capture Status = 'Caption only'`.
Then check the log for a clean success line.

Do not run the 279-item backfill until this single-item test passes.

## Before the backfill — switch the account
The mini's Instagram session was imported from the MacBook's Chrome, so the
filer is browsing as whichever account was logged in there, most likely
@robhowe21 (22,146 followers).

Live filing is a trickle and has been fine. The 279-item backfill is far more
request-dense and is the most checkpoint-prone thing that could be run on this
account. Switch to the burner first and warm it for a couple of days:

    B=~/.claude/skills/gstack/browse/dist/browse
    $B goto "https://www.instagram.com/accounts/login/"
    $B handoff "Log into the burner account, then return to Terminal"
    $B resume && $B state save instagram-agency
    chmod 600 ~/.gstack/browse-states/instagram-agency.json

Point the filer at `instagram-agency` and leave the existing session file alone,
so nothing can accidentally run as Rob.

Credentials belong in macOS Keychain or a chmod-600 `.env` — never in the repo.

## Then steps 2-4
Covered in `transcript-pipeline-spec.md`: OCR of the cover image for on-screen
text, `yt-dlp` + `whisper.cpp` for spoken transcript on every video, and a
resumable backfill driven off `Capture Status`.

`backfill.js` already exists in the project (dated 16 Jul) and is the natural
starting point for step 4 rather than writing one from scratch.
