import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 조회 조건의 상태 선택지 — **값 목록이 확정되지 않아 비어 있다**(계획 결정 18 · `omf-mes#64`).
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 계약이 「확정된 값 목록이 아직 없다 —
 * 서버가 내려주는 선택지를 그대로 쓴다」고 적었고 그 선택지를 주는 오퍼레이션이 아직 없다.
 * `@example` 값을 채우면 사용자는 고를 수 있다고 믿는데 서버는 그 값을 모른다.
 *
 * **여기는 조회 조건이라 비어 있어도 화면이 돈다.** 요청의 **필수** 코드는 사정이 다르며
 * (비면 등록 자체가 막힌다) 그 자리는 PR ②의 `code-options.ts`가 따로 소유한다.
 *
 * 값이 확정되면 **이 파일의 배열만 채우면 된다** — 조건 줄·요청 조립은 배열을 읽을 뿐이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 입하 전표 상태 코드 목록. **비어 있다.**
 *
 * 주소에 `st`가 손으로 적혀 오면 그 값은 그대로 요청에 실린다 — 화면이 값을 제공하지 않을 뿐,
 * 서버가 아는 값을 막지는 않는다.
 */
export const PLACEHOLDER_IR_STATUS_CODES: readonly string[] = [];

/**
 * 상태 선택지.
 *
 * **자리표시 값을 하나 넣어 두지 않는다.** 넣으면 사용자가 그것을 고를 수 있고,
 * 고르는 순간 서버가 모르는 코드가 조회 조건에 실려 결과가 늘 비어 보인다.
 */
export const irStatusOptions = (): SelectOption[] =>
  PLACEHOLDER_IR_STATUS_CODES.map((code) => ({ value: code, label: code }));

/** 선택지가 왜 비어 있는지 밝히는 안내. 비어 있는 선택칸만 두면 고장으로 읽힌다. */
export const irStatusNote = (): string => messages.pendingCode.note;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const irStatusPlaceholder = (): string => messages.pendingCode.placeholder;
