import "server-only";
import { cache } from "react";
import { FieldValue } from "firebase-admin/firestore";
import { fs } from "./firebase/admin";
import { DEFAULT_ROLES } from "./roles";
import type {
  ActivityDoc,
  CommentDoc,
  FolderDoc,
  GalaxyDoc,
  GrantDoc,
  InvitationDoc,
  OverrideDoc,
  PlanetDoc,
  RoleDoc,
  TaskDoc,
  UserDoc,
  XpEventDoc,
} from "./types";

export { FieldValue };

export const col = {
  users: () => fs().collection("users"),
  roles: () => fs().collection("roles"),
  grants: () => fs().collection("grants"),
  overrides: () => fs().collection("overrides"),
  invitations: () => fs().collection("invitations"),
  galaxies: () => fs().collection("galaxies"),
  folders: () => fs().collection("folders"),
  planets: () => fs().collection("planets"),
  tasks: () => fs().collection("tasks"),
  comments: (taskId: string) => fs().collection("tasks").doc(taskId).collection("comments"),
  activity: () => fs().collection("activity"),
  xpEvents: () => fs().collection("xpEvents"),
  pings: () => fs().collection("pings"),
  // Per-user subcollection so "latest first" needs no composite index.
  notifications: (userId: string) => fs().collection("users").doc(userId).collection("notifications"),
  settings: () => fs().collection("settings"),
  reminders: () => fs().collection("reminders"),
  counters: () => fs().collection("counters"),
};

type Snap = FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot;
export function docOf<T>(s: Snap): T {
  return { ...(s.data() as object), id: s.id } as T;
}
export async function all<T>(q: FirebaseFirestore.Query): Promise<T[]> {
  return (await q.get()).docs.map((d) => docOf<T>(d));
}
export async function one<T>(ref: FirebaseFirestore.DocumentReference): Promise<T | null> {
  const s = await ref.get();
  return s.exists ? docOf<T>(s) : null;
}

export const now = () => new Date().toISOString();
export const newId = () => fs().collection("_").doc().id;

/** Creates the default roles the first time the app runs. */
let bootstrapped = false;
async function ensureRoles() {
  if (bootstrapped) return;
  const existing = await col.roles().limit(1).get();
  if (existing.empty) {
    const batch = fs().batch();
    for (const r of DEFAULT_ROLES) batch.set(col.roles().doc(r.id), r);
    await batch.commit();
  }
  bootstrapped = true;
}

// Per-request caches: the whole structure, roles and crew are small (≈100 users).

export const loadRoles = cache(async () => {
  await ensureRoles();
  return (await all<RoleDoc>(col.roles())).sort((a, b) => a.position - b.position);
});

export const loadOverrides = cache(() => all<OverrideDoc>(col.overrides()));

export const loadUsers = cache(async () => (await all<UserDoc>(col.users())).sort((a, b) => a.name.localeCompare(b.name)));

export const loadGrantsOf = cache((userId: string) => all<GrantDoc>(col.grants().where("userId", "==", userId)));

const byPosition = <T extends { position: number; createdAt: string }>(a: T, b: T) => a.position - b.position || a.createdAt.localeCompare(b.createdAt);

export const loadTree = cache(async () => {
  const [galaxies, folders, planets] = await Promise.all([
    all<GalaxyDoc>(col.galaxies().where("deletedAt", "==", null)),
    all<FolderDoc>(col.folders().where("deletedAt", "==", null)),
    all<PlanetDoc>(col.planets().where("deletedAt", "==", null)),
  ]);
  galaxies.sort(byPosition);
  folders.sort(byPosition);
  planets.sort(byPosition);
  return {
    galaxies,
    folders,
    planets,
    folderById: new Map(folders.map((f) => [f.id, f])),
    planetById: new Map(planets.map((p) => [p.id, p])),
  };
});

export type Tree = Awaited<ReturnType<typeof loadTree>>;

export async function getTask(id: string) {
  const t = await one<TaskDoc>(col.tasks().doc(id));
  return t && !t.deletedAt ? t : null;
}

export async function getTaskOrThrow(id: string) {
  const t = await getTask(id);
  if (!t) throw new Error("not_found");
  return t;
}

/** Tasks of the given planets ("in" queries are limited to 30 values per query). */
export async function tasksOfPlanets(planetIds: string[]): Promise<TaskDoc[]> {
  const out: TaskDoc[] = [];
  for (let i = 0; i < planetIds.length; i += 30) {
    const chunk = planetIds.slice(i, i + 30);
    if (chunk.length) out.push(...(await all<TaskDoc>(col.tasks().where("planetId", "in", chunk))));
  }
  return out.filter((t) => !t.deletedAt);
}

export async function nextTaskNumber(): Promise<number> {
  const ref = col.counters().doc("tasks");
  return fs().runTransaction(async (tx) => {
    const n = ((await tx.get(ref)).data()?.value ?? 0) + 1;
    tx.set(ref, { value: n });
    return n;
  });
}

export async function logActivity(taskId: string, actorId: string | null, action: string, data: Record<string, unknown> = {}) {
  await col.activity().add({ taskId, actorId, action, data, createdAt: now() } satisfies Omit<ActivityDoc, "id">);
}

export async function addSystemComment(taskId: string, body: string) {
  await col.comments(taskId).add({
    taskId,
    authorId: null,
    parentId: null,
    body,
    system: true,
    mentions: [],
    reactions: {},
    attachments: [],
    editedAt: null,
    deletedAt: null,
    createdAt: now(),
  } satisfies Omit<CommentDoc, "id">);
}

/** Bumps a ping document browsers listen to, so open views refresh live. */
export async function ping(...keys: string[]) {
  await Promise.all(keys.map((k) => col.pings().doc(k).set({ at: now() })));
}

export type { InvitationDoc, XpEventDoc };
