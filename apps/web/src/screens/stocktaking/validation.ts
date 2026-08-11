import { messages } from '@omf-mes/i18n';

import { isCalendarDate } from './filters';
import type { OpenDraft } from './open-request';

/**
 * 개시를 보내기 전에 화면이 잡는 것.
 *
 * **검증을 세 층에 나누고 층마다 맡는 것을 겹치지 않게 둔다.**
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 필수 값 넷 | 계약 타입 + `open-request.ts`가 늘 채운다 |
 * | **비어 있음**(값 목록 미확정 · 유형 · 창고 · 계획일) | 이 파일의 `openBlockReason` — 버튼 활성/비활성과 사유 |
 * | **형식·길이**(계획일 · 코드 50자) | 이 파일의 `validateOpenDraft` — 인라인 오류 |
 *
 * **화면이 막지 않는 것은 서버가 막는다.** 그 실패는 저장 실패 배너로 보인다.
 *
 * **막는 곳이 화면뿐인 자리가 있다**(실측). 코드에 `minLength`가 없어 목 서버가 **빈 문자열도
 * 201로 통과시킨다** — 개시는 되돌릴 수 없으므로 「보내 보고 서버가 막아 주기」를 기대할 수 없다.
 *
 * **비어 있음과 형식 오류를 가른다.** 아직 넣지 않은 칸에 붉은 글씨를 띄우면 사용자가 잘못
 * 넣은 줄 안다 — 비어 있음은 버튼 옆 사유가, 잘못 넣음은 칸 옆 오류가 맡는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stocktaking;

/** 계약이 정한 코드 길이 상한. */
export const CODE_MAX = 50;

/**
 * 개시 입력칸 ↔ 계약 필드 이름.
 *
 * **한 곳에 모은다.** 오류를 세우는 자리(`validateOpenDraft`)와 그 오류를 읽어 내는 자리
 * (`open-form.tsx`)와 서버 오류를 인라인으로 낼지 가르는 자리(`OPEN_FORM_FIELDS`)가 같은
 * 이름을 봐야, 서버가 준 오류와 화면이 잡은 오류가 **같은 칸에** 붙는다.
 */
export const OPEN_FIELD_NAMES = {
  countType: 'countTypeCode',
  warehouse: 'warehouseId',
  plannedDate: 'plannedDate',
} as const;

/**
 * 이 화면이 소유한 개시 입력칸 이름. 서버가 준 필드 오류를 **인라인으로 낼지 배너로 올릴지** 가른다.
 *
 * `blindCount`는 담지 않는다 — 확인칸에는 오류를 낼 자리가 없어(둘 중 하나는 늘 고른 값이다)
 * 담으면 어디에도 보이지 않는 오류가 된다.
 */
export const OPEN_FORM_FIELDS: readonly string[] = Object.values(OPEN_FIELD_NAMES);

/** 「실사 개시」를 열지 말지 가르는 입력. */
export interface OpenGateInput {
  /**
   * 실사 유형의 **값 목록 자체가 없는가**(`code-options.ts` · 승인 G1).
   *
   * 「아직 안 골랐다」와 다르다 — 고를 것이 없는데 「고르세요」라고 말하면 사용자가 자기가
   * 놓친 것을 찾다가 화면을 고장으로 읽는다. `countTypeCode`가 요청 필수라 이 상태에서는
   * **개시가 통째로 막힌다**(계획 결정 10 — 조건부 필수인 차이 사유와 갈리는 자리다).
   */
  isCountTypeListPending: boolean;
  draft: OpenDraft;
}

const isBlank = (value: string): boolean => value.trim() === '';

/**
 * 왜 막혔는지. 보낼 수 있으면 `null`이다.
 *
 * **차례가 뜻을 정한다.** 코드 목록이 없다는 사정이 가장 앞이다 — 그 상태에서는 나머지를
 * 아무리 채워도 열리지 않으므로, 다른 사유를 먼저 내면 사용자가 할 수 없는 조치를 가리킨다.
 * 그다음은 무엇을 세는가(유형) → 어디를 세는가(창고) → 언제 세는가(계획일) 차례이며,
 * 이 차례가 개시 폼의 칸 차례·확인 창의 나열 차례와 같다.
 */
export const openBlockReason = (input: OpenGateInput): string | null => {
  if (input.isCountTypeListPending) return t.actionReasons.openCodeListPending;
  if (isBlank(input.draft.countType)) return t.actionReasons.openNeedsCountType;
  if (input.draft.warehouse === '') return t.actionReasons.openNeedsWarehouse;
  if (input.draft.plannedDate === '') return t.actionReasons.openNeedsPlannedDate;

  return null;
};

/**
 * 인라인으로 낼 오류.
 *
 * **보낼 값의 길이를 잰다.** 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 재야
 * 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생기지 않는다.
 *
 * **계획일은 달력에 있는 날인지까지 본다.** 자릿수만 보면 `2026-02-31`이 통과해 서버가
 * 400으로 되돌리는데, 개시 요청은 그때 이미 나간 뒤다. 판정은 조회 조건과 **같은 함수**를
 * 쓴다(`filters.ts`의 `isCalendarDate`) — 갈리면 주소에서는 버려진 날짜가 요청에는 실린다.
 *
 * **이 검사가 둘째 층인 것을 밝혀 둔다.** 첫째 층은 네이티브 `type="date"`이며, 그것이 도는
 * 브라우저에서는 달력에 없는 날짜가 애초에 값이 되지 않는다(빈 값이 되고 「계획일을 넣으세요」
 * 사유가 맡는다). 이 층은 **날짜 칸이 글자 칸으로 낮아지는 환경**을 위한 것이다 — 그때는
 * 사용자가 아무 글자나 칠 수 있고, 개시는 되돌릴 수 없어 서버에 맡길 수 없다.
 */
export const validateOpenDraft = (draft: OpenDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (draft.countType.trim().length > CODE_MAX) {
    errors[OPEN_FIELD_NAMES.countType] = t.errors.codeTooLong(CODE_MAX);
  }

  /* 비어 있음은 형식 오류가 아니다 — 그 사정은 버튼 옆 사유가 맡는다. */
  if (draft.plannedDate !== '' && !isCalendarDate(draft.plannedDate)) {
    errors[OPEN_FIELD_NAMES.plannedDate] = t.errors.plannedDateInvalid;
  }

  return errors;
};
