import {folderId, validEvent, record} from './core.mjs';

const FOLDER = 'application/vnd.google-apps.folder';
const ID = /^[\w-]+$/;
const fields = 'id,name,mimeType,modifiedTime,md5Checksum,size,resourceKey';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

export function parseFolder(value) {
  const id = folderId(value);
  let resourceKey = '';
  try { resourceKey = new URL(value.trim()).searchParams.get('resourcekey') || ''; } catch {}
  if (resourceKey && !ID.test(resourceKey)) throw Error('資料夾連結的 resourcekey 格式不正確，請重新複製完整分享連結');
  return {id, resourceKey};
}

// Deliberately separate from the OAuth writer: this client has GET operations only.
export class PublicDrive {
  constructor(apiKey, resourceKeys = {}) {
    this.apiKey = String(apiKey || '').trim();
    this.keys = new Map(Object.entries(resourceKeys).filter(([id, key]) => ID.test(id) && ID.test(key)));
  }
  remember(file) { if (file.resourceKey && ID.test(file.id) && ID.test(file.resourceKey)) this.keys.set(file.id, file.resourceKey); }
  async request(path, params, ids = [], raw = false) {
    if (!this.apiKey) throw Error('網站尚未啟用免登入服務。請管理者設定 Drive API Key 並上傳 guest-config.json；訪客不需要申請帳號或金鑰。');
    const url = new URL('https://www.googleapis.com/drive/v3/' + path);
    url.search = new URLSearchParams({...params, key: this.apiKey});
    const resources = ids.filter(id => this.keys.has(id)).map(id => id + '/' + this.keys.get(id));
    const headers = resources.length ? {'X-Goog-Drive-Resource-Keys': resources.join(',')} : {};
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(url, {method:'GET', headers, credentials:'omit', cache:'no-store', signal:controller.signal});
        if (res.ok) return raw ? await res.blob() : await res.json();
        if ([429,500,502,503,504].includes(res.status) && attempt < 2) { await wait(600 * 2 ** attempt); continue; }
        let detail = ''; try { detail = (await res.json()).error?.message || ''; } catch {}
        const message = res.status === 404 ? '找不到公開資料夾或檔案。請確認分享設定為「知道連結的任何人／檢視者」，並貼上完整資料夾連結。'
          : res.status === 403 ? '無法公開讀取。請確認資料夾與圖片的分享／下載權限，以及網站 API Key 的 Drive API、網址限制與配額。'
          : res.status === 400 || res.status === 401 ? '公開讀取設定無效。請管理者檢查 Drive API Key，並確認資料夾連結正確。'
          : res.status === 429 ? '公開讀取已達流量限制，請稍後再試。' : '公開讀取失敗，請稍後重試。';
        const error = Error(message + '（HTTP ' + res.status + '）'); error.status = res.status; error.detail = detail; throw error;
      } catch (error) {
        if (error.status) throw error;
        if (attempt === 2) throw Error('網路中斷或公開讀取逾時，已保留本機資料，請連線後重試。');
        await wait(600 * 2 ** attempt);
      } finally { clearTimeout(timer); }
    }
  }
  async metadata(id) {
    if (!ID.test(id)) throw Error('無效的 Drive ID');
    const file = await this.request('files/' + id, {fields, supportsAllDrives:'true'}, [id]);
    this.remember(file); return file;
  }
  async children(id) {
    if (!ID.test(id)) throw Error('無效的 Drive ID');
    const all = [], seenTokens = new Set(); let pageToken = '';
    do {
      const response = await this.request('files', {
        q:`'${id}' in parents and trashed = false`, fields:`nextPageToken,incompleteSearch,files(${fields})`,
        pageSize:'1000', spaces:'drive', supportsAllDrives:'true', includeItemsFromAllDrives:'true', ...(pageToken ? {pageToken} : {})
      }, [id]);
      if (response.incompleteSearch || !Array.isArray(response.files)) throw Error('公開資料夾清單不完整，已保留上次資料，請稍後重試');
      for (const file of response.files) { this.remember(file); all.push(file); }
      pageToken = response.nextPageToken || '';
      if (pageToken && seenTokens.has(pageToken)) throw Error('Drive 分頁結果重複，請稍後重試');
      seenTokens.add(pageToken);
    } while (pageToken);
    return all;
  }
  media(id) {
    if (!ID.test(id)) throw Error('無效的 Drive ID');
    return this.request('files/' + id, {alt:'media', supportsAllDrives:'true'}, [id], true);
  }
  async json(file) {
    if (Number(file.size) > 20 * 1024 * 1024) throw Error('標記檔超過 20 MB，請管理者整理：' + file.name);
    const blob = await this.media(file.id);
    if (blob.size > 20 * 1024 * 1024) throw Error('標記檔超過 20 MB：' + file.name);
    try { return JSON.parse(await blob.text()); } catch { throw Error('標記 JSON 無法讀取：' + file.name); }
  }
}

export async function readPublicCollection(client, folder, recursive, previousEvents = [], onProgress = () => {}) {
  const root = await client.metadata(folder);
  if (root.mimeType !== FOLDER) throw Error('這是檔案連結，請改貼 Google Drive「資料夾」連結');
  const queue = [{id:folder, path:root.name}], seen = new Set(), found = new Map(), meta = [], backups = [];
  while (queue.length) {
    const current = queue.shift(); if (seen.has(current.id)) continue; seen.add(current.id);
    for (const file of await client.children(current.id)) {
      if (file.mimeType === FOLDER && file.name === '_meme_data') { if (current.id === folder) meta.push(file); continue; }
      if (file.mimeType === FOLDER && recursive) queue.push({id:file.id, path:current.path + '/' + file.name});
      else if (/^image\/(jpeg|png|webp|gif|avif|bmp)$/.test(file.mimeType)) found.set(file.id, {...file, path:current.path, missing:false});
      else if (current.id === folder && /^MemeFinder-Marks-.+\.json$/.test(file.name)) backups.push(file);
    }
    onProgress(found.size);
  }
  const old = new Map(previousEvents.filter(e => e.driveId).map(e => [e.driveId, e])), events = [];
  for (const directory of meta) {
    for (const file of await client.children(directory.id)) {
      if (!file.name.endsWith('.json')) continue;
      const cached = old.get(file.id);
      const event = cached?.publicStamp === file.modifiedTime && file.modifiedTime ? cached : await client.json(file);
      if (!validEvent(event)) throw Error('公開標記格式不正確：' + file.name);
      events.push({...event, driveId:file.id, publicStamp:file.modifiedTime});
    }
  }
  // A full root backup also works if the owner no longer publishes the revision folder.
  if (!events.length && backups.length) {
    backups.sort((a,b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '') || b.name.localeCompare(a.name));
    const backup = await client.json(backups[0]);
    if (backup.schema !== 1 || backup.folder !== folder || !Array.isArray(backup.events) || !backup.events.every(validEvent)) throw Error('公開備份格式或資料夾不符，請管理者重新備份');
    events.push(...backup.events);
  }
  return {name:root.name, files:[...found.values()], events:[...new Map(events.map(e => [e.id,e])).values()]};
}

export function guestRecord(events, personal, id) {
  const cloud = record(events, id), local = personal[id];
  if (!local) return {...cloud, favorite:false};
  const result = {...cloud, ...local, conflict:false, heads:[]};
  result.tags = [...new Set([...(cloud.tags || []), ...(local.tags || [])])];
  for (const field of ['scene','phrase','text','notes']) result[field] = [...new Set([cloud[field], local[field]].filter(Boolean))].join('\n');
  result.title = local.title || cloud.title || '';
  result.confirmed = local.confirmed || cloud.confirmed;
  return result;
}

export function guestBackup(folder, personal, version) {
  return {schema:1, kind:'MemeFinder-guest-notes', folder, version, createdAt:new Date().toISOString(), personal:structuredClone(personal)};
}
export function validGuestBackup(value, folder) {
  return value?.schema === 1 && value.kind === 'MemeFinder-guest-notes' && value.folder === folder &&
    value.personal && !Array.isArray(value.personal) && typeof value.personal === 'object' &&
    Object.entries(value.personal).every(([id, data]) => ID.test(id) && !['__proto__','constructor','prototype'].includes(id) &&
      validEvent({schema:1,id,fileId:id,time:'',parents:[],data}) && (data.notes === undefined || typeof data.notes === 'string'));
}
