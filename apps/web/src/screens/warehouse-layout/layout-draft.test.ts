import { describe, expect, it } from 'vitest';

import {
  checkDrawingFile,
  DRAWING_MAX_BYTES,
  hasMarker,
  isDirty,
  placeMarker,
  removeMarker,
  toRatio,
  toReplaceBody,
  type LayoutDraft,
} from './layout-draft';

/**
 * 「틀려도 조용한 것」만 시험한다 — 화면은 정상으로 보이면서 값만 틀리는 계산.
 *
 * ⭐ 좌표 비율 변환은 이 부류의 교과서다. 픽셀이 섞이거나 묶이지 않은 값이 나가면 **점이
 * 도면 밖에 그려지거나 창 크기에 따라 자리가 달라지는데, 화면에서는 그럴듯해 보인다.**
 *
 * ⭐ 이 저장은 **집합을 통째로 치환한다**(검증 수준 「중요」 3번 지점). 본문에 빠진 점은
 * 지워지므로, 배치를 본문으로 옮기는 규칙이 틀리면 아무도 지우라고 하지 않은 위치가 사라진다.
 */

describe('toRatio — 밖에서 온 값을 믿지 않는다', () => {
  it('0과 1 사이는 그대로 둔다', () => {
    expect(toRatio(0.42)).toBe(0.42);
  });

  it('⭐ 판 밖으로 나간 값을 묶는다 — 묶지 않으면 도면 밖에 점이 남는다', () => {
    expect(toRatio(-0.3)).toBe(0);
    expect(toRatio(1.7)).toBe(1);
  });

  it('양 끝은 값이다 — 0과 1을 잘라 내지 않는다', () => {
    expect(toRatio(0)).toBe(0);
    expect(toRatio(1)).toBe(1);
  });

  it('수가 아닌 것은 0으로 둔다 — 판 크기가 0이면 나눗셈이 무너진다', () => {
    expect(toRatio(Number.NaN)).toBe(0);
    expect(toRatio(Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('넷째 자리까지 남긴다 — 그보다 잘게 저장해도 화면에서 구분되지 않는다', () => {
    expect(toRatio(0.123456)).toBe(0.1235);
  });
});

describe('placeMarker', () => {
  it('없던 위치는 더한다', () => {
    expect(placeMarker([], 7, 0.5, 0.5)).toEqual([{ locationId: 7, x: 0.5, y: 0.5 }]);
  });

  it('⭐ 이미 찍힌 위치는 두 번 찍지 않고 자리를 옮긴다', () => {
    const draft = placeMarker([{ locationId: 7, x: 0.1, y: 0.1 }], 7, 0.8, 0.9);

    expect(draft).toHaveLength(1);
    expect(draft[0]).toEqual({ locationId: 7, x: 0.8, y: 0.9 });
  });

  it('찍는 자리도 비율로 묶는다', () => {
    expect(placeMarker([], 7, 2, -1)[0]).toEqual({ locationId: 7, x: 1, y: 0 });
  });

  it('옆 위치는 건드리지 않는다', () => {
    const draft = placeMarker([{ locationId: 7, x: 0.1, y: 0.1 }], 8, 0.4, 0.4);

    expect(draft[0]).toEqual({ locationId: 7, x: 0.1, y: 0.1 });
  });
});

describe('hasMarker · removeMarker', () => {
  const draft: LayoutDraft = [
    { locationId: 7, x: 0.1, y: 0.1 },
    { locationId: 8, x: 0.2, y: 0.2 },
  ];

  it('찍힌 것과 아닌 것을 가린다', () => {
    expect(hasMarker(draft, 7)).toBe(true);
    expect(hasMarker(draft, 9)).toBe(false);
  });

  it('뺀 것만 사라진다', () => {
    expect(removeMarker(draft, 7).map((marker) => marker.locationId)).toEqual([8]);
  });
});

describe('isDirty', () => {
  const original: LayoutDraft = [
    { locationId: 7, x: 0.1, y: 0.1 },
    { locationId: 8, x: 0.2, y: 0.2 },
  ];

  it('그대로면 저장할 것이 없다', () => {
    expect(isDirty([...original], original)).toBe(false);
  });

  it('⭐ 점의 순서만 다른 것은 바뀐 것이 아니다', () => {
    expect(isDirty([original[1], original[0]] as LayoutDraft, original)).toBe(false);
  });

  it('자리를 옮기면 바뀐 것이다', () => {
    expect(isDirty([{ locationId: 7, x: 0.9, y: 0.1 }, original[1]] as LayoutDraft, original)).toBe(
      true,
    );
  });

  it('점을 빼면 바뀐 것이다 — 뺀 점은 저장할 때 지워진다', () => {
    expect(isDirty([original[0]] as LayoutDraft, original)).toBe(true);
  });

  it('같은 수의 다른 위치로 바꿔치면 바뀐 것이다', () => {
    expect(isDirty([original[0], { locationId: 9, x: 0.2, y: 0.2 }] as LayoutDraft, original)).toBe(
      true,
    );
  });
});

describe('toReplaceBody', () => {
  it('⭐ 지도에 있는 점만 담는다 — 담기지 않은 위치는 지워진다', () => {
    const body = toReplaceBody(
      [
        { locationId: 7, x: 0.1, y: 0.2 },
        { locationId: 8, x: 0.3, y: 0.4 },
      ],
      null,
    );

    expect(body.markers.map((marker) => marker.locationId)).toEqual([7, 8]);
  });

  it('⭐ 빈 배치도 보낼 수 있는 값이다 — 점을 전부 지우는 뜻이다', () => {
    expect(toReplaceBody([], null).markers).toEqual([]);
  });

  it('⛔ 도면이 없으면 도면 칸을 싣지 않는다 — 비운 것과 「바꾸지 않는다」는 다르다', () => {
    expect('drawingAttachmentId' in toReplaceBody([], null)).toBe(false);
  });

  it('도면이 있으면 그대로 다시 싣는다 — 저장이 도면까지 통째로 바꾼다', () => {
    expect(toReplaceBody([], 42).drawingAttachmentId).toBe(42);
  });

  it('⛔ 위치 이름을 싣지 않는다 — 마스터가 가진 값이다', () => {
    const marker = toReplaceBody([{ locationId: 7, x: 0.1, y: 0.2 }], null).markers[0];

    expect(Object.keys(marker ?? {}).sort()).toEqual(['locationId', 'x', 'y']);
  });

  it('⛔ 점만 있는 초안에서도 도면 id(숫자)를 그대로 싣는다 — 빼면 서버가 도면을 지운다(#1064)', () => {
    const body = toReplaceBody([{ locationId: 7, x: 0.1, y: 0.2 }], 42);

    expect(body.drawingAttachmentId).toBe(42);
    expect(body.markers.map((marker) => marker.locationId)).toEqual([7]);
  });

  it('점만 있는 초안이어도 도면 없음(null)은 도면 칸을 그대로 뺀다', () => {
    const body = toReplaceBody([{ locationId: 7, x: 0.1, y: 0.2 }], null);

    expect('drawingAttachmentId' in body).toBe(false);
  });
});

describe('checkDrawingFile — 올리기 전 사전 검사(최종 판정은 서버)', () => {
  it('png·jpeg 는 통과한다', () => {
    expect(checkDrawingFile({ type: 'image/png', size: 100 })).toBe('ok');
    expect(checkDrawingFile({ type: 'image/jpeg', size: 100 })).toBe('ok');
  });

  it('⛔ webp·gif·빈 형식은 막는다 — 서버가 PNG·JPEG 만 받는다', () => {
    expect(checkDrawingFile({ type: 'image/webp', size: 100 })).toBe('type');
    expect(checkDrawingFile({ type: 'image/gif', size: 100 })).toBe('type');
    expect(checkDrawingFile({ type: '', size: 100 })).toBe('type');
  });

  it('상한(10MB)은 통과, 한 바이트라도 넘으면 막는다', () => {
    expect(checkDrawingFile({ type: 'image/png', size: DRAWING_MAX_BYTES })).toBe('ok');
    expect(checkDrawingFile({ type: 'image/png', size: DRAWING_MAX_BYTES + 1 })).toBe('size');
  });

  it('형식·크기 둘 다 어긋나면 형식부터 알린다', () => {
    expect(checkDrawingFile({ type: 'image/webp', size: DRAWING_MAX_BYTES + 1 })).toBe('type');
  });
});
