import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client, teams } from "./appwrite";
import { DB_ID, TASKS_COL, databases } from "./db";
import { nextDueAfter, type Repeat } from "./taskLogic";

export interface Task extends Models.Document {
  title: string;
  done: boolean;
  hogarId: string;
  createdByName: string;
  /** Persona asignada. null/vacío = de todos (tarea conjunta). */
  assignedToName?: string | null;
  dueAt?: string | null; // ISO datetime
  repeat?: Repeat;
  /** Hasta cuándo se repite (ISO). Ausente = para siempre. */
  repeatUntil?: string | null;
  notify?: boolean;
}

const teamPerms = (hogarId: string) => [
  Permission.read(Role.team(hogarId)),
  Permission.update(Role.team(hogarId)),
  Permission.delete(Role.team(hogarId)),
];

export interface NewTask {
  title: string;
  createdByName: string;
  assignedToName?: string | null;
  dueAt?: string | null;
  repeat?: Repeat;
  repeatUntil?: string | null;
  notify?: boolean;
}

/**
 * Atributos que puede que la colección todavía no tenga (los crea
 * `scripts/appwrite-setup.sh`). Appwrite rechaza el documento ENTERO si mandas
 * uno que no existe, así que si falla se reintenta con lo imprescindible: más
 * vale una tarea sin fecha ni aviso que una tarea que no se guarda.
 */
const OPTIONAL = ["assignedToName", "dueAt", "repeat", "repeatUntil", "notify"] as const;

const withoutOptional = <T extends object>(data: T): T => {
  const out = { ...data } as Record<string, unknown>;
  for (const k of OPTIONAL) delete out[k];
  return out as T;
};

export async function listTasks(hogarId: string): Promise<Task[]> {
  const res = await databases.listDocuments<Task>(DB_ID, TASKS_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return res.documents;
}

export async function createTask(hogarId: string, data: NewTask): Promise<Task> {
  const doc = {
    title: data.title,
    done: false,
    hogarId,
    createdByName: data.createdByName,
    assignedToName: data.assignedToName ?? null,
    dueAt: data.dueAt ?? null,
    repeat: data.repeat ?? "none",
    repeatUntil: data.repeatUntil ?? null,
    notify: data.notify ?? false,
  };
  try {
    return await databases.createDocument<Task>(DB_ID, TASKS_COL, ID.unique(), doc, teamPerms(hogarId));
  } catch {
    return databases.createDocument<Task>(DB_ID, TASKS_COL, ID.unique(), withoutOptional(doc), teamPerms(hogarId));
  }
}

export async function updateTask(
  id: string,
  patch: Partial<Pick<Task, "title" | "done" | "assignedToName" | "dueAt" | "repeat" | "repeatUntil" | "notify">>,
): Promise<Task> {
  try {
    return await databases.updateDocument<Task>(DB_ID, TASKS_COL, id, patch);
  } catch (e) {
    const rest = withoutOptional(patch);
    // Si lo único que se tocaba era un atributo que no existe, no hay nada que
    // salvar: mejor que el error suba y se vea, en vez de fingir que se guardó.
    if (!Object.keys(rest).length) throw e;
    return databases.updateDocument<Task>(DB_ID, TASKS_COL, id, rest);
  }
}

export async function setTaskDone(task: Task, done: boolean): Promise<Task> {
  return updateTask(task.$id, { done });
}

/**
 * Completa una tarea. Si es recurrente y tiene fecha, en vez de marcarla hecha
 * la "adelanta" a su próxima ocurrencia y la deja pendiente. Devuelve la tarea
 * actualizada, o null si fue una recurrente que rodó (sigue pendiente).
 */
export async function completeTask(task: Task, now: Date = new Date()): Promise<void> {
  const repeat = task.repeat ?? "none";
  if (repeat !== "none" && task.dueAt) {
    const next = nextDueAfter(task.dueAt, repeat, now, task.repeatUntil);
    if (next) {
      await updateTask(task.$id, { dueAt: next, done: false });
      return;
    }
  }
  await updateTask(task.$id, { done: true });
}

export async function deleteTask(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, TASKS_COL, id);
}

/** Nombres de los miembros del hogar (para asignar tareas). */
export async function listMemberNames(hogarId: string): Promise<string[]> {
  const res = await teams.listMemberships(hogarId);
  const names = res.memberships.map((m) => m.userName).filter((n): n is string => !!n && n.trim().length > 0);
  return [...new Set(names)];
}

// Tiempo real: notifica cualquier cambio en la colección de tareas.
export function subscribeTasks(onChange: () => void): () => void {
  return client.subscribe(
    `databases.${DB_ID}.collections.${TASKS_COL}.documents`,
    () => onChange(),
  );
}
