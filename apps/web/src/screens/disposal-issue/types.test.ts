import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_DISPOSAL_DRAFT,
  formatDateTime,
  hasAnyDisposalDraftValue,
  readableName,
  toBalanceView,
  toIssueDetailResult,
  toIssueLineView,
  toIssueView,
  toReasonLines,
  toReceiptLineView,
  toReceiptView,
  type BalanceResponse,
  type IssueLineResponse,
  type IssueResponse,
  type ReceiptLineResponse,
  type ReceiptResponse,
} from './types';

const t = messages.disposalIssue;

/** 계약 응답 한 건. **화면이 읽지 않는 필드도 실어** 옮기기가 실제로 고르는지 본다. */
const response = (overrides: Partial<ReceiptResponse> = {}): ReceiptResponse => ({
  goodsReceiptId: 9001,
  goodsReceiptNo: 'GR-2026-900001',
  receiptTypeCode: 'SAMPLE_GR_TYPE_A',
  plantId: 9101,
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
  sourceDocumentTypeCode: 'SAMPLE_SRC_TYPE_A',
  sourceDocumentId: 9201,
  reasonCode: 'SAMPLE_GR_REASON_A',
  remarks: '합성 비고',
  erpMessageQueued: true,
  ...overrides,
});

describe('toReceiptView', () => {
  it('화면이 쓰는 여섯만 옮긴다', () => {
    expect(toReceiptView(response())).toEqual({
      goodsReceiptId: 9001,
      goodsReceiptNo: 'GR-2026-900001',
      receiptTypeCode: 'SAMPLE_GR_TYPE_A',
      warehouseId: 9701,
      receiptDatetime: '2026-08-06T09:12:00+09:00',
      statusCode: 'SAMPLE_GR_STATUS_A',
    });
  });

  /**
   * 짝 방향 — **자리를 두지 않은 값은 옮겨지지 않는다.** 타입에 자리가 없으면 그 번호가
   * 화면으로 샐 경로도 없다(`omf-mes#44`).
   */
  it('공장·원천 문서·사유·비고·ERP 적재는 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toReceiptView(response()) };

    for (const key of [
      'plantId',
      'sourceDocumentTypeCode',
      'sourceDocumentId',
      'reasonCode',
      'remarks',
      'erpMessageQueued',
    ]) {
      expect(view).not.toHaveProperty(key);
    }
  });

  /** 상태·유형 코드는 **그대로 옮긴다** — 값으로 분기하지도 번역하지도 않는다(공유계약 G-2). */
  it('코드를 해석하지 않고 그대로 옮긴다', () => {
    const view = toReceiptView(response({ statusCode: '알 수 없는 코드' }));

    expect(view.statusCode).toBe('알 수 없는 코드');
  });
});

/** 라인 응답 한 줄. **화면이 읽지 않는 필드도 실어** 옮기기가 실제로 고르는지 본다. */
const lineResponse = (overrides: Partial<ReceiptLineResponse> = {}): ReceiptLineResponse => ({
  goodsReceiptLineId: 9401,
  goodsReceiptId: 9001,
  lineNo: 1,
  inboundReceiptLineId: 9501,
  itemId: 9301,
  lotId: 9601,
  receiptQty: 100,
  uomId: 9801,
  qualityStatusCode: 'SAMPLE_QUALITY_A',
  /* 재고 상태만 합성값이 아니다 — **계약이 값을 넷으로 못박아** 다른 값은 타입이 막는다. */
  inventoryStatusCode: 'AVAILABLE',
  destinationLocationId: 9901,
  inventoryTransactionLineId: 9111,
  ...overrides,
});

describe('toReceiptLineView', () => {
  /** 폐기 라인이 요구하는 다섯(품목·LOT·수량·단위·출발 위치)과 줄을 가르는 번호만 옮긴다. */
  it('화면이 쓰는 여섯만 옮긴다', () => {
    expect(toReceiptLineView(lineResponse())).toEqual({
      goodsReceiptLineId: 9401,
      itemId: 9301,
      lotId: 9601,
      receiptQty: 100,
      uomId: 9801,
      destinationLocationId: 9901,
    });
  });

  /**
   * 짝 방향 — **자리를 두지 않은 값은 옮겨지지 않는다.**
   *
   * 품질·재고 상태를 담지 않는 것은 이 화면이 **상태 코드로 줄을 가르지 않기** 때문이고
   * (공유계약 G-2), 원장 라인·줄번호·전표 번호는 낼 것이 번호밖에 없다(`omf-mes#44`).
   */
  it('상태 코드·줄번호·원장 라인·전표 번호는 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toReceiptLineView(lineResponse()) };

    for (const key of [
      'goodsReceiptId',
      'lineNo',
      'inboundReceiptLineId',
      'qualityStatusCode',
      'inventoryStatusCode',
      'inventoryTransactionLineId',
    ]) {
      expect(view).not.toHaveProperty(key);
    }
  });
});

/** 잔액 응답 한 줄. 화면이 쓰지 않는 수량·코드도 함께 실어 옮기기가 고르는지 본다. */
const balanceResponse = (overrides: Partial<BalanceResponse> = {}): BalanceResponse =>
  ({
    groupBy: 'LOT',
    itemId: 9301,
    lotId: 9601,
    warehouseId: 9701,
    ownershipTypeCode: 'SAMPLE_OWNERSHIP_A',
    onHandQty: 100,
    reservedQty: 20,
    pickedQty: 5,
    blockedQty: 30,
    availableQty: 45,
    uomId: 9801,
    ...overrides,
  }) as BalanceResponse;

describe('toBalanceView', () => {
  it('묶은 축·LOT·보유 수량·단위만 옮긴다', () => {
    expect(toBalanceView(balanceResponse())).toEqual({
      groupBy: 'LOT',
      lotId: 9601,
      onHandQty: 100,
      uomId: 9801,
    });
  });

  /**
   * **가용 수량에 자리를 두지 않는다**(계획 결정 4). 보유에서 예약·피킹·**보류**를 뺀 값인데,
   * 폐기 대상은 바로 그 보류·차단된 재고일 가능성이 크다 — 상한으로 쓰면 **폐기해야 할 것을
   * 화면이 막는다.** 자리가 없으면 나중에 그 값을 집어 오는 경로도 없다.
   */
  it('가용·예약·피킹·보류 수량은 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toBalanceView(balanceResponse()) };

    for (const key of ['availableQty', 'reservedQty', 'pickedQty', 'blockedQty']) {
      expect(view).not.toHaveProperty(key);
    }
  });

  /**
   * **없음을 없음으로 옮긴다.** 계약은 `lotId`를 「`groupBy`가 LOT일 때 채워진다」로 두었다 —
   * `?? 0`으로 메우면 **0번 LOT의 잔액**이라는 없는 사실이 만들어지고 어느 줄의 상한으로 읽힌다.
   */
  it('LOT이 없는 줄은 없음으로 옮긴다', () => {
    expect(toBalanceView(balanceResponse({ groupBy: 'ITEM', lotId: undefined })).lotId).toBeNull();
  });
});

describe('formatDateTime', () => {
  it('날짜와 분까지 낸다', () => {
    expect(formatDateTime('2026-08-06T09:12:00+09:00')).toBe('2026-08-06 09:12');
  });

  /**
   * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 자재가 실제로 들어온 곳의
   * 시각이고, 보는 사람의 시간대로 옮기면 같은 전표가 사람마다 다른 시각으로 보인다.
   */
  it('시간대를 옮기지 않는다', () => {
    expect(formatDateTime('2026-08-06T09:12:00Z')).toBe('2026-08-06 09:12');
    expect(formatDateTime('2026-08-06T09:12:00-05:00')).toBe('2026-08-06 09:12');
  });

  /**
   * **형식이 아니면 원문을 그대로 낸다.** 「—」로 바꾸면 값이 없는 것과 못 알아본 것이
   * 구분되지 않는다 — 서버가 보낸 값을 화면이 삼키지 않는다.
   */
  it('알아보지 못한 값은 원문을 낸다', () => {
    expect(formatDateTime('2026-08-06')).toBe('2026-08-06');
    expect(formatDateTime('')).toBe('');
  });
});

/** 출고 전표 응답 한 건. **화면이 읽지 않는 필드도 실어** 옮기기가 실제로 고르는지 본다. */
const issueResponse = (overrides: Partial<IssueResponse> = {}): IssueResponse => ({
  goodsIssueId: 9501,
  goodsIssueNo: 'GI-2026-950001',
  issueTypeCode: 'SAMPLE_GI_TYPE_A',
  sourceDocumentTypeCode: 'SAMPLE_SRC_TYPE_A',
  sourceDocumentId: 9001,
  sourceWarehouseId: 9701,
  destinationTypeCode: 'SAMPLE_DEST_TYPE_A',
  destinationId: 9561,
  issuedAt: '2026-08-08T14:20:00+09:00',
  statusCode: 'SAMPLE_GI_STATUS_A',
  reasonCode: 'SAMPLE_GI_REASON_A',
  replacementExpected: false,
  approvalRequestId: 9521,
  erpMessageQueued: true,
  remarks: '합성 비고',
  ...overrides,
});

describe('toIssueView', () => {
  it('화면이 쓰는 아홉만 옮긴다', () => {
    expect(toIssueView(issueResponse())).toEqual({
      goodsIssueId: 9501,
      goodsIssueNo: 'GI-2026-950001',
      issueTypeCode: 'SAMPLE_GI_TYPE_A',
      sourceWarehouseId: 9701,
      issuedAt: '2026-08-08T14:20:00+09:00',
      statusCode: 'SAMPLE_GI_STATUS_A',
      reasonCode: 'SAMPLE_GI_REASON_A',
      approvalRequestId: 9521,
      erpMessageQueued: true,
    });
  });

  /**
   * 짝 방향 — **자리를 두지 않은 값은 옮겨지지 않는다.** 도착지·원천 문서·대체 입고는 이
   * 화면이 그리지도 보내지도 않는 값이고, 도착지·원천 문서는 낼 것이 번호밖에 없다(`omf-mes#44`).
   */
  it('원천 문서·도착지·대체 입고·비고는 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toIssueView(issueResponse()) };

    for (const key of [
      'sourceDocumentTypeCode',
      'sourceDocumentId',
      'destinationTypeCode',
      'destinationId',
      'replacementExpected',
      'remarks',
    ]) {
      expect(view).not.toHaveProperty(key);
    }
  });

  /**
   * **없음을 없음으로 옮긴다.** 계약이 셋을 선택으로 두었고, `?? 0`·`?? ''`로 메우면
   * 「사유 코드가 빈 문자열인 전표」·「0번 승인 요청」이라는 없는 사실이 만들어진다 —
   * 뒤엣것은 `/app/approval-requests/0`으로 나가는 요청이 된다.
   */
  it('선택 필드가 없으면 없음으로 옮긴다', () => {
    const view = toIssueView(
      issueResponse({
        reasonCode: undefined,
        approvalRequestId: undefined,
        erpMessageQueued: undefined,
      }),
    );

    expect(view.reasonCode).toBeNull();
    expect(view.approvalRequestId).toBeNull();
    expect(view.erpMessageQueued).toBeNull();
  });

  it('널로 온 값도 없음으로 옮긴다', () => {
    const view = toIssueView(issueResponse({ reasonCode: null, approvalRequestId: null }));

    expect(view.reasonCode).toBeNull();
    expect(view.approvalRequestId).toBeNull();
  });

  /* 「적재되지 않음」과 「값이 오지 않음」은 다른 사실이다 — 거짓을 없음으로 접지 않는다. */
  it('ERP 적재 거짓을 없음으로 접지 않는다', () => {
    expect(toIssueView(issueResponse({ erpMessageQueued: false })).erpMessageQueued).toBe(false);
  });
});

const issueLineResponse = (overrides: Partial<IssueLineResponse> = {}): IssueLineResponse => ({
  goodsIssueLineId: 9511,
  goodsIssueId: 9501,
  lineNo: 1,
  pickingLineId: null,
  itemId: 9301,
  lotId: 9601,
  issueQty: 40,
  uomId: 9801,
  sourceLocationId: 9901,
  inventoryTransactionLineId: 9531,
  ...overrides,
});

describe('toIssueLineView', () => {
  it('화면이 쓰는 일곱만 옮긴다', () => {
    expect(toIssueLineView(issueLineResponse())).toEqual({
      goodsIssueLineId: 9511,
      itemId: 9301,
      lotId: 9601,
      issueQty: 40,
      uomId: 9801,
      sourceLocationId: 9901,
      inventoryTransactionLineId: 9531,
    });
  });

  /**
   * **원장 라인 번호만은 담는다** — 「전기됐는가」를 그 값의 유무로 판정하기 때문이다
   * (계획 결정 7). 화면에는 번호가 아니라 표식이 나간다.
   */
  it('전기되지 않은 줄은 원장 라인이 없음이다', () => {
    expect(
      toIssueLineView(issueLineResponse({ inventoryTransactionLineId: null }))
        .inventoryTransactionLineId,
    ).toBeNull();
    expect(
      toIssueLineView(issueLineResponse({ inventoryTransactionLineId: undefined }))
        .inventoryTransactionLineId,
    ).toBeNull();
  });

  it('줄번호·전표 번호·피킹 라인은 옮기지 않는다', () => {
    const view: Record<string, unknown> = { ...toIssueLineView(issueLineResponse()) };

    for (const key of ['goodsIssueId', 'lineNo', 'pickingLineId']) {
      expect(view).not.toHaveProperty(key);
    }
  });
});

describe('readableName', () => {
  it('이름이 있으면 그대로 낸다', () => {
    expect(readableName('합성 상신자 가', '없음')).toBe('합성 상신자 가');
  });

  /* 이름을 못 풀어도 **번호를 대신 내지 않는다**(`omf-mes#44`) — 그 사실을 적는다. */
  it('빈 값·공백만이면 그 사실을 적는다', () => {
    expect(readableName('', '없음')).toBe('없음');
    expect(readableName('   ', '없음')).toBe('없음');
  });

  /* 판정에만 다듬기를 쓰고 값은 실려 온 그대로 낸다 — 서버 표기를 화면이 고쳐 쓰지 않는다. */
  it('이름 안의 공백은 건드리지 않는다', () => {
    expect(readableName(' 합성 상신자 가 ', '없음')).toBe(' 합성 상신자 가 ');
  });
});

describe('toReasonLines', () => {
  /**
   * **줄바꿈이 뜻을 나른다.** 승인 요청의 업무 값이 사유 하나뿐이라 상신자가 여러 줄로
   * 근거를 적는다 — 한 줄로 이어 붙이면 무엇이 무엇의 근거인지 읽을 수 없다.
   */
  it('줄 단위로 나눈다', () => {
    expect(toReasonLines('첫 줄\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
    expect(toReasonLines('첫 줄\r\n둘째 줄')).toEqual(['첫 줄', '둘째 줄']);
  });

  /* 가운데 빈 줄과 줄 안의 공백은 문단 구분과 들여쓴 목록이라 건드리지 않는다. */
  it('빈 줄과 들여쓰기를 지우지 않는다', () => {
    expect(toReasonLines('첫 줄\n\n  들여쓴 줄')).toEqual(['첫 줄', '', '  들여쓴 줄']);
  });

  it('사유가 비었으면 그 사실을 적는다', () => {
    expect(toReasonLines('')).toEqual([t.values.emptyReason]);
    expect(toReasonLines('   ')).toEqual([t.values.emptyReason]);
  });
});

describe('toIssueDetailResult', () => {
  /**
   * **상세 조회와 전표 생성이 같은 모양을 돌려준다**(계약 실측). 옮기기가 한 자리라
   * 방금 만든 전표와 다시 읽은 전표가 서로 다른 값을 보이는 일이 생기지 않는다.
   */
  it('헤더와 라인을 함께 옮긴다', () => {
    const result = toIssueDetailResult({
      goodsIssue: issueResponse(),
      lines: [issueLineResponse()],
    });

    expect(result.issue.goodsIssueNo).toBe(issueResponse().goodsIssueNo);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.issueQty).toBe(issueLineResponse().issueQty);
  });

  it('라인이 없는 전표도 그대로 옮긴다', () => {
    expect(toIssueDetailResult({ goodsIssue: issueResponse(), lines: [] }).lines).toEqual([]);
  });
});

describe('hasAnyDisposalDraftValue', () => {
  it('빈 초안에는 버릴 것이 없다', () => {
    expect(hasAnyDisposalDraftValue(EMPTY_DISPOSAL_DRAFT)).toBe(false);
  });

  /**
   * **모든 칸을 함께 본다.** 한쪽만 보면 나머지가 확인 없이 사라진다 — 「입력 지우기」가
   * 줄 초안과 이 초안을 함께 버리는 자리라, 판정이 좁으면 잠긴 버튼 뒤로 값이 남는다.
   */
  it.each([
    ['codes', { codes: { ...EMPTY_DISPOSAL_DRAFT.codes, issueType: 'SAMPLE_GI_TYPE_A' } }],
    ['issuedDate', { issuedDate: '2026-08-11' }],
    ['issuedTime', { issuedTime: '09:30' }],
    ['remarks', { remarks: '비고' }],
    ['reason', { reason: '사유' }],
  ] as const)('%s 하나만 채워도 버릴 것이 있다', (_name, patch) => {
    expect(hasAnyDisposalDraftValue({ ...EMPTY_DISPOSAL_DRAFT, ...patch })).toBe(true);
  });
});
