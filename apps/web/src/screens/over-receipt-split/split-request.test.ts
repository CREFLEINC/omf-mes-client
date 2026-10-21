import { describe, expect, it } from 'vitest';

import { LABEL_9301, purchaseOrder, purchaseOrderLineFixtures } from './fixtures';
import {
  createDrafts,
  setDraftLot,
  setDraftQty,
  type LineDrafts,
  type LotDraft,
} from './line-draft';
import { toSplitLines } from './split-calc';
import { EMPTY_HEADER_DRAFT, type HeaderDraft } from './types';
import { toBusinessDate, toOccurredAt, toReceiptLines, toSplitRequest } from './split-request';

/**
 * 요청 조립 — **되돌릴 수 없는 쓰기의 본문을 만드는 자리다.**
 *
 * 여기서 잘못 실린 값은 화면이 되돌릴 수 없는 전표로 남는다(계약의 취소는 승인을 탄다).
 * 그래서 「무엇이 실리는가」뿐 아니라 **「무엇이 실리지 않는가」**를 함께 고정한다.
 *
 * **줄 하나 · LOT 하나 · 전표 한 건이다**(서버 장부 P-100). 초과 몫은 그 줄의 `excessQty` 로 실린다.
 */

const PO = purchaseOrder();

/**
 * 고정 시각. **실행 시각에 기대지 않는다** — 「영업일이 입하 일시에서 나온다」는
 * 오늘 날짜와 입하 일시가 우연히 같은 날이면 검사되지 않는다.
 */
const NOW = new Date(2026, 7, 20, 14, 30, 45);

const header = (patch: Partial<HeaderDraft> = {}): HeaderDraft => ({
  ...EMPTY_HEADER_DRAFT,
  receiptDatetime: '2026-08-06T09:12',
  ...patch,
});

/**
 * 9401(잔량 60 · 허용 5 → 한도 65)에 66을 넣으면 P/O 몫 65 · 초과 몫 1로 갈린다.
 * LOT 은 기본으로 라벨 번호를 넣는다 — 서버가 보낼 수 있는 모양이다.
 */
const draftsWith = (texts: Record<number, string>, lot: Partial<LotDraft> = {}): LineDrafts =>
  Object.entries(texts).reduce<LineDrafts>(
    (drafts, [lineId, text]) =>
      setDraftLot(setDraftQty(drafts, Number(lineId), text), Number(lineId), {
        lotNo: LABEL_9301,
        ...lot,
      }),
    createDrafts(purchaseOrderLineFixtures),
  );

const rowsWith = (texts: Record<number, string>, lot: Partial<LotDraft> = {}) =>
  toSplitLines(purchaseOrderLineFixtures, draftsWith(texts, lot));

const input = (drafts: Record<number, string>, patch: Partial<HeaderDraft> = {}) => ({
  purchaseOrder: PO,
  rows: rowsWith(drafts),
  header: header(patch),
  now: NOW,
});

describe('toReceiptLines — 무엇이 전표 줄로 실리는가', () => {
  /* **M24** — 줄이 원 발주의 어느 줄을 채우는지 밝힌다. 한도 안이면 `excessQty` 를 싣지 않는다. */
  it('한도 안의 줄은 발주 라인 번호와 도착 수량을 싣고 초과 몫은 없다', () => {
    expect(toReceiptLines(rowsWith({ 9401: '10' }))).toEqual([
      {
        purchaseOrderLineId: 9401,
        itemId: 9301,
        receivedQty: 10,
        uomId: 9501,
        supplierLotNo: LABEL_9301,
        supplierLotMissing: false,
      },
    ]);
  });

  /*
   * 발주보다 많이 와도 **줄을 가르지 않는다** — LOT 은 IQC 한 단위라 도착 수량 전체가 줄 하나다.
   * P/O 에 넣지 않는 몫만 `excessQty` 로 싣는다(서버가 P/O 라인에 `receivedQty − excessQty` 를 더한다).
   */
  it('한도를 넘으면 한 줄에 도착 수량 전체와 초과 몫을 싣는다', () => {
    expect(toReceiptLines(rowsWith({ 9401: '66' }))).toEqual([
      {
        purchaseOrderLineId: 9401,
        itemId: 9301,
        receivedQty: 66,
        uomId: 9501,
        excessQty: 1,
        supplierLotNo: LABEL_9301,
        supplierLotMissing: false,
      },
    ]);
  });

  /* 초과 몫도 P/O 라인에 묶인 줄의 일부다 — 발주 없는 줄(예외 유형)을 만들지 않는다. */
  it('초과 몫이 있어도 예외 유형·사유를 싣지 않고 발주 라인에 묶인다', () => {
    const [line] = toReceiptLines(rowsWith({ 9401: '500' }));

    expect(line?.purchaseOrderLineId).toBe(9401);
    expect(line?.excessQty).toBe(435);
    expect(Object.keys(line ?? {})).not.toContain('exceptionTypeCode');
    expect(Object.keys(line ?? {})).not.toContain('exceptionReason');
  });

  /* **M16** — 초과 몫이 0이면 키 자체를 싣지 않는다. `excessQty: 0` 은 「없음」과 같지만 본문이 흐려진다. */
  it('초과 몫이 0이면 excessQty 키가 없다', () => {
    const [line] = toReceiptLines(rowsWith({ 9401: '65' }));

    expect(Object.keys(line ?? {})).not.toContain('excessQty');
  });

  /* 빈 칸과 잘못 친 값은 실릴 것이 없다. */
  it('미입력과 형식 오류인 줄은 실리지 않는다', () => {
    expect(toReceiptLines(rowsWith({ 9401: '', 9402: 'abc', 9403: '0' }))).toHaveLength(0);
  });

  /* 여러 줄을 채우면 줄 순서를 그대로 지킨다 — 표에 보인 차례와 전표의 차례가 같아야 읽힌다. */
  it('여러 줄이면 표의 차례를 지킨다', () => {
    const lines = toReceiptLines(rowsWith({ 9401: '66', 9403: '8' }));

    expect(lines.map((line) => line.purchaseOrderLineId)).toEqual([9401, 9403]);
    expect(lines.map((line) => line.receivedQty)).toEqual([66, 8]);
    /* 9403 은 누적 입하가 발주를 넘겨 한도가 3이다 — 나머지 5가 초과 몫이다. */
    expect(lines.map((line) => line.excessQty)).toEqual([1, 5]);
  });

  /* 수량은 소수를 가질 수 있다(계약이 `number`다). 정수로 반올림하면 받은 양이 달라진다. */
  it('소수 수량을 그대로 싣는다', () => {
    expect(toReceiptLines(rowsWith({ 9401: '0.5' }))[0]?.receivedQty).toBe(0.5);
    expect(toReceiptLines(rowsWith({ 9401: '65.5' }))[0]).toMatchObject({
      receivedQty: 65.5,
      excessQty: 0.5,
    });
  });

  /*
   * **LOT 세 모양** — 서버가 LOT 번호 없는 줄을 받지 않는다(`supplierLotMissing=false` 면 번호 필수).
   * 라벨이 붙었으면 번호만, 라벨 없이 번호를 받아 적었으면 부착 거짓, 번호도 없으면 없음 + 사유다.
   */
  it('라벨이 붙은 LOT 은 번호만 싣는다', () => {
    const line = toReceiptLines(rowsWith({ 9401: '10' }))[0];

    expect(line?.supplierLotNo).toBe(LABEL_9301);
    expect(line?.supplierLotMissing).toBe(false);
    expect(Object.keys(line ?? {})).not.toContain('supplierLotLabelAttached');
    expect(Object.keys(line ?? {})).not.toContain('substituteLotReasonCode');
  });

  it('라벨 없이 받아 적은 번호는 부착 거짓으로 싣는다', () => {
    const line = toReceiptLines(
      rowsWith({ 9401: '10' }, { lotNo: 'DN-LOT-7', labelMissing: true }),
    )[0];

    expect(line).toMatchObject({
      supplierLotNo: 'DN-LOT-7',
      supplierLotMissing: false,
      supplierLotLabelAttached: false,
    });
  });

  it('번호가 없으면 없음과 대체 사유를 싣는다', () => {
    const line = toReceiptLines(
      rowsWith({ 9401: '10' }, { lotNo: '', labelMissing: true, reasonCode: 'NO_LABEL' }),
    )[0];

    expect(line).toMatchObject({ supplierLotMissing: true, substituteLotReasonCode: 'NO_LABEL' });
    expect(Object.keys(line ?? {})).not.toContain('supplierLotNo');
  });

  it('입하 예정 라인을 싣지 않는다', () => {
    expect(Object.keys(toReceiptLines(rowsWith({ 9401: '66' }))[0] ?? {})).not.toContain(
      'asnLineId',
    );
  });
});

describe('toSplitRequest — 늘 정량분 part 하나', () => {
  /* 전표는 늘 한 건이다 — 초과 몫은 줄의 `excessQty` 로 실려 초과분 part 를 만들지 않는다. */
  it('갈래는 늘 NORMAL_ONLY 이고 초과분 part 가 없다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(request.mode).toBe('NORMAL_ONLY');
    expect(request.normal?.lines).toHaveLength(1);
    expect(request.normal?.lines[0]).toMatchObject({ receivedQty: 66, excessQty: 1 });
    expect(request.excess).toBeUndefined();
    expect(Object.keys(request)).not.toContain('excess');
  });

  /* 등록 단추를 누르는 쪽이 갈래를 고르지 않는다 — 입력 하나만 받는다. */
  it('입력 하나만 받는다', () => {
    expect(toSplitRequest.length).toBe(1);
  });
});

describe('toSplitRequest — part에 실리는 값', () => {
  it('머리 값과 발주에서 온 값이 실린다', () => {
    const request = toSplitRequest(
      input({ 9401: '66' }, { deliveryNoteNo: 'SAMPLE-DN-01', remarks: '합성 비고' }),
    );
    const part = request.normal;

    expect(part?.supplierId).toBe(PO.supplierId);
    expect(part?.plantId).toBe(PO.plantId);
    expect(part?.deliveryNoteNo).toBe('SAMPLE-DN-01');
    expect(part?.remarks).toBe('합성 비고');
    expect(part?.receiptDatetime.startsWith('2026-08-06T09:12:00')).toBe(true);
  });

  /* 비운 칸은 키 자체를 싣지 않는다 — 빈 문자열을 보내면 「빈 값을 넣었다」가 전표에 남는다. */
  it('비운 칸은 키를 싣지 않는다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(Object.keys(request.normal ?? {})).not.toContain('deliveryNoteNo');
    expect(Object.keys(request.normal ?? {})).not.toContain('remarks');
  });

  /* 앞뒤 공백은 떼고 보낸다 — 길이 검사도 뗀 값으로 재므로 두 자리의 기준이 같다. */
  it('앞뒤 공백을 떼고 싣는다', () => {
    const request = toSplitRequest(input({ 9401: '66' }, { deliveryNoteNo: '  SAMPLE-DN-01  ' }));

    expect(request.normal?.deliveryNoteNo).toBe('SAMPLE-DN-01');
  });

  /* 초과 몫이 있어도 예외 유형·사유가 전표 머리에 실리지 않는다 — 이 전표는 발주에 묶인 정상 입하다. */
  it('예외 유형과 사유를 싣지 않는다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(Object.keys(request.normal ?? {})).not.toContain('exceptionTypeCode');
    expect(Object.keys(request.normal ?? {})).not.toContain('exceptionReason');
  });

  /*
   * 입하장(도크)은 선택칸을 만들지 않았다 — 계약이 창고를 필수로 요구하는데 이 화면에
   * 창고 축이 없다. 지어낸 값을 싣지 않는다.
   */
  it('입하장을 싣지 않는다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(Object.keys(request.normal ?? {})).not.toContain('dockLocationId');
  });
});

describe('toSplitRequest — 영업일과 발생 시각', () => {
  /*
   * **M34** — 계약이 영업일을 필수로 요구하는데 산출 규칙이 어디에도 정의돼 있지 않다.
   * **입하 일시의 날짜로 파생한다**(계획 결정 8 · 승인 13-5). 실행 시각의 날짜를 쓰면
   * 어제 받은 자재를 오늘 등록하는 흔한 경우에 영업일이 하루 밀린다.
   */
  it('영업일이 입하 일시의 날짜에서 나온다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(request.businessDate).toBe('2026-08-06');
    /* 짝 방향 — 실행 시각(2026-08-20)의 날짜가 아니다. */
    expect(request.businessDate).not.toBe('2026-08-20');
  });

  it('입하 일시가 바뀌면 영업일도 함께 바뀐다', () => {
    const request = toSplitRequest(input({ 9401: '66' }, { receiptDatetime: '2026-07-31T23:50' }));

    expect(request.businessDate).toBe('2026-07-31');
  });

  /*
   * **M35** — `datetime-local` 값에는 offset이 없다. 그대로 보내면 서버가 어느 지역의
   * 시각인지 알 수 없어 같은 문자열이 나라마다 다른 순간을 가리킨다.
   */
  it('입하 일시와 발생 시각에 offset이 붙는다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(request.normal?.receiptDatetime).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(request.occurredAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  /* 계약이 초까지 있는 형식을 요구한다. 입력칸은 분까지만 주므로 초를 채워 보낸다. */
  it('분까지만 친 입하 일시에 초를 채운다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(request.normal?.receiptDatetime.slice(0, 19)).toBe('2026-08-06T09:12:00');
  });

  /*
   * 발생 시각은 **제출 순간의 시각**이다 — 사용자가 정할 값이 아니라 입력칸을 두지 않는다.
   * 입하 일시와 다른 값이라는 것이 요점이다(어제 받은 것을 오늘 등록한다).
   */
  it('발생 시각은 제출 순간에서 나오고 입하 일시와 다르다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(request.occurredAt).toBe(toOccurredAt(NOW));
    expect(request.occurredAt.startsWith('2026-08-20T14:30:45')).toBe(true);
    expect(request.occurredAt).not.toBe(request.normal?.receiptDatetime);
  });

  /*
   * **C24** — 계약이 「영업일과 발생 시각은 바깥에서 한 번만 받는다」고 적었다.
   * part 안에 함께 실으면 두 값이 갈릴 자리가 생긴다.
   */
  it('영업일과 발생 시각은 바깥에만 있다', () => {
    const request = toSplitRequest(input({ 9401: '66' }));

    expect(Object.keys(request.normal ?? {})).not.toContain('businessDate');
    expect(Object.keys(request.normal ?? {})).not.toContain('occurredAt');
  });
});

describe('toBusinessDate — 파생 규칙', () => {
  it('입하 일시의 날짜 부분을 그대로 쓴다', () => {
    expect(toBusinessDate('2026-08-06T09:12')).toBe('2026-08-06');
    expect(toBusinessDate('2026-12-31T23:59')).toBe('2026-12-31');
  });
});
