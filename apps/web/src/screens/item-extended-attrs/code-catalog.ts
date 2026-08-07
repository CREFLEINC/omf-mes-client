import { ensureOption } from './options';
import type { SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 코드를 어떻게 다루는지 **한 곳에서** 정한다(결정 4).
 *
 * 규칙은 하나다 — **화면이 값 목록을 발명하지 않는다.** 계약이 이름으로 밝힌 값만 선택지가 되고,
 * 그렇지 않은 코드는 자유 입력으로 받아 판정을 서버에 맡긴다(공유계약 G-8).
 *
 * **계약의 `example` 값을 쓰지 않는다.** 목 서버가 `"STANDARD"`를 곳곳에 내려주지만
 * 그것은 스키마 예시 문자열이지 실제 코드값이 아니다.
 *
 * 앞선 화면(W-06-06)은 값 목록 미정 코드를 「빈 선택지 + 안내」로 처리했고
 * 그 결과 자격을 실제로 등록할 수 없었다. 이 화면에서 같은 처리를 하면
 * 외부 코드 편집이 통째로 멈춘다 — 그래서 코드마다 갈라 처리한다.
 */

/**
 * 선출 정책. 계약이 **이름으로 밝힌 두 값**이다 —
 * `FIFO`는 스키마의 기본값이고 `FEFO`는 서술(QA #28)에 나온다.
 *
 * 여기에 값을 더하려면 계약이 그 이름을 밝혔는지 먼저 확인한다.
 */
export const FIFO_POLICY_CODES: readonly string[] = ['FIFO', 'FEFO'];

/**
 * 값 목록이 확정되지 않아 **자유 입력**으로 받는 확장 속성 필드.
 *
 * 화면이 이 필드들의 선택지를 만들지 않는다. 목록이 늘어나는 것은
 * 그 필드를 다루는 구획이 생길 때다 — 지금 없는 구획의 필드를 미리 적지 않는다.
 */
export const FREE_TEXT_CODES: readonly string[] = [
  'lotControlTypeCode',
  'serialControlTypeCode',
  'storageConditionCode',
];

/**
 * 선출 정책 선택지.
 *
 * 서버가 준 현재 값이 목록에 없으면 그대로 남긴다 — 빼면 선택칸이 비어 보여
 * 사용자가 값이 사라진 줄 안다. **라벨은 코드 그대로다**: 두 값 모두 업계 표준 약어이고,
 * 한국어 이름을 붙이면 화면이 계약에 없는 이름을 발명하는 것이 된다.
 */
export const fifoPolicyOptions = (selected: string): SelectOption[] =>
  ensureOption(
    FIFO_POLICY_CODES.map((code) => ({ value: code, label: code })),
    selected,
  );
