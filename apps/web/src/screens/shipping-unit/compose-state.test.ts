import { describe, expect, it } from 'vitest';

import {
  INITIAL_STATE,
  PREVIEW_ITEM_ROWS,
  canClose,
  canCreateUnit,
  canRemoveBox,
  canScanBox,
  hasBox,
  isClosed,
  previewRows,
  type ComposeState,
} from './compose-state';
import { DELIVERY_LABEL_ITEM_ROWS } from './delivery-label-image';
import type { ShippingUnitBox, ShippingUnitDetail, ShippingUnitStatus } from './types';

/**
 * 구성 화면의 판단.
 *
 * ⭐ **마감은 되돌릴 수 없다**(설계 §4-6). 그래서 「지금 마감할 수 있는가」를 렌더 코드에 흩어
 *    두지 않고 여기서 낱낱이 밟는다 — 경계 하나가 틀리면 담당이 빈 단위를 마감한다.
 */

const box = (seq: number, no: string): ShippingUnitBox => ({
  handlingUnitId: 7000 + seq,
  handlingUnitNo: no,
  seq,
  contents: [],
});

const unit = (statusCode: ShippingUnitStatus, boxes: ShippingUnitBox[] = []): ShippingUnitDetail => ({
  shippingUnitId: 9001,
  shippingUnitNo: 'SU-20260916-0001',
  shippingUnitTypeCode: 'PALLET',
  statusCode,
  shipmentId: 501,
  shipmentNo: 'SH-20260916-0003',
  customer: { partnerId: 1, partnerCode: '100003', partnerName: 'Samjin' },
  shipTo: { partnerId: 2, partnerCode: '901463', partnerName: 'Ha Noi' },
  boxCount: boxes.length,
  boxes,
  itemTotals: [],
});

const state = (patch: Partial<ComposeState> = {}): ComposeState => ({ ...INITIAL_STATE, ...patch });

describe('새 단위 만들기', () => {
  it('출하와 유형을 모두 골라야 만들 수 있다', () => {
    expect(canCreateUnit(state())).toBe(false);
    expect(canCreateUnit(state({ shipmentId: 501 }))).toBe(false);
    expect(canCreateUnit(state({ typeCode: 'PALLET' }))).toBe(false);
    expect(canCreateUnit(state({ shipmentId: 501, typeCode: 'PALLET' }))).toBe(true);
  });

  /* ⛔ 한 번에 하나만 나간다 — 연타하면 빈 단위가 여러 개 남고 그것을 지울 경로가 없다. */
  it('무언가 하는 중이면 못 만든다', () => {
    expect(canCreateUnit(state({ shipmentId: 501, typeCode: 'PALLET', busy: 'creating' }))).toBe(
      false,
    );
  });
});

describe('상자 읽기·빼기', () => {
  it('단위를 만들기 전에는 못 읽는다', () => {
    expect(canScanBox(state({ shipmentId: 501 }))).toBe(false);
  });

  it('구성 중인 단위가 있으면 읽을 수 있다', () => {
    expect(canScanBox(state({ unit: unit('OPEN') }))).toBe(true);
  });

  /*
   * ⛔⛔ **마감된 단위에는 못 넣는다.** 서버도 막지만, 칸을 열어 두면 담당이 상자 앞에서 읽고
   *    나서야 막힌 것을 안다 — 스캐너를 든 사람에게 그 한 번은 큰 낭비다.
   */
  it('마감된 단위에는 못 읽고 못 뺀다', () => {
    const closed = state({ unit: unit('CLOSED', [box(1, 'HU-1')]) });

    expect(canScanBox(closed)).toBe(false);
    expect(canRemoveBox(closed)).toBe(false);
    expect(isClosed(closed)).toBe(true);
  });

  it('무언가 하는 중이면 못 읽는다', () => {
    expect(canScanBox(state({ unit: unit('OPEN'), busy: 'adding' }))).toBe(false);
  });
});

describe('이미 든 상자 알아보기', () => {
  const filled = state({ unit: unit('OPEN', [box(1, 'HU-20260916-0002')]) });

  it('같은 번호면 이미 들었다고 답한다', () => {
    expect(hasBox(filled, 'HU-20260916-0002')).toBe(true);
  });

  /* 스캐너가 앞뒤 공백을 붙여 쏘는 일이 있다. */
  it('앞뒤 공백을 흘린다', () => {
    expect(hasBox(filled, '  HU-20260916-0002  ')).toBe(true);
  });

  it('다른 번호면 아니다', () => {
    expect(hasBox(filled, 'HU-20260916-0009')).toBe(false);
  });

  it('단위가 없으면 아니다', () => {
    expect(hasBox(state(), 'HU-1')).toBe(false);
  });
});

describe('마감', () => {
  /*
   * ⛔⛔ **상자가 없으면 마감하지 않는다**(설계 §4-6 — 서버가 422). 화면이 먼저 막아,
   *    되돌릴 수 없는 조작을 눌렀다가 거절당하는 일을 없앤다.
   */
  it('상자가 하나도 없으면 못 한다', () => {
    expect(canClose(state({ unit: unit('OPEN') }))).toBe(false);
  });

  it('상자가 하나라도 있으면 할 수 있다', () => {
    expect(canClose(state({ unit: unit('OPEN', [box(1, 'HU-1')]) }))).toBe(true);
  });

  it('이미 마감했으면 다시 못 한다', () => {
    expect(canClose(state({ unit: unit('CLOSED', [box(1, 'HU-1')]) }))).toBe(false);
  });

  it('무언가 하는 중이면 못 한다', () => {
    expect(canClose(state({ unit: unit('OPEN', [box(1, 'HU-1')]), busy: 'closing' }))).toBe(false);
  });

  it('단위가 없으면 못 한다', () => {
    expect(canClose(state({ shipmentId: 501 }))).toBe(false);
    expect(isClosed(state())).toBe(false);
  });
});

describe('미리보기 품목 합', () => {
  const totals = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      itemId: index,
      itemCode: `ITEM-${String(index)}`,
      itemName: `NAME-${String(index)}`,
      qty: 10,
      uomId: 1,
      uomCode: 'EA',
    }));

  it('단위가 없으면 보일 것이 없다', () => {
    expect(previewRows(null)).toEqual({ shown: [], hidden: 0 });
  });

  it('자리에 맞으면 그대로 보인다', () => {
    const rows = previewRows({ ...unit('OPEN'), itemTotals: totals(3) });

    expect(rows.shown).toHaveLength(3);
    expect(rows.hidden).toBe(0);
  });

  it('넘치면 마지막 자리를 안내에 내준다', () => {
    const rows = previewRows({ ...unit('OPEN'), itemTotals: totals(7) });

    expect(rows.shown).toHaveLength(PREVIEW_ITEM_ROWS - 1);
    expect(rows.hidden).toBe(5);
  });

  /*
   * ⛔⛔ **미리보기와 라벨이 «같은 수»로 접어야 한다.** 다르면 담당이 본 것과 종이로 나온 것이
   *    달라진다 — 라벨은 되돌릴 수 없으므로 그 어긋남을 나중에야 알게 된다.
   *
   * ⚠ 라벨 쪽 수를 여기 다시 적지 않고 **가져와 견준다** — 적어 두면 한쪽만 바뀌어도 통과한다.
   */
  it('접는 자리 수가 라벨과 같다', () => {
    expect(PREVIEW_ITEM_ROWS).toBe(DELIVERY_LABEL_ITEM_ROWS);
  });
});
