import { readingItems } from './reading.js';
// Reading a second copy must not make the already-read volume eligible again.
export function unreadCandidates(series, location = '') {
  return series.filter(s => !s.trashedAt).map(series => {
    const labels = new Map(), atLocation = new Set(), ranks = { unread: 0, planned: 1, reading: 2, read: 3 };
    for (const entry of series.entries) if (!entry.trashedAt && entry.status === 'owned') {
      for (const item of readingItems(entry)) {
        if (!location || (entry.location??'').trim()===location) atLocation.add(item.label);
        if (!labels.has(item.label) || ranks[item.status] > ranks[labels.get(item.label)]) labels.set(item.label,item.status);
      }
    }
    return { series, labels: [...labels].filter(([label,status]) => status === 'unread' && atLocation.has(label)).map(([label]) => label) };
  }).filter(candidate => candidate.labels.length);
}
export function pickUnread(candidates, previous, random = Math.random) {
  const pool = candidates.length > 1 ? candidates.filter(c => c.series.id !== previous) : candidates;
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
}
