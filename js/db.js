/* IndexedDB 永続保存層。
 * 全レコードは同期を想定した共通フィールドを持つ:
 *   id(UUID) / createdAt / updatedAt / deleted(論理削除) / device
 * 将来サーバ同期する場合は updatedAt > lastSync のレコードを送受信する。 */
(function () {
  const DB_NAME = 'my-fitness-ai';
  const DB_VER = 1;
  const STORES = {
    kv: { keyPath: 'key' },                 // profile / settings / lastSync など
    weights: { keyPath: 'id', idx: ['date'] },
    meals: { keyPath: 'id', idx: ['date'] },
    foods: { keyPath: 'id', idx: ['jan', 'name'] },
    workouts: { keyPath: 'id', idx: ['date', 'machineId'] },
    gyms: { keyPath: 'id' },
    machines: { keyPath: 'id', idx: ['gymId'] },
  };
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, def] of Object.entries(STORES)) {
          if (db.objectStoreNames.contains(name)) continue;
          const st = db.createObjectStore(name, { keyPath: def.keyPath });
          (def.idx || []).forEach((i) => st.createIndex(i, i));
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15);
      return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
  }

  function deviceId() {
    try {
      let d = localStorage.getItem('mfa-device');
      if (!d) { d = uuid(); localStorage.setItem('mfa-device', d); }
      return d;
    } catch { return 'unknown'; }
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const st = t.objectStore(store);
      let out;
      Promise.resolve(fn(st)).then((v) => { out = v; });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const DB = {
    uuid,
    async put(store, obj) {
      const now = new Date().toISOString();
      const rec = Object.assign({}, obj);
      if (store !== 'kv') {
        rec.id = rec.id || uuid();
        rec.createdAt = rec.createdAt || now;
        rec.deleted = !!rec.deleted;
        rec.device = rec.device || deviceId();
      }
      rec.updatedAt = now;
      await tx(store, 'readwrite', (st) => st.put(rec));
      return rec;
    },
    async get(store, key) {
      return tx(store, 'readonly', (st) => reqP(st.get(key)));
    },
    async all(store, includeDeleted) {
      const rows = await tx(store, 'readonly', (st) => reqP(st.getAll()));
      return includeDeleted ? rows : rows.filter((r) => !r.deleted);
    },
    async remove(store, id) { // 論理削除（同期時に削除を伝播できるように）
      const r = await DB.get(store, id);
      if (!r) return;
      r.deleted = true;
      return DB.put(store, r);
    },
    async kvGet(key, def) {
      const r = await DB.get('kv', key);
      return r ? r.value : def;
    },
    async kvSet(key, value) { return DB.put('kv', { key, value }); },
    async exportAll() {
      const out = { app: 'my-fitness-ai', version: 1, exportedAt: new Date().toISOString(), data: {} };
      for (const s of Object.keys(STORES)) out.data[s] = await DB.all(s, true);
      return out;
    },
    async importAll(json) {
      if (!json || json.app !== 'my-fitness-ai' || !json.data) throw new Error('My Fitness AI のバックアップではありません');
      let n = 0;
      for (const s of Object.keys(STORES)) {
        const rows = json.data[s] || [];
        await tx(s, 'readwrite', (st) => {
          rows.forEach((r) => { st.put(r); n++; });
        });
      }
      return n;
    },
    async wipe() {
      for (const s of Object.keys(STORES)) await tx(s, 'readwrite', (st) => st.clear());
    },
  };
  window.DB = DB;
})();
