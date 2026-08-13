import { useEffect, useMemo, useState } from "react";

import { ImageBannerAd } from "../../components/BannerAd";
import { Card } from "../../components/ScreenLayout";
import { EVENT, track, trackScreen } from "../../lib/analytics";
import {
  findConflicts,
  loadDur,
  search,
  type Drug,
  type DurData,
} from "../../lib/dur";
import { palette } from "../../theme";

/** 한 번에 담을 수 있는 약. 이보다 많으면 약사와 상담할 일이에요. */
const MAX = 10;

type Load = { k: "loading" } | { k: "ready"; data: DurData } | { k: "error" };

export function HomeScreen() {
  const [load, setLoad] = useState<Load>({ k: "loading" });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Drug[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    trackScreen("home");
    loadDur()
      .then((data) => setLoad({ k: "ready", data }))
      .catch(() => setLoad({ k: "error" }));
  }, []);

  const results = useMemo(
    () => (load.k === "ready" ? search(load.data.drugs, q) : []),
    [load, q],
  );

  const conflicts = useMemo(
    () => (load.k === "ready" && checked ? findConflicts(picked, load.data) : []),
    [load, picked, checked],
  );

  const add = (d: Drug) => {
    if (picked.length >= MAX) return;
    if (picked.some((p) => p.seq === d.seq)) return;
    setPicked([...picked, d]);
    setQ("");
    setChecked(false);
    track(EVENT.drugAdded, { name: d.name });
  };

  const remove = (seq: string) => {
    setPicked(picked.filter((p) => p.seq !== seq));
    setChecked(false);
  };

  const check = () => {
    setChecked(true);
    const found = load.k === "ready" ? findConflicts(picked, load.data) : [];
    track(EVENT.checked, { count: picked.length });
    if (found.length > 0) track(EVENT.conflictFound, { count: found.length });
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

      {load.k === "loading" && <Note text="약 정보를 불러오는 중이에요…" />}
      {load.k === "error" && <Note text="약 정보를 불러오지 못했어요. 잠시 뒤 다시 열어주세요." />}

      {load.k === "ready" && (
        <>
          {/* -------------------------------------------------- 검색 */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="약 이름 두 글자 이상 (예: 아스피)"
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

          {results.length > 0 && (
            <Card style={{ marginTop: 8, padding: 4 }}>
              {results.map((d) => (
                <button
                  key={d.seq}
                  onClick={() => add(d)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "transparent",
                    borderRadius: 10,
                    padding: "12px",
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 600, color: palette.ink }}>{d.name}</div>
                  <div style={{ fontSize: 13, color: palette.sub, marginTop: 2 }}>{d.entp}</div>
                </button>
              ))}
            </Card>
          )}

          {q.trim().length >= 2 && results.length === 0 && (
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
                  <button
                    key={d.seq}
                    onClick={() => remove(d.seq)}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "10px 14px",
                      fontSize: 15,
                      fontWeight: 600,
                      color: palette.ink,
                      background: palette.white,
                      boxShadow: "0 1px 6px rgba(26,22,30,0.08)",
                    }}
                  >
                    {d.name} <span style={{ color: palette.sub, marginLeft: 4 }}>✕</span>
                  </button>
                ))}
              </div>

              <button
                onClick={check}
                disabled={picked.length < 2}
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
                {picked.length < 2 ? "약을 2개 이상 담아주세요" : "같이 먹어도 되는지 확인"}
              </button>
            </div>
          )}

          {/* ------------------------------------------------- 결과 */}
          {checked && <Result conflicts={conflicts} count={picked.length} />}
        </>
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

function Result({
  conflicts,
  count,
}: {
  conflicts: ReturnType<typeof findConflicts>;
  count: number;
}) {
  if (conflicts.length === 0) {
    return (
      <Card style={{ marginTop: 16, borderLeft: `5px solid ${palette.ok}` }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: palette.ok }}>
          금기로 등록된 조합은 없어요
        </div>
        <p style={{ fontSize: 14, color: palette.sub, margin: "8px 0 0", lineHeight: 1.7 }}>
          담으신 약 {count}개 사이에 식약처가 병용금기로 정해 둔 조합은 없었어요.
          다만 <b>등록되지 않은 상호작용</b>은 여전히 있을 수 있어요.
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
