# Social Content Library Analysis — 2026

Analysis of Rob Howe's saved content library cross-referenced against
first-party performance data, produced 27 Aug 2026.

Published report: https://claude.ai/code/artifact/c84f4ebb-d70a-4c94-8f29-82a7c3484e8a

## Sources
- Notion "Rob's Content Inspo & Content Strategy Content" — 279 items, 22 Jun – 26 Aug 2026
- Notion "Rob's AI Content Repository" — 110 items, same window
- Windsor.ai post-level connectors — @robhowe21 (80 posts), @diabeticsdoingthings (9),
  YouTube (320 videos), 1 Jun – 27 Aug 2026
- Slack — #greyhound, #content-inspiration, weekly DDT Growth Agent reports

## Files
| file | what it is |
|---|---|
| `inspo_raw.json` | full extract of the 279-item inspiration library |
| `ai_repo.json` | full extract of the 110-item AI operations library |
| `corpus.jsonl` | 278 items coded by platform / hook archetype / mechanic / pillar |
| `rh_posts.json` | @robhowe21 post-level metrics incl. skip rate and watch time |
| `yt.json` | YouTube per-video daily metrics |
| `firstparty_findings.md` | the measured findings from own-account data |
| `synthesis.md` | the nine theses |
| `product_revenue.md` | product ladder and Q4 revenue model |
| `field-report.html` | source of the published report |
| `page_urls.json` | Notion page URL + source link for all 280 rows |
| `own_all.json` | permalinks for 325 own posts, both IG accounts, since Jan 2025 |

## Headline numbers
- Hook quality: reels with better hooks (avg skip 0.406) get 2.8x the median reach
  of reels with worse hooks (0.642). Account median skip rate 0.534.
- Format inversion: 87.5% of output is reels; carousels return 3.0x reach,
  16x saves, 14x shares.
- Concentration: top 1 post of 80 = 25.0% of all reach.
- Gap: comment-keyword-to-DM is 26.3% of the library and 0 of 80 posts.
- YouTube: 320 videos, 66 subscribers, median 5 views/video; device-utility
  tutorials are the only reliable subscriber drivers.

## Follow-up pass (27 Aug)
Attempted to mine source transcripts for actual save-intent. Not retrievable in
this environment:
- Notion page bodies are all blank; `Summary` is the only stored text
- instagram.com, youtube.com and all general web egress are blocked by the
  environment network policy (example.com also fails)
- `Visual` cover images sit on S3 behind the same blocked egress
- the filer's source channels (#content-inspiration, #fitness-content,
  #ai-content-repo) return channel_not_found for the Slack app

Established instead:
- **Zero** of 280 library items are Rob's own posts, checked against 325 own
  posts across both accounts back to Jan 2025. The personal-vs-agency
  distinction is intended destination, not authorship.
- The filer templates every Takeaway as "Rob can/could...", which asserts
  personal-brand intent on all 279 items regardless of why they were saved.
- Subject-domain split: 16.2% personal (health/fitness/sport/lifestyle),
  83.8% craft/ops.
- `img_index` in 41 carousel URLs records the slide Rob was on when he shared.
  Only 9 were saved on slide 1; 78% deeper in, median ~slide 5, max slide 14.
- `My Notes` is filled on 8 of 279 items; 2 are system tests. The 6 real ones
  are the only recorded purpose in the corpus, and 3 of them are draft hooks
  Rob wrote for himself. Conversion from saved to my-version: 2.2%.

The library stores a link, an AI summary and a cover image, never the content
itself. Three items are already permanently unreadable.
