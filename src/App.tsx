import { BannerAd } from "./components/BannerAd";
import { HomeScreen } from "./features/home/HomeScreen";
import { AD_GROUP_ID_BANNER } from "./lib/env";

/** 화면 하나짜리 앱이에요. 배너는 하단 고정 하나뿐입니다. */
export default function App() {
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
      {AD_GROUP_ID_BANNER !== "" && (
        <div
          style={{
            flexShrink: 0,
            height: 96,
            paddingBottom: "env(safe-area-inset-bottom)",
            background: "#FFFFFF",
          }}
        >
          <BannerAd />
        </div>
      )}
    </div>
  );
}
