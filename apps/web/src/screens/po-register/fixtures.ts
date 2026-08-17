import type { components } from '@omf-mes/api-client';

import type { LineDraft, SourceLineView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 입하번호·거래처·품목처럼 **실제로 보일 법한
 * 값**을 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)만 쓴다.
 * 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 예시값(`1001`·`IR-2026-…`)을 쓰지 않는다.** 계약 예시가 픽스처로 새어 들어오면
 * 「목이 채워 준 값」과 「화면이 만든 값」이 구분되지 않는다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9100대(입하 전표·라인) ·
 * 9200대(사업부) · 9300대(공급사) · 9400대(공장) · 9500대(품목) · 9600대(단위) ·
 * 9700대(발주 라인). 「화면 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 줄번호·수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 */

type InboundReceiptResponse = components['schemas']['InboundReceipt'];
type InboundReceiptLineResponse = components['schemas']['InboundReceiptLine'];

const BASE_RECEIPT: InboundReceiptResponse = {
  inboundReceiptId: 9101,
  inboundReceiptNo: 'SAMPLE-IR-9101',
  supplierId: 9301,
  plantId: 9401,
  receiptDatetime: '2026-08-16T09:12:00+09:00',
  statusCode: 'SAMPLE_IR_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const inboundReceiptResponse = (
  overrides: Partial<InboundReceiptResponse> = {},
): InboundReceiptResponse => ({ ...BASE_RECEIPT, ...overrides });

const BASE_RECEIPT_LINE: InboundReceiptLineResponse = {
  inboundReceiptLineId: 9111,
  inboundReceiptId: 9101,
  lineNo: 1,
  itemId: 9501,
  receivedQty: 12,
  uomId: 9601,
  supplierLotMissing: false,
  inspectionRequired: false,
  statusCode: 'SAMPLE_IR_STATUS_A',
};

export const inboundReceiptLineResponse = (
  overrides: Partial<InboundReceiptLineResponse> = {},
): InboundReceiptLineResponse => ({ ...BASE_RECEIPT_LINE, ...overrides });

/**
 * 라인 두 줄. **대상을 골라야 하는 갈래를 만드는 값이다**(계획 결정 4) —
 * 한 줄뿐이면 자동으로 확정되므로 「고르기 전에는 잠긴다」를 만들어 낼 수 없다.
 *
 * 둘째 줄의 품목은 **참조 목록에 없다** — 「목록에 없음」 갈래를 실제 값으로 만든다.
 */
export const inboundReceiptLineFixtures: InboundReceiptLineResponse[] = [
  inboundReceiptLineResponse(),
  inboundReceiptLineResponse({
    inboundReceiptLineId: 9112,
    lineNo: 2,
    itemId: 9502,
    receivedQty: 4,
  }),
];

/** 입하 상세 응답 본문. **요청 1회로 머리와 라인이 함께 온다.** */
export const inboundReceiptDetailBody = (
  lines: InboundReceiptLineResponse[] = inboundReceiptLineFixtures,
  receipt: InboundReceiptResponse = inboundReceiptResponse(),
): { inboundReceipt: InboundReceiptResponse; lines: InboundReceiptLineResponse[] } => ({
  inboundReceipt: receipt,
  lines,
});

const BASE_SOURCE_LINE: SourceLineView = {
  inboundReceiptLineId: 9111,
  lineNo: 1,
  itemId: 9501,
  receivedQty: 12,
  uomId: 9601,
};

export const sourceLineView = (overrides: Partial<SourceLineView> = {}): SourceLineView => ({
  ...BASE_SOURCE_LINE,
  ...overrides,
});

/**
 * 값이 전부 유효한 라인 초안. **검사하려는 칸만 인자로 어긋나게 둔다** —
 * 기본값이 이미 잘못돼 있으면 어느 규칙이 울었는지 가릴 수 없다.
 */
const BASE_LINE_DRAFT: LineDraft = {
  key: 'new:0',
  sourceLineId: null,
  sourceQty: null,
  itemId: '9501',
  orderedQty: '12',
  uomId: '9601',
  toleranceOverQty: '0',
  toleranceUnderQty: '0',
};

export const lineDraft = (overrides: Partial<LineDraft> = {}): LineDraft => ({
  ...BASE_LINE_DRAFT,
  ...overrides,
});

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라
 * 계약의 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 */
export const partnerFixtures = [
  { partnerId: 9301, partnerCode: 'SAMPLE-SUP-01', partnerName: '합성 공급사 가', isActive: true },
  { partnerId: 9302, partnerCode: 'SAMPLE-SUP-02', partnerName: '합성 공급사 나', isActive: true },
];

export const businessUnitFixtures = [
  {
    businessUnitId: 9201,
    businessUnitCode: 'SAMPLE-BU-01',
    businessUnitName: '합성 사업부 가',
    isActive: true,
  },
];

export const plantFixtures = [
  { plantId: 9401, plantCode: 'SAMPLE-PLT-01', plantName: '합성 공장 가', isActive: true },
];

/** 9502(둘째 줄의 품목)는 일부러 빠져 있다 — 「목록에 없음」 갈래를 만드는 값이다. */
export const itemFixtures = [
  { itemId: 9501, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true },
  { itemId: 9503, itemCode: 'SAMPLE-ITEM-03', itemName: '합성 품목 다', isActive: false },
];

export const uomFixtures = [
  { uomId: 9601, uomCode: 'SAMPLE-EA', uomName: '합성 단위 개', isActive: true },
];
