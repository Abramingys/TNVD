"use client";

import Link from "next/link";
import { Moon, Search, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import { savePreferences } from "@/app/actions";

export function Workspace({ children, landing, initialCountry, initialTheme, user }: {
  children: ReactNode; landing:boolean; initialCountry:string; initialTheme:string; user:boolean;
}) {
  const [country,setCountry] = useState(initialCountry);
  const [theme,setTheme] = useState(initialTheme);
  const [menu,setMenu] = useState(true);
  const [error,setError] = useState("");
  async function update(nextCountry:string,nextTheme:string) {
    setCountry(nextCountry);
    setTheme(nextTheme);
    setError("");
    try { await savePreferences(nextCountry,nextTheme); }
    catch { setError("Не удалось сохранить настройки."); }
  }
  return <div className={landing || !menu?"app":"app shell"} data-theme={theme}>
    {!landing && menu && <aside><Link className="brand" href="/">TN VED AI</Link><nav aria-label="Разделы">
      {[["dashboard","Обзор"],["search","Поиск ТН ВЭД"],["catalog","Справочник"],["history","История"],["favorites","Избранное"],["settings","Настройки"]].map(([key,label])=><Link key={key} href={"/"+key}>{label}</Link>)}
    </nav></aside>}
    <div><header>
      {landing?<Link className="brand" href="/">TN VED AI</Link>:<button onClick={()=>setMenu(!menu)} aria-expanded={menu}>Меню</button>}
      <nav aria-label="Быстрые ссылки"><Link href="/search">Поиск</Link><Link href="/catalog">Справочник</Link></nav>
      <div className="controls">
        <select aria-label="Страна оформления" value={country} onChange={event=>void update(event.target.value,theme)}><option value="BY">РБ</option><option value="RU">РФ</option></select>
        <button aria-label="Переключить тему" onClick={()=>void update(country,theme==="dark"?"light":"dark")}>{theme==="dark"?<Sun size={18}/>:<Moon size={18}/>}</button>
        {user?<Link href="/settings">Аккаунт</Link>:<><Link href="/login">Войти</Link><Link href="/register">Регистрация</Link></>}
      </div>
    </header><main>{error&&<p role="alert">{error}</p>}{children}</main></div>
  </div>;
}

export function SearchForm({ value="", children }: { value?:string; children?:ReactNode }) {
  return <form action="/search"><input aria-label="Название товара или код" name="q" defaultValue={value} maxLength={160} placeholder="Название товара или код"/>{children}<button className="primary"><Search size={16} style={{display:"inline",marginRight:6}}/>Найти</button></form>;
}

export function CopyButton({value,share=false}:{value:string;share?:boolean}) {
  const [message,setMessage] = useState("");
  return <button type="button" onClick={async()=>{
    try { await navigator.clipboard.writeText(share?location.href:value); setMessage("Скопировано"); }
    catch { setMessage("Не удалось скопировать"); }
  }}>{message || (share?"Поделиться":"Скопировать код")}</button>;
}

export function ConfirmButton({children}:{children:ReactNode}) {
  return <button type="submit" onClick={event=>{if(!confirm("Подтвердить удаление?")) event.preventDefault();}}>{children}</button>;
}
