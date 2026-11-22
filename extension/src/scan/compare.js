// "Since your last check": a check compared with an earlier one opened from a locked copy, on this computer only.
// A way in that is new since then can mean someone was given access again, or got back in after a change.
//
// Findings match by their kind and the first line of what the page showed (a device's name, an app's name, an address),
// so "2 hours ago" turning into "3 days ago" is the same finding. Only checks that ran both times are compared: a check
// that did not run before cannot have anything "new since then".
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const keyOf = f => `${f.code}|${norm(String(f.detail || f.label || '').split('\n')[0])}`;
const checkedIn = scan => new Set((scan?.outcomes || []).filter(o => o.status === 'checked').map(o => o.id));

function unmatched(from, against) {
  const left = new Map();
  for (const f of against) left.set(keyOf(f), (left.get(keyOf(f)) || 0) + 1);
  return from.filter(f => {
    const k = keyOf(f);
    if (left.get(k)) { left.set(k, left.get(k) - 1); return false; }
    return true;
  });
}

/**
 * Compare `now` with `before` (both scan records). Returns { added: refs in now, removed: [{ code, label }],
 * same: count, compared: check ids that ran both times }.
 */
export function compareChecks(before, now) {
  const both = new Set([...checkedIn(before)].filter(id => checkedIn(now).has(id)));
  const inBoth = scan => (scan?.findings || []).filter(f => both.has(f.check));
  const b = inBoth(before);
  const n = inBoth(now);
  const added = unmatched(n, b);
  const removed = unmatched(b, n);
  return {
    added: added.map(f => f.ref),
    removed: removed.map(f => ({ code: f.code, label: f.label })),
    same: n.length - added.length,
    compared: [...both],
  };
}
