const path = require('path');
const express = require('express');

const config = require('./config');
const { Store } = require('./store');
const { computeBias } = require('./score');
const { lastSessionOpen } = require('./time');
const { getTiles } = require('./prices');
const { pullAll, feedStatus } = require('./news/feeds');
const classifier = require('./classify');

const store = new Store(config.DEMO ? null : config.DATA_FILE);
const assetsById = new Map(config.ASSETS.map((a) => [a.id, a]));

// Start of the scoring window. Demo mode stretches it so the sample
// headlines (up to ~4h old) are always inside it.
function windowStartFor(nowMs) {
    const open = lastSessionOpen(nowMs, config.SESSION_OPEN, config.SESSION_TZ);
    return config.DEMO ? Math.min(open, nowMs - 5 * 3600 * 1000) : open;
}

// ---- Pipeline: ingest -> judge -------------------------------------------

let busy = false;
async function cycle() {
    if (busy) return;
    busy = true;
    try {
        const now = Date.now();
        if (!config.DEMO) await pullAll(config.NEWS_FEEDS, store);
        store.prune(now);
        // Judge only headlines inside the current window, newest first.
        const windowStart = windowStartFor(now);
        let batch = store.pending(config.CLASSIFY_BATCH).filter((h) => h.publishedAt >= windowStart);
        while (batch.length) {
            // Throws on auth/network/API errors: those don't count as attempts,
            // so headlines get judged once the key or connection is fixed.
            const results = await classifier.classifyBatch(batch);
            for (const [id, j] of results) store.applyJudgment(id, j);
            // Headlines the model answered without judging count as an attempt
            // (gives up after 5, so one odd headline can't block the queue).
            store.markAttempt(batch.filter((h) => !results.has(h.id)).map((h) => h.id));
            if (results.size === 0) break;
            batch = store.pending(config.CLASSIFY_BATCH).filter((h) => h.publishedAt >= windowStart);
        }
    } catch (err) {
        console.error('[cycle]', err.message);
    } finally {
        busy = false;
    }
}

// ---- HTTP API ------------------------------------------------------------

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/assets', (req, res) => {
    res.json(config.ASSETS.map(({ id, name, symbol, badge }) => ({ id, name, symbol, badge })));
});

app.get('/api/bias/:asset', async (req, res) => {
    const asset = assetsById.get(req.params.asset);
    if (!asset) return res.status(404).json({ error: 'Unknown asset' });

    const nowMs = Date.now();
    const windowStart = windowStartFor(nowMs);
    const result = computeBias(asset, store.all(), {
        nowMs,
        windowStart,
        tauMin: config.DECAY_TAU_MIN,
        windowLabel: config.WINDOW_LABEL,
    });

    const sort = req.query.sort === 'relevant' ? 'relevant' : 'newest';
    result.headlines.sort((a, b) => (sort === 'relevant' ? b.weight - a.weight : 0) || b.publishedAt - a.publishedAt);

    res.json({
        asset: { id: asset.id, name: asset.name, symbol: asset.symbol, badge: asset.badge, unit: asset.unit, decimals: asset.decimals },
        window: { start: windowStart, label: config.WINDOW_LABEL },
        now: nowMs,
        ...result,
        prices: await getTiles(asset, nowMs, lastSessionOpen(nowMs, config.SESSION_OPEN, config.SESSION_TZ)),
        status: {
            demo: config.DEMO,
            classifier: classifier.status(),
        },
    });
});

// Push headlines from any source (your own scraper, a Telegram/Discord
// squawk bot, a paid news webhook). Body: { title, source?, url?, publishedAt? }
// or an array of those.
app.post('/api/headlines', (req, res) => {
    if (config.INGEST_TOKEN && req.get('authorization') !== `Bearer ${config.INGEST_TOKEN}`) {
        return res.status(401).json({ error: 'Bad token' });
    }
    const items = Array.isArray(req.body) ? req.body : [req.body];
    const added = items.filter((i) => i && store.add(i)).length;
    res.json({ added });
    if (added) cycle();
});

app.get('/api/status', (req, res) => {
    const all = store.all();
    res.json({
        demo: config.DEMO,
        headlines: all.length,
        pending: all.filter((h) => h.status === 'pending').length,
        feeds: feedStatus(),
        classifier: classifier.status(),
        prices: config.PRICE_PROVIDER,
    });
});

// ---- Start ---------------------------------------------------------------

if (config.DEMO) {
    require('./news/demo').seedDemo(store);
    console.log('Demo mode: invented headlines, synthetic prices, no API calls.');
}

app.listen(config.PORT, () => {
    console.log(`Bias tool on http://localhost:${config.PORT}`);
    cycle();
    setInterval(cycle, config.POLL_SECONDS * 1000);
});
