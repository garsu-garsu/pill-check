import { BannerAd } from "./components/BannerAd";
import { HomeScreen } from "./features/home/HomeScreen";

/** 화면 하나짜리 앱이에요. 배너는 하단 고정 하나뿐입니다. */
export default function App() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <HomeScreen />
      </div>
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
    </div>
  );
}
