import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { context } from "@/app/actions";
import { demo } from "@/lib/supabase";
import { Workspace } from "./workspace";

export async function Frame({children,landing=false}:{children:ReactNode;landing?:boolean}) {
  const [{db,user},jar] = await Promise.all([context(),cookies()]);
  const profile = db && user ? (await db.from("profiles").select("default_country,theme").eq("id",user.id).maybeSingle()).data : null;
  return <Workspace landing={landing} user={Boolean(user)} initialCountry={profile?.default_country ?? jar.get("tnved-country")?.value ?? "BY"} initialTheme={profile?.theme ?? jar.get("tnved-theme")?.value ?? "light"}>
    {demo()&&<p className="notice">Демонстрационный режим · тестовые данные. Для таможенного оформления используйте официальный источник.</p>}
    {children}
  </Workspace>;
}
