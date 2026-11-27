import { createHash,randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const safeUrl = z.url({protocol:/^https$/});
const snapshot = z.object({
  version:z.string().trim().min(1),
  effectiveFrom:z.iso.date(),
  effectiveTo:z.iso.date().nullable().default(null),
  source:safeUrl,
  rows:z.array(z.object({
    key:z.string().trim().min(1).max(128),
    parent:z.string().trim().min(1).nullable(),
    code:z.string().transform(value=>value.replace(/\s/g,"")).pipe(z.string().regex(/^\d{2,10}$/)).nullable(),
    title:z.string().trim().min(1),
    notes:z.string().optional(),
    validFrom:z.iso.date().nullable().default(null),
    validTo:z.iso.date().nullable().default(null),
    source:safeUrl.optional(),
    leaf:z.boolean(),
  })).min(1).max(100000),
});

async function main() {
  const [file,...flags] = process.argv.slice(2);
  if (!file || flags.some(flag=>flag!=="--dry-run"&&flag!=="--activate")) throw new Error("Использование: npm run import:tnved -- snapshot.json [--dry-run | --activate]");
  const bytes = await readFile(file);
  if (bytes.length>100_000_000) throw new Error("Слишком большой файл.");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const data = snapshot.parse(JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/,"")));
  if (data.effectiveTo && data.effectiveTo<data.effectiveFrom) throw new Error("Некорректные даты редакции.");
  const rows = new Map(data.rows.map(row=>[row.key,row]));
  if (rows.size!==data.rows.length) throw new Error("Повторяющиеся ключи строк.");
  const errors:string[] = [];
  const leafCodes = new Set<string>();
  const parents = new Set(data.rows.flatMap(row=>row.parent?[row.parent]:[]));
  const normalized = data.rows.map((row,sort_order)=>{
    const chain = [row];
    const seen = new Set([row.key]);
    let key = row.parent;
    while (key) {
      const parent = rows.get(key);
      if (!parent || seen.has(key) || chain.length>=13) {
        errors.push(row.key+": отсутствующий родитель, цикл или превышение глубины");
        break;
      }
      seen.add(key);
      chain.unshift(parent);
      key = parent.parent;
    }
    if (row.leaf) {
      if (!row.code || row.code.length!==10 || leafCodes.has(row.code) || parents.has(row.key)) errors.push(row.key+": некорректный или повторяющийся конечный код");
      if (row.code) leafCodes.add(row.code);
    } else if (!parents.has(row.key)) errors.push(row.key+": у структурного узла нет потомков");
    if (row.validTo && row.validTo<(row.validFrom ?? data.effectiveFrom)) errors.push(row.key+": некорректные даты действия");
    return {
      external_key:row.key,parent_key:row.parent,code:row.code,title:row.title,
      full_description:chain.map(item=>item.title).join(" / "),section_key:chain[0].key,
      group_code:chain.find(item=>item.code?.length===2)?.code ?? null,
      level:chain.length-1,is_leaf:row.leaf,sort_order,valid_from:row.validFrom,
      valid_to:row.validTo,notes:row.notes ?? null,source_url:row.source ?? data.source,
    };
  });
  if (!leafCodes.size) errors.push("Нет конечных кодов.");
  if (errors.length) throw new Error(errors.slice(0,30).join("\n")+"\nВсего ошибок: "+errors.length);
  console.log(JSON.stringify({rows:normalized.length,leaves:leafCodes.size,checksum,version:data.version}));
  if (flags.includes("--dry-run")) return;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Укажите URL проекта и SUPABASE_SERVICE_ROLE_KEY.");
  if (flags.includes("--activate") && process.env.TNVED_APPROVED_SHA256!==checksum) throw new Error("Сверьте полную редакцию и укажите подтверждённый SHA-256 в TNVED_APPROVED_SHA256.");
  const db = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {error:versionError} = await db.from("tnved_versions").upsert({
    version_name:data.version,effective_from:data.effectiveFrom,effective_to:data.effectiveTo,source_url:data.source,source_checksum:checksum,
  },{onConflict:"source_checksum",ignoreDuplicates:true});
  if (versionError) throw new Error("Не удалось создать версию: "+versionError.code);
  const {data:version,error} = await db.from("tnved_versions").select("id,status").eq("source_checksum",checksum).single();
  if (error || !version) throw new Error("Не удалось прочитать версию.");
  if (version.status==="draft") {
    const ids = new Map<string,string>();
    for (let level=0;level<=12;level++) {
      const batch = normalized.filter(row=>row.level===level);
      for (let i=0;i<batch.length;i+=500) {
        const entries = batch.slice(i,i+500).map(({parent_key,...row})=>({
          ...row,id:randomUUID(),version_id:version.id,parent_id:parent_key?ids.get(parent_key):null,
        }));
        const {error:insertError} = await db.from("tnved_codes").upsert(entries,{onConflict:"version_id,external_key",ignoreDuplicates:true});
        if (insertError) throw new Error("Не удалось загрузить пакет: "+insertError.code);
        const {data:saved,error:readError} = await db.from("tnved_codes").select("id,external_key").eq("version_id",version.id).in("external_key",entries.map(row=>row.external_key));
        if (readError || saved?.length!==entries.length) throw new Error("Проверка пакета не пройдена.");
        saved.forEach(row=>ids.set(row.external_key,row.id));
      }
    }
  }
  if (flags.includes("--activate")) {
    const {error:activationError} = await db.rpc("activate_tnved",{target:version.id,expected_count:normalized.length});
    if (activationError) throw new Error("Версия не активирована: "+activationError.message);
  }
  console.log("Версия "+version.id+(flags.includes("--activate")?" активирована.":" проверена или загружена для проверки."));
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:"Импорт прерван.");
  process.exitCode=1;
});
