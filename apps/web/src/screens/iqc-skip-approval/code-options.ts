import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 화면이 그럴듯한 예시로 메우면 사용자는
 * 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다. 계약의 `@example` 값도 심지 않는다 —
 * 그것은 예시이지 확정이 아니다.
 *
 * **이 화면에서는 잠기는 범위가 다르다.** 앞선 화면(W-CO-09)에서 승인 유형은 조건 하나였지만
 * 여기서는 **화면이 자기 대상을 좁히는 유일한 축**이다. 그래도 **아무것도 잠그지 않는다** —
 * 근거는 `screen.tsx`의 G1 주석에 있다.
 *
 * 추적: 승인 유형·상태 값 목록 미확정 — **`omf-mes#64`**. 비공개 저장소이므로 번호로만 참조한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 긴급 IQC 생략의 **승인 유형 코드** — 이 화면의 정체이자 유일한 고정 축.
 *
 * **값이 오면 이 한 줄만 채우면 된다.** 조회는 이 값을 인자로 받고(`filters.ts`) 안내는
 * 이 값으로 갈린다(`typePendingNote`) — 채우는 순간 조건이 실리고 안내가 사라진다.
 *
 * `string | null`로 넓혀 두는 것은 의도다. `null` 리터럴로 좁으면 「값이 있을 때」를 다루는
 * 코드가 닿을 수 없는 가지로 보이고, 그러면 전환을 재는 시험이 성립하지 않는다.
 */
export const IQC_SKIP_APPROVAL_TYPE_CODE: string | null = null;

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
