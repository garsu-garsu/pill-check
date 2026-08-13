/**
 * 병용금기 표 굽기 (배치 — 식약처 데이터가 갱신될 때만 다시 돌려요)
 *
 *   MFDS_KEY=발급키 node scripts/build-dur.mjs
 *   MFDS_KEY=발급키 node scripts/build-dur.mjs --probe   ← 먼저 이걸로 응답 확인
 *
 * 출처 (공공데이터포털, 무료)
 *   의약품 DUR 품목정보 (병용금기)  https://www.data.go.kr/data/15059512/openapi.do
 *   의약품 개요정보 e약은요         https://www.data.go.kr/data/15075057/openapi.do
 *
 * 결과: public/data/dur.json 한 파일.
 *   { reasons: [...], drugs: [[seq,name,entp,[성분코드]]], banned: {"A|B": 사유번호} }
 *
 * 왜 성분 코드 기준인가
 *   금기는 제품이 아니라 성분끼리 잡혀요. 같은 성분의 복제약이 수십 개라
 *   제품 쌍으로 저장하면 표가 수백만 줄로 터집니다.
 *
 * ⚠️ 응답 필드명이 --probe 출력과 다르면 아래 FIELD 만 고치세요.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../public/data");

const DUR_URL =
  "http://apis.data.go.kr/1471000/DURPrdlstInfoService03/getUsjntTabooInfoList03";
const DRUG_URL =
  "http://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";

const FIELD = {
  // 병용금기
  seqA: "ITEM_SEQ",
  nameA: "ITEM_NAME",
  entpA: "ENTP_NAME",
  ingrA: "INGR_CODE",
  seqB: "MIXTURE_ITEM_SEQ",
  nameB: "MIXTURE_ITEM_NAME",
  entpB: "MIXTURE_ENTP_NAME",
  ingrB: "MIXTURE_INGR_CODE",
  reason: "PROHBT_CONTENT",
  // e약은요
  drugSeq: "itemSeq",
  drugName: "itemName",
  drugEntp: "entpName",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        // 키가 안 맞으면 JSON 대신 XML 오류가 와요.
        throw new Error(`JSON이 아니에요: ${text.slice(0, 200)}`);
      }
    } catch (e) {
      if (i === 2) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

function body(json) {
  const b = json?.body ?? json?.response?.body ?? {};
  return { items: b.items ?? [], totalCount: Number(b.totalCount ?? 0) };
}

/** 사전순 키 — (A,B)와 (B,A)를 따로 저장하지 않아요. */
export function keyOf(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** 같은 사유 문장이 수만 번 반복돼서 번호로 눌러요. */
function makeInterner() {
  const list = [];
  const seen = new Map();
  return {
    list,
    idx(text) {
      const t = String(text ?? "").trim();
      const hit = seen.get(t);
      if (hit != null) return hit;
      const i = list.push(t) - 1;
      seen.set(t, i);
      return i;
    },
  };
}

async function fetchAll(base, key, onPage) {
  const perPage = 1000;
  let page = 1;
  let seen = 0;
  let total = Infinity;
  while (seen < total) {
    const url = `${base}?serviceKey=${key}&pageNo=${page}&numOfRows=${perPage}&type=json`;
    const { items, totalCount } = body(await getJson(url));
    if (page === 1) total = totalCount || items.length;
    if (items.length === 0) break;
    onPage(items);
    seen += items.length;
    console.log(`  ${seen}/${total}`);
    page++;
    await sleep(120);
  }
}

async function main() {
  const key = process.env.MFDS_KEY;
  if (key == null) {
    console.error("MFDS_KEY 가 필요해요. 공공데이터포털에서 위 두 API 활용신청 후 인코딩 키를 넣으세요.");
    process.exit(1);
  }

  if (process.argv[2] === "--probe") {
    const a = body(await getJson(`${DUR_URL}?serviceKey=${key}&pageNo=1&numOfRows=2&type=json`));
    console.log("== 병용금기 총건수:", a.totalCount);
    console.log(JSON.stringify(a.items[0], null, 2));
    const b = body(await getJson(`${DRUG_URL}?serviceKey=${key}&pageNo=1&numOfRows=2&type=json`));
    console.log("\n== e약은요 총건수:", b.totalCount);
    console.log(JSON.stringify(b.items[0], null, 2));
    return;
  }

  const reasons = makeInterner();
  const banned = {};
  /** 품목기준코드 → 성분코드 집합. 금기 표에서 같이 얻어져요. */
  const ingOf = new Map();
  const nameOf = new Map();

  console.log("병용금기 받는 중…");
  await fetchAll(DUR_URL, key, (items) => {
    for (const it of items) {
      const ia = String(it[FIELD.ingrA] ?? "").trim();
      const ib = String(it[FIELD.ingrB] ?? "").trim();
      if (ia === "" || ib === "" || ia === ib) continue;

      banned[keyOf(ia, ib)] = reasons.idx(it[FIELD.reason]);

      for (const [seq, name, entp, ing] of [
        [it[FIELD.seqA], it[FIELD.nameA], it[FIELD.entpA], ia],
        [it[FIELD.seqB], it[FIELD.nameB], it[FIELD.entpB], ib],
      ]) {
        const s = String(seq ?? "").trim();
        if (s === "") continue;
        if (!ingOf.has(s)) ingOf.set(s, new Set());
        ingOf.get(s).add(ing);
        if (!nameOf.has(s)) {
          nameOf.set(s, [String(name ?? "").trim(), String(entp ?? "").trim()]);
        }
      }
    }
  });

  // e약은요로 제품명을 보강해요. 금기 표에만 있는 이름은 표기가 들쭉날쭉해요.
  console.log("제품 정보 받는 중…");
  await fetchAll(DRUG_URL, key, (items) => {
    for (const it of items) {
      const s = String(it[FIELD.drugSeq] ?? "").trim();
      if (s === "" || !ingOf.has(s)) continue; // 금기와 무관한 약은 담지 않아요
      nameOf.set(s, [
        String(it[FIELD.drugName] ?? "").trim(),
        String(it[FIELD.drugEntp] ?? "").trim(),
      ]);
    }
  });

  const drugs = [];
  for (const [seq, ing] of ingOf) {
    const [name, entp] = nameOf.get(seq) ?? ["", ""];
    if (name === "") continue;
    drugs.push([seq, name, entp, [...ing]]);
  }
  drugs.sort((a, b) => a[1].localeCompare(b[1], "ko"));

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/dur.json`,
    JSON.stringify({ reasons: reasons.list, drugs, banned }),
  );
  console.log(
    `\n약 ${drugs.length}개 / 금기 조합 ${Object.keys(banned).length}쌍 / 사유 ${reasons.list.length}종 저장`,
  );
}

/* 자체 점검 */
export function demo() {
  if (keyOf("B", "A") !== "A|B") throw new Error("키는 사전순이어야 해요");
  if (keyOf("A", "B") !== "A|B") throw new Error("순서를 바꿔도 같은 키");
  const r = makeInterner();
  if (r.idx("같은 사유") !== 0) throw new Error("첫 사유는 0번");
  if (r.idx("같은 사유") !== 0) throw new Error("같은 문장은 같은 번호");
  if (r.idx("다른 사유") !== 1) throw new Error("다른 문장은 새 번호");
  if (r.list.length !== 2) throw new Error("중복은 저장 안 함");
  console.log("build-dur OK");
}

if (process.argv[2] === "--check") demo();
else main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
