import { ID, Permission, Query, Role, type Models } from "react-native-appwrite";
import { client } from "./appwrite";
import { DB_ID, TASKS_COL, databases } from "./db";

export interface Task extends Models.Document {
  title: string;
  done: boolean;
  hogarId: string;
  createdByName: string;
  assignedToName?: string | null;
}

export async function listTasks(hogarId: string): Promise<Task[]> {
  const res = await databases.listDocuments<Task>(DB_ID, TASKS_COL, [
    Query.equal("hogarId", hogarId),
    Query.orderDesc("$createdAt"),
    Query.limit(100),
  ]);
  return res.documents;
}

export async function createTask(
  hogarId: string,
  title: string,
  createdByName: string,
): Promise<Task> {
  // Permisos a nivel de documento: solo los miembros del hogar (team) acceden.
  return databases.createDocument<Task>(
    DB_ID,
    TASKS_COL,
    ID.unique(),
    { title, done: false, hogarId, createdByName },
    [
      Permission.read(Role.team(hogarId)),
      Permission.update(Role.team(hogarId)),
      Permission.delete(Role.team(hogarId)),
    ],
  );
}

export async function setTaskDone(task: Task, done: boolean): Promise<Task> {
  return databases.updateDocument<Task>(DB_ID, TASKS_COL, task.$id, { done });
}

export async function deleteTask(id: string): Promise<void> {
  await databases.deleteDocument(DB_ID, TASKS_COL, id);
}

// Tiempo real: notifica cualquier cambio en la colección de tareas.
export function subscribeTasks(onChange: () => void): () => void {
  return client.subscribe(
    `databases.${DB_ID}.collections.${TASKS_COL}.documents`,
    () => onChange(),
  );
}
