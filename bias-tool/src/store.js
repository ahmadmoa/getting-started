// In-memory headline store, saved to a JSON file so restarts keep judgments.
// Swap for SQLite/Postgres once you run this for real.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEEP_HOURS = 48;

class Store {
    constructor(file) {
        this.file = file;
        this.items = new Map();
        this.saveTimer = null;
        if (file) this.load();
    }

    static idFor(title) {
        const norm = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
    }

    load() {
        try {
            const rows = JSON.parse(fs.readFileSync(this.file, 'utf8'));
            for (const r of rows) this.items.set(r.id, r);
        } catch {
            // no file yet
        }
    }

    save() {
        if (!this.file) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            fs.writeFileSync(this.file, JSON.stringify([...this.items.values()]));
        }, 500);
    }

    // Returns true if the headline was new.
    add({ title, source, url, publishedAt }) {
        title = String(title || '').replace(/\s+/g, ' ').trim();
        if (!title) return false;
        const id = Store.idFor(title);
        if (this.items.has(id)) return false; // same story from another feed
        this.items.set(id, {
            id,
            title,
            source: source || 'unknown',
            url: url || null,
            publishedAt: Number(publishedAt) || Date.now(),
            receivedAt: Date.now(),
            status: 'pending',
            attempts: 0,
        });
        this.save();
        return true;
    }

    // Stores a fully judged headline (used by demo mode and tests).
    put(row) {
        this.items.set(row.id, row);
        this.save();
    }

    applyJudgment(id, { theme, impact, judgments }) {
        const h = this.items.get(id);
        if (!h) return;
        Object.assign(h, { theme, impact, judgments, status: 'judged', judgedAt: Date.now() });
        this.save();
    }

    markAttempt(ids) {
        for (const id of ids) {
            const h = this.items.get(id);
            if (h) h.attempts = (h.attempts || 0) + 1;
        }
    }

    pending(limit) {
        return [...this.items.values()]
            .filter((h) => h.status === 'pending' && (h.attempts || 0) < 5)
            .sort((a, b) => b.publishedAt - a.publishedAt)
            .slice(0, limit);
    }

    all() {
        return [...this.items.values()];
    }

    prune(nowMs) {
        const cutoff = nowMs - KEEP_HOURS * 3600 * 1000;
        for (const [id, h] of this.items) if (h.publishedAt < cutoff) this.items.delete(id);
        this.save();
    }
}

module.exports = { Store };
