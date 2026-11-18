// Invented headlines, already judged, for trying the dashboard without an API
// key or network access. They are not real news. Timestamps are relative to
// when the server starts so recency decay looks realistic.

const H = 'higher';
const L = 'lower';
const M = 'mixed';

// m = minutes ago, moves = asset -> direction, why = default reasoning,
// reasons = per-asset reasoning where the default does not fit.
const DEMO = [
    { m: 2, title: "Japan's finance minister: watching currency moves with a high sense of urgency", pending: true },
    {
        m: 5, theme: 'Fed and rates', impact: 3,
        title: 'Fed governor: no rush to cut rates while services inflation stays sticky',
        why: 'A Fed in no hurry to cut keeps US yields and the dollar supported.',
        moves: { gold: L, silver: L, nasdaq: L, sp500: L, us30: L, bitcoin: L, dxy: H, eurusd: L, gbpusd: L, usdjpy: H, audusd: L, nzdusd: L, usdcad: H, usdchf: H, us10y: H },
        reasons: {
            gold: 'Fewer expected cuts lift real yields and the dollar, which tends to press gold.',
            nasdaq: 'Higher-for-longer rates weigh on long-duration tech valuations.',
        },
    },
    {
        m: 12, theme: 'War and energy supply', impact: 4,
        title: 'Tanker reports explosion near the Strait of Hormuz; crew evacuated, maritime agency says',
        why: 'A threat to Gulf shipping raises the risk of oil supply disruption.',
        moves: { oil: H, gold: M, usdcad: L, sp500: L, nasdaq: L, us30: L, usdjpy: L, usdchf: L, us10y: H, bitcoin: L },
        reasons: {
            gold: 'Safe-haven demand helps gold, but an oil-driven inflation scare lifts yields and pulls the other way.',
            usdcad: 'Higher oil supports the Canadian dollar, pushing USD/CAD lower.',
            usdjpy: 'Risk-off flows favour the yen.',
            us10y: 'An oil spike lifts inflation expectations and yields.',
        },
    },
    {
        m: 19, theme: 'Growth and jobs', impact: 3,
        title: 'US initial jobless claims 198K vs 215K expected',
        why: 'A tight labour market lowers the odds of near-term Fed cuts.',
        moves: { dxy: H, gold: L, us10y: H, eurusd: L, usdjpy: H, gbpusd: L, nasdaq: M, sp500: M },
        reasons: {
            gold: 'Strong jobs data firms the dollar and yields, a headwind for gold.',
            nasdaq: 'Good for growth, bad for rate-cut hopes: the two effects roughly cancel.',
            sp500: 'Good for earnings, bad for rate-cut hopes: the two effects roughly cancel.',
        },
    },
    {
        m: 27, theme: 'Other central banks', impact: 1,
        title: "China's central bank keeps loan prime rates unchanged, as expected",
        why: 'An expected hold changes little for China-linked currencies.',
        moves: { audusd: M, nzdusd: M },
    },
    {
        m: 34, theme: 'War and energy supply', impact: 3,
        title: 'OPEC+ delegates say the group is open to pausing its planned output increase',
        why: 'Less supply than planned supports crude prices.',
        moves: { oil: H, usdcad: L, us10y: H, gold: L },
        reasons: {
            usdcad: 'Firmer oil supports the Canadian dollar.',
            gold: 'Firmer energy prices feed inflation expectations and yields, which weigh on gold.',
        },
    },
    {
        m: 42, theme: 'Other central banks', impact: 2,
        title: 'ECB board member: further rate cuts not needed with inflation near target',
        why: 'A less dovish ECB supports the euro.',
        moves: { eurusd: H, dxy: L },
    },
    {
        m: 49, theme: 'War and energy supply', impact: 2,
        title: 'Israeli military says it intercepted drones launched from Yemen',
        why: 'Continued regional conflict keeps an energy risk premium in place.',
        moves: { oil: H, gold: L, usdjpy: L },
        reasons: {
            gold: 'In this regime war headlines trade as inflationary, lifting yields and the dollar, which presses gold.',
            usdjpy: 'Risk-off flows favour the yen.',
        },
    },
    {
        m: 58, theme: 'Fed and rates', impact: 3,
        title: 'US 10-year yield climbs to 4.6%, highest in three weeks',
        why: 'Rising yields tighten financial conditions.',
        moves: { gold: L, silver: L, nasdaq: L, us10y: H, usdjpy: H, dxy: H, bitcoin: L },
        reasons: { gold: 'Higher yields raise the opportunity cost of holding gold, which pays no interest.' },
    },
    {
        m: 66, theme: 'Other central banks', impact: 3,
        title: 'Bank of Japan governor: will raise rates if the outlook is realised',
        why: 'Hike signals from the BoJ support the yen.',
        moves: { usdjpy: L },
    },
    {
        m: 75, theme: 'Inflation', impact: 3,
        title: 'UK CPI 3.4% y/y vs 3.2% expected',
        why: 'Hotter UK inflation pushes back Bank of England cuts.',
        moves: { gbpusd: H },
    },
    {
        m: 83, theme: 'Crypto', impact: 2,
        title: 'Spot bitcoin ETFs log their largest daily inflow in a month',
        why: 'Fresh ETF demand absorbs supply.',
        moves: { bitcoin: H },
    },
    {
        m: 96, theme: 'Trade and tariffs', impact: 3,
        title: 'White House adviser: tariffs on EU autos are still on the table',
        why: 'Tariff threats hurt the euro and weigh on equities.',
        moves: { eurusd: L, sp500: L, us30: L, nasdaq: L, gold: H, dxy: M },
        reasons: {
            gold: 'Trade uncertainty drives haven buying in gold.',
            dxy: 'Tariffs help the dollar against the euro but raise US growth worries.',
        },
    },
    {
        m: 104, theme: 'Risk sentiment and earnings', impact: 3,
        title: 'Megacap chipmaker shares rise 3% premarket after guidance beat',
        why: 'Strong AI demand lifts tech-led indices.',
        moves: { nasdaq: H, sp500: H },
    },
    {
        m: 118, theme: 'Other news', impact: 2,
        title: 'Central bank gold buying hit a record in Q3, industry group says',
        why: 'Steady official-sector demand supports gold and silver.',
        moves: { gold: H, silver: H },
    },
    {
        m: 131, theme: 'Inflation', impact: 2,
        title: 'Canada CPI cools to 1.9% y/y, below forecasts',
        why: 'Soft inflation opens room for Bank of Canada cuts, weakening CAD.',
        moves: { usdcad: H },
    },
    {
        m: 145, theme: 'Fed and rates', impact: 2,
        title: 'Regional Fed president: inflation progress has stalled, patience is warranted',
        why: 'Another hawkish Fed voice supports yields and the dollar.',
        moves: { gold: L, us10y: H, dxy: H, nasdaq: L },
    },
    {
        m: 160, theme: 'War and energy supply', impact: 2,
        title: 'Iran foreign ministry: talks with European powers to resume next week',
        why: 'Diplomacy eases the energy risk premium.',
        moves: { oil: L, gold: L, usdjpy: H },
        reasons: { gold: 'Lower tension trims safe-haven demand.' },
    },
    {
        m: 176, theme: 'Growth and jobs', impact: 2,
        title: 'Australia unemployment rate rises to 4.4%',
        why: 'A softer labour market raises RBA cut odds.',
        moves: { audusd: L },
    },
    {
        m: 189, theme: 'Other central banks', impact: 2,
        title: 'RBNZ deputy governor: further easing may be needed',
        why: 'Dovish RBNZ guidance weighs on the kiwi.',
        moves: { nzdusd: L },
    },
    {
        m: 204, theme: 'Risk sentiment and earnings', impact: 2,
        title: 'Dow futures add 120 points as bank earnings top estimates',
        why: 'Strong bank results lift value-heavy indices.',
        moves: { us30: H, sp500: H },
    },
    {
        m: 221, theme: 'Other central banks', impact: 2,
        title: 'Swiss National Bank chair: ready to intervene in FX markets if needed',
        why: 'Intervention threats cap franc strength.',
        moves: { usdchf: H },
    },
    {
        m: 238, theme: 'Fed and rates', impact: 2,
        title: 'US Treasury 20-year bond auction draws weak demand',
        why: 'A soft auction pushes yields higher.',
        moves: { us10y: H, gold: L, nasdaq: L },
    },
    {
        m: 252, theme: 'Other news', impact: 1,
        title: 'Silver ETF holdings fall for a fifth straight session',
        why: 'Investor outflows weigh on silver.',
        moves: { silver: L },
    },
];

function seedDemo(store, nowMs = Date.now()) {
    const { Store } = require('../store');
    for (const d of DEMO) {
        const id = Store.idFor(d.title);
        const base = { id, title: d.title, source: 'Demo wire', url: null, publishedAt: nowMs - d.m * 60000, receivedAt: nowMs };
        if (d.pending) {
            store.put({ ...base, status: 'pending', attempts: 99 }); // never sent to Claude
            continue;
        }
        const judgments = {};
        for (const [asset, direction] of Object.entries(d.moves)) {
            judgments[asset] = { direction, reason: (d.reasons && d.reasons[asset]) || d.why };
        }
        store.put({ ...base, status: 'judged', theme: d.theme, impact: d.impact, judgments });
    }
}

module.exports = { seedDemo, DEMO };
