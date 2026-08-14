import { useEffect, useMemo, useState } from "react";

import { ImageBannerAd } from "../../components/BannerAd";
import { Card } from "../../components/ScreenLayout";
import { EVENT, track, trackScreen } from "../../lib/analytics";
import { findConflicts, searchDrugs, type Conflict, type Drug } from "../../lib/dur";
import {
  addRecent,
  clearRecent,
  findCombo,
  isFavorite,
  loadCombos,
  loadFavorites,
  loadRecent,
  removeCombo,
  saveCombo,
  toggleFavorite,
  type Combo,
} from "../../lib/pillbox";
import { palette } from "../../theme";

/** 한 번에 담을 수 있는 약. 이보다 많으면 약사와 상담할 일이에요. */
const MAX = 10;
/** 입력할 때마다 API를 부르면 너무 잦으니, 타이핑이 멈추고 이만큼 지나면 검색해요. */
const SEARCH_DEBOUNCE_MS = 400;

type Search = { k: "idle" } | { k: "loading" } | { k: "done"; results: Drug[] } | { k: "error" };
type Check = { k: "idle" } | { k: "loading" } | { k: "done"; conflicts: Conflict[] } | { k: "error" };

export function HomeScreen() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState<Search>({ k: "idle" });
  const [picked, setPicked] = useState<Drug[]>([]);
  const [check, setCheck] = useState<Check>({ k: "idle" });
  const [recent, setRecent] = useState<Drug[]>(() => loadRecent());
  const [favorites, setFavorites] = useState<Drug[]>(() => loadFavorites());
  const [combos, setCombos] = useState<Combo[]>(() => loadCombos());

  useEffect(() => {
    trackScreen("home");
  }, []);

  // 타이핑이 멈추면 검색해요.
  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) {
      setSearch({ k: "idle" });
      return;
    }
    setSearch({ k: "loading" });
    const timer = setTimeout(() => {
      searchDrugs(needle)
        .then((results) => setSearch({ k: "done", results }))
        .catch(() => setSearch({ k: "error" }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  const results = useMemo(() => (search.k === "done" ? search.results : []), [search]);

  const add = (d: Drug) => {
    if (picked.length >= MAX) return;
    if (picked.some((p) => p.seq === d.seq)) return;
    setPicked([...picked, d]);
    setQ("");
    setCheck({ k: "idle" });
    setRecent(addRecent(recent, d));
    track(EVENT.drugAdded, { name: d.name });
  };

  const remove = (seq: string) => {
    setPicked(picked.filter((p) => p.seq !== seq));
    setCheck({ k: "idle" });
  };

  const favorite = (d: Drug) => setFavorites(toggleFavorite(favorites, d));

  const clearHistory = () => {
    clearRecent();
    setRecent([]);
  };

  // 즐겨찾기에 이미 있는 약은 최근 목록에서 또 안 보여줘요 — 화면이 복잡해지니까요.
  const visibleRecent = recent.filter((d) => !isFavorite(favorites, d.seq));

  // 담은 약과 구성이 같은 조합이 이미 저장돼 있으면(순서 달라도) "저장됨"으로 표시해요.
  const currentCombo = findCombo(combos, picked);

  const applyCombo = (c: Combo) => {
    setPicked(c.drugs);
    setCheck({ k: "idle" });
  };

  const runCheck = () => {
    setCheck({ k: "loading" });
    findConflicts(picked)
      .then((found) => {
        setCheck({ k: "done", conflicts: found });
        track(EVENT.checked, { count: picked.length });
        if (found.length > 0) track(EVENT.conflictFound, { count: found.length });
      })
      .catch(() => setCheck({ k: "error" }));
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: palette.bg,
        padding: "16px 20px 24px",
        paddingTop: "max(16px, env(safe-area-inset-top))",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 800, color: palette.ink, margin: "0 0 4px" }}>
        같이 먹어도 되나
      </h1>
      <p style={{ fontSize: 14, color: palette.sub, margin: "0 0 16px", lineHeight: 1.6 }}>
        지금 드시는 약을 담으면, 식약처가 <b>함께 먹지 말라고 정해 둔 조합</b>이 있는지 찾아봐요.
      </p>

      {/* -------------------------------------------------- 검색 */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="약 이름 두 글자 이상 (예: 타이레놀)"
        style={{
          width: "100%",
          boxSizing: "border-box",
          border: `1.5px solid ${palette.line}`,
          borderRadius: 12,
          padding: "16px 14px",
          fontSize: 17,
          color: palette.ink,
          background: palette.white,
          outline: "none",
        }}
      />

      {/* -------------------------------------------- 저장한 조합 · 내 약 · 최근 담은 약 */}
      {q.trim() === "" && (combos.length > 0 || favorites.length > 0 || visibleRecent.length > 0) && (
        <div style={{ marginTop: 14 }}>
          {combos.length > 0 && (
            <div style={{ marginBottom: favorites.length > 0 || visibleRecent.length > 0 ? 16 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: palette.sub, marginBottom: 8 }}>
                저장한 조합
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {combos.map((c) => (
                  <div
                    key={c.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      borderRadius: 999,
                      background: palette.white,
                      boxShadow: "0 1px 6px rgba(26,22,30,0.08)",
                    }}
                  >
                    <button
                      onClick={() => applyCombo(c)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        minHeight: 44,
                        maxWidth: 220,
                        border: "none",
                        background: "transparent",
                        borderRadius: 999,
                        padding: "0 4px 0 16px",
                        fontSize: 15,
                        fontWeight: 600,
                        color: palette.ink,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                    </button>
                    <button
                      onClick={() => setCombos(removeCombo(combos, c.key))}
                      aria-label="조합 지우기"
                      style={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        border: "none",
                        background: "transparent",
                        fontSize: 16,
                        color: palette.sub,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {favorites.length > 0 && (
            <div style={{ marginBottom: visibleRecent.length > 0 ? 16 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: palette.sub, marginBottom: 8 }}>
                내 약
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {favorites.map((d) => (
                  <Chip key={d.seq} drug={d} onClick={() => add(d)} />
                ))}
              </div>
            </div>
          )}
          {visibleRecent.length > 0 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: palette.sub }}>
                  최근 담은 약
                </div>
                <button
                  onClick={clearHistory}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: palette.sub,
                    fontSize: 13,
                    textDecoration: "underline",
                    padding: "8px 0",
                  }}
                >
                  기록 지우기
                </button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {visibleRecent.map((d) => (
                  <Chip key={d.seq} drug={d} onClick={() => add(d)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {search.k === "loading" && (
        <p style={{ fontSize: 14, color: palette.sub, marginTop: 10 }}>찾는 중…</p>
      )}
      {search.k === "error" && (
        <p style={{ fontSize: 14, color: palette.sub, marginTop: 10 }}>
          약을 찾지 못했어요. 잠시 뒤 다시 시도해주세요.
        </p>
      )}

      {results.length > 0 && (
        <Card style={{ marginTop: 8, padding: 4 }}>
          {results.map((d) => (
            <div key={d.seq} style={{ display: "flex", alignItems: "center" }}>
              <button
                onClick={() => add(d)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  borderRadius: 10,
                  padding: "12px",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, color: palette.ink }}>{d.name}</div>
                <div style={{ fontSize: 13, color: palette.sub, marginTop: 2 }}>
                  {d.entp}
                  {d.etcOtc !== "" && ` · ${d.etcOtc}`}
                </div>
              </button>
              <StarButton active={isFavorite(favorites, d.seq)} onClick={() => favorite(d)} />
            </div>
          ))}
        </Card>
      )}

      {search.k === "done" && results.length === 0 && (
        <p style={{ fontSize: 14, color: palette.sub, marginTop: 10 }}>
          찾는 약이 없어요. 상자에 적힌 이름 그대로 넣어보세요.
        </p>
      )}

      {/* ---------------------------------------------- 담은 약 */}
      {picked.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: palette.ink, marginBottom: 8 }}>
            담은 약 {picked.length}개
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {picked.map((d) => (
              <div
                key={d.seq}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 999,
                  background: palette.white,
                  boxShadow: "0 1px 6px rgba(26,22,30,0.08)",
                }}
              >
                <StarButton active={isFavorite(favorites, d.seq)} onClick={() => favorite(d)} />
                <button
                  onClick={() => remove(d.seq)}
                  style={{
                    border: "none",
                    background: "transparent",
                    borderRadius: 999,
                    padding: "10px 14px 10px 2px",
                    fontSize: 15,
                    fontWeight: 600,
                    color: palette.ink,
                  }}
                >
                  {d.name} <span style={{ color: palette.sub, marginLeft: 4 }}>✕</span>
                </button>
              </div>
            ))}
          </div>

          {picked.length >= 2 && (
            <button
              onClick={() => setCombos(saveCombo(combos, picked))}
              disabled={currentCombo != null}
              style={{
                width: "100%",
                marginTop: 10,
                minHeight: 44,
                border: `1.5px solid ${palette.primary}`,
                borderRadius: 12,
                padding: "10px 0",
                fontSize: 15,
                fontWeight: 700,
                color: currentCombo != null ? palette.sub : palette.primary,
                background: "transparent",
              }}
            >
              {currentCombo != null ? "저장됨" : "이 조합 저장"}
            </button>
          )}

          <button
            onClick={runCheck}
            disabled={picked.length < 2 || check.k === "loading"}
            style={{
              width: "100%",
              marginTop: 16,
              border: "none",
              borderRadius: 14,
              padding: "18px 0",
              fontSize: 18,
              fontWeight: 800,
              color: palette.white,
              background: picked.length < 2 ? "#C9C3CE" : palette.primary,
            }}
          >
            {picked.length < 2
              ? "약을 2개 이상 담아주세요"
              : check.k === "loading"
                ? "확인하는 중…"
                : "같이 먹어도 되는지 확인"}
          </button>
        </div>
      )}

      {/* ------------------------------------------------- 결과 */}
      {check.k === "done" && <Result conflicts={check.conflicts} count={picked.length} />}
      {check.k === "error" && (
        <Note text="확인하지 못했어요. 잠시 뒤 다시 시도해주세요." />
      )}

      {/* 이 문구는 지우면 안 돼요. 이 앱은 판단을 대신하지 않아요. */}
      <Card style={{ marginTop: 24, background: "rgba(26,22,30,0.03)", boxShadow: "none" }}>
        <p style={{ fontSize: 13, color: palette.sub, margin: 0, lineHeight: 1.7 }}>
          식품의약품안전처가 공개한 <b>DUR 병용금기 정보</b>를 그대로 보여드려요.
          <br />
          이 앱은 진단이나 복약 지도를 하지 않아요. 실제로 드실지는{" "}
          <b>약사·의사와 상의해서</b> 정하세요.
          <br />
          여기에 안 나온다고 안전하다는 뜻은 아니에요.
        </p>
      </Card>

      <div style={{ marginTop: 24 }}>
        <ImageBannerAd />
      </div>
    </div>
  );
}

function Result({ conflicts, count }: { conflicts: Conflict[]; count: number }) {
  if (conflicts.length === 0) {
    return (
      <Card style={{ marginTop: 16, borderLeft: `5px solid ${palette.ok}` }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: palette.ok }}>
          금기로 등록된 조합은 없어요
        </div>
        <p style={{ fontSize: 14, color: palette.sub, margin: "8px 0 0", lineHeight: 1.7 }}>
          담으신 약 {count}개 사이에 식약처가 병용금기로 정해 둔 조합은 없었어요.
          그렇다고 <b>함께 먹어도 안전하다는 뜻은 아니에요</b>. 아직 등록되지 않은 상호작용도 있을 수 있으니,
          정확한 판단은 약사·의사와 상의하세요.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          fontSize: 19,
          fontWeight: 800,
          color: palette.danger,
          marginBottom: 10,
        }}
      >
        함께 먹지 말라고 되어 있는 조합 {conflicts.length}건
      </div>

      {conflicts.map((c, i) => (
        <Card key={i} style={{ marginBottom: 10, borderLeft: `5px solid ${palette.danger}` }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: palette.ink, lineHeight: 1.5 }}>
            {c.a.name}
            <span style={{ color: palette.danger, margin: "0 6px" }}>＋</span>
            {c.b.name}
          </div>
          {c.reason !== "" && (
            <p style={{ fontSize: 14, color: palette.sub, margin: "8px 0 0", lineHeight: 1.7 }}>
              {c.reason}
            </p>
          )}
        </Card>
      ))}

      <Card style={{ background: "rgba(199,58,58,0.06)", boxShadow: "none" }}>
        <p style={{ fontSize: 14, color: palette.ink, margin: 0, lineHeight: 1.7 }}>
          <b>스스로 약을 끊지 마세요.</b> 처방받은 약이라면 이미 검토된 조합일 수 있어요.
          이 화면을 약사나 의사에게 보여주고 상의하세요.
        </p>
      </Card>
    </div>
  );
}

function Note({ text }: { text: string }) {
  return (
    <Card style={{ textAlign: "center", padding: 24 }}>
      <p style={{ fontSize: 15, color: palette.sub, margin: 0, lineHeight: 1.6 }}>{text}</p>
    </Card>
  );
}

/** 최근/즐겨찾기 칩. 이름이 길어서 괄호 앞부분만 잘라 보여줘요(전체 이름은 담긴 뒤에 보여요). */
function Chip({ drug, onClick }: { drug: Drug; onClick: () => void }) {
  const label = drug.name.split("(")[0].trim();
  return (
    <button
      onClick={onClick}
      style={{
        minHeight: 44,
        maxWidth: 220,
        padding: "0 16px",
        border: "none",
        borderRadius: 999,
        background: palette.white,
        color: palette.ink,
        fontSize: 15,
        fontWeight: 600,
        boxShadow: "0 1px 6px rgba(26,22,30,0.08)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function StarButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        border: "none",
        background: "transparent",
        fontSize: 20,
        color: active ? "#F5A623" : palette.line,
      }}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
