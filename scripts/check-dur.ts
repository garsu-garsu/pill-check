/** `npm run check:dur` — 금기 판정이나 최근/즐겨찾기 로직이 깨지면 여기서 터져요. */
import { demo } from "../src/lib/dur.ts";
import { demo as pillboxDemo } from "../src/lib/pillbox.ts";

demo();
pillboxDemo();
