"use client";
import { useState } from "react";
import Link from "next/link";
import type { Code } from "@/lib/tnved";

export function CatalogTree({initial=[],parent,initialMore=false}:{initial?:Code[];parent?:string;initialMore?:boolean}) {
  const [rows,setRows] = useState(initial);
  const [more,setMore] = useState(initialMore || Boolean(parent));
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({offset:String(rows.length)});
      if (parent) query.set("parent",parent);
      const response = await fetch("/api/catalog?"+query);
      if (!response.ok) throw new Error();
      const body = await response.json();
      setRows(previous=>[...previous,...body.rows]);
      setMore(body.more);
    } catch { setError("Не удалось загрузить позиции."); }
    finally { setLoading(false); }
  }
  return <ul className="tree">{rows.map(row=><li key={row.id}>
    <Link href={"/codes/"+(row.code ?? row.id)}>{row.code&&<code>{row.code} · </code>}{row.title}</Link>
    {!row.is_leaf&&<details><summary>Дочерние позиции</summary><CatalogTree parent={row.id}/></details>}
  </li>)}{error&&<li role="alert">{error}</li>}{more&&<li><button disabled={loading} onClick={()=>void load()}>{loading?"Загрузка…":"Загрузить позиции"}</button></li>}{!more&&!rows.length&&<li>Позиций нет.</li>}</ul>;
}
