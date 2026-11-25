# Token Radar — Build the best token launch radar (token-radar-01)

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/JoeyAlexander21/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/JoeyAlexander21/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Entry for the [make.fun bounty "Build the best token launch radar"](https://make.fun/bounty/token-radar-01) — $1,325 in USDC.

A static dashboard that ranks every pre-token protocol in a sealed DefiLlama snapshot by
the implied value of the token it may one day issue, with a concrete farm plan for each one.

- **Entry:** `main.ts` (Node 22, standard library only) reads `/input/snapshot.json`,
  writes `/output/board.json`, `/output/data.js`, copies `dashboard/` and `screenshots/`,
  and writes `/output/dossier.json` with the vendored `vendor/makefun-board.ts`.
- **Board:** 178 rows — the 40-protocol watchlist plus 138 pre-token protocols below the
  $50M floor. Rank 1 is Steakhouse Financial at $63.1M implied value.
- **Status:** built and verified locally. **Not submitted.** No repo created, nothing pushed.

## Methodology (model `radar-3`)

Implied value is a **power law fitted on the snapshot itself** — never a hardcoded list of
names. The 119 live-token protocols (market cap above zero, exchanges excluded) are the
market's own comparables. Ordinary least squares of log10(market cap) on log10(TVL) gives:

```
log10(mcap) = 3.3823 + 0.4721 × log10(TVL)
implied = round( 10^(3.3823 + 0.4721 × log10(tvl_usd))
                 × (1 + clamp(change_7d, -60, 120) / 100 × 0.5)
                 × (0.85 + 0.15 × min(age_days, 1095) / 1095) )
```

The fit is sublinear (slope ≈ 0.47): token value grows with roughly the square root of
TVL, because live market caps grow far slower than TVL. A flat TVL × 0.25 multiple would
put the biggest protocol near $700M; the fitted curve puts it near $69M base ($63M after
multipliers) — where live protocols of that size actually trade.

**Peer launch rate** (display only, never an input to the value): the share of protocols
in the same age × TVL bucket that already have a token, shrunk toward the global rate
(57%, prior weight 20). It rises steeply with age — under-1-year protocols sit near
30–45%, over-3-year ones near 80–92% — so a large, old, still-tokenless protocol is a
rare holdout. It cuts both ways (overdue launch, or a protocol that will never launch),
and the dashboard says so.

**What the board ranks.** A protocol is rankable when it records no token, is not an
exchange, not a versioned pool, and not a wrapped, staked or bridged product of a token
that already trades (the watchlist's own exclusion, applied to every row: WBTC is Bitcoin
on Ethereum, Binance staked ETH is ETH in Binance's staking product). Above the $50M
floor only watchlist protocols are ranked — the house's rule is the only record of which
above-floor protocols are parents or wrapped products, and the snapshot's ten fields
cannot reproduce it. Live-token protocols are set aside with their market caps.

**Farm plans.** Seven steps per protocol, derived from its own record (category, chains,
TVL, age): a fresh-wallet setup, a category-specific main action, a second different
action, a weekly cadence, an age-based hold (30–60 days), a claim-safety check (never pay
to claim), and a log + exit plan. Each step states its cost and time; the detail view
also totals the farm economics (capital + gas + hours).

## Validation — blind tests run at build time

`main.ts` runs two blind tests over the 119 live comparables and reports them in the
dashboard (model panel), next to a TVL × global-median baseline:

| Test | Model median log error | Model within 2x | Baseline median log error | Baseline within 2x |
| --- | --- | --- | --- | --- |
| Leave-one-out (n=119) | 0.534 dex | 35.3% | 0.698 dex | 29.4% |
| Walk-forward (n=43) | 0.408 dex | 27.9% | 0.664 dex | 27.9% |

Live market caps are extremely noisy (one live protocol trades at 13x its fitted value,
another at 0.02x), so the value is a central estimate with wide error bars — the
dashboard says so. Two terms were **tested and dropped** because they worsened held-out
error: per-category multiples (leave-one-out 0.53 → 0.57 dex) and chain breadth
(within-2x 35.3% → 34.5%). Category medians are still shown as peer context, not as an
input. The dashboard's detail view recomputes every row from the snapshot figures and
checks the number `board.json` carries (0 mismatches across 178 rows).

## Ablation — 11 challengers to radar-3, all rejected (2026-11-25)

Before submitting, radar-3 was tested against 11 variants on the same two blind tests.
A variant was adopted only if it beat radar-3 on **both** tests; none did, so radar-3
stands. Med = median absolute log10 error (lower is better), 2x = share predicted
within 2x (higher is better).

| Variant | LOO med | LOO 2x | WF med | WF 2x | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A radar-3 (OLS all 119 comps, growth 0.5)** | **0.534** | **35.3%** | **0.408** | **27.9%** | **kept** |
| B fit on TVL ≥ $50M comps only (n=45) | 0.546 | 34.5% | 0.393 | 41.9% | mixed: WF better, LOO worse |
| C fit on TVL ≥ $100M comps only (n=26) | 0.523 | 34.5% | 0.525 | 25.6% | WF much worse |
| D growth weight 0.25 | 0.532 | 34.5% | 0.403 | 27.9% | noise (±0.005 dex) |
| E growth weight 0.75 | 0.535 | 33.6% | 0.455 | 27.9% | worse |
| F growth weight 1.0 | 0.530 | 33.6% | 0.411 | 27.9% | mixed |
| G fit TVL ≥ $50M + growth 0.75 | 0.535 | 34.5% | 0.393 | 41.9% | mixed: WF better, LOO flat |
| H fit TVL ≥ $50M + growth 0.25 | 0.557 | 34.5% | 0.393 | 41.9% | LOO worse |
| I Theil-Sen robust fit | 0.523 | 32.8% | 0.492 | 25.6% | WF much worse |
| J maturity 0.70–1.00 (wider) | 0.539 | 32.8% | 0.434 | 27.9% | worse |
| K maturity off (1.00 flat) | 0.539 | 33.6% | 0.418 | 27.9% | worse — damped maturity helps |
| L Theil-Sen + growth 0.25 | 0.517 | 32.8% | 0.502 | 23.3% | WF much worse |

Notes: the TVL ≥ $50M fit (B/G) is the one near-miss — it lifts walk-forward within-2x
from 27.9% to 41.9% but costs leave-one-out accuracy on the larger, more reliable test
(n=119 vs n=43), so it was not adopted. Theil-Sen (I/L) looks better on leave-one-out
medians but collapses walk-forward, which is the test that most resembles ranking
protocols listed later — exactly what this board does. Growth weight 0.5 sits in the
flat middle: 0.25 and 1.0 both move the medians by ~0.005 dex, i.e. noise.

## Data source

- `input/snapshot.json` from the competition kit: DefiLlama `https://api.llama.fi/protocols`,
  fetched **2026-11-14T01:18:33Z**, `as_of` **2026-11-14**. 758 protocols at or above $5M
  TVL; watchlist floor $50,000,000; watchlist 40 protocols. Frozen and read-only — every
  number on the board comes from these ten fields per protocol and nothing else.
- "Records no token" is DefiLlama's record, never proof a protocol has none. Implied
  value is this entry's own claim, never a promise of a launch, a date, or a price.

## How to run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json
```

Node 22.18+ (tested on Node 24.22.1). No install, no network, deterministic: two runs
produce byte-identical output (`diff -r` verified). In the grader's container the
defaults apply (`/input/snapshot.json` → `/output`).

## Layout

```
main.ts                  entrypoint (Node 22, stdlib only)
lib/model.ts             radar-3 model: fit, blind tests, launch rates, board, farm plans
vendor/makefun-board.ts  make.fun dossier library, copied from the kit WITHOUT changes
dashboard/index.html     static page shell (loads ../data.js, no network)
dashboard/app.css        paper / ink-navy / teal-amber theme
dashboard/app.js         board, filters, detail dialog, value map, model sandbox
screenshots/1-board.png  board (1280×900, 152 KB)
screenshots/2-detail.png protocol detail (1280×900, 190 KB)
screenshots/3-filtered.png  filtered view, Risk Curators (1280×900, 152 KB)
out/                     generated output of the last run (board.json, data.js, dossier.json)
LICENSE                  MIT
```

Gate self-check (mirrors `RULES.txt`): 178 rows; ranks 1–178; implied values
non-increasing and not all equal; watchlist coverage 40/40; all farm plans 7 steps of
20–600 chars; 3 screenshots within size and dimension caps; `dossier.json` 709 KB
(< 1.5 MiB) with dashboard source text 49,223 bytes (< 65,536, so the judge reads the
whole source); no `http(s)` string anywhere in the dashboard files.

## Lessons learned (what this build taught us)

1. **Fit the curve, don't assume the multiple.** A flat TVL multiple is the obvious
   model and it is wrong: log-log OLS on live market caps gives slope ≈ 0.47, and it
   beats the flat baseline held-out on both blind tests. The single most valuable
   discovery of this build.
2. **Ablate every term, keep only what survives held-out.** Category multiples felt
   like the smart differentiator; leave-one-out says they hurt (0.53 → 0.57 dex).
   Maturity at full strength hurt too; damped to 0.85–1.00 it helps. Dropping a term
   you liked, with numbers, is a stronger story than keeping it.
3. **The watchlist rule is a signal, not just a list.** Above-floor protocols the
   watchlist leaves out are excluded for reasons the snapshot cannot show
   (`parentProtocol`); ranking them anyway put WBTC and Binance staked ETH at the top
   of an early board. Trust the house's exclusion.
4. **Zero is data, not a number.** Thirteen live protocols record a $0 market cap;
   including them dragged the global median from 0.246 to 0.186. Exclude zero-mcap
   comps and say so in the integrity strip.
5. **Small samples need shrinkage, and winsorization before medians.** One live
   prediction-market comp trades at 400x TVL; without winsorizing it would set the
   whole category's multiple.
6. **Determinism is a rounding discipline.** The page must recompute board values
   exactly: round the fitted intercept/slope to 4 decimals and use the rounded values
   everywhere; round the power-law base only for display, never before multiplying
   (that cost 36 off-by-$1 mismatches in one iteration).
7. **Peer launch rate is the angle most boards miss.** Age × TVL buckets show a clean
   monotone: the older and bigger a protocol is, the more of its peers already have a
   token. It is a display signal, not a prediction — and it is computed from the same
   snapshot, so it cannot be accused of being invented.
8. **Screenshots are part of the entry, not an afterthought.** The managed browser
   refuses direct headless use here; a stock Chromium via Playwright (`npx playwright
   install chromium`) screenshots the static dashboard offline. Check the renders:
   default button styling on sort headers and run-together mover cards were both
   caught only by looking at the PNGs.

## What is still missing before submit

- [ ] GitHub repository (created after the competition opened, 2026-11-14T10:00:00Z) + push — **parent decides**. `.makefun/owner.json` (`{"wallet": "7vmsx3zAhxqKEwe6eNQGwd6FCPaDfhM3DTjDCyw2wTts"}`) is committed in this repo so the entry passes `repo_owner` even if the repo owner differs from the linked GitHub account; the README already carries the three make.fun badges (owner/repo `JoeyAlexander21/token-radar-01` — update the badge URLs if the repo is named differently) and the `makefun` topic + make.fun homepage must be set on the GitHub About before submit.
- [x] Transcript bundle prepared 2026-11-25 (staging + `transcripts.tar.gz`, `makefun check` 15 passed / 0 failed — see `~/workspace/makefun/staging-token-radar/`). Submit only when the parent says so.
- [ ] Possible next step: a dev-grade submission early to get a provisional win rate against the house dashboards; iterate the model only if the rate disappoints — the ablation table above shows the obvious next variants (TVL ≥ $50M fit, Theil-Sen) already fail the blind tests, so a new idea would need a new signal, not a new fit.
- [ ] The competition deadline is **2026-12-14 10:00 UTC (17:00 WIB)**. Prizes:
      $1,000 / 4× $50 / 5× $25, total $1,325 in USDC on Solana.
