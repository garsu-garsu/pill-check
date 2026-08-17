/**
 * 코치마크 온보딩 확인용 스크린샷.
 *
 *   npm run dev   (다른 창에서 5176 포트로 띄워두고)
 *   node scripts/shot-coach.mjs
 *
 * 1) 첫 실행 — intro → search 단계 스크린샷, 건너뛴 뒤 평소 화면
 * 2) 새로고침해도 다시 안 뜨는지 확인
 * 3) 저장한 약이 있는 "재방문" 상태에서 코치마크를 다시 켜면 3번째(저장) 단계까지 뜨는지 확인
 */
import { mkdir } from "node:fs/promises";

import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const PAGE_URL = process.env.BASE_URL ?? "http://localhost:5176/";
const OUT = "screenshots";
const SIZE = { width: 636, height: 1048, deviceScaleFactor: 1 };
const DRUG1 = process.env.DRUG1 ?? "이부프로펜";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  // ---------- 1) 첫 실행: 코치마크 1단계 ----------
  await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(500);
  await page.screenshot({ path: `${OUT}/readme-coach-1.png` });

  // 2단계(검색창)로 넘어가기 — 카드 안의 "다음" 버튼(카드 클릭은 stopPropagation돼요)
  await page.click('button ::-p-text(다음)');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/readme-coach-2.png` });

  // 건너뛰기 → 평소 화면
  await page.click('button ::-p-text(건너뛰기)');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/readme-coach-done.png` });

  // ---------- 2) 새로고침해도 다시 안 뜨는지 ----------
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(500);
  const stillThere = await page.$('[aria-label="다음"]');
  console.log("새로고침 뒤 코치마크 안 뜸:", stillThere == null ? "OK" : "실패(다시 떴음)");

  // ---------- 3) 저장한 약이 있는 상태에서 다시 켜면 3단계까지 나오는지 ----------
  // 약 검색 + 즐겨찾기 등록 → localStorage에 남김 (코치마크가 이미 닫힌 뒤에!)
  await page.type("input", DRUG1, { delay: 30 });
  await page
    .waitForFunction(
      (needle) => document.body.innerText.includes(needle) || document.body.innerText.includes("찾는 약이 없어요"),
      { timeout: 8000 },
      DRUG1,
    )
    .catch(() => {});
  await sleep(300);
  const starBtn = await page.$('[aria-label="즐겨찾기 추가"]');
  if (starBtn) await starBtn.click();
  await sleep(300);
  const favKeys = await page.evaluate(() => localStorage.getItem("pill-check:favorites"));
  console.log("즐겨찾기 저장됨:", favKeys != null && favKeys !== "[]" ? "OK" : "실패");

  // 코치마크만 다시 켜고(새로고침으로 재마운트), 즐겨찾기는 남아 있어야 함
  await page.evaluate(() => localStorage.removeItem("pill-check:coach:v1"));
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(500);

  // 1 → 2 → 3단계(저장 칸) 확인
  await page.click('button ::-p-text(다음)');
  await sleep(200);
  await page.click('button ::-p-text(다음)');
  await sleep(300);
  const step3Text = await page.evaluate(() => document.body.innerText);
  const gotStep3 = step3Text.includes("저장해두면 다음에 바로 볼 수 있어요");
  console.log("즐겨찾기 있는 상태에서 저장 단계 나옴:", gotStep3 ? "OK" : "실패");
  await page.screenshot({ path: `${OUT}/readme-coach-3-saved.png` });

  console.log("페이지 오류:", errors.length === 0 ? "없음" : errors.slice(0, 5));
} finally {
  await browser.close();
}
