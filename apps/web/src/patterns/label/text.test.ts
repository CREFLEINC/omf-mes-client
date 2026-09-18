import { afterEach, describe, expect, it } from 'vitest';

import { GLYPH_H, createBitmap, drawText, readDot, textDots } from './bitmap';
import {
  blit,
  drawLabelText,
  fitLabelText,
  hasTextCanvas,
  headroomOf,
  measureLabelText,
  rasterizeText,
  toDots,
} from './text';

/**
 * 시스템 글꼴 래스터의 감지기.
 *
 * ⚠⚠ **실제 글자 모양은 여기서 검사되지 않는다.** 시험은 jsdom 에서 도는데 그곳에는
 *    `OffscreenCanvas` 가 없다(실측 2026-09-16). 그래서 이 파일이 재는 것은 셋뿐이다 —
 *
 * | 무엇 | 어떻게 |
 * | --- | --- |
 * | Canvas **밖**의 순수한 일(임계값 · 점판에 얹기) | 손으로 만든 화소를 넣어 되읽는다 |
 * | 갈래 판정과 **대체 경로** | Canvas 가 없는 그대로 재고, 있을 때는 가짜 판을 심어 잰다 |
 * | 글자 모양 | ⛔ **못 잰다.** 실기에서 눈으로 본다(통합 담당 승인 2026-09-16) |
 *
 * ⛔ 가짜 판으로 잰 것을 「글꼴이 맞게 그려졌다」로 말하지 않는다 — 배선이 맞다는 것뿐이다.
 */

/** 불투명한 화소 하나. 색은 뜻이 없다 — 알파만 신호다. */
const pixel = (alpha: number, red = 0): number[] => [red, 0, 0, alpha];

const rgba = (rows: number[][][]): Uint8ClampedArray => new Uint8ClampedArray(rows.flat().flat());

interface FakeCall {
  font: string;
  textBaseline: string;
  fillStyle: string;
  text: string;
  at: [number, number];
}

const calls: FakeCall[] = [];

/**
 * 가짜 Canvas — **글자 한 자를 4점 폭의 채운 상자로 그린다.**
 *
 * ⚠ 모양을 흉내 내지 않는다. 이 판이 재는 것은 「부르는 쪽이 판을 열고, 글꼴·기준선을 세우고,
 *   받은 화소를 점판으로 옮겨 얹는가」뿐이다.
 */
const installFakeCanvas = (glyphWidth = 4): void => {
  class FakeCanvas {
    width: number;
    height: number;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }

    getContext(kind: string): unknown {
      if (kind !== '2d') return null;

      void this;

      const context = {
        font: '',
        textBaseline: '',
        fillStyle: '',
        clearRect: () => undefined,
        measureText: (text: string) => ({ width: text.length * glyphWidth }),
        fillText: (text: string, x: number, y: number) => {
          calls.push({
            font: context.font,
            textBaseline: context.textBaseline,
            fillStyle: context.fillStyle,
            text,
            at: [x, y],
          });
        },
        getImageData(_x: number, _y: number, width: number, height: number) {
          const data = new Uint8ClampedArray(width * height * 4);

          /* 글자 자리를 위 두 줄만 채워 둔다 — 「어디에 얹혔나」를 되읽을 수 있게. */
          for (let row = 0; row < Math.min(2, height); row += 1) {
            for (let column = 0; column < width; column += 1) {
              data[(row * width + column) * 4 + 3] = 255;
            }
          }

          return { data };
        },
      };

      return context;
    }
  }

  (globalThis as { OffscreenCanvas?: unknown }).OffscreenCanvas = FakeCanvas;
};

afterEach(() => {
  Reflect.deleteProperty(globalThis as object, 'OffscreenCanvas');
  calls.length = 0;
});

describe('화소를 점으로 — 임계값', () => {
  it('불투명한 자리만 검어진다', () => {
    const bitmap = toDots(rgba([[pixel(255), pixel(0), pixel(255)]]), 3, 1);

    expect([readDot(bitmap, 0, 0), readDot(bitmap, 1, 0), readDot(bitmap, 2, 0)]).toEqual([
      true,
      false,
      true,
    ]);
  });

  /*
   * ⚠ **가장자리는 반투명으로 흐려진다**(안티에일리어싱). 문턱을 어디 두느냐로 획이 통통해지거나
   *   끊긴다 — 203dpi 라벨에서는 끊기는 쪽이 더 위험하다.
   */
  it('문턱 이상이면 검다 — 경계값을 포함한다', () => {
    const data = rgba([[pixel(95), pixel(96), pixel(97)]]);
    const bitmap = toDots(data, 3, 1, 96);

    expect([readDot(bitmap, 0, 0), readDot(bitmap, 1, 0), readDot(bitmap, 2, 0)]).toEqual([
      false,
      true,
      true,
    ]);
  });

  /* ⛔ 색을 보지 않는다 — 글자는 투명 바탕에 그리므로 알파만이 신호다. */
  it('색은 보지 않는다', () => {
    const opaqueWhite = toDots(rgba([[pixel(255, 255)]]), 1, 1);
    const opaqueBlack = toDots(rgba([[pixel(255, 0)]]), 1, 1);

    expect(opaqueWhite.dots).toEqual(opaqueBlack.dots);
  });

  it('줄과 칸을 제 자리에 옮긴다', () => {
    const bitmap = toDots(
      rgba([
        [pixel(0), pixel(255)],
        [pixel(255), pixel(0)],
      ]),
      2,
      2,
    );

    expect(readDot(bitmap, 1, 0)).toBe(true);
    expect(readDot(bitmap, 0, 1)).toBe(true);
    expect(bitmap.dots.filter(Boolean)).toHaveLength(2);
  });
});

describe('점판에 얹기', () => {
  const source = (): ReturnType<typeof createBitmap> => {
    const bitmap = createBitmap(2, 2);
    bitmap.dots[0] = true;
    bitmap.dots[3] = true;

    return bitmap;
  };

  it('검은 점만 옮긴다 — 흰 점으로 남의 점을 지우지 않는다', () => {
    const target = createBitmap(4, 4);
    target.dots[1] = true;

    blit(target, source(), 0, 0);

    /* 원래 있던 (1,0) 이 살아 있어야 한다 — 원본의 그 자리는 흰 점이다. */
    expect(readDot(target, 1, 0)).toBe(true);
    expect(readDot(target, 0, 0)).toBe(true);
    expect(readDot(target, 1, 1)).toBe(true);
  });

  it('자리를 옮겨 얹는다', () => {
    const target = createBitmap(6, 6);
    blit(target, source(), 3, 2);

    expect(readDot(target, 3, 2)).toBe(true);
    expect(readDot(target, 4, 3)).toBe(true);
    expect(target.dots.filter(Boolean)).toHaveLength(2);
  });

  /* 판 밖은 조용히 버린다 — 옆줄로 새면 라벨 반대편에 점이 찍힌다. */
  it('판 밖으로 나간 것은 버리고 옆줄로 새지 않는다', () => {
    const target = createBitmap(4, 4);

    blit(target, source(), 3, 3);
    blit(target, source(), -1, -1);

    expect(readDot(target, 3, 3)).toBe(true);
    expect(readDot(target, 0, 0)).toBe(true);
    expect(target.dots.filter(Boolean)).toHaveLength(2);
  });
});

describe('갈래 판정', () => {
  /* 시험 환경에는 Canvas 가 없다 — 그것이 정상이고, 던지지 않아야 한다. */
  it('Canvas 가 없으면 없다고 답한다 — 던지지 않는다', () => {
    expect(hasTextCanvas()).toBe(false);
    expect(rasterizeText('가나다', 4)).toBeNull();
  });

  it('Canvas 가 있으면 있다고 답한다', () => {
    installFakeCanvas();

    expect(hasTextCanvas()).toBe(true);
  });
});

describe('대체 경로 — Canvas 가 없을 때', () => {
  it('너비를 점 글꼴 기준으로 잰다', () => {
    expect(measureLabelText('AB', 3)).toBe(textDots('AB', 3));
  });

  it('점 글꼴로 찍는다 — 같은 자리에 같은 점이 놓인다', () => {
    const drawn = createBitmap(60, 40);
    const expected = createBitmap(60, 40);

    drawLabelText(drawn, 'AB', 4, 5, 3);
    drawText(expected, 'AB', 4, 5, 3);

    expect(drawn.dots).toEqual(expected.dots);
  });

  it('폭 맞추기도 점 글꼴 규약을 따른다', () => {
    const fitted = fitLabelText('ABCDEFGH', 50, 5);

    expect(fitted.scale).toBe(2);
    expect(textDots(fitted.text, fitted.scale)).toBeLessThanOrEqual(50);
  });
});

describe('Canvas 경로 — 배선', () => {
  it('글꼴 크기는 배율을 따르고 기준선은 «윗변»이다', () => {
    installFakeCanvas();

    drawLabelText(createBitmap(40, 20), '가', 0, 0, 3);

    const call = calls.at(-1);
    expect(call?.font).toBe(`${String(GLYPH_H * 3)}px sans-serif`);
    /* ⛔ 기준선을 바꾸면 글이 점 글꼴 줄과 어긋나 한 줄만 아래로 내려앉는다. */
    expect(call?.textBaseline).toBe('top');
    expect(call?.at).toEqual([0, 0]);
  });

  it('너비를 시스템 글꼴 기준으로 잰다 — 점 글꼴 너비와 다르다', () => {
    installFakeCanvas(4);

    /* 가짜 판은 한 자를 4점으로 잰다. 점 글꼴은 같은 배율에서 더 넓다. */
    expect(measureLabelText('ABC', 3)).toBe(12);
    expect(measureLabelText('ABC', 3)).not.toBe(textDots('ABC', 3));
  });

  it('받은 화소를 그 자리에 얹는다', () => {
    installFakeCanvas(2);
    const bitmap = createBitmap(40, 20);

    drawLabelText(bitmap, 'AB', 5, 6, 2);

    /* 가짜 판은 위 두 줄을 채운다 — 폭은 2자 × 2점 = 4. */
    expect(readDot(bitmap, 5, 6)).toBe(true);
    expect(readDot(bitmap, 8, 7)).toBe(true);
    expect(readDot(bitmap, 9, 6)).toBe(false);
    expect(readDot(bitmap, 5, 8)).toBe(false);
  });

  /*
   * ⛔ **비례 글꼴은 글자마다 폭이 다르다** — 셈으로는 자를 자리를 못 정한다. 한 글자씩 줄이며
   *    재야 하고, 자른 뒤에도 **반드시 주어진 폭 안에** 들어가야 한다.
   */
  it('넘치면 한 글자씩 줄이며 재고, 잘린 사실을 `~` 로 남긴다', () => {
    installFakeCanvas(4);

    const fitted = fitLabelText('ABCDEFGHIJ', 20, 4);

    expect(fitted.text.endsWith('~')).toBe(true);
    expect(measureLabelText(fitted.text, fitted.scale)).toBeLessThanOrEqual(20);
  });

  it('한 글자도 못 들어가면 빈 글이 된다', () => {
    installFakeCanvas(4);

    expect(fitLabelText('ABCDEFGH', 3, 4).text).toBe('');
  });

  it('빈 글은 아무것도 찍지 않는다', () => {
    installFakeCanvas();
    const bitmap = createBitmap(20, 20);

    drawLabelText(bitmap, '', 0, 0, 3);

    expect(bitmap.dots.filter(Boolean)).toHaveLength(0);
  });
});

/* 윗변 위로 넘치는 한글 획을 담을 여백(omf-all-around#9 · HT800 실기에서 윗획이 깎였다). */
describe('headroomOf', () => {
  it('글꼴 값과 잉크 값 중 큰 쪽을 올림하고 1점을 더한다', () => {
    expect(
      headroomOf({ width: 10, actualBoundingBoxAscent: 1.24, fontBoundingBoxAscent: 3.75 }),
    ).toBe(5);
    expect(
      headroomOf({ width: 10, actualBoundingBoxAscent: 6.1, fontBoundingBoxAscent: 3.75 }),
    ).toBe(8);
  });

  it('값이 없거나 음수면(획이 윗변 아래) 1점만 둔다', () => {
    expect(headroomOf({ width: 10 })).toBe(1);
    expect(
      headroomOf({ width: 10, actualBoundingBoxAscent: -0.6, fontBoundingBoxAscent: -1 }),
    ).toBe(1);
  });
});
