import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 고정 OpenAPI가 닫은 승인 유형에서 없어진 IQC 생략(omf-all-around#353)을 뺀 8개를 조회와 등록에서 함께 쓰는 단일 목록이다.
 * 이 화면이 소유하며 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
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
  'PRODUCTION_RESULT_CORRECT',
] as const;

/** 승인 유형 코드 → 사람이 읽는 이름 — 결재함과 같은 이름표를 쓴다. 목록에 없는 코드는 코드 그대로 보인다. */
export const approvalTypeLabelOf = (code: string): string =>
  messages.approvalInbox.approvalTypeNames[code] ?? code;

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨은 사람이 읽는 이름이다(#353, 사용자 지시).** 코드값만으로는 무슨 결재인지 읽히지 않아
 * 서버 알림 이름과 같은 이름을 붙인다(`approvalTypeLabelOf`). 값은 코드 그대로 보낸다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toApprovalTypeOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: approvalTypeLabelOf(code) }));

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;
