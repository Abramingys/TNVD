import Link from "next/link";
import { Frame } from "@/components/frame";
import { SearchForm } from "@/components/workspace";
import { source } from "@/lib/tnved";

export const dynamic = "force-dynamic";
export default function Home() {
  return <Frame landing>
    <section className="hero"><p>Справочник для специалистов по ВЭД</p><h1>Найдите нужный код ТН ВЭД</h1>
      <p>Ищите по названию товара или начальным цифрам кода. Изучайте позиции в иерархии номенклатуры ЕАЭС.</p>
      <SearchForm/><p>Примеры запросов · <Link href="/search?q=кофе">кофе</Link> · <Link href="/search?q=0901"><code>0901</code></Link></p>
    </section>
    <section><h2>Справочник ТН ВЭД ЕАЭС</h2><p>Откройте раздел или группу, чтобы перейти к товарным позициям и подробным карточкам.</p><Link href="/catalog">Открыть справочник</Link></section>
    <section><h2>Официальные источники</h2><p>Базовая номенклатура утверждена Решением Совета ЕЭК от 14 сентября 2021 года № 80.</p><a href={source}>Решение Совета ЕЭК № 80</a></section>
    <section><h2>Частые вопросы</h2>
      <details><summary>Нужна ли регистрация для поиска?</summary><p>Поиск и справочник открыты для гостей. Аккаунт нужен для истории и избранного.</p></details>
      <details><summary>Что меняет выбор страны?</summary><p>Страна определяет контекст оформления и выбор национальных документов. Номенклатура ЕАЭС общая.</p></details>
    </section><footer>TN VED AI · Беларусь и Россия</footer>
  </Frame>;
}
