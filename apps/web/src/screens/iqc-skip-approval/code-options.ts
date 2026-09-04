import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 긴급 IQC 생략은 고정 OpenAPI의 `IQC_SKIP` 승인 유형만 조회한다. 요청 상태는 운영 공통코드
 * 조회 대상이라 값 목록을 발명하지 않고 비워 둔다.
 */

/**
 * 긴급 IQC 생략의 **승인 유형 코드** — 이 화면의 정체이자 유일한 고정 축.
 *
 * `string | null`로 넓혀 두는 것은 의도다. `null` 리터럴로 좁으면 「값이 있을 때」를 다루는
 * 코드가 닿을 수 없는 가지로 보이고, 그러면 전환을 재는 시험이 성립하지 않는다.
 */
export const IQC_SKIP_APPROVAL_TYPE_CODE: string | null = 'IQC_SKIP';

/** 요청 상태 값 목록 — 같은 사정이다. 계약이 「값 목록은 공통코드 소관」이라고 적었다. */
export const PLACEHOLDER_REQUEST_STATUS_CODES: readonly string[] = [];

/**
 * 승인 유형 코드가 **없는 동안** 목록 위에 서는 안내.
 *
 * 좁히지 못한다는 사실을 화면이 스스로 밝힌다 — 감추면 사용자가 「여기 있는 것은 전부 IQC
 * 생략 건」이라고 믿고 남의 유형을 결재한다. **값이 차면 `undefined`가 되어 안내가 사라진다.**
 *
 * **공백만인 값은 채워지지 않은 것으로 본다.** 그 값을 조건으로 실으면 어떤 요청도 걸리지
 * 않아 화면이 늘 0건이 되는데, 사용자에게는 「내 결재 대기가 없다」로 읽힌다.
 */
export const typePendingNote = (approvalTypeCode: string | null): string | undefined =>
  approvalTypeCode === null || approvalTypeCode.trim() === ''
    ? messages.iqcSkipApproval.typePendingNote
    : undefined;

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
