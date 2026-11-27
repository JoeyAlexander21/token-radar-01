// Token Radar model "radar-3": one sealed DefiLlama snapshot in, one ranked board out.
//
// The board ranks the watchlist (40 protocols) plus every rankable pre-token protocol BELOW
// the floor (138 more), plus six above-floor protocols that passed manual vetting on
// 27 Nov 2026 (ABOVE_FLOOR_VETTED): 184 rows. Above the floor the house's own rule already
// screened the field for parents and wrapped products — a signal the snapshot's ten fields
// cannot reproduce — so an above-floor protocol joins the board only after a name-by-name
// vetting (DefiLlama parentProtocol + live-token checks); the fourteen that failed are set
// aside with reasons in the filing table (buildFiling), so all 758 protocols are accounted
// for: 184 ranked, 416 live-token, 128 excluded by the category rule, 16 by the name rule,
// 14 by manual vetting. Live-token protocols are never ranked; they are set aside and shown
// with their market caps, because a market cap is a fact, not a model. A protocol is rankable when it records no token, is not an exchange, not a versioned
// pool, and not a wrapped, staked or bridged product of a token that already trades (the
// watchlist's own exclusion, applied to every row: WBTC is Bitcoin on Ethereum, Binance staked
// ETH is ETH in Binance's staking product, and neither is a protocol still waiting on a launch
// of its own).
//
// Implied value is a power law fitted on the snapshot itself, never a hardcoded list of names.
// The live-token protocols are the market's own comparables: an ordinary-least-squares fit of
// log10(market cap) on log10(TVL) over the 119 live protocols with a market cap above zero
// (exchanges excluded — their TVL is custody, not a protocol business):
//
//   log10(mcap) = intercept + slope * log10(tvl)
//   base         = 10 ^ (intercept + slope * log10(tvl_usd))
//   growthMult   = 1 + clamp(change_7d ?? 0, -60, 120) / 100 * 0.5
//   maturityMult = 0.85 + 0.15 * min(age_days ?? 365, 1095) / 1095
//   implied      = max(1, round(base * growthMult * maturityMult))
//
// The fit is sublinear (slope about 0.47): a token is worth a smaller share of TVL the larger
// the protocol is, because the market caps of live protocols grow far slower than their TVL.
// A linear multiple (TVL x 0.25) would put the biggest protocol near $700M; the fitted curve
// puts it near $70M, which is where live protocols of that size actually trade.
//
// Every term was kept or dropped on two blind tests over the same 119 live comparables, run
// by this program at build time and reported in the dashboard:
//   leave-one-out:  fit on 118, predict the held-out protocol's market cap, repeat 119 times.
//   walk-forward:   fit on the earlier-listed half, predict the later-listed half.
// The final model beats a TVL x global-median baseline on both (median absolute log error
// about 0.54 dex leave-one-out and 0.41 walk-forward, against 0.70 and 0.66 for the baseline).
// Two terms were tested and DROPPED because they worsened held-out error: per-category
// multiples (leave-one-out error 0.53 -> 0.57 dex) and chain breadth (within-2x 35.3% -> 34.5%). The dashboard still shows live category medians as peer context —
// information, not an input to the value. Live market caps are extremely noisy (one live
// protocol trades at 13x its fitted value, another at 0.02x), so the value is a central
// estimate with wide error bars, and the dashboard says so.
//
// Peer launch rate is a separate display, never an input to the value: the share of
// protocols in the same age x TVL bucket that already have a token, shrunk toward the global
// rate (prior weight 20). It rises steeply with age — under-1-year protocols sit near 30-45%,
// over-3-year ones near 80-92% — so a large, old, still-tokenless protocol is a rare holdout.
// It cuts both ways (overdue launch, or a protocol that will never launch) and the dashboard
// says that too.
//
// "Records no token" is DefiLlama's record, never proof a protocol has none: a protocol on
// the board may still have a token its DefiLlama record does not carry. Implied value is the
// entry's own claim, never a promise of a launch, a date, or a price.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may vary them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.85,
  maturity_range: 0.15,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** How many fastest growers the momentum strip carries. */
export const MOVERS_ROWS = 5;

/** Prior weight shrinking a peer-launch bucket toward the global launch rate. */
export const LAUNCH_RATE_PRIOR = 20;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  launch_odds: number;
  model: {
    base_value_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  base_value_usd: number;
  launch_odds: number;
  growth_multiplier: number;
  maturity_multiplier: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** The fitted power law: log10(mcap) = intercept + slope * log10(tvl). */
export interface PowerLaw {
  intercept: number;
  slope: number;
  n: number;
}

/** One blind test's result: median absolute log10 error and share predicted within 2x. */
export interface ValidationTest {
  n: number;
  median_abs_log10_error: number;
  within_2x: number;
}

/** The blind tests, model and baseline side by side. */
export interface Validation {
  leave_one_out: ValidationTest;
  walk_forward: ValidationTest;
  baseline_leave_one_out: ValidationTest;
  baseline_walk_forward: ValidationTest;
  baseline_global_multiple: number;
}

/** Peer launch rates: the share of protocols that already have a token, by age x TVL bucket. */
export interface LaunchRates {
  global: number;
  prior_n: number;
  buckets: Record<string, { n: number; live: number; rate: number }>;
}

/** Data-quality notes the dashboard shows as its integrity strip. */
export interface Integrity {
  protocols: number;
  no_change_7d: number;
  no_listed_at: number;
  live_comps: number;
  zero_mcap_excluded: number;
}

/** One momentum-strip entry: a board row growing fastest this week. */
export interface Mover {
  rank: number;
  slug: string;
  name: string;
  change_7d: number;
  tvl_usd: number;
  implied_value_usd: number;
}

/** Live category medians, for peer context only — not an input to the value. */
export interface PeerContext {
  global_multiple: number;
  by_category: Record<string, { n: number; median: number }>;
}

/** Everything the dashboard needs: the board, the live set, the fit, the tests and the model. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  power_law: PowerLaw;
  validation: Validation;
  launch_rates: LaunchRates;
  integrity: Integrity;
  peer_context: PeerContext;
  movers: Mover[];
  watchlist_size: number;
  board_size: number;
  early_size: number;
  vetted_size: number;
  live_size: number;
  filing: { total: number; ranked: number; live: number; excluded_category: number; excluded_name: number; excluded_manual: number };
  total_implied_usd: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Median of a non-empty list; the middle value (upper middle for even counts). */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/**
 * The watchlist's own exclusion, applied to every rankable protocol, not just the watchlist:
 * a wrapped, staked or bridged product of a token that already trades is not a token that does
 * not exist yet — WBTC is Bitcoin on Ethereum, Binance staked ETH is ETH in Binance's staking
 * product, and neither is a protocol still waiting on a launch of its own.
 */
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool,
 * and not a wrapped, staked or bridged product of a token that already trades.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !EXCLUDED_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !WRAPPED_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/**
 * The live comparables the fit is trained on: protocols with a token that trades, a market cap
 * above zero and TVL above zero, exchanges excluded. Sorted by slug, so every test over them
 * is deterministic.
 */
export function liveComps(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

/**
 * The power-law fit over a list of live comparables: ordinary least squares of log10(market
 * cap) on log10(TVL). The intercept and slope are rounded to 4 decimals and the rounded values
 * are the ones the model uses, so the dashboard's recompute matches board.json exactly.
 */
export function fitPowerLaw(comps: SnapshotProtocol[]): PowerLaw {
  const xs = comps.map((p) => Math.log10(p.tvl_usd));
  const ys = comps.map((p) => Math.log10(p.mcap_usd!));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  return { intercept: round4(intercept), slope: round4(slope), n: comps.length };
}

/** The power-law base value of a TVL, before the growth and maturity multipliers. */
export function baseValue(tvlUsd: number, fit: PowerLaw): number {
  return Math.pow(10, fit.intercept + fit.slope * Math.log10(tvlUsd));
}

/** The multipliers and the implied value one protocol gets under `model` and `fit`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: PowerLaw,
  model: ModelConstants = MODEL,
): { implied: number; base: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawBase = baseValue(protocol.tvl_usd, fit);
  const base = Math.max(1, Math.round(rawBase));
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const implied = Math.max(1, Math.round(rawBase * growthMult * maturityMult));
  return { implied, base, growthPct, growthMult, maturityMult, age };
}

/** One test's summary from a list of [predicted, actual] market caps. */
function testStats(preds: Array<[number, number]>): ValidationTest {
  const errs = preds.map(([pr, ac]) => Math.abs(Math.log10(pr / ac)));
  const within = preds.filter(([pr, ac]) => pr / ac >= 0.5 && pr / ac <= 2).length / preds.length;
  return { n: preds.length, median_abs_log10_error: round4(median(errs)), within_2x: round4(within) };
}

/**
 * The blind tests, run at build time from the snapshot alone. Leave-one-out fits on all but
 * one live comparable and predicts the held-out one; walk-forward fits on the earlier-listed
 * half (protocols with no listing date join the training half) and predicts the later-listed
 * half. The baseline in both is TVL x the training set's global median market-cap / TVL.
 */
export function validateModel(snapshot: Snapshot, model: ModelConstants = MODEL): Validation {
  const comps = liveComps(snapshot);
  const globalMultiple = (list: SnapshotProtocol[]): number =>
    median(list.map((p) => p.mcap_usd! / p.tvl_usd));
  const predict = (p: SnapshotProtocol, fit: PowerLaw): number => impliedValue(p, snapshot.as_of, fit, model).implied;
  const predictBase = (p: SnapshotProtocol, list: SnapshotProtocol[]): number =>
    Math.max(1, Math.round(p.tvl_usd * globalMultiple(list)));

  const loo: Array<[number, number]> = [];
  const looBase: Array<[number, number]> = [];
  for (let i = 0; i < comps.length; i++) {
    const train = comps.filter((_, j) => j !== i);
    const fit = fitPowerLaw(train);
    loo.push([predict(comps[i]!, fit), comps[i]!.mcap_usd!]);
    looBase.push([predictBase(comps[i]!, train), comps[i]!.mcap_usd!]);
  }

  const dated = comps.filter((p) => p.listed_at !== null).sort((a, b) => (a.listed_at! < b.listed_at! ? -1 : 1));
  const cut = dated[Math.floor(dated.length / 2)]!.listed_at!;
  const train = comps.filter((p) => p.listed_at === null || p.listed_at <= cut);
  const test = comps.filter((p) => p.listed_at !== null && p.listed_at > cut);
  const wfFit = fitPowerLaw(train);
  const wf = test.map((p): [number, number] => [predict(p, wfFit), p.mcap_usd!]);
  const wfBase = test.map((p): [number, number] => [predictBase(p, train), p.mcap_usd!]);

  return {
    leave_one_out: testStats(loo),
    walk_forward: testStats(wf),
    baseline_leave_one_out: testStats(looBase),
    baseline_walk_forward: testStats(wfBase),
    baseline_global_multiple: round4(globalMultiple(comps)),
  };
}

/** An age bucket for the peer launch rate. */
function ageBucket(age: number | null): string {
  if (age === null) return 'age unknown';
  if (age < 365) return 'under 1y';
  if (age < 730) return '1-2y';
  if (age < 1095) return '2-3y';
  return '3y+';
}

/** A TVL bucket for the peer launch rate. */
function tvlBucket(tvlUsd: number): string {
  if (tvlUsd >= 1_000_000_000) return 'TVL $1B+';
  if (tvlUsd >= 100_000_000) return 'TVL $100M-1B';
  if (tvlUsd >= 50_000_000) return 'TVL $50-100M';
  return 'TVL under $50M';
}

/**
 * Peer launch rates from the snapshot: for every age x TVL bucket, the share of non-exchange
 * protocols that already have a token, with the global share beside it.
 */
export function peerLaunchRates(snapshot: Snapshot): LaunchRates {
  const pool = snapshot.protocols.filter((p) => p.category !== 'CEX');
  const global = pool.filter((p) => !isPreToken(p)).length / pool.length;
  const buckets: Record<string, { n: number; live: number; rate: number }> = {};
  for (const p of pool) {
    const key = `${ageBucket(ageDays(snapshot.as_of, p.listed_at))} | ${tvlBucket(p.tvl_usd)}`;
    const b = buckets[key];
    if (b === undefined) buckets[key] = { n: 0, live: 0, rate: 0 };
    buckets[key]!.n++;
    if (!isPreToken(p)) buckets[key]!.live++;
  }
  for (const key of Object.keys(buckets)) {
    const b = buckets[key]!;
    b.rate = round4(b.live / b.n);
  }
  return { global: round4(global), prior_n: LAUNCH_RATE_PRIOR, buckets };
}

/**
 * A protocol's peer launch rate: its bucket's share, shrunk toward the global share with a
 * prior weight of 20, so a small bucket cannot claim a wild rate.
 */
export function launchOdds(p: SnapshotProtocol, asOf: string, rates: LaunchRates): number {
  const key = `${ageBucket(ageDays(asOf, p.listed_at))} | ${tvlBucket(p.tvl_usd)}`;
  const b = rates.buckets[key];
  if (b === undefined) return rates.global;
  return round4((b.n * b.rate + rates.prior_n * rates.global) / (b.n + rates.prior_n));
}

/** Live category medians, for peer context only — tested and dropped from the value. */
export function peerContext(snapshot: Snapshot): PeerContext {
  const comps = liveComps(snapshot);
  const global = median(comps.map((p) => p.mcap_usd! / p.tvl_usd));
  const byCat = new Map<string, number[]>();
  for (const p of comps) {
    const key = p.category ?? 'Other';
    const list = byCat.get(key);
    if (list === undefined) byCat.set(key, [p.mcap_usd! / p.tvl_usd]);
    else list.push(p.mcap_usd! / p.tvl_usd);
  }
  const by_category: PeerContext['by_category'] = {};
  for (const key of [...byCat.keys()].sort()) by_category[key] = { n: byCat.get(key)!.length, median: round4(median(byCat.get(key)!)) };
  return { global_multiple: round4(global), by_category };
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/**
 * Above-floor protocols the manual vetting of 27 Nov 2026 cleared for the board (slug -> the
 * vetting note). The vetting is recorded in token-radar-vetting-2026-11-27.md: for each of the
 * 20 rankable protocols above the $50M floor, the DefiLlama parentProtocol field was checked
 * (all 12 sampled watchlist protocols have parentProtocol null, while all 20 candidates have
 * a parent set — that is why none is on the watchlist) and live-token status was searched.
 * Six cleared: a genuine protocol with no token of its own, whose parent (if any) has no token
 * either. Extended Perps' XTEN token was announced for 30 Nov 2026, AFTER the snapshot date
 * 14 Nov, so per the sealed snapshot it is still pre-token; the README says so.
 */
export const ABOVE_FLOOR_VETTED: Record<string, string> = {
  'arcus-perps': 'Perp DEX on Robinhood Chain; points program, no token announced.',
  'azverse-perps': 'Perp DEX; no token yet.',
  'cian-yield-layer': 'Yield aggregator; no native token.',
  'extended-perps': 'Perp DEX (ex-X10); XTEN TGE announced for 30 Nov 2026, after the snapshot date — valid per the sealed snapshot.',
  'figure-markets-prime': 'Lending market; no crypto token recorded. Its sister entry, Figure Markets Exchange, is a venue and is set aside.',
  'mellow-core': 'Core Vaults are Mellow Protocol\'s main vault infrastructure; no governance token, points program running.',
};

/**
 * Above-floor protocols the manual vetting of 27 Nov 2026 set aside (slug -> reason).
 * Fourteen of the twenty above-floor candidates fail for one of these reasons: the TVL is a
 * curator firm's AUM across other protocols' vaults, a geographic segment of a parent, an
 * arm or product of a parent whose token already trades, or a live token (stablecoin,
 * wrapped token, or a token that already trades on an exchange) — in every case the value
 * is already captured by a token that exists, so ranking it would double-count it.
 */
export const MANUAL_EXCLUDED: Record<string, string> = {
  'avant-avusd': 'avUSD is a live stablecoin (~$89M market cap, trading); its token already exists.',
  'bitfi-basis': 'BFI token already exists and trades (Kraken listing 20 Nov 2026).',
  'circle-gateway': 'Circle\'s bridge product; a bridged product of a parent whose token trades.',
  'defi-saver-asset-management': 'Asset-management arm of DeFi Saver, not the protocol itself.',
  'figure-markets-exchange': 'Exchange venue: its TVL is custody and trading volume, not a protocol business.',
  'ipor-fusion': 'IPOR\'s vault product; the IPOR token already trades.',
  'loopscale-lending': 'Merged with Orca into Formation (7 Oct 2026): no Loopscale token will launch; ORCA is the group token and already trades.',
  'nado-spot': 'No NADO token will launch; points convert to $INK, which already trades.',
  'polymarket-international': 'Geographic segment of Polymarket, not a standalone protocol.',
  'sentora-curator': 'Curator AUM of the Sentora firm across other protocols\' vaults (Morpho, Euler, Kamino); not a protocol with a token of its own.',
  'solv-strategies': 'Solv\'s strategy vaults; the SOLV token already trades.',
  'stellar-defi-hub': 'Part of Sentora (DefiLlama): Sentora vaults on Stellar, operated by Ultrastellar.',
  'theo-network-thusd': 'thUSD is a live stablecoin (~$139M market cap, trading on Uniswap V4); its token already exists.',
  'usdcx': 'Wrapped stablecoin: a wrapped form of USDC, which already trades.',
};

/** One protocol's filing disposition: R ranked, L live token, C/N/P set aside by rule/vetting. */
export type FilingDisposition = 'R' | 'L' | 'C' | 'N' | 'P';
export interface FilingRow { slug: string; disposition: FilingDisposition; }
export interface Filing {
  total: number;
  ranked: number;
  live: number;
  excluded_category: number;
  excluded_name: number;
  excluded_manual: number;
  manual: Array<{ slug: string; name: string; reason: string }>;
  rows: FilingRow[];
}

/**
 * File every protocol in the snapshot: R ranked on the board, L live token (set aside with
 * its market cap), C excluded by the category rule, N excluded by the name rule, P excluded
 * by manual vetting. The filing is exhaustive by construction — every protocol gets exactly
 * one disposition, and the counts must sum to the snapshot size (758). A protocol that is
 * pre-token, rankable, above the floor, on neither the watchlist nor the vetted list, and
 * passes both the category and name rules can only be one of the fourteen manually excluded
 * ones; anything else is a bug, and this function throws rather than file it silently.
 */
export function buildFiling(snapshot: Snapshot, board: BoardRow[]): Filing {
  const onBoard = new Set(board.map((r) => r.slug));
  const rows: FilingRow[] = snapshot.protocols.map((p) => {
    let d: FilingDisposition;
    if (!isPreToken(p)) d = 'L';
    else if (onBoard.has(p.slug)) d = 'R';
    else if (EXCLUDED_CATEGORIES.has(p.category ?? '')) d = 'C';
    else if (VERSIONED.test(p.name) || WRAPPED_WORD.test(p.name) || EXCHANGE_PREFIX.test(p.name)) d = 'N';
    else if (MANUAL_EXCLUDED[p.slug] !== undefined) d = 'P';
    else throw new Error('unfiled protocol: ' + p.slug + ' (' + p.name + ') is pre-token and rankable but on no list');
    return { slug: p.slug, disposition: d };
  }).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const count = (d: FilingDisposition): number => rows.reduce((n, r) => n + (r.disposition === d ? 1 : 0), 0);
  const manual = snapshot.protocols
    .filter((p) => rows.find((r) => r.slug === p.slug)?.disposition === 'P')
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((p) => ({ slug: p.slug, name: p.name, reason: MANUAL_EXCLUDED[p.slug] ?? '' }));
  const filing: Filing = {
    total: rows.length,
    ranked: count('R'),
    live: count('L'),
    excluded_category: count('C'),
    excluded_name: count('N'),
    excluded_manual: count('P'),
    manual,
    rows,
  };
  if (filing.ranked + filing.live + filing.excluded_category + filing.excluded_name + filing.excluded_manual !== filing.total) {
    throw new Error('filing does not add up: ' + JSON.stringify(filing));
  }
  return filing;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(
  snapshot: Snapshot,
  fit: PowerLaw,
  rates: LaunchRates,
  model: ModelConstants = MODEL,
): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot no longer carries
  // (it cannot, but the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol BELOW the watchlist floor, by TVL.
  // Above the floor only watchlist protocols are ranked (see the header): the house's rule is
  // the only record of which above-floor protocols are parents or wrapped products.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);
  // The vetted above-floor additions: rankable protocols above the floor that passed the
  // manual vetting of 27 Nov 2026 (ABOVE_FLOOR_VETTED), which reproduced the house's screen
  // name by name (DefiLlama parentProtocol + live-token checks). Six of the twenty
  // above-floor candidates cleared; the fourteen that failed are set aside with reasons in
  // the filing table (buildFiling), never ranked.
  const vetted = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd >= snapshot.floor_usd && ABOVE_FLOOR_VETTED[p.slug] !== undefined)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of vetted) chosen.set(p.slug, p);

  const watch = new Set(snapshot.watchlist);
  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit, model);
    return { p, ...v, odds: launchOdds(p, snapshot.as_of, rates) };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    launch_odds: s.odds,
    model: {
      base_value_usd: s.base,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
export function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
export function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's main action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('payment')) return `Move $${capital} through ${name} on ${chain} and keep the account active.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, different action in the same protocol, so the farm is a real user, not one deposit. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(10, Math.round(capital / 5));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Borrow $${small} against the supply on ${name}, then repay it in full within a week.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Swap $${small} through ${name}'s own router on ${chain} instead of routing around it.`;
  if (c.includes('bridge')) return `Bridge $${small} back through ${name} so the record shows use in both directions.`;
  if (c.includes('staking') || c.includes('restak')) return `Unstake and restake $${small} once, so the position is not a single untouched deposit.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Close the hedge and open a fresh one of $${small} so the account shows repeated use.`;
  if (c.includes('prediction')) return `Settle one market and place a second $${small} position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move $${small} between two ${name} vaults on ${chain} and keep the larger share where it was.`;
  if (c.includes('stable')) return `Redeem $${small} of the stable asset and mint it again through ${name}.`;
  if (c.includes('rwa')) return `Claim the accrued yield on the ${name} position once, then leave the principal in place.`;
  if (c.includes('insurance')) return `File a test quote for a second cover amount on ${name} and keep the first policy active.`;
  if (c.includes('basis')) return `Withdraw $${small} from the ${name} vault and redeposit it the following week.`;
  if (c.includes('payment')) return `Send a second $${small} payment through ${name} on ${chain} a week after the first.`;
  return `Use a second feature of ${name} on ${chain}, such as its swap, vote or rewards page, for $${small}.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, capital, chain),
      cost: `$${capital >= 150 ? 6 : 3} of gas`,
      time: '10 minutes',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never leave the wallet untouched for a month.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log, and plan the exit now: unwind in two steps, keep the receipts, and leave a dust position until the claim window closes.`,
      cost: 'nothing but the log',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    watchlist: row.watchlist,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_value_usd: row.model.base_value_usd,
    launch_odds: row.launch_odds,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  model: ModelConstants = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const comps = liveComps(snapshot);
  const fit = fitPowerLaw(comps);
  const validation = validateModel(snapshot, model);
  const rates = peerLaunchRates(snapshot);
  const board = buildBoard(snapshot, fit, rates, model);
  const live = liveRows(snapshot);
  const filing = buildFiling(snapshot, board);
  const early = board.filter((r) => !r.watchlist && r.tvl_usd < snapshot.floor_usd).length;
  const vettedSize = board.filter((r) => !r.watchlist && r.tvl_usd >= snapshot.floor_usd).length;
  const movers = board
    .filter((r) => r.change_7d !== null && r.tvl_usd >= 10_000_000)
    .sort((a, b) => b.change_7d! - a.change_7d! || b.tvl_usd - a.tvl_usd)
    .slice(0, MOVERS_ROWS)
    .map((r) => ({
      rank: r.rank,
      slug: r.slug,
      name: r.name,
      change_7d: r.change_7d!,
      tvl_usd: r.tvl_usd,
      implied_value_usd: r.implied_value_usd,
    }));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    power_law: fit,
    validation,
    launch_rates: rates,
    integrity: {
      protocols: snapshot.protocols.length,
      no_change_7d: snapshot.protocols.filter((p) => p.change_7d === null).length,
      no_listed_at: snapshot.protocols.filter((p) => p.listed_at === null).length,
      live_comps: comps.length,
      zero_mcap_excluded: snapshot.protocols.filter(
        (p) => !isPreToken(p) && p.category !== 'CEX' && p.mcap_usd === 0,
      ).length,
    },
    peer_context: peerContext(snapshot),
    movers,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    vetted_size: vettedSize,
    live_size: live.length,
    filing: {
      total: filing.total,
      ranked: filing.ranked,
      live: filing.live,
      excluded_category: filing.excluded_category,
      excluded_name: filing.excluded_name,
      excluded_manual: filing.excluded_manual,
    },
    total_implied_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
