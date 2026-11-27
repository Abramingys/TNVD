import { NextResponse } from "next/server";
import { database, demo } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!demo() && code && code.length <= 256) {
    const db = await database();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(url.searchParams.has("recovery") ? "/reset-password" : "/dashboard", url));
  }
  return NextResponse.redirect(new URL("/login?notice=error", url));
}
