import { encodeQr } from '@omf-mes/ui';
import { describe, expect, it } from 'vitest';

import { readDot } from '../../patterns/label/bitmap';

import { toDeliveryLabelFields } from './delivery-label-fields';
import { drawDeliveryLabel, type DeliveryLabelFields } from './delivery-label-image';
import type { ShippingUnitDetail } from './types';

/**
 * 납품 라벨을 **POP 이 스스로 그린다.** 서버가 그려 주지 않으므로 틀려도 서버 쪽에서 걸릴
 * 자리가 없다 — 이 감지기들이 유일한 그물이다.
 *
 * ⚠⚠ **이름 줄의 «글자 모양»은 여기서 검사되지 않는다.** 시험 환경에 Canvas 가 없어 시스템
 *    글꼴 갈래로 가지 못한다(`patterns/label/text` 머리말). 여기서 재는 것은 자리·접기·QR 이고,
 *    글자 모양은 실기에서 눈으로 본다.
 */

const FIELDS: DeliveryLabelFields = {
  shippingUnitNo: 'SU-20260916-0001',
  customer: { partnerCode: '100003', partnerName: 'Cong doan Samjin' },
  shipTo: { partnerCode: '901463', partnerName: 'Ha Noi DC' },
  boxCount: 4,
  issueSeq: 1,
  itemTotals: [{ itemCode: 'F534F50200', itemName: 'COVER', quantity: '480 EA' }],
};

const dotCount = (bitmap: ReturnType<typeof drawDeliveryLabel>): number =>
  bitmap.dots.filter(Boolean).length;

describe('납품 라벨 — 점판', () => {
  it('서식 크기는 다른 라벨과 같은 자를 쓴다', () => {
    const bitmap = drawDeliveryLabel(FIELDS);

    expect([bitmap.width, bitmap.height]).toEqual([639, 240]);
  });

  it('테두리가 네 변에 선다', () => {
    const bitmap = drawDeliveryLabel(FIELDS);

    expect(readDot(bitmap, 0, 0)).toBe(true);
    expect(readDot(bitmap, bitmap.width - 1, bitmap.height - 1)).toBe(true);
  });

  /*
   * ⭐ **QR 은 출하 단위 번호 «원문»이다**(설계 §8). 역추적이 이 값에서 시작한다 — 접두어를
   *    붙이거나 다듬으면 되짚는 길이 끊긴다.
   */
  it('QR 격자가 출하 단위 번호 원문만큼 찍힌다', () => {
    const bitmap = drawDeliveryLabel(FIELDS);
    const expected = encodeQr(FIELDS.shippingUnitNo).modules.flat().filter(Boolean).length;

    let dark = 0;
    for (let y = 3; y < 125; y += 1) {
      for (let x = 520; x < bitmap.width - 3; x += 1) {
        if (readDot(bitmap, x, y)) dark += 1;
      }
    }

    expect(dark).toBeGreaterThan(0);
    expect(dark % expected).toBe(0);
  });

  it('다른 단위면 QR 도 달라진다', () => {
    const other = drawDeliveryLabel({ ...FIELDS, shippingUnitNo: 'SU-20260916-0099' });

    expect(other.dots).not.toEqual(drawDeliveryLabel(FIELDS).dots);
  });

  /* 설계 §8 이 라벨 면에 싣기로 한 것들 — 하나라도 안 실리면 여기서 걸린다. */
  it.each([
    ['회차', { issueSeq: 2 }],
    ['상자 수', { boxCount: 9 }],
    ['고객 코드', { customer: { partnerCode: '999999', partnerName: 'Cong doan Samjin' } }],
    ['고객 명', { customer: { partnerCode: '100003', partnerName: 'Other Name' } }],
    ['납품처 코드', { shipTo: { partnerCode: '000000', partnerName: 'Ha Noi DC' } }],
    ['납품처 명', { shipTo: { partnerCode: '901463', partnerName: 'Da Nang DC' } }],
    ['품목 코드', { itemTotals: [{ itemCode: 'X1', itemName: 'COVER', quantity: '480 EA' }] }],
    ['품목 수량', { itemTotals: [{ itemCode: 'F534F50200', itemName: 'COVER', quantity: '1 EA' }] }],
  ])('%s 가 달라지면 라벨도 달라진다', (_what, patch) => {
    const changed = drawDeliveryLabel({ ...FIELDS, ...patch } as DeliveryLabelFields);

    expect(changed.dots).not.toEqual(drawDeliveryLabel(FIELDS).dots);
  });

  it('품목이 없어도 그린다 — 머리와 거래처는 서야 한다', () => {
    const bitmap = drawDeliveryLabel({ ...FIELDS, itemTotals: [] });

    expect(dotCount(bitmap)).toBeGreaterThan(0);
  });

  /*
   * ⛔⛔ **넘친 품목을 말없이 버리지 않는다.** 라벨에 적힌 것이 이 단위의 전부로 읽히면 받는
   *    쪽에서 대조가 어긋난다.
   */
  it('품목이 자리보다 많으면 몇 개가 더 있는지 수로 말한다', () => {
    const many = Array.from({ length: 6 }, (_, index) => ({
      itemCode: `ITEM-${String(index)}`,
      itemName: `NAME-${String(index)}`,
      quantity: '10 EA',
    }));

    const folded = drawDeliveryLabel({ ...FIELDS, itemTotals: many });
    const three = drawDeliveryLabel({ ...FIELDS, itemTotals: many.slice(0, 3) });

    expect(folded.dots).not.toEqual(three.dots);
  });

  /* 긴 값이 들어와도 판을 벗어나지 않는다 — 벗어나면 옆 칸 위로 겹쳐 찍힌다. */
  it('긴 이름이 들어와도 라벨 안에 머문다', () => {
    const bitmap = drawDeliveryLabel({
      ...FIELDS,
      shippingUnitNo: 'SU-2026'.repeat(10),
      customer: { partnerCode: '1'.repeat(40), partnerName: 'NAME'.repeat(20) },
      shipTo: { partnerCode: '9'.repeat(40), partnerName: 'PLACE'.repeat(20) },
    });

    const margin = bitmap.width - 3;

    for (let y = 0; y < bitmap.height; y += 1) {
      expect(readDot(bitmap, margin, y)).toBe(y < 2 || y >= bitmap.height - 2);
    }
  });
});

describe('납품 라벨 — 값 옮기기', () => {
  const partner = (code: string, name: string) => ({ partnerId: 1, partnerCode: code, partnerName: name });

  const detail = (patch: Partial<ShippingUnitDetail> = {}): ShippingUnitDetail => ({
    shippingUnitId: 7001,
    shippingUnitNo: 'SU-20260916-0001',
    shippingUnitTypeCode: 'PALLET',
    statusCode: 'CLOSED',
    shipmentId: 501,
    shipmentNo: 'SH-20260916-0003',
    customer: partner('100003', 'Cong doan Samjin'),
    shipTo: partner('901463', 'Ha Noi DC'),
    boxCount: 4,
    createdAt: '2026-09-17T09:00:00+09:00',
    /* ⚠ 낙관적 잠금 토큰 — 응답 ETag 와 같은 값이고 `:close` 가 `If-Match` 로 받는다. */
    versionNo: 1,
    boxes: [],
    itemTotals: [
      {
        itemId: 11,
        itemCode: 'F534F50200',
        itemName: 'COVER',
        qty: 480,
        uomId: 1,
        uomCode: 'EA',
      },
    ],
    ...patch,
  });

  it('상세와 회차를 그대로 옮긴다', () => {
    const fields = toDeliveryLabelFields(detail(), 2);

    expect(fields).toMatchObject({
      shippingUnitNo: 'SU-20260916-0001',
      boxCount: 4,
      issueSeq: 2,
    });
    expect(fields.customer).toEqual({ partnerCode: '100003', partnerName: 'Cong doan Samjin' });
    expect(fields.itemTotals[0]).toEqual({
      itemCode: 'F534F50200',
      itemName: 'COVER',
      quantity: '480 EA',
    });
  });

  /*
   * ⛔ **상자 수를 세지 않는다.** 서버가 준 값을 그대로 쓴다 — 받은 `boxes` 를 세면 목록이
   *    일부만 왔을 때 틀린 수가 라벨에 찍힌다.
   */
  it('상자 수는 서버가 준 값이다 — 받은 목록을 세지 않는다', () => {
    const fields = toDeliveryLabelFields(detail({ boxCount: 4, boxes: [] }), 1);

    expect(fields.boxCount).toBe(4);
  });

  it('이름이 비어 오면 그 사실을 적는다 — 빈칸으로 두지 않는다', () => {
    const fields = toDeliveryLabelFields(detail({ shipTo: partner('901463', '  ') }), 1);

    expect(fields.shipTo).toEqual({ partnerCode: '901463', partnerName: '-' });
  });

  /* ⛔ 단위를 지어내지 않는다 — 박스 단위를 낱개로 읽으면 대조가 통째로 어긋난다. */
  it('단위를 못 받았으면 수만 적는다', () => {
    const fields = toDeliveryLabelFields(
      detail({
        itemTotals: [
          { itemId: 11, itemCode: 'A', itemName: 'B', qty: 480, uomId: 1, uomCode: '' },
        ],
      }),
      1,
    );

    expect(fields.itemTotals[0]?.quantity).toBe('480');
  });

  it('품목이 없으면 빈 목록이다', () => {
    expect(toDeliveryLabelFields(detail({ itemTotals: [] }), 1).itemTotals).toEqual([]);
  });
});
