import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const demo = () => process.env.DEMO_MODE === "true";

export async function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Настройте подключение Supabase или явно включите DEMO_MODE.");
  const jar = await cookies();
  return createServerClient(url, key, { cookies: {
    getAll: () => jar.getAll(),
    setAll: (values) => {
      try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
      catch { /* Server Components cannot write cookies. */ }
    },
  } });
}
