import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다.
 * 결재선에는 **물리 삭제 경로가 없어**(사용 중지만 있다) 잘못 만든 결재선을 지울 수 없고,
 * 그 결재선은 어떤 상신과도 매칭되지 않는다 — 지어낸 값의 비용이 유난히 크다.
 * 계약의 `@example` 값도 심지 않는다. 그것은 예시이지 확정이 아니다.
 *
 * **이 화면에서 잠기는 범위는 좁다.** 승인 유형은 **등록의 유일한 필수 필드**이고 수정 요청에는
 * 아예 없다 — 값 목록이 비어 있어도 이미 있는 결재선을 고치고 단계를 세우고 끄고 켤 수 있다.
 * 이 회차(읽기)에서는 조회 조건의 선택칸 하나가 빌 뿐이다.
 *
 * **값이 확정되면 이 파일의 배열만 채우면 된다.** 조건 줄은 배열을 읽을 뿐이라 다른 자리를
 * 고칠 필요가 없고, 채우는 순간 선택칸이 저절로 살아난다.
 *
 * 추적: 승인 유형 값 목록 미확정 — **`omf-mes#64`**. 비공개 저장소이므로 번호로만 참조한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 승인 유형 값 목록 — **비어 있는 것이 지금의 사실이다.** */
export const PLACEHOLDER_APPROVAL_TYPE_CODES: readonly string[] = [];

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
 * 승인 유형은 값 목록 자체가 없어 선택지가 비지만, 승인자 구분은 **계약이 셋을 못 박았고
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
 * 상수로 굳히면 그때 고칠 자리를 찾아 헤매게 된다(승인 유형의 자리표시 배열과 같은 규율).
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
