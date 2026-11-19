// Everything you are likely to tune lives here or in environment variables.
// Settings can also go in a `.env` file next to package.json (see .env.example).

const path = require('path');

try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
    // no .env file: use the real environment only
}

const env = process.env;
const isDemo = env.DEMO === '1' || env.DEMO === 'true' || process.argv.includes('--demo');

// The instruments the dashboard covers. `notes` is fed to Claude so it knows
// what each asset is and how it is quoted (a "higher" EUR/USD is a weaker dollar).
// `yahoo` is the ticker used by the Yahoo price provider; swap for your broker's.
const ASSETS = [
    { id: 'gold', name: 'Gold', symbol: 'XAUUSD', badge: 'Au', yahoo: 'GC=F', unit: '$', decimals: 2, demoPrice: 3870, notes: 'Spot gold in USD. Sensitive to real yields, the dollar, safe-haven flows and inflation expectations.' },
    { id: 'nasdaq', name: 'Nasdaq', symbol: 'NAS100', badge: 'NQ', yahoo: 'NQ=F', unit: '', decimals: 1, demoPrice: 21400, notes: 'Nasdaq 100 index. Tech-heavy, very sensitive to yields and AI/megacap news.' },
    { id: 'us30', name: 'US30', symbol: 'DJI', badge: 'DJ', yahoo: 'YM=F', unit: '', decimals: 0, demoPrice: 44100, notes: 'Dow Jones Industrial Average. Value/industrial tilt, banks and industrials matter.' },
    { id: 'sp500', name: 'S&P 500', symbol: 'SPX', badge: 'SP', yahoo: 'ES=F', unit: '', decimals: 1, demoPrice: 6210, notes: 'S&P 500 index. Broad US equity risk sentiment.' },
    { id: 'oil', name: 'Oil', symbol: 'USOIL', badge: 'WT', yahoo: 'CL=F', unit: '$', decimals: 2, demoPrice: 63.4, notes: 'WTI crude. Driven by supply disruptions, OPEC+ policy, demand outlook.' },
    { id: 'silver', name: 'Silver', symbol: 'XAGUSD', badge: 'Ag', yahoo: 'SI=F', unit: '$', decimals: 3, demoPrice: 48.2, notes: 'Spot silver in USD. Follows gold plus industrial demand.' },
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTCUSD', badge: '₿', yahoo: 'BTC-USD', unit: '$', decimals: 0, demoPrice: 94500, notes: 'Bitcoin in USD. Risk asset, sensitive to liquidity, ETF flows, crypto regulation.' },
    { id: 'dxy', name: 'US dollar', symbol: 'DXY', badge: '$', yahoo: 'DX-Y.NYB', unit: '', decimals: 3, demoPrice: 99.2, notes: 'US dollar index against a basket of majors. Higher = stronger dollar.' },
    { id: 'eurusd', name: 'EUR/USD', symbol: 'EURUSD', badge: '€', yahoo: 'EURUSD=X', unit: '', decimals: 5, demoPrice: 1.158, notes: 'Euro vs dollar. Higher = stronger euro / weaker dollar.' },
    { id: 'gbpusd', name: 'GBP/USD', symbol: 'GBPUSD', badge: '£', yahoo: 'GBPUSD=X', unit: '', decimals: 5, demoPrice: 1.312, notes: 'Pound vs dollar. Higher = stronger pound / weaker dollar.' },
    { id: 'usdjpy', name: 'USD/JPY', symbol: 'USDJPY', badge: '¥', yahoo: 'JPY=X', unit: '', decimals: 3, demoPrice: 154.6, notes: 'Dollar vs yen. Higher = stronger dollar / weaker yen. Yen is a safe haven.' },
    { id: 'audusd', name: 'AUD/USD', symbol: 'AUDUSD', badge: 'A$', yahoo: 'AUDUSD=X', unit: '', decimals: 5, demoPrice: 0.651, notes: 'Aussie vs dollar. Risk-sensitive, linked to China and commodities.' },
    { id: 'nzdusd', name: 'NZD/USD', symbol: 'NZDUSD', badge: 'N$', yahoo: 'NZDUSD=X', unit: '', decimals: 5, demoPrice: 0.574, notes: 'Kiwi vs dollar. Risk-sensitive, linked to dairy and China.' },
    { id: 'usdcad', name: 'USD/CAD', symbol: 'USDCAD', badge: 'C$', yahoo: 'CAD=X', unit: '', decimals: 5, demoPrice: 1.398, notes: 'Dollar vs Canadian dollar. Higher = stronger USD. CAD tends to strengthen with oil, so higher oil usually means lower USD/CAD.' },
    { id: 'usdchf', name: 'USD/CHF', symbol: 'USDCHF', badge: 'Fr', yahoo: 'CHF=X', unit: '', decimals: 5, demoPrice: 0.802, notes: 'Dollar vs Swiss franc. Higher = stronger USD. Franc is a safe haven.' },
    { id: 'us10y', name: 'US yields', symbol: 'US10Y', badge: '%', yahoo: '^TNX', unit: '', decimals: 3, demoPrice: 4.41, notes: 'US 10-year Treasury yield. Higher = yields rising (bond prices falling).' },
];

// Every headline is filed under one theme; the "Stories driving ..." cards group by these.
const THEMES = [
    'War and energy supply',
    'Fed and rates',
    'Inflation',
    'Growth and jobs',
    'Other central banks',
    'Trade and tariffs',
    'Risk sentiment and earnings',
    'Crypto',
    'Other news',
];

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

module.exports = {
    ASSETS,
    THEMES,
    PORT: num(env.PORT, 3000),
    DEMO: isDemo,

    // Window: headlines since the last session open. 17:00 New York is the
    // daily FX/futures roll, i.e. the start of the trading day.
    SESSION_OPEN: env.SESSION_OPEN || '17:00',
    SESSION_TZ: env.SESSION_TZ || 'America/New_York',
    WINDOW_LABEL: env.WINDOW_LABEL || 'since the New York open',

    // Recency decay: weight = impact * exp(-age / tau). 170 min ≈ 2h half-life.
    DECAY_TAU_MIN: num(env.DECAY_TAU_MIN, 170),

    // News ingestion. Comma-separated RSS/Atom URLs. These are examples: swap in
    // the feeds or squawk service you trust (see README).
    NEWS_FEEDS: (env.NEWS_FEEDS ||
        [
            'https://www.fxstreet.com/rss/news',
            'https://www.cnbc.com/id/100003114/device/rss/rss.html',
            'https://feeds.content.dowjones.io/public/rss/mw_topstories',
        ].join(','))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    POLL_SECONDS: num(env.POLL_SECONDS, 60),
    INGEST_TOKEN: env.INGEST_TOKEN || '', // protects POST /api/headlines when set

    // Claude classification.
    CLASSIFY_MODEL: env.CLASSIFY_MODEL || 'claude-opus-5-5',
    CLASSIFY_EFFORT: env.CLASSIFY_EFFORT || 'low',
    CLASSIFY_BATCH: num(env.CLASSIFY_BATCH, 12),
    // Free-text notes on the current market regime, e.g. "Markets trade war
    // escalation as inflationary: oil up, yields up, gold down." Changes how
    // Claude reads the same headline.
    MARKET_CONTEXT: env.MARKET_CONTEXT || '',

    // Prices: "yahoo" (free, unofficial, delayed) or "demo" (synthetic).
    PRICE_PROVIDER: env.PRICE_PROVIDER || (isDemo ? 'demo' : 'yahoo'),

    DATA_FILE: env.DATA_FILE || path.join(__dirname, '..', 'data', 'headlines.json'),
};
