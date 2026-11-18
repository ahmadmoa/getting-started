// Pulls headlines from RSS/Atom feeds. Any source works as long as it ends up
// calling store.add({ title, source, url, publishedAt }); you can also POST
// headlines to /api/headlines from your own scraper or squawk bot.

const Parser = require('rss-parser');

const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'bias-tool/0.1 (+rss reader)' },
});

const lastResult = new Map(); // url -> { ok, count, error, at }

async function pullFeed(url, store) {
    const feed = await parser.parseURL(url);
    const source = (feed.title || new URL(url).hostname).trim();
    let added = 0;
    for (const item of feed.items || []) {
        const publishedAt = Date.parse(item.isoDate || item.pubDate || '') || Date.now();
        if (store.add({ title: item.title, source, url: item.link, publishedAt })) added++;
    }
    return added;
}

async function pullAll(urls, store) {
    let added = 0;
    await Promise.all(
        urls.map(async (url) => {
            try {
                const n = await pullFeed(url, store);
                added += n;
                lastResult.set(url, { ok: true, added: n, at: Date.now() });
            } catch (err) {
                lastResult.set(url, { ok: false, error: err.message, at: Date.now() });
            }
        }),
    );
    return added;
}

const feedStatus = () => Object.fromEntries(lastResult);

module.exports = { pullAll, feedStatus };
