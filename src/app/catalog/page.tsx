import { Frame } from "@/components/frame";
import { CatalogTree } from "@/components/catalog-tree";
import { catalogChildren } from "@/lib/tnved";
export const dynamic = "force-dynamic";
export default async function Catalog() {
  const rows = await catalogChildren(null);
  return <Frame><h1>Справочник</h1><section><CatalogTree initial={rows.slice(0,50)} initialMore={rows.length>50}/></section></Frame>;
}
