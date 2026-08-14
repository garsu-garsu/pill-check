/**
 * 최근 담은 약 · 즐겨찾기.
 *
 * 전부 이 기기 안(localStorage)에만 저장해요. 약 이름은 서버로 절대 안 보내요.
 * 저장이 안 되는 환경(시크릿 모드 등)은 조용히 무시하고 앱은 계속 돌아가야 해요.
 */
import type { Drug } from "./dur.ts";

const RECENT_KEY = "pill-check:recent";
const FAVORITE_KEY = "pill-check:favorites";
export const MAX_RECENT = 12;

function load(key: string): Drug[] {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? [] : (JSON.parse(raw) as Drug[]);
  } catch {
    return [];
  }
}

function save(key: string, list: Drug[]): void {
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

  console.log("pillbox.ts OK");
}
