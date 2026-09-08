import { describe, expect, it } from 'vitest';

import {
  canRegister,
  isFillable,
  labelQtyOf,
  queuedLineIdsOf,
  queuedLotNosOf,
  scanProblemOf,
  toLotDraft,
  type InboundReceiptLine,
} from './lot';

/* 제품코드9 · 수량9 · 날짜6 · 공급사6 · 번호4 = 34자리. */
const LOT_NO = '123456789' + '000000500' + '260731' + '778899' + '0007';

const line = (overrides: Partial<InboundReceiptLine> = {}): InboundReceiptLine => ({
  inboundReceiptLineId: 7101,
  inboundReceiptId: 7001,
  lineNo: 2,
  itemId: 2002,
  receivedQty: 480,
  uomId: 1001,
  supplierLotMissing: false,
  inspectionRequired: true,
  statusCode: 'REGISTERED',
  lotId: null,
  ...overrides,
});

describe('채울 수 있는 라인', () => {
  it('LOT 이 비어 있는 사전부착 라인이 대상이다', () => {
    expect(isFillable(line())).toBe(true);
  });

  /* 도착 때 스캔한 라인은 입하 등록이 이미 만들었다. 여기서 또 만들면 400 이다. */
  it('이미 LOT 이 있는 라인은 대상이 아니다', () => {
    expect(isFillable(line({ lotId: 8001 }))).toBe(false);
  });

  /* 미부착은 서버 채번이라 이 화면 밖이다. */
  it('미부착 라인은 대상이 아니다', () => {
    expect(isFillable(line({ supplierLotMissing: true }))).toBe(false);
  });
});

describe('스캔값 검사', () => {
  it('34자리 숫자면 통과한다', () => {
    expect(scanProblemOf(LOT_NO, [])).toBeNull();
  });

  it('자릿수가 모자라면 막는다', () => {
    expect(scanProblemOf(LOT_NO.slice(0, 30), [])).toBe('length');
  });

  it('숫자가 아닌 글자가 섞이면 막는다', () => {
    expect(scanProblemOf(`${LOT_NO.slice(0, 33)}A`, [])).toBe('notDigits');
  });

  /*
   * 자릿수만 보면 없는 날짜가 통과한다. Date 는 2월 31일을 3월 3일로 굴려 받아, 라벨에
   * 없는 날짜가 있는 날짜로 조용히 바뀐다.
   */
  it('없는 날짜를 막는다', () => {
    const bad = '123456789' + '000000500' + '260231' + '778899' + '0007';

    expect(scanProblemOf(bad, [])).toBe('badDate');
  });

  /* 오프라인에서 같은 라벨을 두 번 스캔하면 뒤엣것이 서버에서 되돌아온다. */
  it('큐에 담아 둔 번호를 막는다', () => {
    expect(scanProblemOf(LOT_NO, [LOT_NO])).toBe('duplicate');
  });
});

describe('라벨 수량', () => {
  /* 라인 수량이 아니라 라벨의 최초 납품 스냅샷이다. */
  it('수량 분절을 읽는다', () => {
    expect(labelQtyOf(LOT_NO)).toBe(500);
  });

  it('모양이 아니면 읽지 않는다', () => {
    expect(labelQtyOf('12345')).toBeNull();
  });
});

describe('등록 가능 여부', () => {
  it('라인을 안 고르면 등록할 수 없다', () => {
    expect(canRegister(null, LOT_NO, true, 1001, [], [])).toBe(false);
  });

  it('사번이 없으면 등록할 수 없다', () => {
    expect(canRegister(line(), LOT_NO, false, 1001, [], [])).toBe(false);
  });

  /* 유일성은 공장과 번호의 짝이다. 공장을 모르면 어느 짝인지 정할 수 없다. */
  it('단말 공장을 모르면 등록할 수 없다', () => {
    expect(canRegister(line(), LOT_NO, true, null, [], [])).toBe(false);
  });

  it('스캔값이 잘못되면 등록할 수 없다', () => {
    expect(canRegister(line(), '12345', true, 1001, [], [])).toBe(false);
  });

  /* 수량 0 인 LOT 은 계약이 받지 않는다. */
  it('라벨 수량이 0 이면 등록할 수 없다', () => {
    const zero = '123456789' + '000000000' + '260731' + '778899' + '0007';

    expect(canRegister(line(), zero, true, 1001, [], [])).toBe(false);
  });

  /*
   * 라인 하나에 LOT 은 하나다. 오프라인에서 같은 라인에 다른 라벨을 스캔하면 둘 다 통과하고
   * 라인에 LOT 이 둘 생긴다.
   */
  it('이 라인을 이미 큐에 담아 두었으면 등록할 수 없다', () => {
    expect(canRegister(line(), LOT_NO, true, 1001, [], [7101])).toBe(false);
  });

  it('라인과 스캔값이 서면 등록한다', () => {
    expect(canRegister(line(), LOT_NO, true, 1001, [], [])).toBe(true);
  });
});

describe('큐에 담긴 것', () => {
  const entries = [{ body: { lotNo: LOT_NO, sourceId: 7101 } }, { body: {} }, {}];

  it('담긴 건의 번호를 모은다', () => {
    expect(queuedLotNosOf(entries)).toEqual([LOT_NO]);
  });

  it('담긴 건의 원천 라인을 모은다', () => {
    expect(queuedLineIdsOf(entries)).toEqual([7101]);
  });
});

describe('보낼 것', () => {
  const now = new Date('2026-09-07T09:12:00+09:00');

  it('공급사 채번으로 보낸다', () => {
    const draft = toLotDraft(line(), LOT_NO, 1001, now, '100028');
    const body = draft?.body as { numberSourceCode: string; lotNo: string };

    expect(draft?.method).toBe('POST');
    expect(draft?.path).toBe('/trace/lots');
    expect(body.numberSourceCode).toBe('SUPPLIER');
    expect(body.lotNo).toBe(LOT_NO);
  });

  /* 발번 단위가 건이 아니라 라인이다. 건 식별자를 넣으면 원천이 어긋난다. */
  it('원천으로 입하 라인을 가리킨다', () => {
    const draft = toLotDraft(line(), LOT_NO, 1001, now, '100028');
    const body = draft?.body as { sourceTypeCode: string; sourceId: number };

    expect(body.sourceTypeCode).toBe('INBOUND_RECEIPT_LINE');
    expect(body.sourceId).toBe(7101);
  });

  /* 라벨 수량과 라인 수량이 다르다. 최초 수량은 라벨의 것이다. */
  it('라인 수량이 아니라 라벨 수량을 싣는다', () => {
    const draft = toLotDraft(line({ receivedQty: 480 }), LOT_NO, 1001, now, '100028');
    const body = draft?.body as { initialQty: number };

    expect(body.initialQty).toBe(500);
  });

  /* 기준일 없이 보내면 서버가 등록을 거절한다. */
  it('업무 기준일을 싣는다', () => {
    const draft = toLotDraft(line(), LOT_NO, 1001, now, '100028');
    const body = draft?.body as { businessDate: string };

    expect(body.businessDate).toBe('2026-09-07');
  });

  it('공장과 자재 유형을 싣는다', () => {
    const draft = toLotDraft(line(), LOT_NO, 1001, now, '100028');
    const body = draft?.body as { plantId: number; lotTypeCode: string };

    expect(body.plantId).toBe(1001);
    expect(body.lotTypeCode).toBe('MATERIAL');
  });

  /* 라인 수량으로 바꿔 담으면 라벨과 다른 값이 최초 수량으로 굳는다. */
  it('라벨에서 수량을 읽지 못하면 만들지 않는다', () => {
    expect(toLotDraft(line(), '12345', 1001, now, '100028')).toBeNull();
  });
});
