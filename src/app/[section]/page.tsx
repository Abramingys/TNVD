import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { z } from "zod";
import { Frame } from "@/components/frame";
import { ConfirmButton,SearchForm } from "@/components/workspace";
import { authenticate,context,logout,mutate } from "@/app/actions";
import { demo } from "@/lib/supabase";

const titles = {
  login:"Вход",register:"Регистрация","forgot-password":"Восстановление пароля","reset-password":"Новый пароль",
  dashboard:"Обзор",history:"История поиска",favorites:"Избранное",settings:"Настройки",
};
const notices = {demo:"Для авторизации требуется Supabase.",email:"Проверьте почту и откройте ссылку из письма.",invalid:"Проверьте введённые данные.",error:"Операцию не удалось выполнить. Повторите попытку."};
const filters = z.object({q:z.string().max(160).optional(),country:z.enum(["BY","RU",""]).optional(),date:z.iso.date().or(z.literal("")).optional(),notice:z.string().optional(),page:z.coerce.number().int().min(1).max(1000).default(1)});

export default async function AccountPage({params,searchParams}:{params:Promise<{section:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const [{section},raw] = await Promise.all([params,searchParams]);
  if (!Object.hasOwn(titles,section)) notFound();
  const title = titles[section as keyof typeof titles];
  const parsed = filters.safeParse(raw);
  const filter = parsed.success?parsed.data:{page:1};
  if (["login","register","forgot-password","reset-password"].includes(section)) {
    const notice = filter.notice as keyof typeof notices;
    return <Frame><h1>{title}</h1><section>
      {notice&&Object.hasOwn(notices,notice)&&<p role="status">{notices[notice]}</p>}
      <form action={authenticate.bind(null,section)}>
        {section!=="reset-password"&&<input name="email" type="email" required placeholder="Электронная почта" aria-label="Электронная почта" autoComplete="email"/>}
        {section!=="forgot-password"&&<input name="password" type="password" required minLength={section==="login"?1:8} maxLength={128} placeholder="Пароль" aria-label="Пароль" autoComplete={section==="login"?"current-password":"new-password"}/>}
        <button disabled={demo()} className="primary">{section==="login"?"Войти":section==="register"?"Зарегистрироваться":"Продолжить"}</button>
      </form><p><Link href="/forgot-password">Забыли пароль?</Link> · <Link href="/login">Войти</Link></p>
    </section></Frame>;
  }
  if (demo()) return <Frame><h1>{title}</h1><p>Для личного кабинета требуется подключение Supabase и вход в аккаунт.</p></Frame>;
  const {db,user} = await context();
  if (!db || !user) redirect("/login");
  if (section==="settings") {
    const {data,error} = await db.from("profiles").select("full_name").eq("id",user.id).maybeSingle();
    if (error) throw new Error("Профиль недоступен.");
    return <Frame><h1>{title}</h1><section><p>{user.email}</p>
      <form action={mutate.bind(null,"profile")}><label>Имя <input name="name" defaultValue={data?.full_name ?? ""} maxLength={100}/></label><button className="primary">Сохранить</button></form>
      <p>Выбранные страна и тема сохраняются при переключении в верхней панели.</p>
      <div className="controls"><form action={logout}><button>Выйти</button></form><form action={mutate.bind(null,"clear-data")}><ConfirmButton>Удалить историю, избранное и профиль</ConfirmButton></form></div>
    </section></Frame>;
  }
  const from = (filter.page-1)*20;
  const end = section==="dashboard"?4:from+20;
  let historyRequest = db.from("search_history").select("id,query,country,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).order("id").range(from,end);
  if (filter.country) historyRequest = historyRequest.eq("country",filter.country);
  if (filter.date) {
    const tomorrow = new Date(Date.parse(filter.date)+86400000).toISOString();
    historyRequest = historyRequest.gte("created_at",filter.date).lt("created_at",tomorrow);
  }
  let favoriteRequest = db.from("favorites").select("id,tnved_codes!inner(id,code,title)",{count:"exact"}).eq("user_id",user.id).order("created_at",{ascending:false}).order("id").range(from,end);
  if (filter.q) favoriteRequest = favoriteRequest.ilike("tnved_codes.title","%"+filter.q.replace(/[\\%_]/g,"\\$&")+"%");
  const [history,favorites,version] = await Promise.all([
    section!=="favorites"?historyRequest:null,section!=="history"?favoriteRequest:null,
    section==="dashboard"?db.from("tnved_versions").select("version_name").eq("status","active").maybeSingle():null,
  ]);
  if (history?.error||favorites?.error||version?.error) throw new Error("Данные кабинета временно недоступны.");
  const pageHref = (page:number) => "?"+new URLSearchParams({...filter.country?{country:filter.country}:{},...filter.date?{date:filter.date}:{},...filter.q?{q:filter.q}:{},page:String(page)});
  return <Frame><h1>{title}</h1>
    {section==="dashboard"&&<section><SearchForm/><p>Версия номенклатуры · {version?.data?.version_name ?? "не импортирована"}</p><p>Сохранено кодов · {favorites?.count ?? 0}</p><Link href="/catalog">Открыть справочник</Link></section>}
    {section==="history"&&<section><form><label>Дата (UTC) <input name="date" type="date" defaultValue={filter.date}/></label><select name="country" aria-label="Страна" defaultValue={filter.country ?? ""}><option value="">Все страны</option><option value="BY">РБ</option><option value="RU">РФ</option></select><button>Применить</button></form><form action={mutate.bind(null,"clear-history")}><ConfirmButton>Очистить историю</ConfirmButton></form></section>}
    {history&&<section><h2>Последние запросы</h2>{history.data?.slice(0,20).map(row=><article key={row.id} className="row"><Link href={"/search?"+new URLSearchParams({q:row.query})}>{row.query}</Link><p>{row.country==="BY"?"РБ":"РФ"} · {new Date(row.created_at).toLocaleString("ru-RU",{timeZone:"UTC"})} UTC</p><form action={mutate.bind(null,"remove-history")}><input type="hidden" name="id" value={row.id}/><ConfirmButton>Удалить</ConfirmButton></form></article>)}{!history.data?.length&&<p>Запросов нет.</p>}</section>}
    {section==="favorites"&&<form><input name="q" aria-label="Название позиции" maxLength={160} defaultValue={filter.q}/><button>Найти</button></form>}
    {favorites&&<section><h2>Сохранённые позиции</h2>{favorites.data?.slice(0,20).map(row=>{
      const code = Array.isArray(row.tnved_codes)?row.tnved_codes[0]:row.tnved_codes;
      return code&&<article key={row.id} className="row"><Link href={"/codes/"+(code.code ?? code.id)}><code>{code.code}</code> {code.title}</Link><form action={mutate.bind(null,"remove-favorite")}><input type="hidden" name="id" value={row.id}/><ConfirmButton>Удалить</ConfirmButton></form></article>;
    })}{!favorites.data?.length&&<p>Сохранённых позиций нет.</p>}</section>}
    {section!=="dashboard"&&<nav>{filter.page>1&&<Link href={pageHref(filter.page-1)}>Предыдущая страница</Link>}{((history?.data?.length ?? 0)>20||(favorites?.data?.length ?? 0)>20)&&<Link href={pageHref(filter.page+1)}>Следующая страница</Link>}</nav>}
  </Frame>;
}
