import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 고정 OpenAPI가 닫은 승인 유형 9개를 조회와 등록에서 함께 쓰는 단일 목록이다.
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
  'IQC_SKIP',
  'PRODUCTION_RESULT_CORRECT',
] as const;

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다(자주 쓰는 것부터 등).
 */
export const toApprovalTypeOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/** 선택지가 왜 비어 있는지 밝히는 안내. **차면 거둔다** — 남으면 화면이 거짓말을 한다. */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;

/**
 * 승인자 구분 — **승인 유형과 사정이 다르다.**
 *
 * 승인 유형은 고정 OpenAPI가 값 목록을 닫았지만, 승인자 구분은 **계약이 셋을 못 박았고
 * 그중 하나만 1차에 열린다.** 계약이 그 이유까지 적었다 — 역할·부서는 상신할 때 사람을 고를
 * 입력이 물리 모델에 없다. 그래서 여기서는 **지어낼 것이 없고, 감출 이유도 없다.**
 *
 * **잠긴 선택지를 감추지 않는다.** 감추면 사용자는 역할·부서 결재가 아예 없는 기능이라고
 * 읽는다. 보이되 잠그고 사유를 붙이면 「지금은 아니다」가 읽힌다.
 *
 * 추적: 역할·부서 승인자 미결 — **`omf-mes#69`**. 비공개 저장소이므로 번호로만 참조한다.
 */
export const APPROVER_TYPE_CODES = ['USER', 'ROLE', 'DEPARTMENT'] as const;

export type ApproverTypeCode = (typeof APPROVER_TYPE_CODES)[number];

/**
 * 1차에 고를 수 있는 구분 — **여기 하나가 잠금의 유일한 근거다.**
 *
 * `omf-mes#69`가 열리면 이 배열에 값을 더하는 것만으로 선택지가 살아난다. 잠금을 부품 안에
 * 상수로 굳히면 그때 고칠 자리를 찾아 헤매게 된다.
 */
export const ENABLED_APPROVER_TYPE_CODES: readonly ApproverTypeCode[] = ['USER'];

const APPROVER_TYPE_LABELS: Record<ApproverTypeCode, string> = {
  USER: messages.approvalRoute.values.approverTypeUser,
  ROLE: messages.approvalRoute.values.approverTypeRole,
  DEPARTMENT: messages.approvalRoute.values.approverTypeDepartment,
};

/**
 * 계약의 세 값을 모두 선택지로 낸다. **열린 것만 고를 수 있다.**
 *
 * 디자인 시스템 `Select`가 옵션별 잠금을 지원하므로(설치본 실측) 잠긴 값을 목록에서 빼지 않고
 * 잠근 채로 보인다 — 「고를 수 없다」와 「없다」는 다른 사실이다.
 */
export const toApproverTypeOptions = (enabledCodes: readonly ApproverTypeCode[]): SelectOption[] =>
  APPROVER_TYPE_CODES.map((code) => ({
    value: code,
    label: APPROVER_TYPE_LABELS[code],
    disabled: !enabledCodes.includes(code),
  }));

/** 잠긴 선택지가 하나라도 있으면 왜 잠겼는지 밝힌다. **전부 열리면 거둔다.** */
export const approverTypeNote = (options: readonly SelectOption[]): string | undefined =>
  options.some((option) => option.disabled === true)
    ? messages.approvalRoute.notes.approverTypePending
    : undefined;
