/**
 * 병용금기 확인.
 *
 * 식약처 공공데이터 API를 그때그때 직접 불러요. 미리 표를 구워두지 않습니다.
 *   - 약 검색: DUR 품목정보(getDurPrdlstInfoList03) — 이름으로 찾아요. 이 목록에 있는 약은
 *     전부 DUR 판정이 가능한 약이라, e약은요보다 검색-확인이 실제로 이어져요(실측 확인).
 *   - 병용금기: DUR 품목정보(getUsjntTabooInfoList03) — 담은 약의 품목기준코드(itemSeq)로
 *     그 약과 부딪히는 상대 약 목록을 통째로 받아, 다른 담은 약이 그 안에 있는지 봐요.
 *   - e약은요(DrbEasyDrugInfoService)는 검색에는 안 쓰고, 상세정보(효능·복용법 등)용으로만 남겨요.
 *
 * ⚠️ 이 앱은 판단을 대신하지 않아요. 식약처가 공개한 금기 정보를 그대로 보여줄 뿐이고,
 *    복용 여부는 약사·의사가 정합니다. 화면 문구도 전부 그 선을 지켜야 해요.
 */
import { DATA_KEY } from "./env.ts";

export interface Drug {
  /** 품목기준코드 */
  seq: string;
  name: string;
  /** 업체명 */
  entp: string;
  /** "전문의약품" | "일반의약품" */
  etcOtc: string;
}

export interface Conflict {
  a: Drug;
  b: Drug;
  reason: string;
}

const DUR_LIST_URL = "https://apis.data.go.kr/1471000/DURPrdlstInfoService03/getDurPrdlstInfoList03";
const DUR_TABOO_URL = "https://apis.data.go.kr/1471000/DURPrdlstInfoService03/getUsjntTabooInfoList03";
const DRUG_URL = "https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList";
/** 공공데이터포털 실측: 이보다 크면 API가 에러를 돌려줘요. */
const MAX_ROWS = 500;

interface RawDurListItem {
  ITEM_SEQ: string;
  ITEM_NAME: string;
  ENTP_NAME: string;
  ETC_OTC_CODE: string;
  /** "정상"이 아니면 허가취소 등 — 지금 살 수 없는 약이라 검색에서 빼요. */
  CANCEL_NAME: string;
}

interface RawTabooItem {
  MIXTURE_ITEM_SEQ: string;
  PROHBT_CONTENT: string;
}

async function getJson(base: string, params: Record<string, string>): Promise<{
  items: unknown[];
  totalCount: number;
}> {
  const url = `${base}?${new URLSearchParams({ ...params, serviceKey: DATA_KEY, type: "json" })}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("약 정보를 불러오지 못했어요");
  const json = (await res.json()) as { body?: { items?: unknown[]; totalCount?: number } };
  // 결과가 0건이면 body는 오는데 items 키가 아예 빠져요(실측). 그건 에러가 아니라 빈 목록이에요.
  if (json.body == null) throw new Error("약 정보를 불러오지 못했어요");
  return { items: json.body.items ?? [], totalCount: Number(json.body.totalCount ?? 0) };
}

/** 결과가 MAX_ROWS 를 넘으면 끝까지 이어서 받아요. 금기를 놓치면 사람이 다쳐요. */
async function getAllPages(base: string, params: Record<string, string>): Promise<unknown[]> {
  const first = await getJson(base, { ...params, numOfRows: String(MAX_ROWS), pageNo: "1" });
  const items = [...first.items];
  const pages = Math.ceil(first.totalCount / MAX_ROWS);
  for (let page = 2; page <= pages; page++) {
    const more = await getJson(base, { ...params, numOfRows: String(MAX_ROWS), pageNo: String(page) });
    items.push(...more.items);
  }
  return items;
}

/** 제품명 검색. 두 글자 미만이면 검색하지 않아요. */
export async function searchDrugs(q: string, limit = 30): Promise<Drug[]> {
  const needle = q.trim();
  if (needle.length < 2) return [];
  const { items } = await getJson(DUR_LIST_URL, {
    itemName: needle,
    numOfRows: String(limit),
    pageNo: "1",
  });
  const seen = new Set<string>();
  const out: Drug[] = [];
  for (const raw of items as RawDurListItem[]) {
    const seq = String(raw.ITEM_SEQ ?? "").trim();
    if (seq === "" || seen.has(seq)) continue; // 같은 품목이 중복으로 오기도 해요
    if (String(raw.CANCEL_NAME ?? "") !== "정상") continue; // 허가취소 등은 담을 수 없어요
    seen.add(seq);
    out.push({
      seq,
      name: String(raw.ITEM_NAME ?? "").trim(),
      entp: String(raw.ENTP_NAME ?? "").trim(),
      etcOtc: String(raw.ETC_OTC_CODE ?? "").trim(),
    });
  }
  return out;
}

/**
 * 고른 약의 효능·복용법·주의사항(e약은요). DUR 목록에는 이 정보가 없어서 따로 불러요.
 * e약은요 카탈로그가 작아서 없는 약이 많아요 — 없으면 null이고, 그럴 땐 그냥 안 보여주면 돼요.
 */
export async function getDrugDetail(name: string): Promise<{
  efcy: string;
  useMethod: string;
  atpn: string;
} | null> {
  const { items } = await getJson(DRUG_URL, { itemName: name, numOfRows: "1", pageNo: "1" });
  const raw = items[0] as
    | { efcyQesitm?: string; useMethodQesitm?: string; atpnQesitm?: string }
    | undefined;
  if (raw == null) return null;
  return {
    efcy: String(raw.efcyQesitm ?? "").trim(),
    useMethod: String(raw.useMethodQesitm ?? "").trim(),
    atpn: String(raw.atpnQesitm ?? "").trim(),
  };
}

/**
 * 담아둔 약들 사이의 금기 조합 전부.
 *
 * 담은 약마다 자기 itemSeq로 병용금기 목록을 통째로 받아, 그 안에 다른 담은 약의
 * itemSeq가 있는지 봐요. 이 관계는 데이터에 양방향으로 다 들어 있어서(실측 확인),
 * 한쪽만 조회해도 놓치지 않아요.
 *
 * 같은 약을 두 번 담아도(같은 seq) 자기 자신과는 비교하지 않아요.
 */
export async function findConflicts(picked: Drug[]): Promise<Conflict[]> {
  const uniq = picked.filter((d, i) => picked.findIndex((p) => p.seq === d.seq) === i);
  if (uniq.length < 2) return [];

  // 약마다 "이 약과 부딪히는 상대 itemSeq → 사유" 맵을 만들어요.
  // 한꺼번에 여러 개를 동시에 부르면 공공데이터포털 쪽이 잘 못 버텨서, 하나씩 순서대로 불러요.
  const tabooByDrug = new Map<string, Map<string, string>>();
  for (const d of uniq) {
    const rows = (await getAllPages(DUR_TABOO_URL, { itemSeq: d.seq })) as RawTabooItem[];
    const m = new Map<string, string>();
    for (const r of rows) {
      m.set(String(r.MIXTURE_ITEM_SEQ ?? "").trim(), String(r.PROHBT_CONTENT ?? "").trim());
    }
    tabooByDrug.set(d.seq, m);
  }

  const out: Conflict[] = [];
  for (let i = 0; i < uniq.length; i++) {
    for (let j = i + 1; j < uniq.length; j++) {
      const a = uniq[i];
      const b = uniq[j];
      // 한 조합에 사유가 여러 개 걸려도 경고는 한 번만 띄워요.
      // 같은 경고를 세 번 보여주면 사용자가 전부 무시하게 됩니다.
      const reason = tabooByDrug.get(a.seq)?.get(b.seq) ?? tabooByDrug.get(b.seq)?.get(a.seq);
      if (reason == null) continue;
      out.push({ a, b, reason });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 자체 점검 — `npm run check:dur`                                     */
/* 네트워크를 타지 않는 순수 로직만 검사해요(중복 제거, 짝 찾기).       */
/* ------------------------------------------------------------------ */
export function demo(): void {
  const eq = (got: unknown, want: unknown, label: string) => {
    if (got !== want) throw new Error(`${label}: ${String(got)} !== ${String(want)}`);
  };

  const mk = (seq: string, name: string): Drug => ({ seq, name, entp: "테스트제약", etcOtc: "일반의약품" });

  // findConflicts와 같은 짝짓기 로직 — 네트워크 없이 순수 로직만 떼어 확인해요.
  const pairUp = (uniq: Drug[]): [Drug, Drug][] => {
    const out: [Drug, Drug][] = [];
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) out.push([uniq[i], uniq[j]]);
    }
    return out;
  };
  const dedupe = (picked: Drug[]): Drug[] =>
    picked.filter((d, i) => picked.findIndex((p) => p.seq === d.seq) === i);

  const A = mk("1", "가나정");
  const B = mk("2", "다라정");
  const C = mk("3", "마바정");

  eq(pairUp(dedupe([A, B])).length, 1, "약 두 개면 짝은 하나");
  eq(pairUp(dedupe([A, B, C])).length, 3, "약 세 개면 짝은 세 개");
  eq(dedupe([A, A, B]).length, 2, "같은 약을 두 번 담으면 하나로 줄여요");
  eq(pairUp(dedupe([A])).length, 0, "약이 하나면 짝이 없어요");
  eq(pairUp(dedupe([])).length, 0, "빈 목록은 짝이 없어요");

  console.log("dur.ts OK");
}
