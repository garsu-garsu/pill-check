/**
 * 조합 저장 화면 확인용 스크린샷.
 *
 *   npx vite preview --port 4174 --strictPort   (다른 창에서 띄워두고)
 *   BASE_URL=http://localhost:4174/ node scripts/shot-combo.mjs
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

async function clearInput(page) {
  await page.click("input");
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await new Promise((r) => setTimeout(r, 200));
}

async function searchAndAdd(page, name) {
  await clearInput(page);
  await page.type("input", name, { delay: 20 });
  await page
    .waitForFunction((needle) => document.body.innerText.includes(needle), { timeout: 8000 }, name)
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  const first = await page.$("div > button");
  if (first) await first.click();
  await new Promise((r) => setTimeout(r, 200));
}

function findByText(page, text) {
  return page.evaluateHandle((needle) => {
    const btns = [...document.querySelectorAll("button")];
    return btns.find((b) => b.textContent?.includes(needle));
  }, text);
}

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport(SIZE);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(PAGE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 500));

  // 1) 약 2개 담고 "이 조합 저장" 누르기 직전/직후.
  await searchAndAdd(page, "이부프로펜");
  await searchAndAdd(page, "타이레놀");
  const saveBtn = await findByText(page, "이 조합 저장");
  if (saveBtn.asElement()) await saveBtn.asElement().click();
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/combo-1-saved.png` }); // 버튼이 "저장됨"으로 바뀐 상태

  // 같은 조합을 또 저장해도 하나만 남는지 — 버튼을 한 번 더 눌러봐요(disabled라 눌러도 그대로여야 함).
  const saveAgain = await findByText(page, "저장됨");
  if (saveAgain.asElement()) await saveAgain.asElement().click();

  // 2) 검색창을 비워서 "저장한 조합" 묶음이 맨 위에 뜨는 걸 확인.
  await clearInput(page);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/combo-2-list.png` });

  // 3) 담은 약을 다른 조합으로 바꾸고, 저장한 조합을 눌러 통째로 갈아끼워지는지 확인.
  // 담긴 약을 전부 지워요(담은 약 칩의 ✕ 전부 클릭).
  for (let i = 0; i < 5; i++) {
    const h = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll("button")];
      return btns.find((b) => b.textContent?.trim().endsWith("✕") && !b.getAttribute("aria-label"));
    });
    if (!h.asElement()) break;
    await h.asElement().click();
    await new Promise((r) => setTimeout(r, 150));
  }
  await searchAndAdd(page, "낙센"); // 엉뚱한 약을 하나 담아둬요
  await clearInput(page);
  await new Promise((r) => setTimeout(r, 300));
  const comboChip = await findByText(page, "부루펜정200밀리그램 외");
  if (comboChip.asElement()) await comboChip.asElement().click();
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}/combo-3-applied.png` }); // 담은 약이 저장된 조합으로 통째로 바뀜

  // 4) 새로고침해도 조합이 남아있는지.
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/combo-4-after-reload.png` });

  console.log(`스크린샷 ${OUT}/ 에 저장`);
  console.log("페이지 오류:", errors.length === 0 ? "없음" : errors.slice(0, 5));
} finally {
  await browser.close();
}
