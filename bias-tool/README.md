# Bias tool

A "formulate a bias" dashboard. It reads market headlines as they arrive,
has Claude judge which way each one pushes 16 assets (gold, indices, oil,
FX majors, Bitcoin, US yields), and turns those judgments into a weighted
consensus:

- **Bullish / Bearish / Neutral**, with the strength of the lean
- the % of headline weight pointing higher, lower or mixed
- the **stories** (themes) driving the asset
- a live **headline feed**, newest or most relevant first
- price change from the current candle's open, from the daily candle down to M5

```
 news sources ──► ingest + dedupe ──► Claude judges ──► store ──► score ──► dashboard
 (RSS, webhook)      (store.js)       (classify.js)              (score.js)  (public/)
                                                     prices ──────────┘
                                                   (prices.js)
```

## Run it

```bash
cd bias-tool
npm install

# 1. Demo: invented headlines + synthetic prices, no key or network needed
npm run demo                     # http://localhost:3000

# 2. Live: real feeds, Claude judgments, Yahoo prices
export ANTHROPIC_API_KEY=sk-ant-...
npm start

npm test                         # scoring, session window, dedupe
```

You can also push headlines from anything you like, such as your own scraper,
a Telegram or Discord squawk bot, or a paid news webhook:

```bash
curl -X POST localhost:3000/api/headlines -H 'content-type: application/json' \
  -d '{"title":"Fed holds rates, signals two cuts this year","source":"my-feed"}'
```

## How it works

### 1. Ingest (`src/news/feeds.js`, `src/store.js`)
The server polls RSS feeds every `POLL_SECONDS`. Each headline is normalised
and hashed, so the same story from two feeds is stored once. New headlines
start as **Not judged yet**.

### 2. Judge (`src/classify.js`)
Pending headlines go to Claude in batches of `CLASSIFY_BATCH` (default 12).
One call judges a headline for **all** assets at once, so cost scales with the
number of headlines, not headlines × assets. For each headline Claude returns:

| field | meaning |
|---|---|
| `theme` | one of the themes in `config.js` (War and energy supply, Fed and rates, Inflation, …) |
| `impact` | 1–5: how much this one headline can move markets in the next few hours |
| `assets[]` | for each asset it plausibly moves: `higher` / `lower` / `mixed`, plus a one-line reason |

The response uses **structured outputs**, a JSON schema the API enforces, so
there is no fragile text parsing. Server-side **refusal fallbacks** are
switched on. The system prompt is cached.

`MARKET_CONTEXT` is the most important setting. The same headline can move an
asset in opposite directions in different market regimes. For example, a war
headline can lift gold as a safe haven, or sink it when markets treat war as
inflationary (higher oil, so higher yields and a stronger dollar). Tell Claude
which regime you are in:

```bash
export MARKET_CONTEXT="Markets trade Middle East escalation as inflationary: oil up, yields up, dollar up, gold down."
```

### 3. Score (`src/score.js`, pure functions)
- **Weight** of a headline = `impact × e^(−age / 170 min)`. That is roughly a
  2-hour half-life, so fresh, high-impact news dominates. This is the small
  number under each headline's timestamp.
- **Bullish / Neutral / Bearish %** = the share of total weight judged
  higher / mixed / lower.
- **Net** = (higher − lower) / total. The lean is *no clear lean* below 0.15,
  then *slight* below 0.4, *moderate* below 0.7, and *strong* above that.
- **Stories**: headlines are grouped by theme. Each theme's share of the
  weight, its direction split, and the reasoning from its heaviest headline
  become a card.
- The **summary paragraph** is built from a template using those numbers, not
  written by the LLM, so it can't drift from the figures above it.
- **Window**: only headlines since the last session open count. That is
  17:00 New York by default, the daily FX/futures roll, with the weekend
  skipped.

### 4. Prices (`src/prices.js`)
Each tile shows the change from the open of the current D / H4 / H1 / M30 /
M15 / M5 candle to now, using Yahoo's free chart endpoint (unofficial and
delayed). For anything serious, plug in your broker or a paid feed (OANDA,
Polygon, Twelve Data) by adding a provider next to `yahooTiles`.

## Configuration

| env var | default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | | Claude credentials |
| `CLASSIFY_MODEL` | `claude-opus-5-5` | set `claude-haiku-5-5` to cut cost ~40× (check that quality holds) |
| `CLASSIFY_EFFORT` | `low` | `low`/`medium`/`high`. Higher means more careful judgments but slower and costlier |
| `MARKET_CONTEXT` | | regime notes passed to Claude (see above) |
| `NEWS_FEEDS` | 3 public RSS feeds | comma-separated RSS/Atom URLs |
| `POLL_SECONDS` | `60` | how often to pull feeds and judge |
| `SESSION_OPEN` / `SESSION_TZ` | `17:00` / `America/New_York` | window start; e.g. `09:30` for the US cash open |
| `DECAY_TAU_MIN` | `170` | recency decay; smaller makes the board react faster |
| `PRICE_PROVIDER` | `yahoo` (`demo` in demo mode) | |
| `INGEST_TOKEN` | | when set, `POST /api/headlines` needs `Authorization: Bearer <token>` |
| `PORT` | `3000` | |

Assets and themes live in `src/config.js`. To add an asset, give it an id,
a name and a one-line note on what moves it and how it is quoted. Claude
reads those notes.

## Cost

A rough estimate on Opus 5.5 at low effort: about $0.005 per headline, judged
once for all 16 assets. At 500 headlines a day that is about $2–3 a day. Haiku
5.5 is about 40× cheaper. Check real figures in the Console's usage page.

## Taking it further

1. **Better news.** Free RSS lags. The tool in your screenshot runs on a
   real-time "squawk" feed. Look at FinancialJuice, Benzinga, Newsquawk, or the
   Reuters/Bloomberg terminal APIs if you have access. Wire any of them into
   `POST /api/headlines`.
2. **Two-stage judging.** Run a fast, cheap pass (impact plus relevance)
   first, then a deeper direction pass only on headlines with impact ≥ 2.
3. **Measure it.** Log each judgment with the asset's price 15, 60 and
   240 min later, then check how often "higher" was right. Use that to tune
   `MARKET_CONTEXT`, the decay and the lean thresholds, and to compare models
   and effort levels.
4. **Storage.** Replace the JSON file in `store.js` with SQLite or Postgres
   once you run it 24/7.
5. **Docker.** `docker build -t bias-tool . && docker run -p 3000:3000 -e
   ANTHROPIC_API_KEY bias-tool`. The Dockerfile was not built or tested in the
   environment where this was written.

> This is a decision-support tool that summarises headline sentiment. It is
> not a trading signal or financial advice.
