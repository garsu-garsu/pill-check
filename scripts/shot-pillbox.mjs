/**
 * 최근 담은 약 · 즐겨찾기 화면 확인용 스크린샷.
 *
 *   npx vite preview --port 4174 --strictPort   (다른 창에서 띄워두고)
 *   BASE_URL=http://localhost:4174/ node scripts/shot-pillbox.mjs
 */
import { mkdir } from "node:fs/promises";

import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const PAGE_URL = process.env.BASE_URL ?? "http://localhost:4174/";
const OUT = "screenshots";
const SIZE = { width: 636, height: 1048, deviceScaleFactor: 1 };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: [`--window-size=${SIZE.width},${SIZE.height}`],
});

async function searchAndAdd(page, name) {
  await page.type("input", name, { delay: 20 });
  await page
    .waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 8000 }, name)
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  const first = await page.$("div > button");
  if (first) await first.click();
  await new Promise((r) => setTimeout(r, 200));
}

async function clearInput(page) {
  await page.click("input");
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await new Promise((r) => setTimeout(r, 200));
}

async function searchAndStar(page, name) {
  await clearInput(page);
  await page.type("input", name, { delay: 20 });
  await page
    .waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 8000 }, name)
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  // 검색 결과 줄(별표 버튼의 부모에 검색어가 들어있는 줄)의 별표만 골라 눌러요 —
  // 담은 약 목록에도 같은 aria-label 별표가 있어서 헷갈리지 않게 구분해요.
  const starHandle = await page.evaluateHandle((needle) => {
    const stars = [...document.querySelectorAll('button[aria-label="즐겨찾기 추가"]')];
    return stars.find((s) => s.parentElement?.textContent?.includes(needle));
  }, name);
  if (starHandle.asElement()) await starHandle.asElement().click();
  await new Promise((r) => setTimeout(r, 200));
  await clearInput(page);
}

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport(SIZE);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));

  // 1) 아무것도 없을 때 — 최근/즐겨찾기 영역이 아예 안 보여야 해요.
  await page.screenshot({ path: `${OUT}/pillbox-1-empty.png` });

  // 2) 두 약을 담았다 하나를 빼서 "최근 담은 약" 칩을 만들어요.
  await searchAndAdd(page, "이부프로펜");
  await searchAndAdd(page, "타이레놀");
  const removeHandle = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll("button")];
    return btns.find((b) => b.textContent?.includes("✕"));
  });
  if (removeHandle.asElement()) await removeHandle.asElement().click();
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/pillbox-2-history.png` });

  // 3) 검색 결과에서 별표를 눌러 즐겨찾기 두 개를 만들어요.
  await searchAndStar(page, "게보린");
  await searchAndStar(page, "낙센");
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/pillbox-3-favorites.png` });

  // 4) 기록 지우기 — 최근 담은 약만 사라지고 즐겨찾기는 남아야 해요.
  const clearHandle = await page.evaluateHandle(() => {
    const btns = [...document.querySelectorAll("button")];
    return btns.find((b) => b.textContent?.includes("기록 지우기"));
  });
  if (clearHandle.asElement()) await clearHandle.asElement().click();
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/pillbox-4-cleared.png` });

  // 5) 새로고침해도 즐겨찾기가 남아있는지.
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/pillbox-5-after-reload.png` });

  console.log(`스크린샷 ${OUT}/ 에 저장`);
  console.log("페이지 오류:", errors.length === 0 ? "없음" : errors.slice(0, 5));
} finally {
  await browser.close();
}
