import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function run(rows) {
  const dir = mkdtempSync(join(tmpdir(),"tnved-"));
  try {
    const input = join(dir,"snapshot.json");
    writeFileSync(input,JSON.stringify({version:"Тест",effectiveFrom:"2026-01-01",source:"https://example.org/test",rows}));
    return spawnSync(process.execPath,["--import","tsx","scripts/import-tnved.ts",input,"--dry-run"],{encoding:"utf8"});
  } finally { rmSync(dir,{recursive:true,force:true}); }
}
const root = {key:"root",parent:null,code:null,title:"Тестовый раздел",leaf:false};
const leaf = {key:"item",parent:"root",code:"01 2345 6789",title:"Тестовый товар",leaf:true};
test("Импорт принимает строковый код с ведущим нулём",()=>{
  const result = run([root,leaf]);
  assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).leaves,1);
});
test("Импорт отклоняет потерю ведущего нуля",()=>assert.equal(run([root,{...leaf,code:123456789}]).status,1));
test("Импорт отклоняет повторяющийся код",()=>assert.equal(run([root,leaf,{...leaf,key:"duplicate"}]).status,1));
test("Импорт отклоняет отсутствующего родителя",()=>assert.equal(run([root,{...leaf,parent:"missing"}]).status,1));
