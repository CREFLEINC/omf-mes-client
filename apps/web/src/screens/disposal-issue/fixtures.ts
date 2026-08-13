import type { ReceiptView, WarehouseResponse } from './types';

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * 여기 있는 값은 전부 지어낸 합성값이다. 이 화면은 입고번호·창고처럼 **실제로 보일 법한 값**을
 * 그리는 자리라, 한눈에 예시임이 보이는 접두(`SAMPLE-`·`SAMPLE_`)와 지어낸 번호 대역
 * (`GR-2026-9…`)만 쓴다. 실 운영 코드·거래처명·품목코드를 넣지 않는다(공개 저장소 경계).
 *
 * **계약의 `@example` 값을 쓰지 않는다.** 예시를 픽스처에 쓰면 나중에 「확정 값」으로 읽힌다.
 *
 * **내부 번호(FK)는 서로 겹치지 않는 대역으로 나눈다** — 9000대(입고 전표) · 9100대(공장) ·
 * 9200대(원천 문서) · 9700대(창고). 「표 어디에도 내부 번호가 렌더되지 않는다」를 검사할 때
 * 수량 같은 정상 숫자와 헷갈리지 않게 하기 위해서다. 업무 번호에 내부 번호가 **부분 문자열로
 * 들어가지 않도록** 대역을 갈라 두었다.
 */

const BASE_RECEIPT: ReceiptView = {
  goodsReceiptId: 9001,
  goodsReceiptNo: 'GR-2026-900001',
  receiptTypeCode: 'SAMPLE_GR_TYPE_A',
  warehouseId: 9701,
  receiptDatetime: '2026-08-06T09:12:00+09:00',
  statusCode: 'SAMPLE_GR_STATUS_A',
};

/** 한 항목만 다른 건을 만든다. 무엇이 다른지 그 인자만 보고 읽히게 한다. */
const goodsReceipt = (overrides: Partial<ReceiptView> = {}): ReceiptView => ({
  ...BASE_RECEIPT,
  ...overrides,
});

/**
 * 화면 수준 테스트가 목록 응답으로 쓰는 세 건. 화면이 다뤄야 하는 까다로운 입력을 일부러 담는다.
 *
 * - 9001 — 값이 전부 채워져 있다. 폐기 대상 창고(9701)에 들어왔다
 * - 9002 — **미사용 창고**로 들어왔고 유형·상태 코드가 9001과 다르다
 * - 9003 — **창고 번호가 참조 목록에 없다.** 「목록에 없음」 갈래를 실제 값으로 만든다
 */
export const goodsReceiptFixtures: ReceiptView[] = [
  goodsReceipt(),
  goodsReceipt({
    goodsReceiptId: 9002,
    goodsReceiptNo: 'GR-2026-900002',
    receiptTypeCode: 'SAMPLE_GR_TYPE_B',
    warehouseId: 9702,
    statusCode: 'SAMPLE_GR_STATUS_B',
  }),
  goodsReceipt({
    goodsReceiptId: 9003,
    goodsReceiptNo: 'GR-2026-900003',
    warehouseId: 9799,
    receiptDatetime: '2026-08-07T10:05:00+09:00',
  }),
];

/**
 * 목록 응답에 실리는 모양. **화면이 버리는 값이 응답에 있어야** 옮기기가 실제로 고르는지 보인다.
 */
interface ReceiptResponseShape extends ReceiptView {
  plantId: number;
  sourceDocumentTypeCode: string;
  sourceDocumentId: number;
}

const toReceiptResponse = (view: ReceiptView): ReceiptResponseShape => ({
  ...view,
  plantId: 9101,
  sourceDocumentTypeCode: 'SAMPLE_SRC_TYPE_A',
  sourceDocumentId: 9201,
});

export const goodsReceiptResponseFixtures = goodsReceiptFixtures.map(toReceiptResponse);

/**
 * 창고 참조 목록의 응답 본문. **화면이 읽는 필드만 담는다** — 스텁 응답은 JSON이라 계약의
 * 모든 필드를 갖출 필요가 없고, 갖추면 무엇을 읽는지가 오히려 가려진다.
 *
 * 목록에 **없는 번호**를 가진 행이 픽스처에 함께 있다(9003의 창고 9799) — 「목록에 없음」
 * 갈래를 실제 값으로 만들어 내는 유일한 방법이다.
 *
 * **유형 코드가 서로 다르다.** 창고 유형의 값 목록이 확정됐을 때 선택지가 실제로 좁혀지는지를
 * 재려면 좁힘에 걸리는 값과 걸리지 않는 값이 함께 있어야 한다.
 */
export const warehouseFixtures: Pick<
  WarehouseResponse,
  'warehouseId' | 'warehouseCode' | 'warehouseName' | 'warehouseTypeCode' | 'isActive'
>[] = [
  {
    warehouseId: 9701,
    warehouseCode: 'SAMPLE-WH-01',
    warehouseName: '합성 폐기창고 가',
    warehouseTypeCode: 'SAMPLE_WH_TYPE_A',
    isActive: true,
  },
  /*
   * **미사용 창고.** 선택지에서 빼지 않는다 — 지금은 쓰지 않는 창고로 들어온 과거 입고가
   * 있고, 빼면 그 입고를 조건으로 찾을 방법이 사라진다.
   */
  {
    warehouseId: 9702,
    warehouseCode: 'SAMPLE-WH-02',
    warehouseName: '합성 자재창고 나',
    warehouseTypeCode: 'SAMPLE_WH_TYPE_B',
    isActive: false,
  },
];

/** 폐기 대상 창고 유형이 확정됐다고 가정할 때 쓰는 합성 코드. **계약 예시값이 아니다.** */
export const SAMPLE_DEFECT_WAREHOUSE_TYPE = 'SAMPLE_WH_TYPE_A';

/** 화면 어디에도 나와서는 안 되는 내부 번호(FK). 업무 번호와 겹치지 않는 대역이다. */
export const INTERNAL_IDS = ['9001', '9002', '9003', '9101', '9201', '9701', '9702', '9799'];
