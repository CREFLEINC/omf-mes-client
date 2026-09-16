import { encodeQr } from '@omf-mes/ui';
import { describe, expect, it } from 'vitest';

import { readDot } from '../../patterns/label/bitmap';

import { toPackingLabelContents, toPackingLabelFields } from './packing-label-fields';
import { drawPackingLabel, type PackingLabelFields } from './packing-label-image';

/**
 * 포장 라벨을 **POP 이 스스로 그린다.** 서버가 그려 주지 않으므로 틀려도 서버 쪽에서 걸릴
 * 자리가 없다 — 이 감지기들이 유일한 그물이다.
 *
 * ⭐ **점판을 직접 들여다본다.** 「그리기 함수를 불렀다」는 **빈 라벨도 통과시킨다.**
 */

const FIELDS: PackingLabelFields = {
  handlingUnitNo: 'HU-20260916-0002',
  shipmentNo: 'SH-20260916-0003',
  issueSeq: 1,
  contents: [{ itemCode: 'F534F50200', lotNo: 'SEED-S240-0001', quantity: '240 EA' }],
};

const dotCount = (bitmap: ReturnType<typeof drawPackingLabel>): number =>
  bitmap.dots.filter(Boolean).length;

describe('포장 라벨 — 점판', () => {
  it('서식 크기는 다른 라벨과 같은 자를 쓴다', () => {
    const bitmap = drawPackingLabel(FIELDS);

    expect([bitmap.width, bitmap.height]).toEqual([639, 240]);
  });

  it('테두리가 네 변에 선다', () => {
    const bitmap = drawPackingLabel(FIELDS);

    expect(readDot(bitmap, 0, 0)).toBe(true);
    expect(readDot(bitmap, bitmap.width - 1, bitmap.height - 1)).toBe(true);
  });

  /*
   * ⭐ **QR 이 담는 것은 취급 단위 번호 «원문»이다**(설계 §8). 출하 단위 구성(P-04-05)이 이
   *    값을 그대로 스캔해 상자를 등록한다 — 접두어를 붙이거나 다듬으면 그 화면이 못 읽는다.
   */
  it('QR 격자가 취급 단위 번호 원문만큼 찍힌다', () => {
    const bitmap = drawPackingLabel(FIELDS);
    const expected = encodeQr(FIELDS.handlingUnitNo).modules.flat().filter(Boolean).length;

    /* QR 은 오른쪽 위 구획에 선다 — 그 안의 검은 칸 수가 격자와 맞아야 한다. */
    let dark = 0;
    for (let y = 3; y < 110; y += 1) {
      for (let x = 520; x < bitmap.width - 3; x += 1) {
        if (readDot(bitmap, x, y)) dark += 1;
      }
    }

    /* 칸이 여러 점으로 커지므로 «배수»로 맞는다. */
    expect(dark).toBeGreaterThan(0);
    expect(dark % expected).toBe(0);
  });

  it('다른 상자면 QR 도 달라진다 — 번호를 안 싣고 있으면 여기서 걸린다', () => {
    const one = drawPackingLabel(FIELDS);
    const other = drawPackingLabel({ ...FIELDS, handlingUnitNo: 'HU-20260916-0009' });

    expect(other.dots).not.toEqual(one.dots);
  });

  it('회차가 오르면 라벨이 달라진다 — K-6 은 회차를 인쇄면에 싣는다', () => {
    const first = drawPackingLabel(FIELDS);
    const second = drawPackingLabel({ ...FIELDS, issueSeq: 2 });

    expect(second.dots).not.toEqual(first.dots);
  });

  it('출하 번호가 달라지면 라벨도 달라진다', () => {
    const one = drawPackingLabel(FIELDS);
    const other = drawPackingLabel({ ...FIELDS, shipmentNo: 'SH-20260916-0099' });

    expect(other.dots).not.toEqual(one.dots);
  });

  it('내용물이 없어도 그린다 — 빈 상자도 라벨이 붙는다', () => {
    const bitmap = drawPackingLabel({ ...FIELDS, contents: [] });

    expect(dotCount(bitmap)).toBeGreaterThan(0);
  });

  /*
   * ⛔⛔ **넘친 내용물을 말없이 버리지 않는다.** 라벨에 적힌 것이 상자의 전부라고 읽히면
   *    현장에서 대조가 어긋난다. 그리고 넘칠 때 **마지막 줄에 덧그리지 않는다** — 점판은
   *    지우지 않으므로 두 글이 겹쳐 둘 다 못 읽는다.
   */
  it('내용물이 자리보다 많으면 몇 개가 더 있는지 «수»로 말한다', () => {
    const many = Array.from({ length: 7 }, (_, index) => ({
      itemCode: `ITEM-${String(index)}`,
      lotNo: `LOT-${String(index)}`,
      quantity: '10 EA',
    }));

    const bitmap = drawPackingLabel({ ...FIELDS, contents: many });
    const three = drawPackingLabel({ ...FIELDS, contents: many.slice(0, 3) });

    /* 세 줄이 다 찬 판과 달라야 한다 — 마지막 줄이 안내로 바뀌었기 때문이다. */
    expect(bitmap.dots).not.toEqual(three.dots);
    expect(dotCount(bitmap)).toBeGreaterThan(0);
  });

  it('내용물이 딱 세 줄이면 안내를 넣지 않는다', () => {
    const three = Array.from({ length: 3 }, (_, index) => ({
      itemCode: `ITEM-${String(index)}`,
      lotNo: `LOT-${String(index)}`,
      quantity: '10 EA',
    }));
    const four = [...three, { itemCode: 'ITEM-3', lotNo: 'LOT-3', quantity: '10 EA' }];

    expect(drawPackingLabel({ ...FIELDS, contents: four }).dots).not.toEqual(
      drawPackingLabel({ ...FIELDS, contents: three }).dots,
    );
  });

  /* 아주 긴 값이 들어와도 판을 벗어나지 않는다 — 벗어나면 옆 칸 위로 겹쳐 찍힌다. */
  it('긴 번호가 들어와도 라벨 안에 머문다', () => {
    const bitmap = drawPackingLabel({
      ...FIELDS,
      handlingUnitNo: 'HU-2026'.repeat(10),
      shipmentNo: 'SH-2026'.repeat(10),
    });

    /*
     * 테두리 «바로 안»의 열은 여백이라 늘 비어 있어야 한다. 테두리 두께가 2 이므로 그 열은
     * `width - 3` 이고, 거기 검은 점이 있으면 글이 여백을 넘어 흘렀다는 뜻이다.
     * (위아래 두 줄은 테두리가 폭 전체를 가로지르므로 검은 것이 맞다.)
     */
    const margin = bitmap.width - 3;

    for (let y = 0; y < bitmap.height; y += 1) {
      expect(readDot(bitmap, margin, y)).toBe(y < 2 || y >= bitmap.height - 2);
    }
  });
});

describe('포장 라벨 — 값 모으기', () => {
  const ALLOCATIONS = [
    { handlingUnitId: 7001, itemCode: 'A-1', lotNo: 'LOT-1', allocatedQty: 240, uomId: 1 },
    { handlingUnitId: 7002, itemCode: 'B-2', lotNo: 'LOT-2', allocatedQty: 120, uomId: 1 },
    { handlingUnitId: 7001, itemCode: 'C-3', lotNo: null, allocatedQty: 10, uomId: 2 },
  ];

  const uomCodeOf = (uomId: number): string | null => (uomId === 1 ? 'EA' : null);

  /*
   * ⛔⛔ **남의 상자 내용을 싣지 않는다.** 배분 목록은 출하 전체를 담는다 — 거르지 않으면
   *    이 상자에 없는 물건이 라벨에 적히고, 현장은 그것을 찾다가 상자를 다시 연다.
   */
  it('이 상자에 담긴 것만 싣는다', () => {
    const contents = toPackingLabelContents(ALLOCATIONS, 7001, uomCodeOf);

    expect(contents.map((each) => each.itemCode)).toEqual(['A-1', 'C-3']);
  });

  it('LOT 번호가 없으면 그 사실을 적는다 — 빈칸으로 두지 않는다', () => {
    const contents = toPackingLabelContents(ALLOCATIONS, 7001, uomCodeOf);

    expect(contents[1]?.lotNo).toBe('-');
  });

  /*
   * ⛔ **단위를 지어내지 않는다.** 늘 `EA` 로 떨어뜨리면 현장이 그 말을 믿는다 — 상자 안이
   *    박스 단위인데 낱개로 읽히면 수량 대조가 통째로 어긋난다.
   */
  it('단위를 풀었으면 붙이고, 못 풀었으면 수만 적는다', () => {
    const contents = toPackingLabelContents(ALLOCATIONS, 7001, uomCodeOf);

    expect(contents[0]?.quantity).toBe('240 EA');
    expect(contents[1]?.quantity).toBe('10');
  });

  it('상자에 배분이 하나도 없으면 빈 목록이다', () => {
    expect(toPackingLabelContents(ALLOCATIONS, 9999, uomCodeOf)).toEqual([]);
  });

  it('회차와 번호를 그대로 옮긴다', () => {
    const fields = toPackingLabelFields({
      handlingUnitId: 7001,
      handlingUnitNo: 'HU-1',
      shipmentNo: 'SH-1',
      issueSeq: 3,
      allocations: ALLOCATIONS,
      uomCodeOf,
    });

    expect(fields).toMatchObject({ handlingUnitNo: 'HU-1', shipmentNo: 'SH-1', issueSeq: 3 });
    expect(fields.contents).toHaveLength(2);
  });
});
