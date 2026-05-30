const rawApiUrl = (import.meta as any).env?.VITE_API_URL || "";
const VITE_API_URL = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

import { auth as firebaseAuth, googleProvider, signInWithPopup, firebaseSignOut } from './firebase';

export { firebaseAuth as firebaseAuthImpl }; // Just optionally

export const supabase = {
  removeChannel: (channel: any) => {},
};

async function apiFetch(path: string, options: any = {}) {
  const token = localStorage.getItem("auth_token");
  const defaultHeaders: any = {
    "Content-Type": "application/json",
  };
  if (token) {
    defaultHeaders["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${VITE_API_URL}${path}`, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });

  if (!res.ok) {
    let errText = `HTTP Error ${res.status}`;
    try {
      const text = await res.text();
      try {
        const errJson = JSON.parse(text);
        errText = errJson.error || errText;
      } catch {
        errText = text || errText;
      }
    } catch {
      // Ignore
    }
    throw new Error(errText);
  }

  return res.json();
}

async function bumpCollectionMeta(collectionName: string) {
  try {
    await apiFetch("/api/db/bump_meta", {
      method: "POST",
      body: JSON.stringify({ collection: collectionName }),
    });
  } catch (e) {
    console.warn("bumpCollectionMeta error:", e);
  }
}

export async function getCollectionMeta(collectionName: string): Promise<number | null> {
  try {
    const res = await apiFetch(`/api/db/meta/${collectionName}`);
    return res.updated_at ?? 0;
  } catch (e) {
    console.warn("getCollectionMeta exception:", e);
    return null;
  }
}

// --- Auth Mock ---
export type User = {
  uid: string;
  email: string | null;
  isAnonymous?: boolean;
  emailVerified?: boolean;
  tenantId?: string;
  providerData?: any[];
};

class AuthMock {
  currentUser: User | null = null;
  listeners: ((user: User | null) => void)[] = [];

  notifyListeners() {
    this.listeners.forEach((cb) => cb(this.currentUser));
  }
}

const authInstance = new AuthMock();

export function getAuth(app: any) {
  return authInstance;
}

export class GoogleAuthProvider {}

export async function signIn() {
  try {
    if (!import.meta.env.VITE_FIREBASE_API_KEY) {
       console.warn("Firebase config not found! Falling back to dummy login");
       const res = await apiFetch("/api/auth/login", {
         method: "POST",
         body: JSON.stringify({ email: "admin@uxl.com", password: "admin123" }),
       });
       localStorage.setItem("auth_token", res.token);
       const userRes = await apiFetch("/api/auth/me");
       authInstance.currentUser = userRes.user as User;
       authInstance.notifyListeners();

       // Check if user exists in Firestore, if not create
       const userRef = doc(db, 'users', authInstance.currentUser.uid);
       const userSnap = await getDoc(userRef);
       if (!userSnap.exists()) {
         await setDoc(userRef, {
           uid: authInstance.currentUser.uid,
           email: authInstance.currentUser.email,
           role: 'user',
           createdAt: new Date().toISOString()
         });
       }
       return authInstance.currentUser;
    }

    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await result.user.getIdToken();

    const res = await apiFetch("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });

    localStorage.setItem("auth_token", res.token);
    
    authInstance.currentUser = res.user as User;
    authInstance.notifyListeners();

    // Check if user exists in Firestore, if not create
    const userRef = doc(db, 'users', authInstance.currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: authInstance.currentUser.uid,
        email: authInstance.currentUser.email,
        role: 'user',
        createdAt: new Date().toISOString()
      });
    }

    return authInstance.currentUser;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}


export async function signInAnon() {
  try {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ isAnonymous: true }),
    });
    localStorage.setItem("auth_token", res.token);
    const userRes = await apiFetch("/api/auth/me");
    authInstance.currentUser = userRes.user as User;
    authInstance.notifyListeners();
    return authInstance.currentUser;
  } catch (error: any) {
    console.error("Error signing in anonymously:", error.message);
    throw error;
  }
}

export async function signOut(authObj: any = null) {
  try {
    await firebaseSignOut(firebaseAuth);
  } catch (e) {
    console.warn("Firebase signout error:", e);
  }
  localStorage.removeItem("auth_token");
  authInstance.currentUser = null;
  authInstance.notifyListeners();
}

export const logout = () => signOut();

export function onAuthStateChanged(
  authObj: any,
  callback: (user: User | null) => void,
) {
  authInstance.listeners.push(callback);

  // Check current token
  apiFetch("/api/auth/me")
    .then((res) => {
      authInstance.currentUser = res.user as User;
      callback(authInstance.currentUser);
    })
    .catch(() => {
      authInstance.currentUser = null;
      callback(null);
    });

  return () => {
    authInstance.listeners = authInstance.listeners.filter((cb) => cb !== callback);
  };
}

// --- Firestore Mock ---
export function getFirestore(app: any, id?: string) {
  return "db";
}

class DocRef {
  constructor(
    public collectionName: string,
    public id: string,
  ) {}
}

class CollRef {
  constructor(public collectionName: string) {}
}

class Query {
  constructor(
    public collectionName: string,
    public filters: any[] = [],
    public orderBys: any[] = [],
    public qlimit?: number,
  ) {}
}

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function doc(db: any, colName: string, id?: string) {
  if (arguments.length > 2) {
    if (typeof id === "string") return new DocRef(colName, id);
  }
  if (
    colName &&
    id === undefined &&
    (colName as any) instanceof CollRef === false
  ) {
    const parts = colName.split("/");
    return new DocRef(parts[0], parts[1]);
  }
  if (db instanceof CollRef) {
    return new DocRef(db.collectionName, colName as string);
  }
  return new DocRef(colName as string, id || generateUUID());
}

export function collection(db: any, colName: string) {
  if (db instanceof DocRef) {
    return new CollRef(`${db.collectionName}/${db.id}/${colName}`);
  }
  return new CollRef(colName);
}

export function query(coll: CollRef | Query, ...constraints: any[]) {
  const q = new Query(
    coll.collectionName,
    coll instanceof Query ? [...coll.filters] : [],
    coll instanceof Query ? [...coll.orderBys] : [],
    coll instanceof Query ? coll.qlimit : undefined,
  );
  constraints.forEach((c) => {
    if (c && c.type === "where") q.filters.push(c);
    if (c && c.type === "orderBy") q.orderBys.push(c);
    if (c && c.type === "limit") q.qlimit = c.value;
  });
  return q;
}

export function where(field: string, op: string, value: any) {
  return { type: "where", field, op, value };
}

export function orderBy(field: string, dir: "asc" | "desc" = "asc") {
  return { type: "orderBy", field, dir };
}

export function limit(value: number) {
  return { type: "limit", value };
}

const localEmitter = new EventTarget();
const globalCache: Record<string, Record<string, any>> = {};
const lastSeenMeta: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem('sb_meta_timestamps') || '{}');
  } catch { return {}; }
})();

function persistMetaTimestamp(collectionName: string, ts: number) {
  lastSeenMeta[collectionName] = ts;
  try {
    localStorage.setItem('sb_meta_timestamps', JSON.stringify(lastSeenMeta));
  } catch {}
}

function initCache(collection: string) {
  if (!globalCache[collection]) {
    try {
      const fromLocal = localStorage.getItem(`sb_cache_${collection}`);
      globalCache[collection] = fromLocal ? JSON.parse(fromLocal) : {};
    } catch (e) {
      globalCache[collection] = {};
    }
  }
}

let persistTimers: Record<string, any> = {};
function persistCache(collection: string) {
  if (persistTimers[collection]) clearTimeout(persistTimers[collection]);
  persistTimers[collection] = setTimeout(() => {
    try {
      localStorage.setItem(`sb_cache_${collection}`, JSON.stringify(globalCache[collection]));
    } catch (e) {}
  }, 1000);
}

function updateGlobalCache(collection: string, id: string, data: any, isDelete = false) {
  initCache(collection);
  if (isDelete) {
    delete globalCache[collection][id];
  } else {
    globalCache[collection][id] = data;
  }
  persistCache(collection);
}

function getFromCache(collection: string, id: string) {
  initCache(collection);
  return globalCache[collection]?.[id];
}

function applyQueryLocally(ref: CollRef | Query) {
  const collectionName = ref.collectionName;
  initCache(collectionName);
  const docsMap = globalCache[collectionName] || {};
  let docs = Object.entries(docsMap).map(([id, data]) => ({
    id,
    data: () => data,
    exists: () => true,
    ref: doc("db", collectionName, id),
  }));

  if (ref instanceof Query) {
    ref.filters.forEach((f) => {
      docs = docs.filter((d) => {
        const val = (d.data() as any)[f.field];
        if (f.op === "==") return val == f.value;
        if (f.op === "<") return val < f.value;
        if (f.op === ">") return val > f.value;
        return true;
      });
    });
    ref.orderBys.forEach((o) => {
      docs.sort((a, b) => {
        const valA = (a.data() as any)[o.field];
        const valB = (b.data() as any)[o.field];
        if (valA < valB) return o.dir === "asc" ? -1 : 1;
        if (valA > valB) return o.dir === "asc" ? 1 : -1;
        return 0;
      });
    });
    if (ref.qlimit) docs = docs.slice(0, ref.qlimit);
  }

  return {
    docs,
    empty: docs.length === 0,
    forEach: (cb: any) => docs.forEach(cb),
  };
}

export async function getDoc(ref: DocRef) {
  const cached = getFromCache(ref.collectionName, ref.id);
  if (cached) {
      return {
          exists: () => true,
          id: ref.id,
          data: () => cached
      };
  }
  
  try {
    const res = await apiFetch("/api/db/get", {
      method: "POST",
      body: JSON.stringify({ collection: ref.collectionName, id: ref.id })
    });
    const parsedData = res.data ? JSON.parse(res.data.data) : null;
    if (parsedData) updateGlobalCache(ref.collectionName, ref.id, parsedData);
    
    return {
      exists: () => !!parsedData,
      id: ref.id,
      data: () => parsedData,
    };
  } catch (error: any) {
    console.error("getDoc error:", error);
    throw new Error(error.message);
  }
}

export async function getDocFromServer(ref: DocRef) {
  return getDoc(ref);
}

export async function getDocsWithDelta(ref: CollRef | Query, lastSeenStr: string, cachedData: any[]) {
  // Delta fetches not fully simulated yet, fallback to getDocs
  return getDocs(ref);
}

export async function getDocs(ref: CollRef | Query) {
  let data = null, error = null;
  let retries = 3;
  
  const payload: any = { collectionName: ref.collectionName };
  if (ref instanceof Query) {
    payload.filters = ref.filters.map(f => ({ field: f.field, op: f.op, value: f.value }));
  }

  while (retries > 0) {
    try {
      const res = await apiFetch("/api/db/query", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      
      // Parse D1 results
      data = res.data ? res.data.map((r: any) => ({
        id: r.id, 
        collection: r.collection,
        data: JSON.parse(r.data)
      })) : [];

      if (ref instanceof Query) {
        ref.orderBys.forEach((o) => {
          data.sort((a: any, b: any) => {
            const valA = a.data[o.field];
            const valB = b.data[o.field];
            if (valA < valB) return o.dir === "asc" ? -1 : 1;
            if (valA > valB) return o.dir === "asc" ? 1 : -1;
            return 0;
          });
        });
        if (ref.qlimit) {
          data = data.slice(0, ref.qlimit);
        }
      }

      break;
    } catch (e: any) {
      retries--;
      const delay = (3 - retries) * 1500;
      console.warn(`Fetch error for ${ref.collectionName}, retry ${3 - retries}/3...`, e);
      await new Promise(resolve => setTimeout(resolve, delay));
      if (retries === 0) {
        error = e;
      }
    }
  }

  if (error) {
    initCache(ref.collectionName);
    const cached = globalCache[ref.collectionName];
    if (cached && Object.keys(cached).length > 0) {
      console.warn(`Serving ${ref.collectionName} from cache due to API failure`);
      const docs = Object.entries(cached).map(([id, d]: any) => ({
        id,
        data: () => d,
        exists: () => true,
        ref: doc(ref as CollRef, id),
      }));
      return { docs, empty: docs.length === 0, forEach: (cb: any) => docs.forEach(cb) };
    }
    console.warn(`Falling back to empty response for ${ref.collectionName}`);
    return { docs: [], empty: true, forEach: () => {} };
  } else {
    (data || []).forEach((d: any) => updateGlobalCache(ref.collectionName, d.id, d.data));
  }
  const docs = (data || []).map((d: any) => ({
    id: d.id,
    data: () => d.data,
    exists: () => true,
    ref: doc(ref as CollRef, d.id),
  }));
  return {
    docs,
    empty: docs.length === 0,
    forEach: (cb: any) => docs.forEach(cb),
  };
}

async function handleSpecialOps(target: any, incoming: any) {
  const result = { ...target };
  for (const key in incoming) {
    const val = incoming[key];
    if (val && typeof val === "object" && val.__op === "increment") {
      result[key] = (Number(target[key]) || 0) + val.val;
    } else if (val && typeof val === "object" && val.__op === "arrayUnion") {
      const existing = Array.isArray(target[key]) ? target[key] : [];
      result[key] = [...existing, ...val.vals];
    } else {
      result[key] = val;
    }
  }
  return result;
}

export async function setDoc(ref: DocRef, data: any, options: any = {}) {
  const finalData = JSON.parse(JSON.stringify(data)); 
  finalData._updatedAt = Date.now();
  let dataToSave = finalData;

  if (!options?.merge) {
    updateGlobalCache(ref.collectionName, ref.id, dataToSave);
    localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
    await bumpCollectionMeta(ref.collectionName);
  }

  if (options && options.merge) {
    try {
      const existingRes = await apiFetch("/api/db/get", {
        method: "POST",
        body: JSON.stringify({ collection: ref.collectionName, id: ref.id })
      });
      const existingData = existingRes.data ? JSON.parse(existingRes.data.data) : null;

      if (existingData) {
        dataToSave = await handleSpecialOps(existingData, finalData);
      }
    } catch {}
  }

  if (Object.values(dataToSave).some((v: any) => v && v.__op)) {
    dataToSave = await handleSpecialOps({}, dataToSave);
  }

  try {
    await apiFetch("/api/db/set", {
      method: "POST",
      body: JSON.stringify({ collection: ref.collectionName, id: ref.id, data: dataToSave })
    });
    updateGlobalCache(ref.collectionName, ref.id, dataToSave);
    localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
    await bumpCollectionMeta(ref.collectionName);
  } catch (error) {
    console.error("setDoc error:", error);
  }
}

export async function updateDoc(ref: DocRef, data: any) {
  const finalData = JSON.parse(JSON.stringify(data));
  finalData._updatedAt = Date.now();
  
  const cached = getFromCache(ref.collectionName, ref.id);
  if (cached) {
      const nextData = { ...cached };
      for (const key in finalData) {
          const val = finalData[key];
          if (key.includes(".")) {
              const parts = key.split(".");
              let cur = nextData;
              for (let i = 0; i < parts.length - 1; i++) {
                  cur[parts[i]] = cur[parts[i]] || {};
                  cur = cur[parts[i]];
              }
              const lastPart = parts[parts.length - 1];
              cur[lastPart] = val; 
          } else {
              nextData[key] = val;
          }
      }
      updateGlobalCache(ref.collectionName, ref.id, nextData);
      localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
      await bumpCollectionMeta(ref.collectionName);
  }

  try {
    const existingRes = await apiFetch("/api/db/get", {
      method: "POST",
      body: JSON.stringify({ collection: ref.collectionName, id: ref.id })
    });
    const existingData = existingRes.data ? JSON.parse(existingRes.data.data) : null;

    if (existingData) {
      const nextData = { ...existingData };
      for (const key in finalData) {
        const val = finalData[key];
        if (key.includes(".")) {
          const parts = key.split(".");
          let cur = nextData;
          for (let i = 0; i < parts.length - 1; i++) {
            cur[parts[i]] = cur[parts[i]] || {};
            cur = cur[parts[i]];
          }
          const lastPart = parts[parts.length - 1];
          if (val && val.__op === "increment") {
            cur[lastPart] = (Number(cur[lastPart]) || 0) + val.val;
          } else if (val && val.__op === "arrayUnion") {
            const arr = Array.isArray(cur[lastPart]) ? cur[lastPart] : [];
            cur[lastPart] = [...arr, ...val.vals];
          } else {
            cur[lastPart] = val;
          }
        } else {
          if (val && val.__op === "increment") {
            nextData[key] = (Number(nextData[key]) || 0) + val.val;
          } else if (val && val.__op === "arrayUnion") {
            const arr = Array.isArray(nextData[key]) ? nextData[key] : [];
            nextData[key] = [...arr, ...val.vals];
          } else {
            nextData[key] = val;
          }
        }
      }
      
      await apiFetch("/api/db/update", {
        method: "POST",
        body: JSON.stringify({ collection: ref.collectionName, id: ref.id, data: nextData })
      });
      updateGlobalCache(ref.collectionName, ref.id, nextData);
      localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
      await bumpCollectionMeta(ref.collectionName);
    }
  } catch (error) {
    console.error("updateDoc error:", error);
  }
}

export async function deleteDoc(ref: DocRef) {
  updateGlobalCache(ref.collectionName, ref.id, null, true);
  localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
  await bumpCollectionMeta(ref.collectionName);

  try {
    await apiFetch("/api/db/delete", {
      method: "DELETE",
      body: JSON.stringify({ collection: ref.collectionName, id: ref.id })
    });
  } catch (error) {
    console.error("deleteDoc error:", error);
  }
}

export function onSnapshot(ref: any, callback: any, errorCb?: any) {
  const isDoc = ref instanceof DocRef;
  const collectionName = isDoc
    ? ref.collectionName
    : (ref as unknown as CollRef | Query).collectionName;

  let _mounted = true;

  const fetchAndNotify = async () => {
    try {
      if (isDoc) {
        const cached = getFromCache(collectionName, ref.id);
        if (cached) {
          callback({ exists: () => true, id: ref.id, data: () => cached });
        } else {
          const d = await getDoc(ref);
          if (_mounted && d.exists()) callback(d);
        }
      } else {
        const queryKey = (ref instanceof Query) ? JSON.stringify({c: ref.collectionName, f: ref.filters}) : ref.collectionName;
        const cacheKeyStr = `sb_query_${queryKey}`;
        const queryCacheStr = localStorage.getItem(cacheKeyStr);
        
        const initialMeta = await getCollectionMeta(collectionName);
        const lastSeen = lastSeenMeta[collectionName] ?? 0;
        const dataIsStale = (initialMeta ?? 0) > lastSeen;

        if (queryCacheStr && !dataIsStale) {
          const parsed = JSON.parse(queryCacheStr);
          const cachedDocs = parsed.map((docData: any) => ({
            id: docData.id,
            data: () => docData,
            exists: () => true,
          }));
          callback({ docs: cachedDocs, empty: cachedDocs.length === 0, forEach: (cb: any) => cachedDocs.forEach(cb) });
        } else {
          const snap = await getDocs(ref);
          
          if (_mounted) {
            const freshDocs = snap.docs.map((d: any) => ({
              id: d.id,
              data: () => d.data(),
              exists: () => true,
            }));
            
            const toCache = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            try { localStorage.setItem(cacheKeyStr, JSON.stringify(toCache)); } catch(e){}
            
            initCache(collectionName);
            snap.forEach((doc: any) => {
              globalCache[collectionName][doc.id] = doc.data();
            });
            persistCache(collectionName);

            callback({ docs: freshDocs, empty: freshDocs.length === 0, forEach: (cb: any) => freshDocs.forEach(cb) });
          }
        }

        if (initialMeta) persistMetaTimestamp(collectionName, initialMeta);
      }
    } catch (err) {
      if (errorCb) errorCb(err);
    }
  };

  fetchAndNotify();

  const BASE_INTERVAL = 8 * 60 * 1000; 
  const JITTER = Math.floor(Math.random() * 120000); 
  
  const timer = setInterval(async () => {
    if (!_mounted) return;
    if (document.hidden) return; 
    try {
      if (isDoc) {
        const d = await getDoc(ref);
        if (_mounted && d.exists()) callback(d);
      } else {
        const serverMeta = await getCollectionMeta(collectionName);
        const lastSeen = lastSeenMeta[collectionName] ?? 0;

        if ((serverMeta ?? 0) <= lastSeen) {
          return;
        }

        const snap = await getDocs(ref);
        if (_mounted) {
          if (serverMeta) persistMetaTimestamp(collectionName, serverMeta); 
          
          const queryKey = (ref instanceof Query) ? JSON.stringify({c: ref.collectionName, f: ref.filters}) : ref.collectionName;
          const cacheKeyStr = `sb_query_${queryKey}`;
          
          const freshDocs = snap.docs.map((d: any) => ({
            id: d.id,
            data: () => d.data(),
            exists: () => true,
          }));
          
          const toCache = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
          try { localStorage.setItem(cacheKeyStr, JSON.stringify(toCache)); } catch(e){}
          
          initCache(collectionName);
          snap.forEach((doc: any) => {
              globalCache[collectionName][doc.id] = doc.data();
          });
          persistCache(collectionName);

          callback({ docs: freshDocs, empty: freshDocs.length === 0, forEach: (cb: any) => freshDocs.forEach(cb) });
        }
      }
    } catch (err) {
      if (errorCb) errorCb(err);
    }
  }, BASE_INTERVAL + JITTER);

  const localHandler = (e: any) => {
    if (e.detail === collectionName && _mounted) {
      if (isDoc) {
        const cached = getFromCache(collectionName, ref.id);
        callback(cached
          ? { exists: () => true, id: ref.id, data: () => cached }
          : { exists: () => false, id: ref.id, data: () => undefined }
        );
      } else {
        callback(applyQueryLocally(ref));
      }
    }
  };
  localEmitter.addEventListener('db_change', localHandler);

  const onVisible = () => {
    if (!_mounted) return;
    if (document.visibilityState === 'visible') {
      fetchAndNotify();
    }
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    _mounted = false;
    clearInterval(timer);
    localEmitter.removeEventListener('db_change', localHandler);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function serverTimestamp() {
  return new Date().toISOString();
}
export class Timestamp {
  static now() {
    return { toMillis: () => Date.now(), toDate: () => new Date() };
  }
}
export function increment(val: number) {
  return { __op: "increment", val };
}

export function arrayUnion(...vals: any[]) {
  return { __op: "arrayUnion", vals };
}

export function writeBatch(db: any) {
  const operations: any[] = [];
  return {
    set: (ref: DocRef, data: any, options: any = {}) =>
      operations.push({ type: "set", ref, data, options }),
    update: (ref: DocRef, data: any) =>
      operations.push({ type: "update", ref, data }),
    delete: (ref: DocRef) => operations.push({ type: "delete", ref }),
    commit: async () => {
      for (const op of operations) {
        if (op.type === "set") await setDoc(op.ref, op.data, op.options);
        if (op.type === "update") await updateDoc(op.ref, op.data);
        if (op.type === "delete") await deleteDoc(op.ref);
      }
    },
  };
}

export const auth = getAuth({});
export const db = getFirestore({});
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: authInstance.currentUser?.uid,
      email: authInstance.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
