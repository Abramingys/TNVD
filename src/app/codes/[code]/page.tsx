import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Frame } from "@/components/frame";
import { CopyButton } from "@/components/workspace";
import { CatalogTree } from "@/components/catalog-tree";
import { context, mutate } from "@/app/actions";
import { getCode } from "@/lib/tnved";

export default async function CodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^(\d{2,10}|demo-[a-z]+|[a-f\d-]{36})$/i.test(code)) notFound();
  const [row, { db, user }, jar] = await Promise.all([getCode(code), context(), cookies()]);
  if (!row) notFound();
  const profile = db && user ? (await db.from("profiles").select("default_country").eq("id",user.id).maybeSingle()).data : null;
  const country = (profile?.default_country ?? jar.get("tnved-country")?.value) === "RU" ? "RU" : "BY";
  const ancestors = [];
  let parent = row.parent_id;
  while (parent && ancestors.length < 12) {
    const node = await getCode(parent);
    if (!node) break;
    ancestors.unshift(node);
    parent = node.parent_id;
  }
  const docs = db ? (await db.from("code_documents").select("legal_documents(title,source_url,country)").eq("code_id", row.id)).data : null;
  const documents = (docs ?? [])
    .flatMap((doc) => doc.legal_documents ?? [])
    .filter((doc) => doc.country === country || doc.country === "EAEU");
  return (
    <Frame>
      <nav aria-label='Путь к позиции'>
        <Link href='/catalog'>Справочник</Link>
        {ancestors.map((node) => (
          <Link key={node.id} href={"/codes/" + (node.code ?? node.id)}>
            {node.code ?? node.title}
          </Link>
        ))}
      </nav>
      <section>
        <h1>
          {row.code && <code>{row.code} </code>}
          {row.title}
        </h1>
        <p>{row.full_description}</p>
        <p>Начало действия · {row.valid_from ?? "нет данных"}</p>
        <p>Окончание действия · {row.valid_to ?? "нет данных"}</p>
        <p>Версия · {row.version_name ?? "демонстрационная"}</p>
        <div className='controls'>
          {row.code && <CopyButton value={row.code} />}
          <CopyButton value={code} share />
          {user && (
            <form action={mutate.bind(null, "favorite")}>
              <input type='hidden' name='id' value={row.id} />
              <button>В избранное</button>
            </form>
          )}
        </div>
      </section>
      {!row.is_leaf && (
        <section>
          <h2>Дочерние позиции</h2>
          <CatalogTree parent={row.id} />
        </section>
      )}
      <section>
        <h2>Примечания и источники</h2>
        <p>{row.notes || "Примечаний в базе нет."}</p>
        {row.source_url && <a href={row.source_url}>Нормативный источник позиции</a>}
        <h2>Документы для {country === "RU" ? "России" : "Беларуси"}</h2>
        {documents.map((doc) => (
          <p key={doc.source_url}>
            <a href={doc.source_url}>{doc.title}</a>
          </p>
        ))}
        {!documents.some((doc) => doc.country === country) && <p>Проверенные национальные данные для выбранной страны пока отсутствуют.</p>}
      </section>
    </Frame>
  );
}
