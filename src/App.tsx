import { lazy, Suspense, useEffect, useState } from "react";

import { HomeScreen } from "./features/home/HomeScreen";
import { AD_GROUP_ID_BANNER } from "./lib/env";

// 배너는 홈 화면이 그려진 뒤에만 붙어요(아래 참고). 그때 가서야 필요하니
// 초기 번들에서 빼고 그 시점에 따로 받아와요.
const BannerAd = lazy(() => import("./components/BannerAd").then((m) => ({ default: m.BannerAd })));

/** 화면 하나짜리 앱이에요. 배너는 하단 고정 하나뿐입니다. */
export default function App() {
  // 홈 화면이 먼저 커밋된 뒤에만 배너 칸을 붙여요. 진입과 동시에 빈 흰
  // 블록이 뜨면 심사가 바텀시트로 봐서 반려돼요(20260816-8, 사유 2번).
  // 고정 지연(setTimeout)이 아니라 "홈 화면이 이미 한 번 그려졌다"는
  // 실제 상태(effect는 커밋 다음 틱에 돌아요)를 기준으로 판단해요.
  const [homePainted, setHomePainted] = useState(false);
  useEffect(() => setHomePainted(true), []);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <HomeScreen />
      </div>
      {/*
        광고그룹 ID가 없으면 자리 자체를 만들지 않아요. 배너는 안 뜨는데 96px
        높이만 남아서 하단에 흰 여백이 크게 깔립니다. 나중에 ID를 넣으면
        원래대로 배너 자리가 생겨요.
      */}
      {homePainted && AD_GROUP_ID_BANNER !== "" && (
        <div
          style={{
            flexShrink: 0,
            height: 96,
            paddingBottom: "env(safe-area-inset-bottom)",
            background: "#FFFFFF",
          }}
        >
          <Suspense fallback={null}>
            <BannerAd />
          </Suspense>
        </div>
      )}
    </div>
  );
}
