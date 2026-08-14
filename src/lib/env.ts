export const AD_GROUP_ID_BANNER = import.meta.env?.VITE_AD_GROUP_ID_BANNER ?? "";
export const AD_GROUP_ID_BANNER_IMAGE =
  import.meta.env?.VITE_AD_GROUP_ID_BANNER_IMAGE ?? "";

/**
 * 공공데이터포털 인증키. 앱이 브라우저(런타임)에서 식약처 API를 직접 부르기 때문에
 * 이 키는 번들에 그대로 들어가 누구나 볼 수 있어요. 이 API는 무료·공개 데이터라
 * 감수한 절충이에요 — 결제·개인정보 같은 민감한 키는 이 방식을 쓰면 안 돼요.
 */
export const DATA_KEY = import.meta.env?.VITE_DATA_KEY ?? "";
