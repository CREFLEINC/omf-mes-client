import { describe, expect, it } from 'vitest';

import { purchaseOrder, purchaseOrderLineFixtures } from './fixtures';
import { toSplitLines } from './split-calc';
import { EMPTY_HEADER_DRAFT, type HeaderDraft } from './types';
import {
  includesExcess,
  toBusinessDate,
  toOccurredAt,
  toSplitParts,
  toSplitRequest,
} from './split-request';

/**
 * 요청 조립 — **되돌릴 수 없는 쓰기의 본문을 만드는 자리다.**
 *
 * 여기서 잘못 실린 값은 화면이 되돌릴 수 없는 전표로 남는다(계약의 취소는 승인을 탄다).
 * 그래서 「무엇이 실리는가」뿐 아니라 **「무엇이 실리지 않는가」**를 함께 고정한다.
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
 * 9401(잔량 60 · 허용 5 → 한도 65)에 66을 넣으면 정량 65 · 초과 1로 갈린다.
 * 두 갈래가 **한 줄에서 동시에** 나오는 입력이라 두 part를 함께 검사할 수 있다.
 */
const rowsWith = (drafts: Record<number, string>) =>
  toSplitLines(purchaseOrderLineFixtures, drafts);

const input = (drafts: Record<number, string>, patch: Partial<HeaderDraft> = {}) => ({
  purchaseOrder: PO,
  rows: rowsWith(drafts),
  header: header(patch),
  now: NOW,
});

describe('toSplitParts — 어느 라인이 어느 쪽에 실리는가', () => {
  /* **M24** — 정량분이 원 발주의 어느 줄을 채우는지 밝히는 것이 정량분의 정의다. */
  it('정량분 라인은 발주 라인 번호를 싣는다', () => {
    const parts = toSplitParts(rowsWith({ 9401: '66' }));

    expect(parts.normal).toEqual([
      {
        purchaseOrderLineId: 9401,
        itemId: 9301,
        receivedQty: 65,
        uomId: 9501,
        supplierLotMissing: false,
      },
    ]);
  });

  /*
   * **M23** — 이슈 §6이 금지한 경로다. 초과분에 발주 라인을 붙이면 초과분이 원 발주에
   * 더해져 「발주보다 많이 받았다」는 사실 자체가 사라진다.
   */
  it('초과분 라인은 발주 라인 번호를 싣지 않는다', () => {
    const parts = toSplitParts(rowsWith({ 9401: '66' }));

    expect(parts.excess).toEqual([
      { itemId: 9301, receivedQty: 1, uomId: 9501, supplierLotMissing: false },
    ]);
    expect(Object.keys(parts.excess[0] ?? {})).not.toContain('purchaseOrderLineId');
  });

  /* **M16의 나머지 절반** — 0인 쪽은 라인 목록에 넣지 않는다. 넣으면 받지도 않은 줄이 실린다. */
  it('한쪽이 0이면 그 쪽 라인 목록에 넣지 않는다', () => {
    /* 9401에 10 → 전부 정량분(한도 65) */
    expect(toSplitParts(rowsWith({ 9401: '10' })).excess).toHaveLength(0);
    /* 9402는 꼭 맞게 받았고 허용치가 0이라 한도가 0 — 도착한 전부가 초과분이다 */
    expect(toSplitParts(rowsWith({ 9402: '12' })).normal).toHaveLength(0);
  });

  /* 빈 칸과 잘못 친 값은 갈릴 것이 없다 — 어느 쪽에도 실리지 않는다. */
  it('미입력과 형식 오류인 줄은 어느 쪽에도 실리지 않는다', () => {
    const parts = toSplitParts(rowsWith({ 9401: '', 9402: 'abc', 9403: '0' }));

    expect(parts.normal).toHaveLength(0);
    expect(parts.excess).toHaveLength(0);
  });

  /* 여러 줄을 채우면 줄 순서를 그대로 지킨다 — 표에 보인 차례와 전표의 차례가 같아야 읽힌다. */
  it('여러 줄이면 표의 차례를 지킨다', () => {
    const parts = toSplitParts(rowsWith({ 9401: '66', 9403: '8' }));

    expect(parts.normal.map((line) => line.receivedQty)).toEqual([65, 5]);
    expect(parts.excess.map((line) => line.receivedQty)).toEqual([1, 3]);
  });

  /* 수량은 소수를 가질 수 있다(계약이 `number`다). 정수로 반올림하면 받은 양이 달라진다. */
  it('소수 수량을 그대로 싣는다', () => {
    expect(toSplitParts(rowsWith({ 9401: '0.5' })).normal[0]?.receivedQty).toBe(0.5);
  });

  /*
   * LOT 입력을 열지 않으므로 「공급사 LOT 없음」은 늘 거짓이다 — 참으로 보내면 계약이
   * 대체 사유 코드를 필수로 요구하는데 그 값 목록이 없어 막다른 길이 된다.
   */
  it('공급사 LOT 없음을 거짓으로 고정해 싣는다', () => {
    const parts = toSplitParts(rowsWith({ 9401: '66' }));

    expect(parts.normal[0]?.supplierLotMissing).toBe(false);
    expect(parts.excess[0]?.supplierLotMissing).toBe(false);
  });

  /* 이 화면은 입하 예정 축을 쓰지 않는다 — 지어낸 예정 라인을 붙이지 않는다. */
  it('입하 예정 라인을 싣지 않는다', () => {
    const parts = toSplitParts(rowsWith({ 9401: '66' }));

    expect(Object.keys(parts.normal[0] ?? {})).not.toContain('asnLineId');
    expect(Object.keys(parts.excess[0] ?? {})).not.toContain('asnLineId');
  });
});

describe('toSplitRequest — 세 갈래', () => {
  /*
   * **M26** — `mode`에 기본값을 두지 않는다(이슈 §6). 기본 인자를 주면 함수의 인자 수가
   * 줄어들므로 그 사실이 값으로 드러난다. 기본값이 생기면 화면이 갈래를 넘기지 않아도
   * 요청이 만들어져, 어느 갈래로 저장됐는지 아무도 고르지 않은 전표가 남는다.
   */
  it('갈래와 입력 둘을 반드시 받는다', () => {
    expect(toSplitRequest.length).toBe(2);
  });

  it('분리 등록은 두 part를 모두 싣는다', () => {
    const request = toSplitRequest('BOTH', input({ 9401: '66' }));

    expect(request.mode).toBe('BOTH');
    expect(request.normal?.lines).toHaveLength(1);
    expect(request.excess?.lines).toHaveLength(1);
  });

  /* 정량분만 저장하면 초과분 part 자체가 없어야 한다 — 빈 part를 실으면 라인 0행이 나간다. */
  it('정량분만 저장은 정량분 part만 싣는다', () => {
    const request = toSplitRequest('NORMAL_ONLY', input({ 9401: '66' }));

    expect(request.mode).toBe('NORMAL_ONLY');
    expect(request.normal?.lines).toHaveLength(1);
    expect(request.excess).toBeUndefined();
    expect(Object.keys(request)).not.toContain('excess');
  });

  it('초과분만 저장은 초과분 part만 싣는다', () => {
    const request = toSplitRequest('EXCESS_ONLY', input({ 9401: '66' }));

    expect(request.mode).toBe('EXCESS_ONLY');
    expect(request.excess?.lines).toHaveLength(1);
    expect(request.normal).toBeUndefined();
    expect(Object.keys(request)).not.toContain('normal');
  });
});

/**
 * **초과분이 실리는 갈래인가** — 요청 본문과 등록 뒤 화면이 **같은 판정**을 쓴다.
 *
 * 등록 결과에 신규 P/O 등록 진입로를 세울지가 이 값에 달렸다(계획 D-14 ② 개정). 두 곳에서
 * 따로 가르면 한쪽만 고쳐진 채 남고, 그때 정량분 전표에 「정산할 초과분」으로 가는 길이 선다.
 */
describe('includesExcess — 갈래가 초과분을 싣는가', () => {
  it('세 갈래를 각각 가른다', () => {
    expect(includesExcess('BOTH')).toBe(true);
    expect(includesExcess('EXCESS_ONLY')).toBe(true);
    expect(includesExcess('NORMAL_ONLY')).toBe(false);
  });

  /* 요청 조립과 **같은 답**을 내야 한다 — 판정이 갈리면 본문과 화면이 다른 사실을 말한다. */
  it('요청 본문의 초과분 part 유무와 답이 같다', () => {
    for (const mode of ['BOTH', 'EXCESS_ONLY', 'NORMAL_ONLY'] as const) {
      const request = toSplitRequest(mode, input({ 9401: '66' }));

      expect(request.excess !== undefined).toBe(includesExcess(mode));
    }
  });
});

describe('toSplitRequest — part에 실리는 값', () => {
  /*
   * **M30** — 같은 도착을 두 전표로 나눈 것이라 머리 값이 갈리면 안 된다.
   * 한쪽에만 실으면 나중에 두 전표를 맞춰 볼 근거가 사라진다.
   */
  it('머리 값과 발주에서 온 값이 두 part에 같이 실린다', () => {
    const request = toSplitRequest(
      'BOTH',
      input({ 9401: '66' }, { deliveryNoteNo: 'SAMPLE-DN-01', remarks: '합성 비고' }),
    );

    for (const part of [request.normal, request.excess]) {
      expect(part?.supplierId).toBe(PO.supplierId);
      expect(part?.plantId).toBe(PO.plantId);
      expect(part?.deliveryNoteNo).toBe('SAMPLE-DN-01');
      expect(part?.remarks).toBe('합성 비고');
      expect(part?.receiptDatetime.startsWith('2026-08-06T09:12:00')).toBe(true);
    }
  });

  /* 비운 칸은 키 자체를 싣지 않는다 — 빈 문자열을 보내면 「빈 값을 넣었다」가 전표에 남는다. */
  it('비운 칸은 키를 싣지 않는다', () => {
    const request = toSplitRequest('NORMAL_ONLY', input({ 9401: '66' }));

    expect(Object.keys(request.normal ?? {})).not.toContain('deliveryNoteNo');
    expect(Object.keys(request.normal ?? {})).not.toContain('remarks');
  });

  /* 앞뒤 공백은 떼고 보낸다 — 길이 검사도 뗀 값으로 재므로 두 자리의 기준이 같다. */
  it('앞뒤 공백을 떼고 싣는다', () => {
    const request = toSplitRequest(
      'NORMAL_ONLY',
      input({ 9401: '66' }, { deliveryNoteNo: '  SAMPLE-DN-01  ' }),
    );

    expect(request.normal?.deliveryNoteNo).toBe('SAMPLE-DN-01');
  });

  /*
   * **M31** — 계약이 「초과분 쪽에서 쓰는 예외 유형」으로 정의했다.
   * 정량분에도 실으면 정상 입하 전표에 예외 사유가 붙어 뒤에 읽는 사람이 오해한다.
   */
  it('예외 유형과 사유는 초과분에만 실린다', () => {
    const request = toSplitRequest(
      'BOTH',
      input(
        { 9401: '66' },
        { exceptionTypeCode: 'SAMPLE_EXCEPTION', exceptionReason: '합성 사유' },
      ),
    );

    expect(request.excess?.exceptionTypeCode).toBe('SAMPLE_EXCEPTION');
    expect(request.excess?.exceptionReason).toBe('합성 사유');
    expect(Object.keys(request.normal ?? {})).not.toContain('exceptionTypeCode');
    expect(Object.keys(request.normal ?? {})).not.toContain('exceptionReason');
  });

  /* 유형 없이 사유만 적은 경우도 초과분에만 실린다. 계약이 사유를 선택으로 두었다. */
  it('유형 없이 사유만 적어도 초과분에만 실린다', () => {
    const request = toSplitRequest(
      'BOTH',
      input({ 9401: '66' }, { exceptionReason: '초과가 온 사정' }),
    );

    expect(request.excess?.exceptionReason).toBe('초과가 온 사정');
    expect(Object.keys(request.excess ?? {})).not.toContain('exceptionTypeCode');
  });

  /*
   * 입하장(도크)은 선택칸을 만들지 않았다 — 계약이 창고를 필수로 요구하는데 이 화면에
   * 창고 축이 없다. 지어낸 값을 싣지 않는다.
   */
  it('입하장을 싣지 않는다', () => {
    const request = toSplitRequest('BOTH', input({ 9401: '66' }));

    expect(Object.keys(request.normal ?? {})).not.toContain('dockLocationId');
    expect(Object.keys(request.excess ?? {})).not.toContain('dockLocationId');
  });
});

describe('toSplitRequest — 영업일과 발생 시각', () => {
  /*
   * **M34** — 계약이 영업일을 필수로 요구하는데 산출 규칙이 어디에도 정의돼 있지 않다.
   * **입하 일시의 날짜로 파생한다**(계획 결정 8 · 승인 13-5). 실행 시각의 날짜를 쓰면
   * 어제 받은 자재를 오늘 등록하는 흔한 경우에 영업일이 하루 밀린다.
   */
  it('영업일이 입하 일시의 날짜에서 나온다', () => {
    const request = toSplitRequest('BOTH', input({ 9401: '66' }));

    expect(request.businessDate).toBe('2026-08-06');
    /* 짝 방향 — 실행 시각(2026-08-20)의 날짜가 아니다. */
    expect(request.businessDate).not.toBe('2026-08-20');
  });

  it('입하 일시가 바뀌면 영업일도 함께 바뀐다', () => {
    const request = toSplitRequest(
      'BOTH',
      input({ 9401: '66' }, { receiptDatetime: '2026-07-31T23:50' }),
    );

    expect(request.businessDate).toBe('2026-07-31');
  });

  /*
   * **M35** — `datetime-local` 값에는 offset이 없다. 그대로 보내면 서버가 어느 지역의
   * 시각인지 알 수 없어 같은 문자열이 나라마다 다른 순간을 가리킨다.
   */
  it('입하 일시와 발생 시각에 offset이 붙는다', () => {
    const request = toSplitRequest('BOTH', input({ 9401: '66' }));

    expect(request.normal?.receiptDatetime).toMatch(/[+-]\d{2}:\d{2}$/);
    expect(request.occurredAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  /* 계약이 초까지 있는 형식을 요구한다. 입력칸은 분까지만 주므로 초를 채워 보낸다. */
  it('분까지만 친 입하 일시에 초를 채운다', () => {
    const request = toSplitRequest('BOTH', input({ 9401: '66' }));

    expect(request.normal?.receiptDatetime.slice(0, 19)).toBe('2026-08-06T09:12:00');
  });

  /*
   * 발생 시각은 **제출 순간의 시각**이다 — 사용자가 정할 값이 아니라 입력칸을 두지 않는다.
   * 입하 일시와 다른 값이라는 것이 요점이다(어제 받은 것을 오늘 등록한다).
   */
  it('발생 시각은 제출 순간에서 나오고 입하 일시와 다르다', () => {
    const request = toSplitRequest('BOTH', input({ 9401: '66' }));

    expect(request.occurredAt).toBe(toOccurredAt(NOW));
    expect(request.occurredAt.startsWith('2026-08-20T14:30:45')).toBe(true);
    expect(request.occurredAt).not.toBe(request.normal?.receiptDatetime);
  });

  /*
   * **C24** — 계약이 「영업일과 발생 시각은 바깥에서 한 번만 받는다」고 적었다.
   * part 안에 함께 실으면 두 값이 갈릴 자리가 생긴다.
   */
  it('영업일과 발생 시각은 바깥에만 있다', () => {
    const request = toSplitRequest('BOTH', input({ 9401: '66' }));

    for (const part of [request.normal, request.excess]) {
      expect(Object.keys(part ?? {})).not.toContain('businessDate');
      expect(Object.keys(part ?? {})).not.toContain('occurredAt');
    }
  });
});

describe('toBusinessDate — 파생 규칙', () => {
  it('입하 일시의 날짜 부분을 그대로 쓴다', () => {
    expect(toBusinessDate('2026-08-06T09:12')).toBe('2026-08-06');
    expect(toBusinessDate('2026-12-31T23:59')).toBe('2026-12-31');
  });
});
