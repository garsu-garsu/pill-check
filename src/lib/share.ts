/**
 * 공유.
 *
 * ⚠️ 확인 결과는 절대 담지 않아요. 어떤 약을 먹는지는 건강에 관한 개인정보라
 *    공유 문구에 들어가면 안 돼요. 그래서 이 앱을 알려주는 링크만 보냅니다 —
 *    부모님께 "이거 써보세요" 로 보내는 용도예요.
 */
import { getTossShareLink, Share } from "@apps-in-toss/web-framework";

import { EVENT, track } from "./analytics.ts";

export async function shareApp(): Promise<void> {
  let link = "";
  try {
    link = await getTossShareLink("intoss://pill-check");
  } catch (err) {
    console.error("공유 링크 생성 실패:", err);
  }

  const message = [
    "드시는 약을 같이 먹어도 되는지 확인해요.",
    "식약처가 정해 둔 병용금기 기록을 그대로 보여줘요.",
    link,
  ]
    .filter((s) => s !== "")
    .join("\n");

  try {
    await Share.sendMessage({ message });
    track(EVENT.shareCompleted);
  } catch (err) {
    console.error("공유 실패:", err);
  }
}
