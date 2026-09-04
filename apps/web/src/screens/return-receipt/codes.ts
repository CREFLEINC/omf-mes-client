import type { components, paths } from '@omf-mes/api-client';

type GoodsReceiptCreate = components['schemas']['GoodsReceiptCreate'];
type GoodsReceiptLineCreate = components['schemas']['GoodsReceiptLineCreate'];
type PartnerQuery = NonNullable<paths['/mdm/partners']['get']['parameters']['query']>;

/**
 * 이 화면이 «고정»하는 값들 — 사용자가 고르지 않는다.
 *
 * | 값 | 근거 |
 * | --- | --- |
 * | 입고 유형 `RETURN` | 스펙 §4-A 「반품 입고 고정」. 표시명은 `RECEIPT_TYPE` 코드값이 준다 |
 * | 원천 문서 `SHIPMENT` | 원 출하를 찾았을 때만 — 못 찾으면 유형·식별자를 «함께» 비운다(§5-3 · A-10) |
 * | 재고 상태 `ON_HOLD` | 반품은 보류로 들어온다(§5-5 · 결정 10 — Lot Status 가 차단의 단일 지점) |
 * | 품질 상태 `INSPECTION_PENDING` | ⚠ 가정 — 스펙은 「Hold 고정」이라 적는데 `LOT_STATUS` 그룹에 Hold 가 없다. 판정 전이므로 «검사 대기»로 싣고 정보 요청을 냈다 |
 *
 * 계약이 유니온으로 좁힌 값은 **생성물 타입에서 파생**한다 — 이름을 바꾸면 컴파일이 멈춘다.
 */
export const RECEIPT_TYPE_RETURN = 'RETURN';

export type SourceDocumentTypeCode = NonNullable<GoodsReceiptCreate['sourceDocumentTypeCode']>;
export const SOURCE_DOCUMENT_SHIPMENT = 'SHIPMENT' satisfies SourceDocumentTypeCode;

export type InventoryStatusCode = GoodsReceiptLineCreate['inventoryStatusCode'];
export const INVENTORY_STATUS_HOLD = 'ON_HOLD' satisfies InventoryStatusCode;

export const QUALITY_STATUS_PENDING = 'INSPECTION_PENDING';

export type PartnerRoleCode = NonNullable<PartnerQuery['roleTypeCode']>;
export const CUSTOMER_ROLE = 'CUSTOMER' satisfies PartnerRoleCode;

/** 코드값 그룹 — 채번 식별자가 아니라 코드로 부른다(환경마다 다르다 · G-32). */
export const REASON_CODE_GROUP = 'GOODS_RECEIPT_REASON';
export const SHIPMENT_STATUS_CODE_GROUP = 'SHIPMENT_STATUS';

/** 선택지 목록 한 번에 받는 크기 — 이보다 많으면 「잘렸다」를 말한다. */
export const LOOKUP_PAGE_SIZE = 200;

export interface CodeOption {
  value: string;
  label: string;
}
