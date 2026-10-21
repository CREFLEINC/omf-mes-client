/**
 * 라벨에 **점 글꼴이 없는 글자**를 찍는다 — 시스템 글꼴로 그려 1비트 점판에 얹는다.
 *
 * ⭐ **왜 필요한가.** 납품 라벨은 고객·납품처 «이름»을 싣는다(사용자 필수 항목). 이름은
 *    한국어·베트남어라 5×7 점 글꼴(`./bitmap`)에 없고, 없는 글자는 **채운 상자**로 나간다 —
 *    한 줄이 통째로 까맣게 찍힌다. 그 글자들을 찍으려면 글꼴이 있는 쪽에 그리게 하는 수밖에
 *    없고, POP 렌더러에는 Canvas 가 있다.
 *
 * ⛔ **점 글꼴을 대체하지 않는다.** 코드·번호는 그대로 점 글꼴이 찍는다 — 그쪽이 또렷하고,
 *    무엇보다 **시험이 점 단위로 되읽을 수 있다.** 이 파일은 「이름을 실어야 하는 줄」만 맡는다.
 *
 * ⚠⚠ **Canvas 갈래는 시험이 닿지 못한다.** 시험은 jsdom 에서 도는데 그곳에는 Canvas 구현이
 *    없어 늘 점 글꼴 갈래로 떨어진다. 그래서 이 파일은 **Canvas 밖의 순수한 일**(임계값 ·
 *    점판에 얹기 · 갈래 판정)을 따로 떼어 두었다 — 그 부분은 손으로 만든 화소를 넣어 되읽기로
 *    검사한다. **실제 글자 모양은 미검증이다**(통합 담당 승인 2026-09-16 · 실기에서 눈으로
 *    본다). ⛔ 그 사실을 「검사됐다」로 말하지 않는다.
 *
 * ⚠ 비ASCII 는 검증하지 않는다 — 단말에 글꼴이 없어 깨지면 깨진 대로 둔다(사용자 결정).
 */

import { GLYPH_H, createBitmap, drawText, fitText, textDots, type LabelBitmap } from './bitmap';

/**
 * 「검다」로 볼 불투명도. 글자는 투명 바탕에 검게 그리므로 **알파가 곧 신호**다.
 *
 * ⚠ 가장자리는 반투명으로 흐려진다(안티에일리어싱). 낮게 잡으면 글자가 통통해지고 높게
 *   잡으면 가늘어져 끊긴다 — 203dpi 라벨에서 가는 쪽이 더 위험하다(획이 사라진다).
 */
const DEFAULT_THRESHOLD = 96;

/** 점 글꼴과 같은 배율 말을 쓴다 — 부르는 쪽이 두 갈래를 같은 단위로 다룰 수 있게. */
const fontSizeOf = (scale: number): number => GLYPH_H * scale;

/** 내림·올림 획까지 담을 세로 여유. 잘리면 글자 아래가 뭉개진다. */
const RASTER_HEIGHT_RATIO = 1.4;

/**
 * 글꼴 목록. **이름을 지정하지 않는다** — 단말마다 깔린 글꼴이 다르고, 없는 글꼴을 적으면
 * 브라우저가 알아서 대체하되 그 결과를 우리가 고를 수 없다. 시스템 기본에 맡긴다.
 */
const FONT_FAMILY = 'sans-serif';

/** `measureText` 가 내는 값 중 여기서 쓰는 것. 옛 구현에는 높이 값이 없을 수 있다. */
interface TextMetricsLike {
  width: number;
  actualBoundingBoxAscent?: number;
  actualBoundingBoxDescent?: number;
  fontBoundingBoxAscent?: number;
}

interface TextContext {
  measureText: (text: string) => TextMetricsLike;
  fillText: (text: string, x: number, y: number) => void;
  getImageData: (x: number, y: number, width: number, height: number) => { data: Uint8ClampedArray };
  clearRect: (x: number, y: number, width: number, height: number) => void;
  font: string;
  textBaseline: string;
  fillStyle: string;
}

interface TextCanvas {
  width: number;
  height: number;
  context: TextContext;
}

/**
 * 글을 그릴 판을 연다. **없으면 `null`** — 없는 것이 오류가 아니다(시험 환경 · 브라우저).
 *
 * ⛔ **`OffscreenCanvas` «만» 본다.** POP 은 Electron(Chromium) 렌더러라 늘 있다. 한때
 *    `document.createElement('canvas')` 로도 물러섰는데, jsdom 이 그 자리에서
 *    **「Not implemented」를 호출마다 콘솔에 뱉어** 시험 출력이 그 소리로 덮였다. 닿지도 않는
 *    갈래를 위해 매 라벨마다 소리를 내지 않는다 — 없으면 점 글꼴로 간다.
 *
 * ⛔ **던지지 않는다.** 판을 못 열어 라벨 생성이 통째로 멎으면 **점 글꼴로 찍을 수 있는 줄까지
 *    못 찍는다.**
 */
const openCanvas = (width: number, height: number): TextCanvas | null => {
  const factory = (globalThis as { OffscreenCanvas?: new (w: number, h: number) => unknown })
    .OffscreenCanvas;

  if (factory === undefined) return null;

  try {
    const sized = new factory(width, height) as {
      width: number;
      height: number;
      getContext: (kind: string) => unknown;
    };
    sized.width = width;
    sized.height = height;

    const context = sized.getContext('2d') as TextContext | null;

    /* 판은 섰는데 글을 못 그리는 구현이 있다 — 쓸 함수가 실제로 있는지 본다. */
    if (
      context === null ||
      typeof context.fillText !== 'function' ||
      typeof context.getImageData !== 'function' ||
      typeof context.measureText !== 'function'
    ) {
      return null;
    }

    return { width, height, context };
  } catch {
    return null;
  }
};

/** 시스템 글꼴로 글을 찍을 수 있는 자리인가. 화면이 갈래를 물을 때 쓴다. */
export const hasTextCanvas = (): boolean => openCanvas(1, 1) !== null;

/**
 * Canvas 가 낸 RGBA 화소를 **1비트 점판**으로 바꾼다.
 *
 * ⭐ **이 함수는 Canvas 를 모른다.** 그래서 시험이 손으로 만든 화소를 넣어 되읽을 수 있다 —
 *    Canvas 갈래에서 시험이 닿는 유일한 자리다.
 *
 * ⚠ 알파만 본다(네 바이트 중 넷째). 글자를 투명 바탕에 검게 그리므로 색은 뜻이 없다.
 */
export const toDots = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = DEFAULT_THRESHOLD,
): LabelBitmap => {
  const bitmap = createBitmap(width, height);

  for (let index = 0; index < width * height; index += 1) {
    const alpha = rgba[index * 4 + 3] ?? 0;

    if (alpha >= threshold) bitmap.dots[index] = true;
  }

  return bitmap;
};

/**
 * 점판을 다른 점판 위에 얹는다. **검은 점만 옮긴다** — 흰 점을 옮기면 이미 그려진 것을 지운다.
 *
 * 판 밖은 조용히 버린다(`bitmap.ts` 의 `fillRect` 와 같은 태도).
 */
export const blit = (target: LabelBitmap, source: LabelBitmap, x: number, y: number): void => {
  for (let sy = 0; sy < source.height; sy += 1) {
    for (let sx = 0; sx < source.width; sx += 1) {
      if (source.dots[sy * source.width + sx] !== true) continue;

      const tx = x + sx;
      const ty = y + sy;

      if (tx < 0 || ty < 0 || tx >= target.width || ty >= target.height) continue;

      target.dots[ty * target.width + tx] = true;
    }
  }
};

/**
 * 글 한 줄을 **글꼴 크기(px)·글꼴 목록을 정해** 그려 점판으로 낸다. Canvas 가 없으면 `null`.
 *
 * ⭐ 배율이 아니라 px 로 받는 자리다 — TSPL 글줄(point)을 같은 높이의 그림으로 바꿀 때 쓴다
 *    (`pop-location-label` · omf-all-around#9). 점 글꼴 배율을 쓰는 곳은 아래 `rasterizeText` 다.
 */
/** 글 윗변 위로 둔 여백만큼 아래로 내려 그린 점판 — `rise` 가 그 여백(점)이다. */
export type LabelTextRaster = LabelBitmap & { rise: number };

/**
 * 글 윗변(`textBaseline = 'top'`) 위로 **획이 넘치는 만큼**의 여백(점).
 *
 * ⭐ 한글 글꼴은 획이 윗변보다 위로 올라간다 — 윗변을 점판 0 행에 두면 그 획이 판 밖이라
 *    **윗부분이 평평하게 깎였다**(HT800 실기 2026-09-18 · omf-all-around#9. Chromium 실측:
 *    「A구역」 잉크가 윗변 위 1.24px · 글꼴 전체로는 3.75px). 글꼴 값(`fontBoundingBoxAscent`)과
 *    실제 잉크 값 중 큰 쪽에 1점을 더한다 — 단말마다 글꼴이 달라 한쪽만 믿지 않는다.
 */
export const headroomOf = (metrics: TextMetricsLike): number =>
  Math.ceil(Math.max(0, metrics.actualBoundingBoxAscent ?? 0, metrics.fontBoundingBoxAscent ?? 0)) +
  1;

export const rasterizeTextWithFont = (
  text: string,
  fontPx: number,
  family: string,
  /** 켜면 윗변 위로 넘치는 획을 담을 여백을 판 위에 둔다(`rise`). 끄면 예전과 같다. */
  headroom = false,
): LabelTextRaster | null => {
  if (text === '') return { ...createBitmap(0, 0), rise: 0 };

  const probe = openCanvas(1, Math.ceil(fontPx * RASTER_HEIGHT_RATIO));

  if (probe === null) return null;

  probe.context.font = `${String(fontPx)}px ${family}`;
  /* ⚠ 여백을 재는 기준도 그리는 기준과 같은 윗변이어야 한다. */
  probe.context.textBaseline = 'top';
  const metrics = probe.context.measureText(text);
  const width = Math.ceil(metrics.width);
  const rise = headroom ? headroomOf(metrics) : 0;
  const height =
    rise +
    Math.ceil(
      Math.max(
        fontPx * RASTER_HEIGHT_RATIO,
        headroom ? (metrics.actualBoundingBoxDescent ?? 0) + 1 : 0,
      ),
    );

  if (width <= 0) return { ...createBitmap(0, 0), rise: 0 };

  const canvas = openCanvas(width, height);

  if (canvas === null) return null;

  canvas.context.clearRect(0, 0, width, height);
  canvas.context.font = `${String(fontPx)}px ${family}`;
  /* ⚠ `y` 를 **윗변**으로 다룬다 — 점 글꼴의 `drawText` 와 같은 약속이다(기준선이 아니다). */
  canvas.context.textBaseline = 'top';
  canvas.context.fillStyle = '#000';
  canvas.context.fillText(text, 0, rise);

  return { ...toDots(canvas.context.getImageData(0, 0, width, height).data, width, height), rise };
};

/** 글 한 줄을 시스템 글꼴로 그려 점판으로 낸다. Canvas 가 없으면 `null`. */
export const rasterizeText = (text: string, scale: number): LabelBitmap | null =>
  rasterizeTextWithFont(text, fontSizeOf(scale), FONT_FAMILY);

/** 없는 글자를 그리면 나오는 모양의 기준 — 어느 글꼴에도 없을 비문자(U+FFFF). */
const MISSING_GLYPH = String.fromCharCode(0xffff);

/**
 * 이 글꼴 목록이 `probe` 글자를 **진짜 글자로** 그리는가.
 *
 * ⭐ 글꼴이 없으면 브라우저는 오류 없이 네모(없는 글자 모양)를 그린다. 그래서 `probe` 와
 *    비문자를 같은 크기로 그려 **점판이 같으면 없는 것**으로 본다. Canvas 가 없으면 `false`.
 */
export const canDrawGlyph = (probe: string, family: string, fontPx = 24): boolean => {
  const drawn = rasterizeTextWithFont(probe, fontPx, family);
  const missing = rasterizeTextWithFont(MISSING_GLYPH, fontPx, family);

  if (drawn === null || missing === null) return false;
  if (!drawn.dots.some(Boolean)) return false;

  return (
    drawn.width !== missing.width ||
    drawn.height !== missing.height ||
    drawn.dots.some((dot, index) => dot !== missing.dots[index])
  );
};

/**
 * 글 한 줄의 **점 너비**. Canvas 가 있으면 시스템 글꼴 기준, 없으면 점 글꼴 기준이다.
 *
 * ⚠ 두 갈래의 너비가 다르다 — 그래서 자리 계산은 **늘 이 함수를 거쳐야** 한다. 한쪽만 보고
 *   자리를 잡으면 다른 단말에서 글이 옆 칸으로 흘러넘친다.
 */
export const measureLabelText = (text: string, scale: number): number => {
  const raster = rasterizeText(text, scale);

  return raster === null ? textDots(text, scale) : raster.width;
};

/**
 * 주어진 폭에 들어가는 가장 큰 배율 — `fitText` 의 시스템 글꼴 판.
 *
 * ⛔ **넘치게 두지 않는다.** 최소 배율에서도 넘치면 잘라 내고 잘린 사실을 `~` 로 남긴다
 *    (점 글꼴과 같은 규약). 넘치면 옆 칸 위로 겹쳐 찍혀 둘 다 못 읽는다.
 */
export const fitLabelText = (
  text: string,
  available: number,
  maxScale: number,
  minScale = 2,
): { text: string; scale: number } => {
  if (!hasTextCanvas()) return fitText(text, available, maxScale, minScale);

  for (let scale = maxScale; scale >= minScale; scale -= 1) {
    if (measureLabelText(text, scale) <= available) return { text, scale };
  }

  /* 글자마다 폭이 달라(비례 글꼴) 한 글자씩 줄이며 재 본다 — 셈으로는 자를 자리를 못 정한다. */
  for (let length = text.length - 1; length > 0; length -= 1) {
    const cut = `${text.slice(0, length)}~`;

    if (measureLabelText(cut, minScale) <= available) return { text: cut, scale: minScale };
  }

  return { text: '', scale: minScale };
};

/**
 * 글 한 줄을 점판에 찍는다 — **시스템 글꼴이 있으면 그것으로, 없으면 점 글꼴로.**
 *
 * ⚠ `y` 는 글자 **윗변**이다(두 갈래 모두).
 */
export const drawLabelText = (
  bitmap: LabelBitmap,
  text: string,
  x: number,
  y: number,
  scale: number,
): void => {
  const raster = rasterizeText(text, scale);

  if (raster === null) {
    drawText(bitmap, text, x, y, scale);

    return;
  }

  blit(bitmap, raster, x, y);
};
