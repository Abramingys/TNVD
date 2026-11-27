import { z } from "zod";
import { database, demo } from "./supabase";

export const source = "https://docs.eaeunion.org/documents/386/6099/";
export const searchOptions = z.object({
  q: z.string().trim().max(160).default(""),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  group: z.string().regex(/^\d{2}$|^$/).default(""),
  section: z.string().max(32).default(""),
  status: z.enum(["all","active","expired"]).default("all"),
});
export type SearchOptions = z.infer<typeof searchOptions>;
export type Code = {
  id: string; code: string | null; title: string; full_description: string; parent_id: string | null;
  is_leaf: boolean; valid_from: string | null; valid_to: string | null; source_url: string | null;
  notes?: string; version_name?: string; parent_title?: string; section_key?: string;
};
const demoRows: Code[] = [
  ["demo-section",null,"Демонстрационный раздел «Пищевые продукты»",null],
  ["demo-group","09","Демонстрационная группа «Кофе и чай»","demo-section"],
  ["demo-coffee","0901","Кофе","demo-group"],
  ["demo-tea","0902","Чай","demo-group"],
  ["demo-leaf","0901210000","Кофе жареный","demo-coffee"],
  ["demo-eggs",null,"Демонстрационная группа «Яйца птиц»","demo-section"],
  ["demo-ostrich","0499999999","Яйца страуса для инкубации","demo-eggs"],
].map(([id,code,title,parent_id]) => ({
  id:id!,code,title:title!,parent_id,is_leaf:id==="demo-leaf" || id==="demo-ostrich",valid_from:null,valid_to:null,source_url:null,
  full_description:id==="demo-leaf"?"Кофе и чай / Кофе / Кофе жареный":title!,
  section_key:"demo-section",
}));
export const normalize = (value: string) => value.toLowerCase().replaceAll("ё","е").trim();
function near(a: string, b: string) {
  if (a.length < 4 || Math.abs(a.length-b.length)>1) return false;
  const index = [...a].findIndex((letter,i)=>letter!==b[i]);
  if (index < 0) return true;
  const transposed = a[index]===b[index+1] && a[index+1]===b[index] && a.slice(index+2)===b.slice(index+2);
  return transposed || a.slice(index+1)===b.slice(index+1) || a.slice(index+1)===b.slice(index) || a.slice(index)===b.slice(index+1);
}
const limit = 20;

export async function searchTnvedCodes(options: SearchOptions, signal?: AbortSignal) {
  const { q, page, group, section, status } = options;
  if (!demo()) {
    const db = await database();
    const request = db.rpc("search_tnved_codes", { query:q, page_number:page, group_code:group, section_key:section, code_status:status });
    const { data,error } = await (signal ? request.abortSignal(signal) : request);
    if (error) throw new Error("Поиск временно недоступен.");
    return { rows: (data ?? []).slice(0,limit) as Code[], more: (data?.length ?? 0)>limit };
  }
  const term = normalize(q).replace(/[.!?]+$/u,"").trim();
  const digits = term.replace(/\s/g,"");
  const rows = demoRows.map(row => {
    const title = normalize(row.title);
    const full = normalize(row.full_description);
    const rank = !term ? 1 : /^\d+$/.test(digits) ? row.code===digits?8:row.code?.startsWith(digits)?7:0
      : title===term?6:title.includes(term)?5:full.includes(term)?4:row.id==="demo-leaf" && term==="обжаренные зерна"?3
      : title.split(" ").some(word=>near(term,word))?2:0;
    return {row,rank};
  }).filter(({row,rank})=>rank && (!group || row.code?.startsWith(group)) && (!section || row.section_key===section) && status!=="expired")
    .sort((a,b)=>b.rank-a.rank).map(({row})=>row);
  return { rows:rows.slice((page-1)*limit,page*limit),more:rows.length>page*limit };
}

export async function catalogChildren(parent: string | null, offset=0) {
  if (demo()) return demoRows.filter(row=>row.parent_id===parent).slice(offset,offset+51);
  const db = await database();
  const request = db.from("public_tnved_codes").select("*").order("sort_order").order("id").range(offset,offset+50);
  const {data,error} = await (parent ? request.eq("parent_id",parent) : request.is("parent_id",null));
  if (error) throw new Error("Справочник временно недоступен.");
  return (data ?? []) as Code[];
}

export async function getCode(key: string): Promise<Code | null> {
  if (demo()) return demoRows.find(row=>row.id===key || row.code===key) ?? null;
  const db = await database();
  const {data,error} = await db.from("public_tnved_codes").select("*").eq(/^\d+$/.test(key)?"code":"id",key).order("valid_to",{ascending:false,nullsFirst:true}).limit(1).maybeSingle();
  if (error) throw new Error("Карточка временно недоступна.");
  return data as Code | null;
}
