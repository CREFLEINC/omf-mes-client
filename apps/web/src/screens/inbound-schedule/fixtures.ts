import { toDateText } from './arrival';
import type { AsnLineView, AsnView } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 거래처·품목·LOT처럼 **실제로 보일 법한 값**을
 * 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 「합성 …」만 쓴다.
 * 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 7000대(입하 예정·라인) ·
 * 8100~8500대(참조). 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 줄번호·수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다.
 */

/** 「오늘」을 인자로 받아 만든다 — 고정 날짜를 쓰면 경과 표시가 실행 날짜에 따라 뒤집힌다. */
const shiftDays = (today: Date, days: number): string =>
  toDateText(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));

const BASE_ASN: AsnView = {
  asnId: 7001,
  asnNo: 'SAMPLE-ASN-0001',
  supplierId: 8101,
  plantId: 8201,
  expectedArrivalDate: '2026-08-10',
  deliveryNoteNo: 'SAMPLE-DN-0001',
  statusCode: 'SAMPLE_STATUS_A',
  remarks: '합성 비고입니다',
};

/** 한 항목만 다른 건을 만든다. 무엇을 검사하는 테스트인지 그 인자만 보고 읽히게 한다. */
export const asn = (overrides: Partial<AsnView> = {}): AsnView => ({ ...BASE_ASN, ...overrides });

const BASE_LINE: AsnLineView = {
  asnLineId: 7301,
  asnId: 7001,
  lineNo: 1,
  purchaseOrderLineId: 8401,
  itemId: 8301,
  expectedQty: 12,
  uomId: 8501,
  supplierLotNo: 'SAMPLE-LOT-0001',
};

export const asnLine = (overrides: Partial<AsnLineView> = {}): AsnLineView => ({
  ...BASE_LINE,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 7001 — **어제** 도착 예정이라 경과 표시가 붙는다. 선택 필드가 둘 다 채워져 있다
 * - 7002 — **오늘** 도착 예정이라 경과 표시가 붙지 않는다(당일 미포함).
 *   `deliveryNoteNo`·`remarks`가 **둘 다 null**이고, 공급사 번호가 **참조 목록에 없다**
 * - 7003 — **내일** 도착 예정이다. 공장이 7001과 다르다
 *
 * 상태 코드는 7001·7003이 **같은 값**이다 — 선택지를 뽑을 때 중복이 접히는지 여기서 드러난다.
 */
export const asnFixtures = (today: Date): AsnView[] => [
  asn({ expectedArrivalDate: shiftDays(today, -1) }),
  asn({
    asnId: 7002,
    asnNo: 'SAMPLE-ASN-0002',
    supplierId: 8102,
    expectedArrivalDate: shiftDays(today, 0),
    deliveryNoteNo: null,
    statusCode: 'SAMPLE_STATUS_B',
    remarks: null,
  }),
  asn({
    asnId: 7003,
    asnNo: 'SAMPLE-ASN-0003',
    plantId: 8202,
    expectedArrivalDate: shiftDays(today, 1),
    deliveryNoteNo: 'SAMPLE-DN-0003',
    remarks: null,
  }),
];

/**
 * 7001의 라인 두 줄.
 *
 * - 7301 — 발주 라인이 이어져 있고 공급사 LOT도 있다
 * - 7302 — **발주 라인이 없고**(무발주) LOT도 없다. 품목 번호가 **참조 목록에 없다**
 *
 * 무발주 줄을 목록에서 빼지 않는다는 규칙(이슈 #20 §4)을 이 두 줄이 함께 검사한다.
 */
export const asnLineFixtures: AsnLineView[] = [
  asnLine(),
  asnLine({
    asnLineId: 7302,
    lineNo: 2,
    purchaseOrderLineId: null,
    itemId: 8302,
    expectedQty: 34,
    supplierLotNo: null,
  }),
];

/**
 * 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라
 * 계약의 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 행이 픽스처에 함께 있다(7002의 공급사 · 7302의 품목) —
 * 「목록에 없음」 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 */
export const partnerFixtures = [
  { partnerId: 8101, partnerCode: 'SAMPLE-SUP-01', partnerName: '합성 공급사 가', isActive: true },
];

export const plantFixtures = [
  { plantId: 8201, plantCode: 'SAMPLE-PLT-01', plantName: '합성 공장 가', isActive: true },
  { plantId: 8202, plantCode: 'SAMPLE-PLT-02', plantName: '합성 공장 나', isActive: true },
];

export const itemFixtures = [
  { itemId: 8301, itemCode: 'SAMPLE-ITEM-01', itemName: '합성 품목 가', isActive: true },
];

export const uomFixtures = [
  { uomId: 8501, uomCode: 'SAMPLE-EA', uomName: '합성 단위 개', isActive: true },
];
