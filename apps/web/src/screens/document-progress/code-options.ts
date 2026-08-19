import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 한 파일에 격리한다(omf-mes#64).
 *
 * **남은 것은 상태 하나다.** 문서 유형은 여기 없다 — 그 값에는 **동작이 걸려**(조회가 성립하는가 ·
 * 어느 유형을 고를 수 있는가) 설계가 정하는 값이고, 자리도 하나여야 해서 `document-types.ts`가
 * 표로 소유한다. 상태는 다르다: 질의값으로 **그대로 나를 뿐** 화면의 어떤 판정에도 쓰이지 않는다
 * (취소 가능 여부는 서버 `cancellable`이 판정한다).
 *
 * | 코드 | 동작이 걸리나 | 누가 정하나 | 지금 어디에 |
 * | --- | :-: | --- | --- |
 * | 문서 유형 | **예**(조회 성립·선택 가능) | 설계 | `document-types.ts` — 표 |
 * | 문서 상태 | 아니오(질의값으로만 나른다) | **고객**(공통코드 마스터) | **여기** — 자리표시 |
 *
 * ⚠ 원칙대로면 상태는 실행 시점 **공통코드 조회**로 가져와야 한다(공유계약 G-31). 그런데 그
 * 그룹코드가 아직 없어 조회를 만들 수 없다 — 이번 회차만 자리표시로 두고, 그룹코드가 오면
 * 이 파일을 걷고 두 걸음 조회로 바꾼다(전례 사본이 이미 있다).
 *
 * ⚠ **이 배열이 비었다는 사실로 조회나 버튼을 막지 않는다.** 목록은 상태 조건 없이도 열려 있어야
 * 하므로, 비었다고 막으면 그 자리가 **영영 잠긴다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 문서 상태 값 목록 — **비어 있다.**
 *
 * 자리표시 값을 하나 넣어 두지 않는다. 넣으면 사용자가 그것으로 목록을 좁히는데,
 * 서버는 그 상태를 모른다.
 */
export const PLACEHOLDER_DOCUMENT_STATUS_CODES: readonly string[] = [];

/**
 * 값 목록을 선택지로 옮긴다.
 *
 * **라벨을 지어내지 않는다** — 코드값을 그대로 라벨로 쓴다. 사람이 읽을 이름을 주는 곳이
 * 아직 없는데 화면이 이름을 붙이면 그 뜻도 화면이 지어낸 것이 된다.
 *
 * **차례를 바꾸지 않는다.** 값 목록이 어떤 차례로 오는지가 뜻일 수 있다.
 */
export const toStatusOptions = (values: readonly string[]): SelectOption[] =>
  values.map((code) => ({ value: code, label: code }));

/**
 * 선택지가 왜 비어 있는지 밝히는 보조 문구. 채워지면 사라진다 —
 * 고를 것이 있는 칸에 「준비 중」이 남아 있으면 그것이 곧 틀린 안내다.
 */
export const codeNote = (options: readonly SelectOption[]): string | undefined =>
  options.length === 0 ? messages.pendingCode.note : undefined;

/** 비어 있는 선택칸의 자리표시 글자. 「전체」로 두면 목록이 준비된 것처럼 보인다. */
export const codePlaceholder = (): string => messages.pendingCode.placeholder;
