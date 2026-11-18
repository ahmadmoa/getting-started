// "Right now" tiles: % change from the open of the current candle on each
// timeframe. Providers: Yahoo (free, unofficial, delayed) or demo (synthetic).
// For production use your broker's or a paid feed (OANDA, Polygon, Twelve Data).

const config = require('./config');

const TIMEFRAMES = [
    { tf: 'D', minutes: 1440 },
    { tf: 'H4', minutes: 240 },
    { tf: 'H1', minutes: 60 },
    { tf: 'M30', minutes: 30 },
    { tf: 'M15', minutes: 15 },
    { tf: 'M5', minutes: 5 },
];

// Candle opens. D and H4 align to the session open (FX convention);
// the shorter ones align to the clock.
function candleOpens(nowMs, sessionOpen) {
    return TIMEFRAMES.map(({ tf, minutes }) => {
        let start;
        if (tf === 'D') start = sessionOpen;
        else if (tf === 'H4') start = sessionOpen + Math.floor((nowMs - sessionOpen) / (240 * 60000)) * 240 * 60000;
        else start = Math.floor(nowMs / (minutes * 60000)) * minutes * 60000;
        return { tf, start };
    });
}

const cache = new Map(); // asset id -> { at, value }

async function yahooTiles(asset, nowMs, sessionOpen) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.yahoo)}?interval=5m&range=5d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`Yahoo ${res.status}`);
    const json = await res.json();
    const r = json.chart && json.chart.result && json.chart.result[0];
    if (!r || !r.timestamp) throw new Error('No price data');
    const ts = r.timestamp.map((t) => t * 1000);
    const q = r.indicators.quote[0];
    let price = r.meta && r.meta.regularMarketPrice;
    if (price == null) {
        for (let i = q.close.length - 1; i >= 0; i--) if (q.close[i] != null) { price = q.close[i]; break; }
    }
    return candleOpens(nowMs, sessionOpen).map(({ tf, start }) => {
        const i = ts.findIndex((t, k) => t >= start && q.open[k] != null);
        if (i === -1 || price == null) return { tf, pct: null, abs: null };
        const open = q.open[i];
        return { tf, pct: ((price - open) / open) * 100, abs: price - open };
    });
}

// Deterministic pseudo-random walk so demo tiles are stable between refreshes.
function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
}
function demoTiles(asset, nowMs, sessionOpen) {
    const vol = { bitcoin: 2.2, oil: 1.6, silver: 1.5, nasdaq: 0.9, gold: 0.8, us10y: 1.2 }[asset.id] || 0.45;
    return candleOpens(nowMs, sessionOpen).map(({ tf, start }) => {
        const elapsedH = Math.max(0.02, (nowMs - start) / 3600000);
        const drift = (hash(asset.id + tf + start) - 0.5) * 2;
        const pct = drift * vol * Math.sqrt(elapsedH / 24) * 1.4;
        return { tf, pct, abs: (asset.demoPrice * pct) / 100 };
    });
}

async function getTiles(asset, nowMs, sessionOpen) {
    const hit = cache.get(asset.id);
    if (hit && nowMs - hit.at < 30000) return hit.value;
    let value;
    try {
        const tiles = config.PRICE_PROVIDER === 'demo' ? demoTiles(asset, nowMs, sessionOpen) : await yahooTiles(asset, nowMs, sessionOpen);
        value = { provider: config.PRICE_PROVIDER, updatedAt: nowMs, tiles, error: null };
    } catch (err) {
        value = { provider: config.PRICE_PROVIDER, updatedAt: nowMs, tiles: TIMEFRAMES.map(({ tf }) => ({ tf, pct: null, abs: null })), error: err.message };
    }
    cache.set(asset.id, { at: nowMs, value });
    return value;
}

module.exports = { getTiles, candleOpens };
