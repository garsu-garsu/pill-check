/**
 * 병용금기 확인.
 *
 * 식약처 DUR 품목정보(병용금기)를 빌드 때 정적 파일로 굽고, 앱은 그 표만 봅니다.
 * 런타임에 부르는 API가 없어요.
 *
 * ⚠️ 이 앱은 판단을 대신하지 않아요. 식약처가 공개한 금기 정보를 그대로 보여줄 뿐이고,
 *    복용 여부는 약사·의사가 정합니다. 화면 문구도 전부 그 선을 지켜야 해요.
 */

export interface Drug {
  /** 품목기준코드 */
  seq: string;
  name: string;
  /** 업체명 */
  entp: string;
  /** 주성분 코드들 — 금기는 제품이 아니라 성분끼리 잡혀요. */
  ing: string[];
}

export interface DurData {
  /** 금기 사유 문장 목록. 같은 문장이 수만 번 반복돼서 번호로 눌러 놨어요. */
  reasons: string[];
  drugs: Drug[];
  /** "성분A|성분B"(사전순) → 사유 번호 */
  banned: Record<string, number>;
}

export interface Conflict {
  a: Drug;
  b: Drug;
  reason: string;
  /** 실제로 부딪히는 성분 쌍 — 왜 걸렸는지 보여주려고 같이 넘겨요. */
  pair: [string, string];
}

/** 키는 항상 사전순이라 (A,B)와 (B,A)를 따로 저장하지 않아요. */
export function keyOf(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * 파일 안의 약은 객체가 아니라 배열로 눌려 있어요.
 * [품목기준코드, 제품명, 업체명, 성분코드들]
 */
type RawDrug = [string, string, string, string[]];

interface RawDur {
  reasons: string[];
  drugs: RawDrug[];
  banned: Record<string, number>;
}

/** 빌드 때 구운 정적 파일. 런타임에 외부 API를 부르지 않아요. */
export async function loadDur(): Promise<DurData> {
  const res = await fetch("/data/dur.json");
  if (!res.ok) throw new Error("약 정보를 읽지 못했어요");
  const raw = (await res.json()) as RawDur;
  return {
    reasons: raw.reasons,
    banned: raw.banned,
    drugs: raw.drugs.map(([seq, name, entp, ing]) => ({ seq, name, entp, ing })),
  };
}

/**
 * 담아둔 약들 사이의 금기 조합 전부.
 *
 * 같은 약을 두 번 담아도(같은 seq) 자기 자신과는 비교하지 않아요.
 * 서로 다른 제품이 같은 성분을 쓰는 건 금기가 아니라 중복투여라 여기서 안 잡습니다.
 */
export function findConflicts(picked: Drug[], data: DurData): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < picked.length; i++) {
    for (let j = i + 1; j < picked.length; j++) {
      const a = picked[i];
      const b = picked[j];
      if (a.seq === b.seq) continue;

      // 한 조합에 금기 성분이 여러 개 걸려도 경고는 한 번만 띄워요.
      // 같은 경고를 세 번 보여주면 사용자가 전부 무시하게 됩니다.
      const hit = firstBanned(a.ing, b.ing, data.banned);
      if (hit == null) continue;
      out.push({
        a,
        b,
        reason: data.reasons[hit.idx] ?? "",
        pair: [hit.ia, hit.ib],
      });
    }
  }
  return out;
}

function firstBanned(
  left: string[],
  right: string[],
  banned: Record<string, number>,
): { ia: string; ib: string; idx: number } | null {
  for (const ia of left) {
    for (const ib of right) {
      // 같은 성분끼리는 금기가 아니라 중복투여라 여기서 안 잡아요.
      if (ia === ib) continue;
      const idx = banned[keyOf(ia, ib)];
      if (idx != null) return { ia, ib, idx };
    }
  }
  return null;
}

/** 제품명 검색. 앞에서 맞는 것을 먼저 보여줘요. */
export function search(drugs: Drug[], q: string, limit = 30): Drug[] {
  const needle = q.trim().replace(/\s/g, "");
  if (needle.length < 2) return [];
  const starts: Drug[] = [];
  const contains: Drug[] = [];
  for (const d of drugs) {
    const name = d.name.replace(/\s/g, "");
    if (name.startsWith(needle)) starts.push(d);
    else if (name.includes(needle)) contains.push(d);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 자체 점검 — `npm run check:dur`                                     */
/* 금기를 놓치면 사람이 다쳐요. 여기가 이 앱에서 제일 중요한 코드예요. */
/* ------------------------------------------------------------------ */
export function demo(): void {
  const eq = (got: unknown, want: unknown, label: string) => {
    if (got !== want) throw new Error(`${label}: ${String(got)} !== ${String(want)}`);
  };

  eq(keyOf("B", "A"), "A|B", "키는 사전순");
  eq(keyOf("A", "B"), "A|B", "순서를 바꿔도 같은 키");

  const data: DurData = {
    reasons: ["출혈 위험 증가", "심장 리듬 이상"],
    drugs: [],
    banned: { "ING_A|ING_B": 0, "ING_C|ING_D": 1 },
  };
  const mk = (seq: string, name: string, ing: string[]): Drug => ({
    seq, name, entp: "테스트제약", ing,
  });

  const A = mk("1", "가나정", ["ING_A"]);
  const B = mk("2", "다라정", ["ING_B"]);
  const C = mk("3", "마바정", ["ING_X"]);
  const D = mk("4", "사아정", ["ING_C", "ING_X"]);
  const E = mk("5", "자차정", ["ING_D"]);

  eq(findConflicts([A, B], data).length, 1, "금기 한 쌍을 찾아야 해요");
  eq(findConflicts([A, B], data)[0].reason, "출혈 위험 증가", "사유를 붙여야 해요");
  eq(findConflicts([B, A], data).length, 1, "담은 순서가 달라도 찾아야 해요");
  eq(findConflicts([A, C], data).length, 0, "금기가 아니면 0건");
  eq(findConflicts([A], data).length, 0, "약이 하나면 0건");
  eq(findConflicts([], data).length, 0, "빈 목록은 0건");
  eq(findConflicts([A, A], data).length, 0, "같은 약을 두 번 담아도 자기자신과는 비교 안 함");
  eq(findConflicts([C, D], data).length, 0, "같은 성분을 공유해도 금기는 아님");
  eq(findConflicts([D, E], data)[0]?.reason, "심장 리듬 이상", "성분이 여러 개여도 찾아야 해요");
  eq(findConflicts([A, B, D, E], data).length, 2, "세 쌍 이상도 전부 찾아야 해요");

  // 같은 두 약에 금기 성분이 여러 개 걸려도 경고는 한 번만.
  const dupData: DurData = {
    reasons: ["사유"],
    drugs: [],
    banned: { "P1|Q1": 0, "P2|Q2": 0 },
  };
  const P = mk("6", "피정", ["P1", "P2"]);
  const Q = mk("7", "큐정", ["Q1", "Q2"]);
  eq(findConflicts([P, Q], dupData).length, 1, "같은 조합은 한 번만 알림");

  const list = [mk("1", "타이레놀정", []), mk("2", "어린이타이레놀", []), mk("3", "게보린", [])];
  eq(search(list, "타이레").length, 2, "부분 검색");
  eq(search(list, "타이레")[0].name, "타이레놀정", "앞에서 맞는 것이 먼저");
  eq(search(list, "가").length, 0, "한 글자로는 검색 안 함");

  console.log("dur.ts OK");
}
