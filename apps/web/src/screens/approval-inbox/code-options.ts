import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 승인 유형은 고정 OpenAPI가 닫은 9개 enum을 그대로 쓴다. 요청 상태는 운영 공통코드 조회
 * 대상이라 값 목록을 발명하지 않고 비워 둔다. 이 화면이 소유하며 다른 화면의 목록을 빌리지 않는다.
 */

/** OpenAPI가 고객 확장 불가 enum으로 닫은 승인 유형 값 목록. */
export const PLACEHOLDER_APPROVAL_TYPE_CODES = [
  'GOODS_ISSUE_DISPOSAL',
  'INVENTORY_ADJUSTMENT',
  'PURCHASE_ORDER',
  'INBOUND_RECEIPT_CANCEL',
  'GOODS_RECEIPT_CANCEL',
  'GOODS_ISSUE_CANCEL',
  'SHIPMENT_CANCEL',
  'IQC_SKIP',
  'PRODUCTION_RESULT_CORRECT',
] as const;

/** 요청 상태 값 목록 — 같은 사정이다. 계약이 「값 목록은 공통코드 소관」이라고 적었다. */
export const PLACEHOLDER_REQUEST_STATUS_CODES: readonly string[] = [];

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toCodeOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;
