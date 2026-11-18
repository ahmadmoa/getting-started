// Time-zone helpers without a date library.

// Minutes that `timeZone` is ahead of UTC at instant `date`.
function tzOffsetMinutes(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return Math.round((asUtc - (date.getTime() - date.getMilliseconds())) / 60000);
}

// Instant (ms) of wall-clock `hh:mm` on the local date of `local` in `timeZone`.
function wallClockToInstant(year, month, day, hh, mm, timeZone) {
    const guess = Date.UTC(year, month, day, hh, mm);
    // Two passes settle the offset across DST changes.
    let t = guess - tzOffsetMinutes(new Date(guess), timeZone) * 60000;
    t = guess - tzOffsetMinutes(new Date(t), timeZone) * 60000;
    return t;
}

function localParts(ms, timeZone) {
    const shifted = new Date(ms + tzOffsetMinutes(new Date(ms), timeZone) * 60000);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth(),
        day: shifted.getUTCDate(),
        weekday: shifted.getUTCDay(), // 0 = Sunday
    };
}

// Most recent session open at or before `now`. FX/futures sessions open
// Sunday-Thursday at 17:00 New York; a Friday 17:00 "open" does not exist
// (the market closes for the weekend), so those days are skipped.
function lastSessionOpen(nowMs, hhmm, timeZone) {
    const [hh, mm] = hhmm.split(':').map(Number);
    let { year, month, day } = localParts(nowMs, timeZone);
    for (let i = 0; i < 8; i++) {
        const t = wallClockToInstant(year, month, day - i, hh, mm, timeZone);
        if (t > nowMs) continue;
        const wd = localParts(t, timeZone).weekday;
        if (wd === 5 || wd === 6) continue; // Friday, Saturday
        return t;
    }
    return nowMs - 24 * 3600 * 1000;
}

module.exports = { tzOffsetMinutes, lastSessionOpen };
