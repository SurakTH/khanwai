import { validateState, normalizeIsbn } from './lib.js';

export const emptyLibrary = () => ({ schemaVersion: 2, series: [], drafts: [] });
export function stableJSON(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJSON).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJSON(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
export function flattenLibrary(state) {
  const records = new Map();
  for (const series of state.series) {
    const { entries, ...data } = series;
    records.set(`series:${series.id}`, data);
    for (const entry of entries) records.set(`entry:${entry.id}`, { ...entry, seriesId: series.id });
  }
  for (const draft of state.drafts) records.set(`draft:${draft.id}`, draft);
  return records;
}
export function expandLibrary(records) {
  const series = new Map(), drafts = [];
  for (const [key, data] of records) {
    if (key.startsWith('series:')) series.set(data.id, { ...data, entries: [] });
    else if (key.startsWith('draft:')) drafts.push(data);
  }
  for (const [key, data] of records) if (key.startsWith('entry:')) {
    const { seriesId, ...entry } = data;
    if (!series.has(seriesId)) throw Error('เล่มอ้างถึงฉบับที่ไม่มีอยู่ กรุณาตรวจข้อมูลก่อนซิงก์');
    series.get(seriesId).entries.push(entry);
  }
  return validateState({ schemaVersion: 2, series: [...series.values()], drafts });
}
export function recordDiff(before, after) {
  const old = flattenLibrary(before), next = flattenLibrary(after), changes = [];
  for (const [key, value] of next) if (!old.has(key) || stableJSON(value) !== stableJSON(old.get(key))) changes.push({ key, value });
  // Delete children first. Parents are inserted first by flattenLibrary.
  for (const [key] of [...old].sort(([a], [b]) => Number(a.startsWith('series:')) - Number(b.startsWith('series:')))) if (!next.has(key)) changes.push({ key, value: null });
  return changes;
}
export function overlayRecords(remoteState, localState, keys) {
  const remote = flattenLibrary(remoteState), local = flattenLibrary(localState);
  for (const key of keys) { if (local.has(key)) remote.set(key, local.get(key)); else remote.delete(key); }
  // A deliberate parent deletion wins over child records until the user resolves it.
  const parents = new Set([...remote].filter(([key]) => key.startsWith('series:')).map(([, value]) => value.id));
  for (const [key, value] of remote) if (key.startsWith('entry:') && !parents.has(value.seriesId)) remote.delete(key);
  return expandLibrary(remote);
}

export function mergeImport(current, incoming) {
  const state = structuredClone(current), used = new Set([...flattenLibrary(state).values()].map(value => value.id));
  let skipped = 0, added = 0;
  for (const source of incoming.series) {
    let series = state.series.find(s => s.id === source.id);
    if (series && ['title','format','edition','language'].some(key => series[key] !== source[key]) || !series && used.has(source.id)) { skipped += source.entries.length || 1; continue; }
    const existing = Boolean(series);
    if (!series) series = { ...structuredClone(source), entries: [] };
    for (const entry of source.entries) {
      const duplicateIsbn = entry.isbn && state.series.some(s => s.format === source.format && s.entries.some(e => e.isbn && normalizeIsbn(e.isbn) === normalizeIsbn(entry.isbn)));
      if (used.has(entry.id) || duplicateIsbn || series.entries.some(e => e.label === entry.label && e.kind === entry.kind && e.status === entry.status)) { skipped++; continue; }
      series.entries.push(structuredClone(entry)); used.add(entry.id); added++;
    }
    if (existing) series.target = [...new Set([...(series.target ?? []), ...(source.target ?? [])])];
    else if (series.entries.length || !source.entries.length) { state.series.push(series); used.add(series.id); }
  }
  for (const draft of incoming.drafts) {
    if (used.has(draft.id) || draft.isbn && state.drafts.some(d => normalizeIsbn(d.isbn) === normalizeIsbn(draft.isbn))) { skipped++; continue; }
    state.drafts.push(structuredClone(draft)); used.add(draft.id); added++;
  }
  return { state: validateState(state), skipped, added };
}
