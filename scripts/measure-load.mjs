/**
 * 최초 접속 시간 측정용(반려 사유 1번 확인).
 *
 *   npx vite preview --port 4571 --strictPort   (다른 창에서 띄워두고)
 *   BASE_URL=http://localhost:4571/ node scripts/measure-load.mjs
 *
 * 네비게이션 시작부터 실제 홈 화면 문구("같이 먹어도 되나")가 DOM에 나타난
 * 시점까지 걸린 시간을 재요(Node 쪽에서 짧은 간격으로 폴링). 하단 고정
 * 배너 칸이 그 문구보다 먼저 나타나면 진입 즉시 흰 블록만 뜨는 반려 사유
 * 2번도 같이 잡아요.
 */
import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const PAGE_URL = process.env.BASE_URL ?? "http://localhost:4571/";
const RUNS = Number(process.env.RUNS ?? 5);
const POLL_MS = 5;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--window-size=636,1048"],
});

// 페이지 안에서 두 조건이 이미 참인지 확인해요.
const CHECK_FN = () => ({
  content: document.body?.innerText?.includes("같이 먹어도 되나") ?? false,
  // App.tsx 하단 고정 배너 칸: paddingBottom 에 safe-area-inset-bottom 이 들어간 유일한 요소예요.
  banner: [...document.querySelectorAll("div")].some((el) =>
    el.style.paddingBottom.includes("safe-area-inset-bottom"),
  ),
});

async function pollUntil(page, start, timeoutMs = 20000) {
  const marks = {};
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(CHECK_FN).catch(() => ({ content: false, banner: false }));
    const now = Date.now() - start;
    if (state.content && marks.content == null) marks.content = now;
    if (state.banner && marks.banner == null) marks.banner = now;
    if (marks.content != null && marks.banner != null) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return marks;
}

try {
  const results = [];
  for (let i = 0; i < RUNS; i++) {
    const page = await browser.newPage();
    await page.setViewport({ width: 636, height: 1048, deviceScaleFactor: 1 });
    await page.setCacheEnabled(false);

    const start = Date.now();
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    const marks = await pollUntil(page, start);
    results.push(marks);
    await page.close();
    console.log(`  run ${i + 1}:`, marks);
  }

  const contentTimes = results.map((r) => r.content).filter((v) => v != null);
  const bannerTimes = results.map((r) => r.banner).filter((v) => v != null);
  const avg = (xs) => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);

  console.log(`\n실행 ${RUNS}회`);
  console.log(`콘텐츠 첫 표시: 평균 ${avg(contentTimes)?.toFixed(0) ?? "관측 안 됨"}ms`);
  if (bannerTimes.length === 0) {
    console.log("배너 칸: 관측 안 됨 (안 뜸)");
  } else {
    console.log(`배너 칸 첫 표시: 평균 ${avg(bannerTimes)?.toFixed(0)}ms`);
    const order = results
      .filter((r) => r.content != null && r.banner != null)
      .map((r) => (r.banner < r.content ? "배너가 먼저" : "콘텐츠가 먼저"));
    console.log(`순서: ${order.join(", ")}`);
  }
} finally {
  await browser.close();
}
