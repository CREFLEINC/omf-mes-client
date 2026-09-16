/**
 * 라벨을 그릴 **흑백 점판**과 그 위에 글자를 찍는 5×7 점 글꼴.
 *
 * ⭐ **라벨 종류를 모른다.** 출고 QR 이 처음 썼지만(ISSUE-QR-01) 포장·납품 라벨도 같은 점판에
 *    그린다. 그래서 여기에는 **서식·문구·좌표가 하나도 없다** — 그런 것은 화면이 갖는다.
 *    이 파일이 라벨 한 종류를 알게 되는 순간 다음 라벨이 이것을 복사하게 된다.
 *
 * ⭐ **왜 캔버스를 쓰지 않는가.** 이 코드는 POP 렌더러에서 돌지만 **시험은 jsdom 에서 돈다**
 *    (`apps/web/vitest.config.ts`). jsdom 은 캔버스를 구현하지 않고 저장소에 `canvas` 패키지도
 *    없다 — 캔버스로 그리면 「격자가 제 자리에 찍혔는가 · 글자가 들어갔는가」를 **한 번도 재지
 *    못한 채** 내보내게 된다. 점판은 순수 배열이라 그 검사가 그대로 선다.
 *    (통합 담당·사용자 승인 2026-09-16. 네이티브 의존을 들이지 않기로 함께 정했다.)
 *
 * ⚠ **씨앗 서버의 `tools/mock/label-canvas.mjs`·`label-font.mjs` 와 같은 수를 쓴다** — 점 글꼴
 *    모양과 치수 셈법이 같다. 그쪽은 제품이 아니라 목이고 Node 전용(`node:zlib`)이라 그대로
 *    가져올 수 없어 여기에 제품용으로 다시 세웠다. **글자 모양을 고치면 두 곳을 함께 고친다.**
 *
 * ⛔ **한글을 담지 않는다.** 점 글꼴에 없는 글자는 「빠졌다」는 것이 보이는 채운 사각형으로
 *    나간다 — 조용히 빈칸이 되면 라벨에 값이 없는 것과 구별되지 않는다. 라벨 면에 싣는 값은
 *    코드·번호뿐이고 이름표는 영문 약어를 쓴다(통합 담당 지시 2026-09-16).
 */

/** 글자 한 칸의 점 수. 폭 계산이 전부 이 둘에서 나온다. */
export const GLYPH_W = 5;
export const GLYPH_H = 7;
/** 글자 사이 빈 칸. 0 이면 글자가 붙어 라벨에서 읽히지 않는다. */
export const GLYPH_GAP = 1;

const GLYPHS: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#..##|#...#|#...#|.###.',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '#####|..#..|..#..|..#..|..#..|..#..|#####',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#...#|#...#|#...#|#...#',
  N: '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#...#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|.##..|.#...',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '(': '..##.|.#...|#....|#....|#....|.#...|..##.',
  ')': '.##..|...#.|....#|....#|....#|...#.|.##..',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '%': '##..#|##.#.|...#.|..#..|.#...|#.##.|#..##',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  '*': '.....|#.#.#|.###.|#####|.###.|#.#.#|.....',
  _: '.....|.....|.....|.....|.....|.....|#####',
};

/** 없는 글자는 **빈칸으로 흘리지 않고** 채운 사각형으로 낸다 — 빠진 사실이 눈에 보여야 한다. */
const MISSING = '#####|#...#|#.#.#|#...#|#.#.#|#...#|#####';

const glyphRows = (character: string): string[] =>
  (GLYPHS[character.toUpperCase()] ?? MISSING).split('|');

/** 이 글꼴로 글을 찍었을 때의 점 너비. 자리 배치와 넘침 판정에 쓴다. */
export const textDots = (text: string, scale: number): number =>
  text.length === 0 ? 0 : (text.length * (GLYPH_W + GLYPH_GAP) - GLYPH_GAP) * scale;

/**
 * 흑백 점판. `dots[y * width + x]` 가 `true` 면 검은 점이다.
 *
 * ⚠ 바탕은 흰색(`false`)이다 — 라벨지는 흰 종이다.
 */
export interface LabelBitmap {
  width: number;
  height: number;
  dots: boolean[];
}

export const createBitmap = (width: number, height: number): LabelBitmap => ({
  width,
  height,
  dots: new Array<boolean>(width * height).fill(false),
});

/** 판 밖은 조용히 버린다 — 자리를 잘못 잡아도 라벨 생성이 통째로 멎지 않게 한다. */
const setDot = (bitmap: LabelBitmap, x: number, y: number): void => {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return;

  bitmap.dots[y * bitmap.width + x] = true;
};

export const readDot = (bitmap: LabelBitmap, x: number, y: number): boolean =>
  x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height
    ? false
    : (bitmap.dots[y * bitmap.width + x] ?? false);

/** 속을 채운 사각형. */
export const fillRect = (
  bitmap: LabelBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
): void => {
  for (let dy = 0; dy < height; dy += 1) {
    for (let dx = 0; dx < width; dx += 1) setDot(bitmap, x + dx, y + dy);
  }
};

/** 테두리만. 굵기는 안쪽으로 자란다. */
export const strokeRect = (
  bitmap: LabelBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
  thickness: number,
): void => {
  fillRect(bitmap, x, y, width, thickness);
  fillRect(bitmap, x, y + height - thickness, width, thickness);
  fillRect(bitmap, x, y, thickness, height);
  fillRect(bitmap, x + width - thickness, y, thickness, height);
};

/**
 * 글을 찍는다. `y` 는 **글자 윗변**이다(기준선이 아니다 — 점 글꼴이라 윗변이 셈하기 쉽다).
 *
 * `scale` 은 점 하나를 몇 점으로 키울지다. 1 이면 5×7 그대로라 203dpi 에서 너무 작다.
 */
export const drawText = (
  bitmap: LabelBitmap,
  text: string,
  x: number,
  y: number,
  scale: number,
): void => {
  let cursor = x;

  for (const character of text) {
    const rows = glyphRows(character);

    for (const [rowIndex, row] of rows.entries()) {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] !== '#') continue;

        fillRect(bitmap, cursor + column * scale, y + rowIndex * scale, scale, scale);
      }
    }

    cursor += (GLYPH_W + GLYPH_GAP) * scale;
  }
};

/**
 * 주어진 폭에 들어가는 가장 큰 배율. 넘치면 줄이고, 최소 배율에서도 넘치면 **잘라 낸다.**
 *
 * ⛔ **넘치게 두지 않는다.** 씨앗 라벨이 같은 이유로 자른다 — 넘치면 옆 칸 위로 겹쳐 찍혀
 *    둘 다 못 읽는다(`tools/mock/label-tspl.mjs` 의 `clip`, 실측 2026-09-08 · 실기).
 */
export const fitText = (
  text: string,
  available: number,
  maxScale: number,
  minScale = 2,
): { text: string; scale: number } => {
  for (let scale = maxScale; scale >= minScale; scale -= 1) {
    if (textDots(text, scale) <= available) return { text, scale };
  }

  const perGlyph = (GLYPH_W + GLYPH_GAP) * minScale;
  const fits = Math.max(0, Math.floor((available + GLYPH_GAP * minScale) / perGlyph));

  /* 잘렸다는 사실을 남긴다 — 잘린 값을 온전한 값으로 읽으면 엉뚱한 것을 대조하게 된다. */
  return fits <= 1
    ? { text: text.slice(0, Math.max(0, fits)), scale: minScale }
    : { text: `${text.slice(0, fits - 1)}~`, scale: minScale };
};
