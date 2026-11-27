"use strict";

const entries = [
  {code:"0901",title:"Кофе",description:"Демонстрационная товарная позиция «Кофе»."},
  {code:"0902",title:"Чай",description:"Демонстрационная товарная позиция «Чай»."},
  {code:"0901210000",title:"Кофе жареный",description:"Демонстрационная позиция в группе «Кофе и чай».",synonyms:"обжаренные зерна"},
  {code:"0499999999",title:"Яйца страуса для инкубации",description:"Демонстрационная позиция с вымышленным кодом."},
];
const normalize = value => value.toLowerCase().replaceAll("ё","е").trim().replace(/[.!?]+$/u,"");
const byId = id => document.getElementById(id);
const form = byId("search-form");
const input = form.elements.namedItem("q");
const country = byId("country");
const theme = byId("theme");
const position = byId("position");
let current;

function showPosition() {
  current = entries.find(entry => "#code-"+entry.code === location.hash);
  if (!current) return;
  position.hidden = false;
  byId("position-title").textContent = current.code+" · "+current.title;
  byId("position-description").textContent = current.description;
  byId("position-country").textContent = (country.value==="RU"?"Россия":"Беларусь")+" · национальные данные отсутствуют.";
  byId("copy").textContent = "Скопировать код";
  if (document.activeElement !== country) position.scrollIntoView();
}

function search(raw) {
  const results = byId("results");
  results.replaceChildren();
  const query = normalize(raw);
  if (!query) return;
  const digits = query.replace(/\s/g,"");
  const matches = entries.filter(entry => /^\d+$/.test(digits) ? entry.code.startsWith(digits) : normalize(entry.title+" "+(entry.synonyms ?? "")).includes(query));
  if (!matches.length) {
    const item = document.createElement("li");
    item.textContent = "В демонстрационном справочнике совпадений нет.";
    results.append(item);
  }
  for (const entry of matches) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#code-"+entry.code;
    link.textContent = entry.code+" · "+entry.title;
    item.append(link);
    results.append(item);
  }
}

function setTheme(dark) {
  document.documentElement.dataset.theme = dark?"dark":"light";
  theme.textContent = dark?"Светлая тема":"Тёмная тема";
}

input.value = new URLSearchParams(location.search).get("q") ?? "";
country.value = localStorage.getItem("tnved-pages-country")==="RU"?"RU":"BY";
setTheme(localStorage.getItem("tnved-pages-theme")==="dark");
search(input.value);
showPosition();
window.addEventListener("hashchange",showPosition);
form.addEventListener("submit",event=>{
  event.preventDefault();
  const url = new URL(location.href);
  url.search = new URLSearchParams({q:input.value.trim()}).toString();
  url.hash = "search";
  history.replaceState(null,"",url);
  search(input.value);
});
country.addEventListener("change",()=>{
  localStorage.setItem("tnved-pages-country",country.value);
  if (current) showPosition();
});
theme.addEventListener("click",()=>{
  const dark = document.documentElement.dataset.theme!=="dark";
  localStorage.setItem("tnved-pages-theme",dark?"dark":"light");
  setTheme(dark);
});
byId("copy").addEventListener("click",async event=>{
  const button = event.currentTarget;
  if (!current) return;
  try { await navigator.clipboard.writeText(current.code); button.textContent = "Скопировано"; }
  catch { button.textContent = "Не удалось скопировать"; }
});
