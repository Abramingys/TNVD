import { cookies } from "next/headers";
import { context } from "@/app/actions";
import { searchOptions,searchTnvedCodes } from "@/lib/tnved";

export async function GET(request:Request) {
  const parsed = searchOptions.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({error:"Проверьте параметры поиска."},{status:400});
  try {
    const [result,{db,user},jar] = await Promise.all([searchTnvedCodes(parsed.data,request.signal),context(),cookies()]);
    if (db && user && parsed.data.q && parsed.data.page===1 && !request.signal.aborted) {
      const {data:profile} = await db.from("profiles").select("default_country").eq("id",user.id).maybeSingle();
      const country = profile?.default_country ?? jar.get("tnved-country")?.value;
      await db.from("search_history").insert({user_id:user.id,query:parsed.data.q,country:country==="RU"?"RU":"BY"});
    }
    return Response.json({...result,user:Boolean(user)});
  } catch { return Response.json({error:"Поиск временно недоступен. Проверьте подключение к базе."},{status:503}); }
}
