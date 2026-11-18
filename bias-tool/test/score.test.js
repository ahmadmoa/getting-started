const test = require('node:test');
const assert = require('node:assert');

const { computeBias, headlineWeight, percentages, leanLabel } = require('../src/score');
const { lastSessionOpen, tzOffsetMinutes } = require('../src/time');
const { Store } = require('../src/store');
const { seedDemo } = require('../src/news/demo');
const config = require('../src/config');

const gold = { id: 'gold', name: 'Gold' };
const NOW = Date.UTC(2026, 10, 18, 14, 0); // Wed 18 Nov 2026 09:00 New York

function judged(minAgo, impact, theme, direction, reason = 'because') {
    return {
        id: `h${minAgo}${direction}`,
        title: `headline ${minAgo}`,
        source: 'test',
        publishedAt: NOW - minAgo * 60000,
        status: 'judged',
        theme,
        impact,
        judgments: direction ? { gold: { direction, reason } } : {},
    };
}

const opts = { nowMs: NOW, windowStart: NOW - 12 * 3600000, tauMin: 170, windowLabel: 'since the open' };

test('weight decays with age (≈2h half-life at tau=170)', () => {
    assert.strictEqual(headlineWeight(3, NOW, NOW, 170), 3);
    const half = headlineWeight(2, NOW - 118 * 60000, NOW, 170);
    assert.ok(Math.abs(half - 1) < 0.01, `got ${half}`);
});

test('percentages always add to 100', () => {
    for (const vals of [[1, 1, 1], [0.2, 5.1, 94.7], [3, 0, 0], [1, 2]]) {
        assert.strictEqual(percentages(vals).reduce((a, b) => a + b, 0), 100);
    }
    assert.deepStrictEqual(percentages([0, 0]), [0, 0]);
});

test('lean thresholds', () => {
    assert.strictEqual(leanLabel(0.05), 'No clear lean');
    assert.strictEqual(leanLabel(-0.3), 'Slight lean');
    assert.strictEqual(leanLabel(0.5), 'Moderate lean');
    assert.strictEqual(leanLabel(-0.9), 'Strong lean');
});

test('bearish consensus, themes and summary', () => {
    const rows = [
        judged(5, 4, 'War and energy supply', 'lower'),
        judged(20, 3, 'War and energy supply', 'lower'),
        judged(40, 2, 'War and energy supply', 'mixed'),
        judged(60, 1, 'Inflation', 'higher'),
        judged(30, 3, 'Fed and rates', null), // irrelevant to gold
        { id: 'p', title: 'pending', source: 't', publishedAt: NOW - 60000, status: 'pending' },
        judged(13 * 60, 5, 'Fed and rates', 'higher'), // outside window
    ];
    const r = computeBias(gold, rows, opts);
    assert.strictEqual(r.bias, 'Bearish');
    assert.strictEqual(r.counts.total, 5);
    assert.deepStrictEqual(
        { h: r.counts.higher, l: r.counts.lower, m: r.counts.mixed, p: r.counts.pending },
        { h: 1, l: 2, m: 1, p: 1 },
    );
    assert.strictEqual(r.pct.higher + r.pct.lower + r.pct.mixed, 100);
    assert.strictEqual(r.themes[0].theme, 'War and energy supply');
    assert.strictEqual(r.themes[0].direction, 'lower');
    assert.strictEqual(r.themes[0].agreeing, 2);
    assert.match(r.summary, /^\w+ bearish lean from 5 headlines since the open\./);
    assert.match(r.summary, /main driver is War and energy supply, pushing Gold lower/);
    assert.match(r.summary, /Inflation pushes the other way/);
});

test('no headlines gives a neutral, empty result', () => {
    const r = computeBias(gold, [], opts);
    assert.strictEqual(r.bias, 'Neutral');
    assert.strictEqual(r.counts.total, 0);
    assert.match(r.summary, /No headlines/);
});

test('session open is 17:00 New York, skipping the weekend', () => {
    // Wed 09:00 NY -> Tue 17:00 NY (22:00 UTC, EST)
    assert.strictEqual(lastSessionOpen(NOW, '17:00', 'America/New_York'), Date.UTC(2026, 10, 17, 22, 0));
    // Sat 12:00 NY -> Thu 17:00 NY (Friday 17:00 is the weekly close)
    const sat = Date.UTC(2026, 10, 21, 17, 0);
    assert.strictEqual(lastSessionOpen(sat, '17:00', 'America/New_York'), Date.UTC(2026, 10, 19, 22, 0));
    // Summer time (EDT, UTC-4)
    const july = Date.UTC(2026, 6, 15, 12, 0);
    assert.strictEqual(lastSessionOpen(july, '17:00', 'America/New_York'), Date.UTC(2026, 6, 14, 21, 0));
    assert.strictEqual(tzOffsetMinutes(new Date(july), 'America/New_York'), -240);
});

test('store dedupes the same headline from different feeds', () => {
    const s = new Store(null);
    assert.strictEqual(s.add({ title: 'Gold hits record high', source: 'A' }), true);
    assert.strictEqual(s.add({ title: 'Gold hits record  high!', source: 'B' }), false);
    assert.strictEqual(s.pending(10).length, 1);
});

test('demo data only uses known assets, themes and directions', () => {
    const s = new Store(null);
    seedDemo(s, NOW);
    const ids = new Set(config.ASSETS.map((a) => a.id));
    for (const h of s.all()) {
        if (h.status !== 'judged') continue;
        assert.ok(config.THEMES.includes(h.theme), h.theme);
        assert.ok(h.impact >= 1 && h.impact <= 5);
        for (const [asset, j] of Object.entries(h.judgments)) {
            assert.ok(ids.has(asset), asset);
            assert.ok(['higher', 'lower', 'mixed'].includes(j.direction));
            assert.ok(j.reason.length > 10);
        }
    }
});
