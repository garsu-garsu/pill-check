/**
 * 최근 담은 약 · 즐겨찾기 · 저장한 조합.
 *
 * 전부 이 기기 안(localStorage)에만 저장해요. 약 이름은 서버로 절대 안 보내요.
 * 저장이 안 되는 환경(시크릿 모드 등)은 조용히 무시하고 앱은 계속 돌아가야 해요.
 */
import type { Drug } from "./dur.ts";

const RECENT_KEY = "pill-check:recent";
const FAVORITE_KEY = "pill-check:favorites";
const COMBO_KEY = "pill-check:combos";
export const MAX_RECENT = 12;

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? [] : (JSON.parse(raw) as T[]);
  } catch {
    return [];
  }
}

function save<T>(key: string, list: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* 시크릿 모드 등 — 조용히 무시해요 */
  }
}

/** 맨 앞으로 올리고, 중복은 없애고, max개로 잘라요. */
export function pushFront(list: Drug[], d: Drug, max = Infinity): Drug[] {
  return [d, ...list.filter((x) => x.seq !== d.seq)].slice(0, max);
}

export function loadRecent(): Drug[] {
  return load(RECENT_KEY);
}

export function addRecent(list: Drug[], d: Drug): Drug[] {
  const next = pushFront(list, d, MAX_RECENT);
  save(RECENT_KEY, next);
  return next;
}

export function clearRecent(): void {
  save(RECENT_KEY, []);
}

export function loadFavorites(): Drug[] {
  return load(FAVORITE_KEY);
}

export function isFavorite(favorites: Drug[], seq: string): boolean {
  return favorites.some((f) => f.seq === seq);
}

/** 이미 즐겨찾기면 빼고, 아니면 맨 앞에 더해요. */
export function toggleFavorite(favorites: Drug[], d: Drug): Drug[] {
  const next = isFavorite(favorites, d.seq)
    ? favorites.filter((f) => f.seq !== d.seq)
    : pushFront(favorites, d);
  save(FAVORITE_KEY, next);
  return next;
}

export interface Combo {
  /** 약 구성(seq 정렬)으로 만든 키 — 순서가 달라도 같은 조합이면 같은 키예요. */
  key: string;
  label: string;
  drugs: Drug[];
}

function comboKeyOf(drugs: Drug[]): string {
  return drugs
    .map((d) => d.seq)
    .sort()
    .join("|");
}

/** 담은 약 이름으로 자동으로 이름을 지어요. 타이핑 안 시켜요. */
export function autoComboLabel(drugs: Drug[]): string {
  const first = (drugs[0]?.name ?? "").split("(")[0].trim();
  return drugs.length > 1 ? `${first} 외 ${drugs.length - 1}개` : first;
}

export function loadCombos(): Combo[] {
  return load(COMBO_KEY);
}

export function findCombo(combos: Combo[], drugs: Drug[]): Combo | undefined {
  const key = comboKeyOf(drugs);
  return combos.find((c) => c.key === key);
}

/** 이미 같은 조합이 있으면 그대로 두고(중복 저장 안 함), 없으면 새로 만들어요. */
export function saveCombo(combos: Combo[], drugs: Drug[]): Combo[] {
  if (findCombo(combos, drugs) != null) return combos;
  const combo: Combo = { key: comboKeyOf(drugs), label: autoComboLabel(drugs), drugs };
  const next = [combo, ...combos];
  save(COMBO_KEY, next);
  return next;
}

export function removeCombo(combos: Combo[], key: string): Combo[] {
  const next = combos.filter((c) => c.key !== key);
  save(COMBO_KEY, next);
  return next;
}

/* ------------------------------------------------------------------ */
/* 자체 점검 — `npm run check:dur` 에서 같이 돌아요.                    */
/* ------------------------------------------------------------------ */
export function demo(): void {
  const eq = (got: unknown, want: unknown, label: string) => {
    if (got !== want) throw new Error(`${label}: ${String(got)} !== ${String(want)}`);
  };

  const mk = (seq: string): Drug => ({ seq, name: `${seq}정`, entp: "테스트제약", etcOtc: "일반의약품" });
  const A = mk("1");
  const B = mk("2");
  const C = mk("3");

  eq(pushFront([], A).length, 1, "빈 목록에 추가하면 1개");
  eq(pushFront([A], A).length, 1, "같은 약을 또 담아도 중복 안 쌓임");
  eq(pushFront([A, B], A)[0].seq, "1", "다시 담으면 맨 앞으로 올라옴");
  eq(pushFront([A, B], C, 2).length, 2, "max개로 잘림");
  eq(pushFront([A, B], C, 2)[0].seq, "3", "잘려도 방금 담은 게 맨 앞");

  eq(isFavorite([A], "1"), true, "즐겨찾기에 있으면 true");
  eq(isFavorite([A], "2"), false, "즐겨찾기에 없으면 false");

  const named = (seq: string, name: string): Drug => ({ seq, name, entp: "테스트제약", etcOtc: "일반의약품" });
  const tylenol = named("10", "타이레놀정500밀리그람(아세트아미노펜)");
  const ibu = named("11", "부루펜정200밀리그램(이부프로펜)");
  const aspirin = named("12", "아스피린정100밀리그램(아스피린)");

  eq(autoComboLabel([tylenol]), "타이레놀정500밀리그람", "약이 하나면 '외 N개' 안 붙음");
  eq(autoComboLabel([tylenol, ibu, aspirin]), "타이레놀정500밀리그람 외 2개", "괄호 앞부분 + 외 N개");

  let combos = saveCombo([], [tylenol, ibu]);
  eq(combos.length, 1, "조합 저장하면 1개");
  eq(findCombo(combos, [ibu, tylenol]) != null, true, "순서가 달라도 같은 조합으로 찾음");
  combos = saveCombo(combos, [ibu, tylenol]); // 순서만 바꿔서 또 저장
  eq(combos.length, 1, "같은 조합은 중복 저장 안 됨");
  combos = saveCombo(combos, [tylenol, aspirin]);
  eq(combos.length, 2, "다른 조합은 따로 저장됨");
  combos = removeCombo(combos, combos[0].key);
  eq(combos.length, 1, "지우면 하나 줄어듦");

  console.log("pillbox.ts OK");
}
