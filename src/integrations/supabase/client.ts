import { auth, db, storage } from "@/integrations/firebase/client";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type WhereFilterOp,
  type QueryConstraint,
} from "firebase/firestore";
import {
  getBlob,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

type AuthEvent = "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED";

function toSupabaseUser(user: User | null) {
  if (!user) return null;
  return {
    id: user.uid,
    email: user.email,
    email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    user_metadata: {
      full_name: user.displayName,
      avatar_url: user.photoURL,
    },
  };
}

function withId(snapshot: { id: string; data: () => DocumentData }) {
  return { id: snapshot.id, ...snapshot.data() };
}

function defaultsFor(table: string, row: DocumentData, id: string) {
  const now = new Date().toISOString();
  if (table === "issues") {
    return {
      id,
      status: "open",
      is_anonymous: false,
      photo_path: null,
      description: null,
      upvote_count: 0,
      created_at: now,
      updated_at: now,
      ...row,
    };
  }
  if (table === "profiles") {
    return {
      id,
      default_anonymous: false,
      digest_subscribed: true,
      digest_weekday: new Date().getUTCDay(),
      created_at: now,
      updated_at: now,
      ...row,
    };
  }
  if (table === "moderator_profiles") {
    return {
      id,
      verified: false,
      ai_verified: false,
      created_at: now,
      updated_at: now,
      ...row,
    };
  }
  return { id, created_at: now, ...row };
}

class FirebaseQueryBuilder {
  private filters: QueryConstraint[] = [];
  private limitCount?: number;
  private singleMode: "single" | "maybeSingle" | null = null;
  private pendingMutation:
    | { type: "insert"; values: DocumentData | DocumentData[] }
    | { type: "upsert"; values: DocumentData | DocumentData[] }
    | { type: "update"; values: DocumentData }
    | { type: "delete" }
    | null = null;

  constructor(private table: string) {}

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.addWhere(field, "==", value);
    return this;
  }

  neq(field: string, value: unknown) {
    this.addWhere(field, "!=", value);
    return this;
  }

  gte(field: string, value: unknown) {
    this.addWhere(field, ">=", value);
    return this;
  }

  lte(field: string, value: unknown) {
    this.addWhere(field, "<=", value);
    return this;
  }

  in(field: string, values: unknown[]) {
    if (values.length === 0) {
      this.filters.push(where("__name__", "==", "__empty__"));
      return this;
    }
    this.addWhere(field, "in", values.slice(0, 30));
    return this;
  }

  is(field: string, value: unknown) {
    this.addWhere(field, "==", value);
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.filters.push(orderBy(field, options?.ascending === false ? "desc" : "asc"));
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.singleMode = "single";
    return this;
  }

  maybeSingle() {
    this.singleMode = "maybeSingle";
    return this;
  }

  insert(values: DocumentData | DocumentData[]) {
    this.pendingMutation = { type: "insert", values };
    return this;
  }

  upsert(values: DocumentData | DocumentData[]) {
    this.pendingMutation = { type: "upsert", values };
    return this;
  }

  update(values: DocumentData) {
    this.pendingMutation = { type: "update", values };
    return this;
  }

  delete() {
    this.pendingMutation = { type: "delete" };
    return this;
  }

  private addWhere(field: string, op: WhereFilterOp, value: unknown) {
    if (field === "id") {
      this.filters.push(where("__name__", op, value));
      return;
    }
    this.filters.push(where(field, op, value));
  }

  async then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    try {
      const result = await this.execute();
      return onfulfilled ? onfulfilled(result) : (result as TResult1);
    } catch (error) {
      if (onrejected) return onrejected(error);
      return { data: null, error };
    }
  }

  private get collectionRef() {
    return collection(db, this.table);
  }

  private get constraints() {
    return this.limitCount ? [...this.filters, limitQuery(this.limitCount)] : this.filters;
  }

  private async execute(): Promise<{ data: unknown; error: null }> {
    if (!this.pendingMutation) return this.executeRead();

    if (this.pendingMutation.type === "insert") {
      const rows = Array.isArray(this.pendingMutation.values) ? this.pendingMutation.values : [this.pendingMutation.values];
      const written = [];
      for (const row of rows) {
        const docRef = row.id ? doc(db, this.table, String(row.id)) : doc(this.collectionRef);
        const data = defaultsFor(this.table, row, docRef.id);
        await setDoc(docRef, data);
        written.push(data);
      }
      return { data: Array.isArray(this.pendingMutation.values) ? written : written[0], error: null };
    }

    if (this.pendingMutation.type === "upsert") {
      const rows = Array.isArray(this.pendingMutation.values) ? this.pendingMutation.values : [this.pendingMutation.values];
      const written = [];
      for (const row of rows) {
        const id = String(row.id ?? row.user_id ?? row.uid);
        if (!id || id === "undefined") throw new Error(`Missing id for ${this.table} upsert`);
        const data = defaultsFor(this.table, row, id);
        await setDoc(doc(db, this.table, id), data, { merge: true });
        written.push(data);
      }
      return { data: Array.isArray(this.pendingMutation.values) ? written : written[0], error: null };
    }

    const docs = await getDocs(query(this.collectionRef, ...this.constraints));

    if (this.pendingMutation.type === "update") {
      await Promise.all(docs.docs.map((snapshot) => updateDoc(doc(db, this.table, snapshot.id), {
        ...this.pendingMutation?.values,
        updated_at: new Date().toISOString(),
      })));
      return { data: docs.docs.map(withId), error: null };
    }

    await Promise.all(docs.docs.map((snapshot) => deleteDoc(doc(db, this.table, snapshot.id))));
    return { data: null, error: null };
  }

  private async executeRead(): Promise<{ data: unknown; error: null }> {
    const snapshot = await getDocs(query(this.collectionRef, ...this.constraints));
    const rows = snapshot.docs.map(withId);
    if (this.singleMode === "single") return { data: rows[0] ?? null, error: null };
    if (this.singleMode === "maybeSingle") return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }
}

function createChannel(tableName: string) {
  let unsubscribe: (() => void) | undefined;

  return {
    on(_eventType: string, _filter: unknown, callback: () => void) {
      unsubscribe = onSnapshot(collection(db, tableName.split(":").pop() ?? tableName), () => callback());
      return this;
    },
    subscribe() {
      return this;
    },
    unsubscribe() {
      unsubscribe?.();
    },
  };
}

export const supabase = {
  auth: {
    async getUser() {
      return { data: { user: toSupabaseUser(auth.currentUser) }, error: null };
    },
    async getSession() {
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      return {
        data: {
          session: auth.currentUser && token ? { access_token: token, user: toSupabaseUser(auth.currentUser) } : null,
        },
        error: null,
      };
    },
    onAuthStateChange(callback: (event: AuthEvent, session: { user: ReturnType<typeof toSupabaseUser> } | null) => void) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        callback(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user: toSupabaseUser(user) } : null);
      });
      return { data: { subscription: { unsubscribe } } };
    },
    async signOut() {
      await signOut(auth);
      return { error: null };
    },
    async setSession() {
      return { error: null };
    },
  },
  from(table: string) {
    return new FirebaseQueryBuilder(table);
  },
  storage: {
    from(bucket: string) {
      return {
        async upload(path: string, file: Blob | Uint8Array | ArrayBuffer, options?: { upsert?: boolean }) {
          void options;
          const storageRef = ref(storage, `${bucket}/${path}`);
          await uploadBytes(storageRef, file);
          return { data: { path }, error: null };
        },
        async createSignedUrl(path: string) {
          const signedUrl = await getDownloadURL(ref(storage, `${bucket}/${path}`));
          return { data: { signedUrl }, error: null };
        },
        async download(path: string) {
          const blob = await getBlob(ref(storage, `${bucket}/${path}`));
          return { data: blob, error: null };
        },
      };
    },
  },
  channel: createChannel,
  removeChannel(channel: { unsubscribe?: () => void }) {
    channel.unsubscribe?.();
  },
};
