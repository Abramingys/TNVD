"use server";

import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { database, demo } from "@/lib/supabase";

const countrySchema = z.enum(["BY","RU"]);
const themeSchema = z.enum(["light","dark"]);
const idSchema = z.uuid();

export async function context() {
  if (demo()) return { db:null,user:null };
  const db = await database();
  const {data:{user}} = await db.auth.getUser();
  return {db,user};
}

export async function savePreferences(country:string,theme:string) {
  const default_country = countrySchema.parse(country);
  const parsedTheme = themeSchema.parse(theme);
  const {db,user} = await context();
  if (db && user) {
    const {error} = await db.from("profiles").upsert({id:user.id,default_country,theme:parsedTheme});
    if (error) throw new Error("Не удалось сохранить настройки.");
  }
  const jar = await cookies();
  const options = {sameSite:"lax",httpOnly:true,path:"/",maxAge:31536000} as const;
  jar.set("tnved-country",default_country,options);
  jar.set("tnved-theme",parsedTheme,options);
}

const authMode = z.enum(["login","register","forgot-password","reset-password"]);
export async function authenticate(modeInput:string,form:FormData) {
  const mode = authMode.parse(modeInput);
  if (demo()) redirect("/"+mode+"?notice=demo");
  const db = await database();
  const email = z.email().safeParse(form.get("email"));
  const password = z.string().min(mode==="login"?1:8).max(128).safeParse(form.get("password"));
  const origin = process.env.APP_URL || (await headers()).get("origin") || "http://localhost:3000";
  const callback = new URL("/auth/callback",origin);
  let failed = false;
  if (mode==="reset-password" && password.success) {
    const {data:{user}} = await db.auth.getUser();
    if (!user) redirect("/forgot-password");
    failed = Boolean((await db.auth.updateUser({password:password.data})).error);
  } else if (mode==="forgot-password" && email.success) {
    callback.searchParams.set("recovery","1");
    failed = Boolean((await db.auth.resetPasswordForEmail(email.data,{redirectTo:callback.href})).error);
  } else if (email.success && password.success && mode==="register") {
    failed = Boolean((await db.auth.signUp({email:email.data,password:password.data,options:{emailRedirectTo:callback.href}})).error);
  } else if (email.success && password.success && mode==="login") {
    failed = Boolean((await db.auth.signInWithPassword({email:email.data,password:password.data})).error);
  } else redirect("/"+mode+"?notice=invalid");
  if (failed) redirect("/"+mode+"?notice=error");
  redirect(mode==="login"||mode==="reset-password"?"/dashboard":"/"+mode+"?notice=email");
}

export async function logout() {
  const {db} = await context();
  await db?.auth.signOut();
  redirect("/");
}

export async function mutate(operation:string,form:FormData) {
  const {db,user} = await context();
  if (!db || !user) redirect("/login");
  const id = idSchema.safeParse(form.get("id"));
  let error;
  switch (operation) {
    case "favorite":
      if (!id.success) notFound();
      ({error} = await db.from("favorites").upsert({user_id:user.id,code_id:id.data},{onConflict:"user_id,code_id",ignoreDuplicates:true}));
      break;
    case "remove-favorite":
    case "remove-history":
      if (!id.success) notFound();
      ({error} = await db.from(operation==="remove-favorite"?"favorites":"search_history").delete().eq("user_id",user.id).eq("id",id.data));
      break;
    case "clear-history":
      ({error} = await db.from("search_history").delete().eq("user_id",user.id));
      break;
    case "profile": {
      const name = z.string().trim().max(100).parse(form.get("name"));
      ({error} = await db.from("profiles").upsert({id:user.id,full_name:name}));
      break;
    }
    case "clear-data":
      ({error} = await db.rpc("clear_my_data"));
      break;
    default: notFound();
  }
  if (error) throw new Error("Не удалось сохранить изменения.");
  revalidatePath("/", "layout");
  if (operation==="favorite") redirect("/favorites");
}
