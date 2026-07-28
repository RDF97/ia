import { redirect } from "next/navigation";
import { requireSession } from "@/server/auth";
import { todayInTz } from "@/server/board/query";

export default async function Home() {
  await requireSession();
  redirect(`/cuadro/${todayInTz("Europe/Madrid")}`);
}
