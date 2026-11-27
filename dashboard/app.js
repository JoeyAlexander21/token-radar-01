// Token Radar's dashboard (radar-3). It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail dialog with
// the model's own inputs and the protocol's farm plan, a value map, and a model sandbox. No
// network: every byte it shows is in data.js. No protocol name is special-cased anywhere.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var MODEL = DATA.model;
  var FIT = DATA.power_law;
  var state = {
    q: '', category: 'all', chain: 'all', watch: false, tab: 'pre-token',
    sort: 'implied', dir: -1, selected: null,
    growthWeight: MODEL.growth_weight, matFloor: MODEL.maturity_floor
  };

  var usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd0.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function round4(n) { return Math.round(n * 1e4) / 1e4; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ordinal(n) {
    if (n === 1) return 'largest';
    if (n === 2) return '2nd largest';
    if (n === 3) return '3rd largest';
    return n + 'th largest';
  }

  // The model in one function, with the sandbox's overrides: the page recomputes a row from the
  // snapshot figures and checks the number board.json carries, so the page's code and the board's
  // data are visibly the same arithmetic. At the sandbox defaults the recompute must match.
  function impliedOf(row, growthWeight, matFloor) {
    var gw = growthWeight === undefined ? state.growthWeight : growthWeight;
    var mf = matFloor === undefined ? state.matFloor : matFloor;
    var base = Math.pow(10, FIT.intercept + FIT.slope * Math.log10(row.tvl_usd));
    var growth = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * gw;
    var age = row.age_days === null || row.age_days === undefined ? MODEL.unknown_age_days : row.age_days;
    var maturity = mf + (1 - mf) * (Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days);
    return Math.max(1, Math.round(base * growthMult * maturity));
  }
  function sandboxActive() {
    return state.growthWeight !== MODEL.growth_weight || state.matFloor !== MODEL.maturity_floor;
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and
  // age decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield-bearing asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('basis') >= 0) return 'Deposit $' + capital + ' of USDC into ' + name + "'s basis vault on " + chain + ' and keep the position open.';
    if (c.indexOf('payment') >= 0) return 'Move $' + capital + ' through ' + name + ' on ' + chain + ' and keep the account active.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    var small = Math.max(10, Math.round(capital / 5));
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow $' + small + ' against the supply on ' + name + ', then repay it in full within a week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap $' + small + " through " + name + "'s own router on " + chain + ' instead of routing around it.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + small + ' back through ' + name + ' so the record shows use in both directions.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Unstake and restake $' + small + ' once, so the position is not a single untouched deposit.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Close the hedge and open a fresh one of $' + small + ' so the account shows repeated use.';
    if (c.indexOf('prediction') >= 0) return 'Settle one market and place a second $' + small + ' position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Move $' + small + ' between two ' + name + ' vaults on ' + chain + ' and keep the larger share where it was.';
    if (c.indexOf('stable') >= 0) return 'Redeem $' + small + ' of the stable asset and mint it again through ' + name + '.';
    if (c.indexOf('rwa') >= 0) return 'Claim the accrued yield on the ' + name + ' position once, then leave the principal in place.';
    if (c.indexOf('insurance') >= 0) return 'File a test quote for a second cover amount on ' + name + ' and keep the first policy active.';
    if (c.indexOf('basis') >= 0) return 'Withdraw $' + small + ' from the ' + name + ' vault and redeposit it the following week.';
    if (c.indexOf('payment') >= 0) return 'Send a second $' + small + ' payment through ' + name + ' on ' + chain + ' a week after the first.';
    return 'Use a second feature of ' + name + ' on ' + chain + ', such as its swap, vote or rewards page, for $' + small + '.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: '$' + (capital >= 150 ? 6 : 3) + ' of gas', time: '10 minutes' },
      { text: 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote, and never leave the wallet untouched for a month.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, and plan the exit now: unwind in two steps, keep the receipts, and leave a dust position until the claim window closes.', cost: 'nothing but the log', time: '10 minutes' }
    ].map(stepText);
  }
  // The farm's whole economics, from the same capital and hold: setup gas, second-action gas,
  // $2 of gas for each weekly action, and the minutes the seven steps take.
  function farmEconomics(p) {
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var weeks = Math.ceil(hold / 7);
    var gas = (capital >= 150 ? 8 : 4) + (capital >= 150 ? 6 : 3) + 2 * weeks;
    var minutes = 50 + 10 * weeks;
    return { capital: capital, hold: hold, weeks: weeks, gas: gas, hours: (minutes / 60).toFixed(1) };
  }
  // Why this protocol ranks where it does, from its own figures: its TVL standing inside its
  // category, its momentum, its age, and its peers' launch rate.
  function whyText(row) {
    var sameCat = DATA.rows.filter(function (r) { return (r.category || 'Other') === (row.category || 'Other'); }).sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    var pos = 1;
    for (var i = 0; i < sameCat.length; i++) if (sameCat[i].slug === row.slug) pos = i + 1;
    var g = row.change_7d === null ? 'no 7-day change reported' : (row.change_7d >= 0 ? 'up ' + fmtPct(row.change_7d) + ' this week' : 'down ' + fmtPct(row.change_7d) + ' this week');
    return 'Rank ' + row.rank + ' of ' + DATA.board_size + ': the ' + ordinal(pos) + ' tokenless TVL among the board’s ' + (row.category || 'Other') + ' rows, ' + g + ', ' + fmtAge(row.age_days) + ' with no token. ' + Math.round(row.launch_odds * 100) + '% of protocols this old and this big already have a token — this one is the rare holdout, which cuts both ways: overdue, or never.';
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watch')) state.watch = params.get('watch') === '1';
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watch) params.set('watch', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watch && !r.watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'odds') { av = a.launch_odds; bv = b.launch_odds; }
      else { av = impliedOf(a); bv = impliedOf(b); }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var ig = DATA.integrity;
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Every pre-token protocol, ranked by implied value' }),
        el('p', null,
          'The watchlist is the floor: ', el('b', { text: DATA.watchlist_size + ' protocols' }),
          ' with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ',
          el('b', { text: DATA.early_size + ' more pre-token protocols' }),
          ' below that floor, and manual vetting adds ',
          el('b', { text: DATA.vetted_size + ' more above it' }),
          ', so the board holds ', el('b', { text: DATA.board_size + ' rows' }),
          ' in all. Every one of the snapshot’s ', el('b', { text: DATA.filing.total + ' protocols' }),
          ' is filed below — ranked, live-token, or set aside with a reason. Implied value is a fitted model, not a promise of a launch.'),
        el('p', { id: 'sandbox-note', class: 'note', text: sandboxActive() ? 'Model sandbox is on: the values below use your slider settings, not the board. Reset it to see the ranked board.' : 'Move the sliders in “How implied value is computed” to test the model — the board re-sorts live.' }),
        el('p', { class: 'strip', text: 'Data integrity, snapshot ' + DATA.as_of + ': ' + ig.protocols + ' protocols · ' + ig.no_change_7d + ' without a 7-day change · ' + ig.no_listed_at + ' without a listing date (age assumed 365d) · ' + ig.zero_mcap_excluded + ' live protocols with a $0 market cap excluded from the fit · fit on ' + ig.live_comps + ' live comparables.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Snapshot filed' }), el('b', { text: DATA.filing.total + ' / ' + DATA.filing.total })),
        el('div', { class: 'fact' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(DATA.total_implied_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token set aside' }), el('b', { text: String(DATA.live_size) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); refreshBoard(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); refreshBoard(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); refreshBoard(); });
    var watchBox = el('input', { type: 'checkbox', id: 'watch', checked: state.watch ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watchBox.addEventListener('change', function () { state.watch = watchBox.checked; writeHash(); refreshBoard(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field check' }, watchBox, el('span', { text: 'Watchlist only' })),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { id: 'row-count', class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function moversPanel() {
    var items = DATA.movers.map(function (m) {
      return el('button', { class: 'mover', type: 'button', onclick: function () { openDetail(m.slug); } },
        el('b', { text: m.name }),
        el('span', { class: 'pos', text: fmtPct(m.change_7d) }),
        el('span', { class: 'sub', text: 'rank ' + m.rank + ' · ' + fmtUsd(m.tvl_usd) + ' TVL' })
      );
    });
    return el('section', { class: 'panel movers' },
      el('h2', { text: 'Fastest growing this week' }),
      el('p', { class: 'sub', text: 'The board’s biggest 7-day TVL jumps — momentum is where a launch gets noticed first. Select one for its model and farm plan.' }),
      el('div', { class: 'mover-list' }, items)
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return impliedOf(r); }).concat([1]));
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var shown = impliedOf(r);
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: Math.round(r.launch_odds * 100) + '%' }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((shown / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(shown) })
        )),
        el('td', null,
          el('span', { class: 'chip pre', text: 'no token' }),
          r.watchlist ? el('span', { class: 'chip watch', text: 'watchlist' }) : null
        )
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. “Peers launched” is the share of protocols this old and this big that already have a token. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('odds', 'Peers launched'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'chip live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and they are the comparables the power law is fitted on.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  // The value map: log TVL across, log implied value up. Amber dots are the watchlist, teal
  // dots the early radar. Built as one SVG string, so the panel stays small in the source.
  function valueMap() {
    var W = 760, H = 250, PL = 48, PR = 14, PT = 12, PB = 28;
    var tvls = DATA.rows.map(function (r) { return r.tvl_usd; });
    var vals = DATA.rows.map(function (r) { return r.implied_value_usd; });
    var minT = Math.floor(Math.log10(Math.min.apply(null, tvls)));
    var maxT = Math.ceil(Math.log10(Math.max.apply(null, tvls)));
    var minV = Math.floor(Math.log10(Math.min.apply(null, vals)));
    var maxV = Math.ceil(Math.log10(Math.max.apply(null, vals)));
    var x = function (t) { return PL + (Math.log10(t) - minT) / (maxT - minT) * (W - PL - PR); };
    var y = function (v) { return PT + (1 - (Math.log10(v) - minV) / (maxV - minV)) * (H - PT - PB); };
    var grid = '';
    for (var t = minT; t <= maxT; t++) {
      var gx = x(Math.pow(10, t));
      grid += '<line x1="' + gx.toFixed(1) + '" y1="' + PT + '" x2="' + gx.toFixed(1) + '" y2="' + (H - PB) + '" stroke="#e8e0cd"/>';
      grid += '<text x="' + gx.toFixed(1) + '" y="' + (H - 8) + '" font-size="10" fill="#5b6b7a" text-anchor="middle">$' + (Math.pow(10, t) >= 1e9 ? (Math.pow(10, t) / 1e9) + 'B' : (Math.pow(10, t) / 1e6) + 'M') + '</text>';
    }
    for (var v = minV; v <= maxV; v++) {
      var gy = y(Math.pow(10, v));
      grid += '<line x1="' + PL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - PR) + '" y2="' + gy.toFixed(1) + '" stroke="#e8e0cd"/>';
      grid += '<text x="' + (PL - 6) + '" y="' + (gy + 3).toFixed(1) + '" font-size="10" fill="#5b6b7a" text-anchor="end">$' + (Math.pow(10, v) >= 1e6 ? (Math.pow(10, v) / 1e6) + 'M' : Math.pow(10, v) / 1e3 + 'K') + '</text>';
    }
    var dots = DATA.rows.map(function (r) {
      return '<circle cx="' + x(r.tvl_usd).toFixed(1) + '" cy="' + y(r.implied_value_usd).toFixed(1) + '" r="' + (r.watchlist ? 5 : 3.5) + '" fill="' + (r.watchlist ? '#c26a06' : '#0e7c6b') + '" fill-opacity="0.8"><title>' + esc(r.name) + ' — ' + fmtUsd(r.implied_value_usd) + '</title></circle>';
    }).join('');
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Value map: TVL against implied value, log scales">' + grid + dots + '</svg>';
    return el('section', { class: 'panel vmap' },
      el('h2', { text: 'Value map' }),
      el('p', { class: 'sub', text: 'Each dot is a protocol: TVL across, implied value up, both on log scales. Amber dots are the watchlist; teal dots are the rest of the board. The cloud bends: value grows with the square root of TVL, not with TVL itself — that bend is the fitted power law.' }),
      el('div', { html: svg })
    );
  }

  function modelPanel() {
    var m = MODEL;
    var v = DATA.validation;
    var pc = DATA.peer_context;
    var gw = el('input', { type: 'range', id: 'gw', min: '0', max: '1', step: '0.05', value: String(state.growthWeight), 'aria-label': 'Growth weight' });
    var gwOut = el('output', { for: 'gw', text: 'growth weight ' + state.growthWeight.toFixed(2) });
    gw.addEventListener('input', function () { state.growthWeight = parseFloat(gw.value); gwOut.textContent = 'growth weight ' + state.growthWeight.toFixed(2); refreshBoard(); });
    var mf = el('input', { type: 'range', id: 'mf', min: '0.6', max: '1', step: '0.05', value: String(state.matFloor), 'aria-label': 'Maturity floor' });
    var mfOut = el('output', { for: 'mf', text: 'maturity floor ' + state.matFloor.toFixed(2) });
    mf.addEventListener('input', function () { state.matFloor = parseFloat(mf.value); mfOut.textContent = 'maturity floor ' + state.matFloor.toFixed(2); refreshBoard(); });
    var reset = el('button', { class: 'button', type: 'button', text: 'Reset sandbox', onclick: function () { state.growthWeight = MODEL.growth_weight; state.matFloor = MODEL.maturity_floor; render(); } });
    var validBody = el('tbody');
    [
      ['Leave-one-out (n=' + v.leave_one_out.n + ')', v.leave_one_out, v.baseline_leave_one_out],
      ['Walk-forward (n=' + v.walk_forward.n + ')', v.walk_forward, v.baseline_walk_forward]
    ].forEach(function (row) {
      validBody.appendChild(el('tr', null,
        el('td', { text: row[0] }),
        el('td', { class: 'num', text: String(row[1].median_abs_log10_error) }),
        el('td', { class: 'num', text: Math.round(row[1].within_2x * 100) + '%' }),
        el('td', { class: 'num', text: String(row[2].median_abs_log10_error) }),
        el('td', { class: 'num', text: Math.round(row[2].within_2x * 100) + '%' })
      ));
    });
    var peerRows = Object.keys(pc.by_category).map(function (k) {
      return { cat: k, n: pc.by_category[k].n, median: pc.by_category[k].median };
    }).sort(function (a, b) { return b.median - a.median || (a.cat < b.cat ? -1 : 1); });
    var peerBody = el('tbody');
    peerRows.forEach(function (r) {
      peerBody.appendChild(el('tr', null,
        el('td', { text: r.cat }),
        el('td', { class: 'num', text: String(r.n) }),
        el('td', { class: 'num', text: r.median.toFixed(3) + 'x' })
      ));
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every protocol; no name is special-cased. The base is a power law fitted on the snapshot itself: log10(market cap) = ' + FIT.intercept + ' + ' + FIT.slope + ' × log10(TVL), ordinary least squares over ' + FIT.n + ' live protocols with a market cap above zero. The fit is sublinear — value grows with the square root of TVL, not with TVL — because live market caps grow far slower than TVL. A flat TVL × 0.25 multiple would put the biggest protocol near $700M; the fitted curve puts it near $70M, where live protocols of that size actually trade.' }),
      el('div', { class: 'formula' },
        'implied = round( 10 ^ (' + FIT.intercept + ' + ' + FIT.slope + ' x log10(tvl_usd)) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + ' + m.maturity_range + ' x min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ') )'
      ),
      el('p', { class: 'sub', text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed — how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days, and age moves the value by at most ' + Math.round(m.maturity_range * 100) + '%. “Peers launched” is separate from the value: the share of protocols this old and this big that already have a token (global rate ' + Math.round(DATA.launch_rates.global * 100) + '%), shrunk toward the global rate. This is an estimate, not a price, and “records no token” is DefiLlama’s record, never proof a protocol has none.' }),
      el('div', { class: 'sandbox' },
        el('div', null, el('label', { for: 'gw', text: 'Model sandbox: growth weight' }), gw, gwOut),
        el('div', null, el('label', { for: 'mf', text: 'Model sandbox: maturity floor' }), mf, mfOut),
        el('div', { class: 'note' }, 'The sandbox re-scores the board live so you can stress-test the model. It changes only this page — board.json keeps the model as submitted. ', reset)
      ),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'calib' },
          el('caption', { class: 'sub', text: 'Blind tests: the model and a TVL × global-median baseline (' + v.baseline_global_multiple + 'x), predicting live market caps they were not fitted on. Lower median log error is better; live caps are noisy, so even the winner misses by ~0.5 dex (about 3x) half the time.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Test' }), el('th', { scope: 'col', text: 'Model error (dex)' }), el('th', { scope: 'col', text: 'Model within 2x' }), el('th', { scope: 'col', text: 'Baseline error (dex)' }), el('th', { scope: 'col', text: 'Baseline within 2x' }))),
          validBody
        )
      ),
      el('p', { class: 'note', text: 'Terms tested and dropped because they worsened held-out error: per-category multiples (leave-one-out error 0.53 → 0.57 dex) and chain breadth (within-2x 35.3% → 34.5%). The table below is peer context only — information, not an input to the value.' }),
      el('div', { class: 'table-wrap' },
        el('table', { class: 'calib' },
          el('caption', { class: 'sub', text: 'Peer context: live market-cap / TVL medians by category (global ' + pc.global_multiple + 'x).' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Live comps' }), el('th', { scope: 'col', text: 'Median mcap / TVL' }))),
          peerBody
        )
      )
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var steps = farmSteps(row);
    var econ = farmEconomics(row);
    var recomputed = impliedOf(row, MODEL.growth_weight, MODEL.maturity_floor);
    var peer = DATA.peer_context.by_category[row.category || 'Other'];
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? ' — watchlist' : row.tvl_usd >= DATA.floor_usd ? ' — vetted above the floor' : ' — early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('p', { class: 'sub', text: whyText(row) }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Power-law base' }), el('b', { class: 'num', text: fmtUsd(row.base_value_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Peers launched' }), el('b', { class: 'num', text: Math.round(row.launch_odds * 100) + '%' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + (peer ? ' Live ' + (row.category || 'Other') + ' protocols (' + peer.n + ' live comp' + (peer.n === 1 ? '' : 's') + ') trade at a median ' + peer.median + 'x TVL — peer context, not an input to this value.' : '') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      })),
      el('p', { class: 'note', text: 'Farm economics: $' + econ.capital + ' of capital, about $' + econ.gas + ' of gas over ' + econ.hold + ' days (' + econ.weeks + ' weekly actions), and about ' + econ.hours + ' hours of your time. A farm costs real money and the token may never come — never farm more than you can lose, and never pay to claim.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  // The filing table: every protocol in the snapshot, one row each, so the board's coverage
  // can be checked name by name. filing.js carries the rows (window.FILING_TEXT) and the
  // manual reasons (window.FILING_MANUAL); data.js carries only the counts.
  function filingPanel() {
    var f = DATA.filing;
    if (!f) return null;
    var text = typeof window.FILING_TEXT === 'string' ? window.FILING_TEXT : '';
    var manual = window.FILING_MANUAL || {};
    var names = {};
    DATA.rows.forEach(function (r) { names[r.slug] = r.name; });
    DATA.live.forEach(function (r) { names[r.slug] = r.name; });
    var rows = text.split('\n').filter(function (l) { return l.length > 0; });
    var tbody = el('tbody');
    rows.forEach(function (line) {
      var parts = line.split(' ');
      var slug = parts[0], code = parts[1];
      var label = code === 'R' ? 'ranked' : code === 'L' ? 'live token' : code === 'C' ? 'excluded: category rule' : code === 'N' ? 'excluded: name rule' : 'excluded: manual vetting';
      tbody.appendChild(el('tr', null,
        el('td', { text: slug }),
        el('td', { text: names[slug] || '' }),
        el('td', { text: label }),
        el('td', { text: code === 'P' ? (manual[slug] || '') : '' })
      ));
    });
    return el('section', { class: 'panel' },
      el('h2', { text: 'Filing: all ' + f.total + ' protocols accounted for' }),
      el('p', { class: 'sub', text: f.ranked + ' ranked on the board · ' + f.live + ' live-token, set aside with their market caps · ' + f.excluded_category + ' excluded by the category rule · ' + f.excluded_name + ' excluded by the name rule · ' + f.excluded_manual + ' excluded by manual vetting. Nothing in the snapshot is unaccounted for.' }),
      el('details', null,
        el('summary', { text: 'Full filing table (' + rows.length + ' rows)' }),
        el('div', { class: 'table-wrap' },
          el('table', { class: 'calib' },
            el('caption', { class: 'sub', text: 'One row per protocol in the snapshot. R ranked on the board; L live token, set aside with its market cap; C excluded by the category rule (Bridge, Canonical Bridge, Liquid Staking, Liquid Restaking, Restaked BTC, CEX); N excluded by the name rule (versioned name, wrapped/staked/staking, exchange prefix); P excluded by manual vetting on 27 Nov 2026, with the reason given.' }),
            el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'Name' }), el('th', { scope: 'col', text: 'Filing' }), el('th', { scope: 'col', text: 'Reason' }))),
            tbody
          )
        )
      )
    );
  }

  function footer() {
    return el('p', { class: 'foot' },
      'Source: ' + DATA.source + '. Snapshot date ' + DATA.as_of + '. “No token” means DefiLlama records no token for the protocol — not proof it has none. Implied values are this entry’s fitted model, not a prediction that a token launches, when it launches, or what it trades at. Do your own research; never pay to claim an airdrop.'
    );
  }

  // Re-render only the table (and its count + the sandbox note) so typing in the search box
  // or dragging a sandbox slider never loses focus or rebuilds the controls mid-gesture.
  function refreshBoard() {
    var panel = document.getElementById('board-panel');
    if (panel) {
      panel.textContent = '';
      panel.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    }
    var count = document.getElementById('row-count');
    if (count) count.textContent = state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows shown' : DATA.live.length + ' live-token protocols';
    var note = document.getElementById('sandbox-note');
    if (note) note.textContent = sandboxActive() ? 'Model sandbox is on: the values below use your slider settings, not the board. Reset it to see the ranked board.' : 'Move the sliders in “How implied value is computed” to test the model — the board re-sorts live.';
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    if (state.tab === 'pre-token') shell.appendChild(moversPanel());
    shell.appendChild(el('div', { id: 'board-panel' }, state.tab === 'pre-token' ? boardTable() : liveTable()));
    if (state.tab === 'pre-token') shell.appendChild(valueMap());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    if (state.tab === 'pre-token') shell.appendChild(filingPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
