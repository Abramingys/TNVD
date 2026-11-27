import { Suspense } from "react";
import { Frame } from "@/components/frame";
import { SearchForm } from "@/components/workspace";
import { SearchResults } from "@/components/search-results";

export default function SearchPage() {
  return <Frame><h1>Поиск ТН ВЭД</h1><Suspense fallback={<SearchForm/>}><SearchResults/></Suspense></Frame>;
}
