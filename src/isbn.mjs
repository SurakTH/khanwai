import { DEFAULT_PROVIDERS, LOOKUP_PROVIDERS, validateProviders } from '../public/provider-options.js';
import { normalizeIsbn } from '../public/lib.js';
const text = (value, limit = 300) => typeof value === 'string' ? value.slice(0, limit) : '';
const first = value => Array.isArray(value) ? text(value[0]) : '';
const names = values => Array.isArray(values) ? values.map(value => text(typeof value === 'string' ? value : value?.name)).filter(Boolean).join(', ').slice(0, 300) : '';
const result = (status, candidates = []) => ({ status, candidates });

async function google(isbn, fetcher, apiKey) {
  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', `isbn:${isbn}`); url.searchParams.set('maxResults', '10');
  if (apiKey) url.searchParams.set('key', apiKey);
  const response = await fetcher(url.href, { signal: AbortSignal.timeout(6000) });
  if (!response.ok) {
    let limited = response.status === 429;
    if (response.status === 403) { try { const body = await response.json(); limited = body.error?.errors?.some(e => /quota|limit/i.test(e.reason ?? '')) ?? false; } catch {} }
    return result(limited ? 'rate_limited' : 'unavailable');
  }
  const data = await response.json();
  if (!data || Array.isArray(data) || data.items !== undefined && !Array.isArray(data.items)) return result('unavailable');
  const candidates = (data.items ?? []).filter(item => item?.volumeInfo && Array.isArray(item.volumeInfo.industryIdentifiers) && item.volumeInfo.industryIdentifiers.some(i => normalizeIsbn(i?.identifier) === isbn))
    .filter(item => text(item.volumeInfo.title).trim()).slice(0,10)
    .map(item => ({ title: text(item.volumeInfo.title), author: names(item.volumeInfo.authors), publisher: text(item.volumeInfo.publisher), language: text(item.volumeInfo.language,100), isbn, source:'Google Books', externalId:text(item.id) }));
  return result(candidates.length ? 'found' : 'not_found', candidates);
}
async function openLibrary(isbn, fetcher) {
  const response = await fetcher(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`, { signal:AbortSignal.timeout(6000), headers:{'User-Agent':'Khanwai/0.3.1 (personal book lookup)'} });
  if (!response.ok) return result(response.status === 429 ? 'rate_limited' : 'unavailable');
  const data = await response.json();
  if (!data || typeof data !== 'object' || Array.isArray(data) || 'items' in data) return result('unavailable');
  const book = data[`ISBN:${isbn}`];
  if (book === undefined) return result('not_found');
  if (!book || typeof book !== 'object' || !text(book.title).trim()) return result('unavailable');
  const identifiers = book.identifiers;
  const codes = [...(Array.isArray(identifiers?.isbn_10) ? identifiers.isbn_10 : []), ...(Array.isArray(identifiers?.isbn_13) ? identifiers.isbn_13 : [])];
  if (!codes.some(code => normalizeIsbn(code) === isbn)) return result('not_found');
  // This endpoint has no reliable language/volume/edition fields. Leave those for review.
  return result('found', [{ title:text(book.title), author:names(book.authors), publisher:names(book.publishers), language:'', isbn, source:'Open Library', externalId:text(book.url) }]);
}

async function nationalLibrary(isbn, fetcher) {
  const url = new URL('https://nlt.primo.exlibrisgroup.com/primaws/rest/pub/pnxs');
  for (const [key,value] of Object.entries({vid:'66NLT_INST:66NLT',q:`isbn,contains,${isbn}`,scope:'MyInstitution',tab:'LibraryCatalog',inst:'66NLT_INST',limit:'5',lang:'th'})) url.searchParams.set(key,value);
  const response = await fetcher(url.href, {signal:AbortSignal.timeout(6000)});
  if (!response.ok) return result(response.status===429 ? 'rate_limited' : 'unavailable');
  const data = await response.json();
  if (!data || !Array.isArray(data.docs)) return result('unavailable');
  const candidates = [];
  for (const item of data.docs.slice(0,5)) {
    const pnx=item?.pnx, details=pnx?.addata, display=pnx?.display;
    if (!Array.isArray(details?.isbn) || !details.isbn.some(code=>normalizeIsbn(code)===isbn)) continue;
    const title=(first(details.btitle)||first(display?.title)).trim();
    if (!title) continue;
    const language=first(display?.language).slice(0,100);
    const label=title.match(/เล่ม\s*(\d+(?:\.\d+)?)\s*$/)?.[1] ?? '';
    candidates.push({title,author:names(details.au),publisher:names(details.pub),isbn,language:({tha:'ไทย',eng:'อังกฤษ',chi:'จีน',zho:'จีน'})[language] ?? language,
      label,edition:first(display?.edition),source:'หอสมุดแห่งชาติ (NLT)',externalId:first(pnx.control?.recordid)});
  }
  return result(candidates.length ? 'found' : 'not_found', candidates);
}

export function createIsbnLookup({ fetcher = fetch, apiKey = '', intervalMs = 1100, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), cacheSize = 500 } = {}) {
  const cache = new Map(), inflight = new Map(), blocked = new Map(), gates = new Map();
  const adapters = {google,openlibrary:openLibrary,nlt:nationalLibrary};
  async function provider(id, isbn) {
    if ((blocked.get(id) ?? 0) > now()) return result('rate_limited');
    let response;
    try {
      if (id !== 'google') {
        const gate=gates.get(id) ?? {queue:Promise.resolve(),waiting:0,nextStart:0}; gates.set(id,gate);
        if (gate.waiting >= 4) return result('rate_limited');
        gate.waiting++;
        const work=gate.queue.then(async()=>{
          if ((blocked.get(id) ?? 0) > now()) return result('rate_limited');
          const delay=gate.nextStart-now(); if(delay>0) await sleep(delay);
          gate.nextStart=now()+intervalMs;
          return adapters[id](isbn,fetcher);
        });
        gate.queue=work.catch(()=>{});
        try {response=await work;} finally {gate.waiting--;}
      } else response=await google(isbn,fetcher,apiKey);
    } catch {response=result('unavailable');}
    if(response.status==='rate_limited') blocked.set(id,now()+60000);
    return response;
  }
  return async (input, selected = DEFAULT_PROVIDERS) => {
    const ids=validateProviders(selected),isbn=normalizeIsbn(input);
    if(!isbn) return result('invalid');
    if(!ids.length) return {...result('disabled'),providers:[]};
    const key=ids.join(',')+':'+isbn;
    const cached=cache.get(key);if(cached?.expires>now()) return structuredClone(cached.value);
    if(inflight.has(key)) return structuredClone(await inflight.get(key));
    if(inflight.size>=32)return result('rate_limited');
    const work=(async()=>{
      const outcomes=[]; let value;
      for(const id of ids){
        const response=await provider(id,isbn);
        outcomes.push({name:LOOKUP_PROVIDERS.find(p=>p.id===id).name,status:response.status});
        if(response.status==='found'){value=response;break;}
      }
      value ??= result(outcomes.some(r=>r.status==='rate_limited')?'rate_limited':outcomes.some(r=>r.status==='unavailable')?'unavailable':'not_found');
      value.providers=outcomes;
      if(cacheSize){
        if(cache.size>=cacheSize)cache.delete(cache.keys().next().value);
        cache.set(key,{value,expires:now()+(value.status==='found'?3600000:value.status==='not_found'?300000:15000)});
      }
      return value;
    })();
    inflight.set(key,work);
    try{return structuredClone(await work);}finally{inflight.delete(key);}
  };
}
export async function lookupIsbn(input, fetcher = fetch) {
  return createIsbnLookup({fetcher,intervalMs:0,cacheSize:0})(input);
}
