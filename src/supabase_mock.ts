import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  "https://ygrmdlbyfrbqhzvvfmii.supabase.co";
const supabaseKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_taKejserySOg3UGPlk0h-w_7tWsZDiN";

export const supabase = createClient(supabaseUrl, supabaseKey);

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

export async function getDoc(ref: DocRef) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("collection", ref.collectionName)
    .eq("id", ref.id)
    .single();
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
    .select("*")
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

  const { data, error } = await sb;
  if (error) {
    console.error(
      "getDocs error for collection",
      ref.collectionName,
      ":",
      error,
    );
  } else {
    // console.log("getDocs success for collection", ref.collectionName, "count:", data?.length);
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

export async function setDoc(ref: DocRef, data: any, options: any = {}) {
  const finalData = JSON.parse(JSON.stringify(data)); // strip undefined
  if (options && options.merge) {
    const { data: existing, error: fetchErr } = await supabase
      .from("documents")
      .select("data")
      .eq("collection", ref.collectionName)
      .eq("id", ref.id)
      .single();
    if (existing) {
      const { error } = await supabase
        .from("documents")
        .update({ data: { ...existing.data, ...finalData } })
        .eq("collection", ref.collectionName)
        .eq("id", ref.id);
      if (error) {
        console.error("setDoc merge update error:", error);
      }
    } else {
      const { error } = await supabase
        .from("documents")
        .insert({
          id: ref.id,
          collection: ref.collectionName,
          data: finalData,
        });
      if (error) {
        console.error("setDoc merge insert error:", error);
      }
    }
  } else {
    const { error } = await supabase
      .from("documents")
      .upsert(
        { id: ref.id, collection: ref.collectionName, data: finalData },
        { onConflict: "collection,id" },
      );
    if (error) {
      console.error("setDoc upsert error:", error);
    }
  }
}

export async function updateDoc(ref: DocRef, data: any) {
  const finalData = JSON.parse(JSON.stringify(data));
  const { data: existing, error: fetchErr } = await supabase
    .from("documents")
    .select("data")
    .eq("collection", ref.collectionName)
    .eq("id", ref.id)
    .single();
  if (fetchErr && fetchErr.code !== 'PGRST116') {
     console.error("updateDoc fetch error:", fetchErr);
  }
  if (existing) {
    const nextData = { ...existing.data };
    for (const key in finalData) {
      if (key.includes(".")) {
        const parts = key.split(".");
        let cur = nextData;
        for (let i = 0; i < parts.length - 1; i++) {
          cur[parts[i]] = cur[parts[i]] || {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = finalData[key];
      } else {
        nextData[key] = finalData[key];
      }
    }
    const { error: updateErr } = await supabase
      .from("documents")
      .update({ data: nextData })
      .eq("collection", ref.collectionName)
      .eq("id", ref.id);
    if (updateErr) {
      console.error("updateDoc error:", updateErr);
    }
  } else {
    console.warn("updateDoc: doc not found", ref.collectionName, ref.id);
  }
}

export async function deleteDoc(ref: DocRef) {
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
  // Initial fetch
  if (ref instanceof DocRef) {
    getDoc(ref)
      .then((doc) => callback(doc))
      .catch(errorCb);
  } else {
    getDocs(ref)
      .then((snap) => callback(snap))
      .catch(errorCb);
  }

  // Subscribe to realtime updates
  const isDoc = ref instanceof DocRef;
  const collectionName = isDoc
    ? ref.collectionName
    : (ref as unknown as CollRef | Query).collectionName;

  const channel = supabase
    .channel(`public:documents:${generateUUID()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "documents",
        filter: `collection=eq.${collectionName}`,
      },
      (payload) => {
        // Refetch and give the callback the new data. (Simple but effective mock)
        if (isDoc) {
          getDoc(ref)
            .then((doc) => callback(doc))
            .catch(errorCb);
        } else {
          getDocs(ref)
            .then((snap) => callback(snap))
            .catch(errorCb);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
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
  return val;
}
export function arrayUnion(...vals: any[]) {
  return vals;
}

export function writeBatch(db: any) {
  const operations: any[] = [];
  return {
    set: (ref: DocRef, data: any) =>
      operations.push({ type: "set", ref, data }),
    update: (ref: DocRef, data: any) =>
      operations.push({ type: "update", ref, data }),
    delete: (ref: DocRef) => operations.push({ type: "delete", ref }),
    commit: async () => {
      for (const op of operations) {
        if (op.type === "set") await setDoc(op.ref, op.data);
        if (op.type === "update") await updateDoc(op.ref, op.data);
        if (op.type === "delete") await deleteDoc(op.ref);
      }
    },
  };
}
