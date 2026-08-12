import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 화면이 그럴듯한 예시로 메우면 사용자는
 * 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 — 결재함에서는 그 비용이 「조회가
 * 늘 0건인 조건」으로 나타나고, 사용자는 자기 결재 대기가 없다고 읽는다.
 * 계약의 `@example` 값도 심지 않는다. 그것은 예시이지 확정이 아니다.
 *
 * **이 화면에서 잠기는 범위는 좁다.** 두 값 모두 조회 조건일 뿐이라 값 목록이 비어 있어도
 * 탭·기간·요청번호로 좁힐 수 있고 쪽 이동과 결재가 전부 열려 있다.
 *
 * **값이 확정되면 이 파일의 배열만 채우면 된다.** 조건 줄은 배열을 읽을 뿐이라 다른 자리를
 * 고칠 필요가 없고, 채우는 순간 선택칸이 저절로 살아난다.
 *
 * 추적: 승인 유형·상태 값 목록 미확정 — **`omf-mes#64`**. 비공개 저장소이므로 번호로만 참조한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 승인 유형 값 목록 — **비어 있는 것이 지금의 사실이다.** */
export const PLACEHOLDER_APPROVAL_TYPE_CODES: readonly string[] = [];

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
