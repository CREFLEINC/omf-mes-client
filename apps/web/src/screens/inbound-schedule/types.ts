import type { components } from '@omf-mes/api-client';

/**
 * W-01-09 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이 유지된다.
 *
 * 이 화면은 **읽기만 한다.** 계약에 이 자원의 쓰기 오퍼레이션이 하나도 없다 —
 * ERP 수신본이라 등록·수정·삭제가 없고, 라인에 낙관적 잠금 컬럼 자체가 없다.
 *
 * 이 파일은 이 화면이 소유한다. **다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다** —
 * 형태가 같아도 리소스 이름이 박힌 타입을 공유하면 한 화면의 계약 변화가 다른 화면을 끌고 간다.
 */

type AsnResponse = components['schemas']['Asn'];
type AsnLineResponse = components['schemas']['AsnLine'];

export type PageMeta = components['schemas']['PageMeta'];

/**
 * 화면이 다루는 입하 예정 한 건. 계약 응답과 같되 **선택 필드가 전부 `null`로 모인다.**
 *
 * 키가 없는 경우와 `null`인 경우를 화면이 갈라 다루면 같은 「받지 못했다」가 두 갈래로 흩어지고,
 * 대시 표기 판정이 자리마다 달라진다.
 */
export interface AsnView extends Omit<AsnResponse, 'deliveryNoteNo' | 'remarks'> {
  deliveryNoteNo: string | null;
  remarks: string | null;
}

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toAsnView = (data: AsnResponse): AsnView => ({
  asnId: data.asnId,
  asnNo: data.asnNo,
  supplierId: data.supplierId,
  plantId: data.plantId,
  expectedArrivalDate: data.expectedArrivalDate,
  // `??`를 쓴다 — 빈 문자열은 서버가 보낸 값이라 `null`로 뭉개면 그 사실이 사라진다.
  deliveryNoteNo: data.deliveryNoteNo ?? null,
  statusCode: data.statusCode,
  remarks: data.remarks ?? null,
});

/**
 * 화면이 다루는 입하 예정 라인 한 줄.
 *
 * **`purchaseOrderLineId`를 화면에 내지 않는다**(#44 · 계획 결정 6) — 그 번호를 이름으로 풀 경로가
 * 계약에 없어(`purchaseOrderId`가 없어 발주 라인 경로를 조립할 수 없다) 낼 것이 번호밖에 없다.
 * 다만 **타입에는 남긴다.** 무발주 라인을 목록에서 빼지 않는다는 규칙(이슈 #20 §4)을
 * 테스트가 실제 값으로 검사할 수 있어야 하기 때문이다.
 */
export interface AsnLineView extends Omit<
  AsnLineResponse,
  'purchaseOrderLineId' | 'supplierLotNo'
> {
  purchaseOrderLineId: number | null;
  supplierLotNo: string | null;
}

/** 라인 한 줄을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toAsnLineView = (data: AsnLineResponse): AsnLineView => ({
  asnLineId: data.asnLineId,
  asnId: data.asnId,
  lineNo: data.lineNo,
  purchaseOrderLineId: data.purchaseOrderLineId ?? null,
  itemId: data.itemId,
  expectedQty: data.expectedQty,
  uomId: data.uomId,
  supplierLotNo: data.supplierLotNo ?? null,
});

/** 목록 조회 결과. `page`는 쪽 이동과 위치 표시의 정본이다. */
export interface AsnListResult {
  items: AsnView[];
  page: PageMeta;
}

/**
 * 선택 목록의 원본 항목.
 *
 * **사용 여부는 선택지를 거르는 데 쓰지 않고 표식을 붙이는 데 쓴다.** 이 화면은 조회 전용이고
 * ERP 수신본에는 지금은 쓰지 않는 거래처·품목을 참조하는 과거 건이 온다 — 미사용 값을 빼면
 * 그 건들을 조건으로 찾을 방법이 사라진다. 표식을 붙이는 자리는 `screen.tsx`의
 * `toSelectOptions` 한 곳이고, 표의 이름 칸에는 붙이지 않는다(저장소 관례).
 */
export interface LookupEntry {
  value: string;
  label: string;
  isActive: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}
