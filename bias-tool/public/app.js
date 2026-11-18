(() => {
    const $ = (id) => document.getElementById(id);
    const esc = (s) =>
        String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    const hhmm = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const cls = (dir) => (dir === 'higher' ? 'up' : dir === 'lower' ? 'down' : dir === 'mixed' ? 'mixed' : 'pending');

    let assets = [];
    let current = location.hash.slice(1) || 'gold';
    let sort = 'newest';
    const open = new Set(); // expanded headline ids survive refreshes

    async function init() {
        assets = await (await fetch('api/assets')).json();
        if (!assets.find((a) => a.id === current)) current = assets[0].id;
        $('chips').innerHTML = assets
            .map((a) => `<button type="button" class="chip" data-id="${esc(a.id)}">${esc(a.name)}</button>`)
            .join('');
        $('chips').addEventListener('click', (e) => {
            const b = e.target.closest('.chip');
            if (b) select(b.dataset.id);
        });
        document.querySelector('.seg').addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            sort = b.dataset.sort;
            document.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b));
            load();
        });
        $('feed').addEventListener('click', (e) => {
            if (e.target.closest('a')) return;
            const li = e.target.closest('.item');
            if (!li) return;
            li.classList.toggle('open');
            li.classList.contains('open') ? open.add(li.dataset.id) : open.delete(li.dataset.id);
        });
        window.addEventListener('hashchange', () => select(location.hash.slice(1)));
        select(current);
        setInterval(load, 30000);
    }

    function select(id) {
        if (!assets.find((a) => a.id === id)) return;
        current = id;
        if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
        document.querySelectorAll('.chip').forEach((c) => {
            const on = c.dataset.id === id;
            c.classList.toggle('on', on);
            if (on) c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
        load();
    }

    let seq = 0;
    async function load() {
        const mine = ++seq;
        const res = await fetch(`api/bias/${encodeURIComponent(current)}?sort=${sort}`);
        const data = await res.json();
        if (mine === seq) render(data);
    }

    function fmtAbs(v, asset) {
        if (v == null) return '–';
        const sign = v < 0 ? '−' : '+';
        return `${sign}${asset.unit}${Math.abs(v).toFixed(asset.decimals)}`;
    }

    function render(d) {
        const a = d.asset;
        document.title = `${a.name} bias`;
        $('asset-name').textContent = a.name;
        $('asset-symbol').textContent = a.symbol;
        $('asset-badge').textContent = a.badge;
        $('window-label').textContent = `Headline consensus, ${d.window.label}`;

        // Notices
        const notes = [];
        if (d.status.demo) notes.push('Demo mode: invented headlines and synthetic prices. Run without DEMO=1 for live data.');
        if (d.status.classifier.lastError) notes.push(d.status.classifier.lastError);
        if (d.prices.error) notes.push(`Prices unavailable (${d.prices.error}).`);
        $('notice').hidden = notes.length === 0;
        $('notice').textContent = notes.join(' ');

        // Bias
        const bc = d.bias === 'Bullish' ? 'up' : d.bias === 'Bearish' ? 'down' : '';
        $('bias-arrow').className = `arrow-box ${bc}`;
        $('bias-arrow').textContent = bc === 'up' ? '↑' : bc === 'down' ? '↓' : '↔';
        $('bias-word').className = `bias-word ${bc}`;
        $('bias-word').textContent = d.bias;
        $('bias-lean').textContent = d.lean;
        $('pct-higher').textContent = `${d.pct.higher}%`;
        $('pct-mixed').textContent = `${d.pct.mixed}%`;
        $('pct-lower').textContent = `${d.pct.lower}%`;
        $('bar-higher').style.width = `${d.pct.higher}%`;
        $('bar-mixed').style.width = `${d.pct.mixed}%`;
        $('bar-lower').style.width = `${d.pct.lower}%`;
        const c = d.counts;
        $('counts').innerHTML =
            `${c.total} headlines: <span class="up">${c.higher} higher</span> ${c.mixed} mixed ` +
            `<span class="down">${c.lower} lower</span>` + (c.pending ? ` ${c.pending} not judged yet` : '');
        $('summary').textContent = d.summary;

        // Prices
        $('now-title').textContent = `${a.name} right now`;
        $('prices-updated').textContent = `Updated ${hhmm(d.prices.updatedAt)} · current candle, open to now`;
        $('tiles').innerHTML = d.prices.tiles
            .map((t) => {
                const s = t.pct == null ? '' : t.pct > 0.005 ? 'up' : t.pct < -0.005 ? 'down' : '';
                const pct = t.pct == null ? '–' : `${t.pct < 0 ? '−' : t.pct > 0 ? '+' : ''}${Math.abs(t.pct).toFixed(2)}%`;
                return `<div class="tile ${s}"><div class="tf">${t.tf}</div><div class="pct">${pct}</div><div class="abs">${fmtAbs(t.abs, a)}</div></div>`;
            })
            .join('');

        // Stories
        $('stories-title').textContent = `Stories driving ${a.name}`;
        $('stories').innerHTML = d.themes.length
            ? d.themes
                  .map((t) => {
                      const k = cls(t.direction);
                      const arrow = k === 'up' ? '↑' : k === 'down' ? '↓' : '↔';
                      const verb = t.direction === 'mixed' ? `Pulls ${esc(a.name)} both ways` : `Pushes ${esc(a.name)} ${t.direction}`;
                      return `<article class="story ${k}">
                        <div class="story-head">
                          <div class="story-title"><span class="s-arrow">${arrow}</span> ${esc(t.theme)}<span class="share">${t.share}%</span></div>
                          <div class="story-meta">${t.headlines} headline${t.headlines === 1 ? '' : 's'} · latest ${hhmm(t.latest)}</div>
                        </div>
                        <div class="story-bar"><span style="width:${t.share}%"></span></div>
                        <div class="story-split"><b>${verb}</b> · ${t.split.higher}% higher, ${t.split.lower}% lower, ${t.split.mixed}% mixed</div>
                        <p>${esc(t.explanation)}</p>
                      </article>`;
                  })
                  .join('')
            : '<div class="empty">No judged stories yet.</div>';

        // Feed
        $('feed-title').textContent = `Headlines on ${a.name}, ${sort === 'newest' ? 'newest first' : 'most relevant first'}`;
        $('feed').innerHTML = d.headlines.length
            ? d.headlines
                  .map((h) => {
                      const k = cls(h.direction);
                      const label =
                          k === 'up' ? '↑ Pushes higher' : k === 'down' ? '↓ Pushes lower' : k === 'mixed' ? '— Mixed' : '— Not judged yet';
                      const dots = h.impact
                          ? `<span class="dots ${k}">${'<span class="lit">●</span>'.repeat(h.impact)}${'●'.repeat(5 - h.impact)}</span>
                             <span class="imp">Impact ${h.impact}</span> <span class="lvl ${h.impactLabel}">${h.impactLabel}</span>`
                          : '';
                      const link = h.url ? ` · <a class="src" href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.source)}</a>` : ` · <span class="src">${esc(h.source)}</span>`;
                      return `<li class="item${open.has(h.id) ? ' open' : ''}" data-id="${esc(h.id)}">
                        <div><div class="when">${hhmm(h.publishedAt)}</div><span class="wt">${h.weight.toFixed(1)}</span></div>
                        <div>
                          <div class="meta"><span class="dir ${k}">${label}</span>${dots}</div>
                          <div class="title">${esc(h.title)}</div>
                          <div class="why">${h.reason ? esc(h.reason) : 'Waiting for Claude to judge this headline.'}${link}</div>
                        </div>
                      </li>`;
                  })
                  .join('')
            : `<li class="empty">No headlines on ${esc(a.name)} ${esc(d.window.label)} yet.</li>`;
    }

    init().catch((e) => {
        $('notice').hidden = false;
        $('notice').textContent = `Could not load: ${e.message}`;
    });
})();
