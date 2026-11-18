// Pure scoring: turns judged headlines into the bias, percentages, story
// groups and summary paragraph shown on the dashboard. No I/O here, so it is
// easy to unit-test and tune.

const IMPACT_LABEL = { 1: 'LOW', 2: 'MEDIUM', 3: 'MEDIUM', 4: 'HIGH', 5: 'HIGH' };

function headlineWeight(impact, publishedAt, nowMs, tauMin) {
    const ageMin = Math.max(0, (nowMs - publishedAt) / 60000);
    return impact * Math.exp(-ageMin / tauMin);
}

// Rounds shares to whole percents that add up to exactly 100.
function percentages(values) {
    const total = values.reduce((a, b) => a + b, 0);
    if (total <= 0) return values.map(() => 0);
    const raw = values.map((v) => (v / total) * 100);
    const floored = raw.map(Math.floor);
    let left = 100 - floored.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - floored[i], i])
        .sort((a, b) => b[0] - a[0])
        .forEach(([, i]) => {
            if (left > 0) {
                floored[i] += 1;
                left -= 1;
            }
        });
    return floored;
}

function leanLabel(net) {
    const a = Math.abs(net);
    if (a < 0.15) return 'No clear lean';
    if (a < 0.4) return 'Slight lean';
    if (a < 0.7) return 'Moderate lean';
    return 'Strong lean';
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * @param asset     asset config ({ id, name })
 * @param headlines all stored headlines (any asset); filtered here
 * @param opts      { nowMs, windowStart, tauMin, windowLabel }
 */
function computeBias(asset, headlines, opts) {
    const { nowMs, windowStart, tauMin, windowLabel } = opts;

    const rows = [];
    for (const h of headlines) {
        if (h.publishedAt < windowStart || h.publishedAt > nowMs + 60000) continue;
        if (h.status === 'judged') {
            const j = h.judgments && h.judgments[asset.id];
            if (!j) continue; // judged as irrelevant to this asset
            const weight = headlineWeight(h.impact, h.publishedAt, nowMs, tauMin);
            rows.push({
                id: h.id,
                title: h.title,
                source: h.source,
                url: h.url,
                publishedAt: h.publishedAt,
                theme: h.theme,
                impact: h.impact,
                impactLabel: IMPACT_LABEL[h.impact],
                direction: j.direction,
                reason: j.reason,
                weight,
            });
        } else {
            // Not judged yet: shown in every asset's list until Claude scores it.
            rows.push({
                id: h.id,
                title: h.title,
                source: h.source,
                url: h.url,
                publishedAt: h.publishedAt,
                theme: null,
                impact: null,
                impactLabel: null,
                direction: null,
                reason: null,
                weight: 0,
            });
        }
    }

    const judged = rows.filter((r) => r.direction);
    const sum = (list, dir) => list.filter((r) => r.direction === dir).reduce((a, r) => a + r.weight, 0);
    const count = (list, dir) => list.filter((r) => r.direction === dir).length;

    const wHigher = sum(judged, 'higher');
    const wLower = sum(judged, 'lower');
    const wMixed = sum(judged, 'mixed');
    const total = wHigher + wLower + wMixed;
    const [pHigher, pMixed, pLower] = percentages([wHigher, wMixed, wLower]);
    const net = total > 0 ? (wHigher - wLower) / total : 0;

    let bias = 'Neutral';
    if (leanLabel(net) !== 'No clear lean') bias = net > 0 ? 'Bullish' : 'Bearish';

    const counts = {
        total: rows.length,
        higher: count(judged, 'higher'),
        lower: count(judged, 'lower'),
        mixed: count(judged, 'mixed'),
        pending: rows.length - judged.length,
    };

    // Story groups by theme.
    const byTheme = new Map();
    for (const r of judged) {
        if (!byTheme.has(r.theme)) byTheme.set(r.theme, []);
        byTheme.get(r.theme).push(r);
    }
    const themes = [...byTheme.entries()].map(([theme, list]) => {
        const th = sum(list, 'higher');
        const tl = sum(list, 'lower');
        const tm = sum(list, 'mixed');
        const tw = th + tl + tm;
        const [ph, pm, pl] = percentages([th, tm, tl]);
        const tnet = tw > 0 ? (th - tl) / tw : 0;
        const direction = Math.abs(tnet) < 0.15 ? 'mixed' : tnet > 0 ? 'higher' : 'lower';
        // The card text is the reasoning from the heaviest headline that agrees
        // with the theme's direction.
        const lead =
            [...list].filter((r) => r.direction === direction).sort((a, b) => b.weight - a.weight)[0] ||
            [...list].sort((a, b) => b.weight - a.weight)[0];
        return {
            theme,
            weight: tw,
            share: 0, // filled below
            direction,
            split: { higher: ph, lower: pl, mixed: pm },
            headlines: list.length,
            agreeing: list.filter((r) => r.direction === direction).length,
            latest: Math.max(...list.map((r) => r.publishedAt)),
            explanation: lead ? lead.reason : '',
        };
    });
    const shares = percentages(themes.map((t) => t.weight));
    themes.forEach((t, i) => (t.share = shares[i]));
    themes.sort((a, b) => b.weight - a.weight);

    const summary = buildSummary({ asset, bias, net, counts, pHigher, pLower, pMixed, themes, windowLabel, judgedCount: judged.length });

    return {
        bias,
        lean: leanLabel(net),
        net,
        pct: { higher: pHigher, mixed: pMixed, lower: pLower },
        counts,
        themes,
        summary,
        headlines: rows,
    };
}

function buildSummary({ asset, bias, net, counts, pHigher, pLower, pMixed, themes, windowLabel, judgedCount }) {
    if (counts.total === 0) return `No headlines on ${asset.name} ${windowLabel} yet.`;
    if (judgedCount === 0) {
        return `${plural(counts.total, 'headline')} ${windowLabel}, none judged yet.`;
    }
    const lean = leanLabel(net);
    const opener =
        bias === 'Neutral'
            ? `No clear lean from ${plural(counts.total, 'headline')} ${windowLabel}.`
            : `${lean.replace(' lean', '')} ${bias.toLowerCase()} lean from ${plural(counts.total, 'headline')} ${windowLabel}.`;
    const parts = [
        opener,
        `${pHigher}% of the headline weight points higher, ${pLower}% lower and ${pMixed}% is mixed.`,
    ];
    const main = themes[0];
    if (main) {
        const verb = main.direction === 'mixed' ? `pulling ${asset.name} both ways` : `pushing ${asset.name} ${main.direction}`;
        parts.push(
            `The main driver is ${main.theme}, ${verb} (${main.share}% of the weight, ${main.agreeing} of ${plural(main.headlines, 'headline')}).`,
        );
        if (main.direction !== 'mixed') {
            const opposite = main.direction === 'higher' ? 'lower' : 'higher';
            const counter = themes.find((t) => t.direction === opposite);
            if (counter) {
                parts.push(
                    `${counter.theme} pushes the other way (${counter.share}% of the weight, ${plural(counter.headlines, 'headline')}).`,
                );
            }
        }
    }
    return parts.join(' ');
}

module.exports = { computeBias, headlineWeight, percentages, leanLabel };
