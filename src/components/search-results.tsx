"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Code } from "@/lib/tnved";
import { CopyButton } from "./workspace";
import { mutate } from "@/app/actions";

export function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const query = params.toString();
  const [draft,setDraft] = useState({ query, value: params.get("q") ?? "" });
  const value = draft.query===query?draft.value:params.get("q") ?? "";
  const [result,setResult] = useState<{query:string;rows?:Code[];more?:boolean;user?:boolean;error?:string}>();
  useEffect(()=>{
    if (value===(new URLSearchParams(query).get("q") ?? "")) return;
    const timer = setTimeout(()=>{
      const next = new URLSearchParams(query);
      next.set("q",value);
      next.delete("page");
      router.replace("/search?"+next.toString(),{scroll:false});
    },350);
    return ()=>clearTimeout(timer);
  },[query,router,value]);
  useEffect(()=>{
    const controller = new AbortController();
    fetch("/api/codes?"+query,{signal:controller.signal}).then(async response=>{
      const body = await response.json();
      if (!controller.signal.aborted) setResult({query,...body});
    }).catch(()=>{if (!controller.signal.aborted) setResult({query,error:"Поиск временно недоступен."});});
    return ()=>controller.abort();
  },[query]);
  const page = Number(params.get("page") ?? 1);
  function pageLink(next:number) {
    const filters = new URLSearchParams(query);
    filters.set("page",String(next));
    return "/search?"+filters.toString();
  }
  return <>
    <form action="/search">
      <input name="q" aria-label="Название товара или код" maxLength={160} value={value} onChange={e=>setDraft({query,value:e.target.value})}/>
      <input name="section" aria-label="Раздел" placeholder="Раздел" maxLength={32} defaultValue={params.get("section") ?? ""}/>
      <input name="group" aria-label="Группа" placeholder="Группа (2 цифры)" pattern="[0-9]{2}" defaultValue={params.get("group") ?? ""}/>
      <select name="status" aria-label="Статус" defaultValue={params.get("status") ?? "all"}><option value="all">Все статусы</option><option value="active">Действующие</option><option value="expired">Истёкшие</option></select>
      <button className="primary">Найти</button>
    </form>
    <section aria-live="polite">
      {result?.query!==query?<p aria-busy="true" className="animate-pulse">Ищем позиции…</p>:result.error?<p role="alert">{result.error}</p>:result.rows?.length?result.rows.map(row=><article className="row" key={row.id}>
        <Link href={"/codes/"+(row.code ?? row.id)}>{row.code&&<code>{row.code} · </code>}{row.title}</Link>
        <p>{row.full_description}</p>{row.parent_title&&<p>Родительская позиция · {row.parent_title}</p>}
        {row.valid_from&&<p>С {row.valid_from}{row.valid_to?" по "+row.valid_to:""}</p>}
        <div className="controls">{row.code&&<CopyButton value={row.code}/>}
          {result.user&&<form action={mutate.bind(null,"favorite")}><input type="hidden" name="id" value={row.id}/><button>В избранное</button></form>}
        </div>
      </article>):<p>Ничего не найдено. Попробуйте изменить запрос или фильтры.</p>}
    </section>
    <nav>{page>1&&<Link href={pageLink(page-1)}>Предыдущая страница</Link>}{result?.query===query&&result.more&&<Link href={pageLink(page+1)}>Следующая страница</Link>}</nav>
  </>;
}
