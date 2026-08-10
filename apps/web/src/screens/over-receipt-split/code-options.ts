import { messages } from '@omf-mes/i18n';

import type { SelectOption } from './types';

/**
 * 값 목록이 확정되지 않은 선택지와 그 안내를 한 파일에 격리한다.
 *
 * **값을 지어내지 않는 것이 이 파일의 목적이다.** 착수 이슈가 미결로 남긴 것을 화면이
 * 그럴듯한 예시로 메우면, 사용자는 고를 수 있다고 믿고 고르는데 서버는 그 값을 모른다 —
 * 되돌릴 수 없는 쓰기 화면에서 그 어긋남은 막다른 길이 된다.
 *
 * 값이 확정되면 **이 파일의 배열만 채우면 된다.** 화면·요청 조립은 배열을 읽을 뿐이라
 * 다른 자리를 고칠 필요가 없다(W-01-07·W-01-09가 세운 형태).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.overReceiptSplit;

/**
 * 예외 유형 코드 목록. **비어 있다.**
 *
 * 계약이 「확정된 값 목록이 아직 없다 — 서버가 내려주는 선택지를 그대로 쓴다」고 적었고,
 * 그 선택지를 주는 오퍼레이션이 아직 없다. 채우는 순간 짝 제약(유형을 고르면 사유가 필수)이
 * 화면에서 살아난다 — 그 규칙은 이미 `validation.ts`에 심어 두었다.
 */
export const PLACEHOLDER_EXCEPTION_TYPE_CODES: readonly string[] = [];

/**
 * 예외 유형 선택지.
 *
 * **자리표시 값을 하나 넣어 두지 않는다.** 넣으면 사용자가 그것을 고를 수 있고, 고르는 순간
 * 초과 사유가 필수가 되며, 등록하면 서버가 모르는 코드가 전표에 실린다.
 */
export const exceptionTypeOptions = (): SelectOption[] =>
  PLACEHOLDER_EXCEPTION_TYPE_CODES.map((code) => ({ value: code, label: code }));

/** 선택지가 왜 비어 있는지 밝히는 안내. 비어 있는 선택칸만 두면 고장으로 읽힌다. */
export const exceptionTypeNote = (): string => messages.pendingCode.note;

/** 선택칸 트리거에 보이는 자리표시 문구. */
export const exceptionTypePlaceholder = (): string => messages.pendingCode.placeholder;

/**
 * 초과분의 수입검사 대상 여부 — **보내는 값이 없고 안내만 남는다.**
 *
 * 착수 이슈는 「정량분 값을 그대로 승계한다」를 후보로 두었으나, 계약의 분리 등록 요청에는
 * 검사 관련 필드가 하나도 없다(실측). 승계해 보낼 자리 자체가 없으므로 **보내지 않고**,
 * 화면이 그 사실을 밝히는 것까지가 이번 범위다.
 *
 * 문구를 상수로 한 곳에 두는 이유는 이 사정이 풀렸을 때 고칠 자리를 하나로 남기기 위해서다.
 */
export const EXCESS_INSPECTION_NOTE: string = t.notes.excessInspection;
