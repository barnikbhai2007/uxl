import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const supabaseKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

async function bumpCollectionMeta(collectionName: string) {
  try {
    await supabase
      .from('collection_meta')
      .upsert({ collection: collectionName, updated_at: Date.now() }, { onConflict: 'collection' });
  } catch (e) {
    // Non-critical, ignore silently
  }
}

async function getCollectionMeta(collectionName: string): Promise<number> {
  try {
    const { data } = await supabase
      .from('collection_meta')
      .select('updated_at')
      .eq('collection', collectionName)
      .single();
    return data?.updated_at ?? 0;
  } catch (e) {
    return 0;
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

export function getAuth(app: any) {
  return {
    currentUser: null as User | null,
  };
}

export class GoogleAuthProvider {}

export async function signInWithPopup(auth: any, provider: any) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { queryParams: { prompt: "select_account" } },
  });
  if (error) throw error;
  return { user: { uid: "auth-user", email: "user@example.com" } };
}

export async function signInAnonymously(auth: any) {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return {
    user: { uid: data.user?.id || "anon", email: null, isAnonymous: true },
  };
}

export async function signOut(auth: any) {
  await supabase.auth.signOut();
}

export function onAuthStateChanged(
  auth: any,
  callback: (user: User | null) => void,
) {
  const handleSession = (session: any) => {
    if (session?.user) {
      const u: User = {
        uid: session.user.id,
        email: session.user.email || null,
        isAnonymous: session.user.is_anonymous,
        providerData: [],
      };
      auth.currentUser = u;
      callback(u);
    } else {
      auth.currentUser = null;
      callback(null);
    }
  };

  supabase.auth.getSession().then(({ data: { session } }) => {
    handleSession(session);
  });

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    handleSession(session);
  });
  return () => {
    data.subscription.unsubscribe();
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
// Load persisted timestamps from localStorage
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
    } catch (e) {
      console.warn("Failed to persist cache", e);
    }
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
  const { data, error } = await supabase
    .from("documents")
    .select("id, collection, data")
    .eq("collection", ref.collectionName)
    .eq("id", ref.id)
    .single();
  
  if (error && error.code !== "PGRST116") { // Ignore strict single row missing error
    console.error("getDoc error:", error);
    throw new Error(error.message || JSON.stringify(error));
  }

  if (data) updateGlobalCache(ref.collectionName, ref.id, data.data);
  return {
    exists: () => !!data,
    id: ref.id,
    data: () => (data ? data.data : undefined),
  };
}

export async function getDocFromServer(ref: DocRef) {
  return getDoc(ref);
}

export async function getDocs(ref: CollRef | Query) {
  let sb = supabase
    .from("documents")
    .select("id, collection, data")
    .eq("collection", ref.collectionName);

  if (ref instanceof Query) {
    ref.filters.forEach((f) => {
      const fieldStr = `data->>${f.field}`;
      if (f.op === "==") sb = sb.eq(fieldStr, f.value);
      if (f.op === "<") sb = sb.lt(fieldStr, f.value);
      if (f.op === ">") sb = sb.gt(fieldStr, f.value);
    });
    ref.orderBys.forEach((o) => {
      sb = sb.order(`data->${o.field}`, { ascending: o.dir === "asc" });
    });
    if (ref.qlimit) {
      sb = sb.limit(ref.qlimit);
    }
  }

  let data = null, error = null;
  let retries = 3;
  while (retries > 0) {
    try {
      const res = await Promise.race([
        sb,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('client_timeout')), 15000)
        )
      ]) as any;
      data = res.data;
      error = res.error;
  
      if (error && (
        error.message?.includes('statement timeout') ||
        error.message?.includes('client_timeout')
      )) {
        retries--;
        console.warn(`Timeout for ${ref.collectionName}, retry ${3 - retries}/3...`);
        const delay = (3 - retries) * 1500; // 1.5s, 3s, 4.5s
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        break;
      }
    } catch (e: any) {
      retries--;
      const delay = (3 - retries) * 1500; // 1.5s, 3s, 4.5s
      console.warn(`Fetch error for ${ref.collectionName}, retry ${3 - retries}/3...`, e);
      await new Promise(resolve => setTimeout(resolve, delay));
      if (retries === 0) {
        error = e;
      }
    }
  }

  // If still failing, serve from cache silently
  if (error) {
    initCache(ref.collectionName);
    const cached = globalCache[ref.collectionName];
    if (cached && Object.keys(cached).length > 0) {
      console.warn(`Serving ${ref.collectionName} from cache due to timeout`);
      const docs = Object.entries(cached).map(([id, d]: any) => ({
        id,
        data: () => d,
        exists: () => true,
        ref: doc(ref as CollRef, id),
      }));
      return { docs, empty: docs.length === 0, forEach: (cb: any) => docs.forEach(cb) };
    }
    // Silently continue if cache is completely empty instead of crashing
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
  const finalData = JSON.parse(JSON.stringify(data)); // strip undefined
  let dataToSave = finalData;

  // Optimistic update for non-merge or if we can guess the state
  if (!options?.merge) {
    updateGlobalCache(ref.collectionName, ref.id, dataToSave);
    localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
    bumpCollectionMeta(ref.collectionName);
  }

  if (options && options.merge) {
    const { data: existing } = await supabase
      .from("documents")
      .select("data")
      .eq("collection", ref.collectionName)
      .eq("id", ref.id)
      .single();
    
    if (existing) {
      dataToSave = await handleSpecialOps(existing.data, finalData);
      await supabase
        .from("documents")
        .update({ data: dataToSave })
        .eq("collection", ref.collectionName)
        .eq("id", ref.id);
      
      updateGlobalCache(ref.collectionName, ref.id, dataToSave);
      localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
      bumpCollectionMeta(ref.collectionName);
      return;
    }
  }

  if (Object.values(dataToSave).some((v: any) => v && v.__op)) {
    dataToSave = await handleSpecialOps({}, dataToSave);
  }

  const { error } = await supabase
    .from("documents")
    .upsert(
      { id: ref.id, collection: ref.collectionName, data: dataToSave },
      { onConflict: "collection,id" },
    );
  
  if (error) {
    console.error("setDoc upsert error:", error);
  } else {
    updateGlobalCache(ref.collectionName, ref.id, dataToSave);
    localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
    bumpCollectionMeta(ref.collectionName);
  }
}

export async function updateDoc(ref: DocRef, data: any) {
  const finalData = JSON.parse(JSON.stringify(data));
  
  // Try to find cached data for optimistic update
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
              cur[lastPart] = val; // Nested increment/arrayUnion not fully mocked here but simple assignments work
          } else {
              nextData[key] = val;
          }
      }
      updateGlobalCache(ref.collectionName, ref.id, nextData);
      localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
      bumpCollectionMeta(ref.collectionName);
  }

  const { data: existing } = await supabase
    .from("documents")
    .select("data")
    .eq("collection", ref.collectionName)
    .eq("id", ref.id)
    .single();
  
  if (existing) {
    const nextData = { ...existing.data };
    
    // First handle dot notation keys to find the target object
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
    
    await supabase
      .from("documents")
      .update({ data: nextData })
      .eq("collection", ref.collectionName)
      .eq("id", ref.id);
    
    updateGlobalCache(ref.collectionName, ref.id, nextData);
    localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
    bumpCollectionMeta(ref.collectionName);
  }
}

export async function deleteDoc(ref: DocRef) {
  updateGlobalCache(ref.collectionName, ref.id, null, true);
  localEmitter.dispatchEvent(new CustomEvent('db_change', { detail: ref.collectionName }));
  bumpCollectionMeta(ref.collectionName);

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("collection", ref.collectionName)
    .eq("id", ref.id);
  if (error) {
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
        initCache(collectionName);
        const hasCache = globalCache[collectionName] && Object.keys(globalCache[collectionName]).length > 0;

        // Check server timestamp first (only 100 bytes)
        const initialMeta = await getCollectionMeta(collectionName);
        const lastSeen = lastSeenMeta[collectionName] ?? 0;
        const dataIsStale = initialMeta > lastSeen;

        if (hasCache && !dataIsStale) {
          // Cache is fresh - show instantly, zero full download
          callback(applyQueryLocally(ref));
        } else {
          // No cache OR data changed since last visit - fetch fresh
          const snap = await getDocs(ref);
          if (_mounted) {
            if (!(ref instanceof Query) || ref.filters.length === 0) {
              globalCache[collectionName] = {};
              snap.forEach((doc: any) => {
                globalCache[collectionName][doc.id] = doc.data();
              });
              persistCache(collectionName);
              callback(applyQueryLocally(ref));
            } else {
              const freshDocs = snap.docs.map((d: any) => ({
                id: d.id,
                data: () => d.data(),
                exists: () => true,
              }));
              callback({ docs: freshDocs, empty: freshDocs.length === 0, forEach: (cb: any) => freshDocs.forEach(cb) });
            }
          }
        }

        persistMetaTimestamp(collectionName, initialMeta);
      }
    } catch (err) {
      if (errorCb) errorCb(err);
    }
  };

  // Initial fetch immediately
  fetchAndNotify();

  // ✅ Poll with smart jitter to avoid thundering herd database timeouts
  const BASE_INTERVAL = 8 * 60 * 1000; // 8 minutes
  const JITTER = Math.floor(Math.random() * 120000); // Up to 120s of jitter
  
  const timer = setInterval(async () => {
    if (!_mounted) return;
    if (document.hidden) return; // Zero DB calls when tab is not visible
    try {
      if (isDoc) {
        const d = await getDoc(ref);
        if (_mounted && d.exists()) callback(d);
      } else {
        // Step 1: Check only the tiny timestamp first
        const serverMeta = await getCollectionMeta(collectionName);
        const lastSeen = lastSeenMeta[collectionName] ?? 0;

        if (serverMeta <= lastSeen) {
          // Nothing changed — skip entirely, zero egress
          return;
        }

        // Something changed — fetch fresh data
        const snap = await getDocs(ref);
        if (_mounted) {
          persistMetaTimestamp(collectionName, serverMeta); // Update our timestamp
          if (!(ref instanceof Query) || ref.filters.length === 0) {
            // For full collection fetches, we can confidently wipe deleted records
            globalCache[collectionName] = {};
            snap.forEach((doc: any) => {
                globalCache[collectionName][doc.id] = doc.data();
            });
            persistCache(collectionName);
            callback(applyQueryLocally(ref));
          } else {
            // Filtered fetch (e.g. where status == approved):
            // Bypass stale cache entirely, use fresh DB results directly
            const freshDocs = snap.docs.map((d: any) => ({
              id: d.id,
              data: () => d.data(),
              exists: () => true,
            }));
            callback({ docs: freshDocs, empty: freshDocs.length === 0, forEach: (cb: any) => freshDocs.forEach(cb) });
          }
        }
      }
    } catch (err) {
      if (errorCb) errorCb(err);
      console.warn("Polling fetch failed, keeping cache intact:", err);
    }
  }, BASE_INTERVAL + JITTER);

  // Local emitter still works for instant updates when THIS tab writes
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

  // When user returns to the tab, fetch fresh data immediately
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
    // No supabase.removeChannel needed — no channel opened!
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

const app = {};
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const signIn = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Check if user exists in Firestore, if not create
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        role: 'user' // Default role
      });
    }
    return user;
  } catch (error) {
    console.error("Error signing in:", error);
    throw error;
  }
};

export const signInAnon = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error: any) {
    console.error("Error signing in anonymously:", error.code, error.message);
    throw error;
  }
};

export const logout = () => signOut(auth);

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
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
