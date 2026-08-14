/**
 * 화면 확인용 스크린샷(636x1048 — 콘솔 제출 규격).
 *
 *   npx vite preview --port 4173 --strictPort   (다른 창에서 띄워두고)
 *   node scripts/shot.mjs
 *
 * 검색 → 담기 → 확인까지 실제 API를 그대로 태워요(개발 모드 우회 없음).
 * .env 에 VITE_DATA_KEY 가 없으면 검색이 비어서 나오는 게 정상이에요.
 */
import { mkdir } from "node:fs/promises";

import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const PAGE_URL = process.env.BASE_URL ?? "http://localhost:4173/";
const OUT = "screenshots";
const SIZE = { width: 636, height: 1048, deviceScaleFactor: 1 };
const DRUG1 = process.env.DRUG1 ?? "이부프로펜";
const DRUG2 = process.env.DRUG2 ?? "타이레놀";
const PREFIX = process.env.PREFIX ?? "";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [`--window-size=${SIZE.width},${SIZE.height}`],
});

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport(SIZE);

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/${PREFIX}1-home.png` });

  // 첫 번째 약 검색 + 담기
  await page.type("input", DRUG1, { delay: 30 });
  await page
    .waitForFunction((needle) => document.body.innerText.includes(needle) || document.body.innerText.includes("찾는 약이 없어요"), { timeout: 8000 }, DRUG1)
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/${PREFIX}2-search.png` });

  const firstResult = await page.$("div > button");
  if (firstResult) {
    await firstResult.click();
    await new Promise((r) => setTimeout(r, 300));
  }

  // 두 번째 약 검색 + 담기
  await page.type("input", DRUG2, { delay: 30 });
  await new Promise((r) => setTimeout(r, 1500));
  const secondResult = await page.$("div > button");
  if (secondResult) {
    await secondResult.click();
    await new Promise((r) => setTimeout(r, 300));
  }
  await page.screenshot({ path: `${OUT}/${PREFIX}3-picked.png` });

  // 확인 버튼
  const buttons = await page.$$("button");
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text?.includes("같이 먹어도 되는지 확인")) {
      await b.click();
      break;
    }
  }
  // "금기로 등록된 조합" / "함께 먹지 말라고" / "확인하지 못했어요" — 안내 문구의 "금기"와
  // 구분되는, 실제 결과가 떴을 때만 나오는 문구로 기다려요.
  await page
    .waitForFunction(
      () =>
        document.body.innerText.includes("금기로 등록된 조합") ||
        document.body.innerText.includes("함께 먹지 말라고 되어 있는 조합") ||
        document.body.innerText.includes("확인하지 못했어요"),
      { timeout: 30000 },
    )
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/${PREFIX}4-result.png` });

  console.log(`스크린샷 ${OUT}/ 에 저장`);
  console.log("페이지 오류:", errors.length === 0 ? "없음" : errors.slice(0, 5));
} finally {
  await browser.close();
}
