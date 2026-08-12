import { messages } from '@omf-mes/i18n';

import { REQUIRED_CODE_KEYS } from './code-options';
import type { ReturnReadyState } from './return-selection';
import type { ReturnCodeKey, ReturnDraft } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **검증을 세 층에 나눠 심고 층마다 맡는 것을 겹치지 않게 둔다.**
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 필수 값(헤더 10종·라인 5종) | 계약 타입 + `issue-request.ts`가 늘 채운다 |
 * | **무엇을 얼마나 보내는가**(줄 선택·수량·상한) | `return-selection.ts` — 이 파일은 그 판정을 **받아서 낸다** |
 * | **조건부 필수**(공급사·필수 코드 넷·출고 일시) | 이 파일의 `returnBlockReason` — 버튼 활성/비활성과 사유 |
 * | **길이**(코드 50자) | 이 파일의 `validateReturnDraft` — 인라인 오류 |
 *
 * **화면이 막지 않는 것은 서버가 막는다.** 그 실패는 저장 실패 배너로 보인다.
 *
 * **막는 곳이 화면뿐인 자리가 셋 있다**(실측). 계약의 `lines`에 `minItems`가 없어 목이 빈
 * 배열을 201로 통과시키고, 코드에 `minLength`가 없어 공백만인 코드도 201로 통과하며,
 * `reasonCode`는 스키마가 nullable이라 `null`도 201이다 — **재고를 차감하는 되돌릴 수 없는
 * 쓰기**라 「보내 보고 서버가 막아 주기」를 기대할 수 없다.
 *
 * **날짜·시각의 형식을 이 파일이 재지 않는다.** 두 값의 출처가 달력 컨트롤과 시각 입력칸뿐이고
 * (조회 조건과 달리 **주소가 소유하지 않아** 사용자가 직접 고칠 길이 없다), 두 컨트롤은
 * `YYYY-MM-DD`·`HH:mm` 외의 값을 방출하지 않는다 — 형식 가지를 두면 닿을 수 없는 안전망이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.supplierReturn;

/** 계약이 정한 코드 길이 상한. */
export const CODE_MAX = 50;

/**
 * 코드 자리 ↔ 계약 필드 이름.
 *
 * **한 곳에 모은다.** 오류를 세우는 자리(`validateReturnDraft`)와 그 오류를 읽어 내는 자리
 * (`return-form.tsx`)와 서버 오류를 인라인으로 낼지 가르는 자리(`RETURN_FORM_FIELDS`)가
 * 같은 이름을 봐야, 서버가 준 오류와 화면이 잡은 오류가 같은 칸에 붙는다.
 */
export const CODE_FIELD_NAMES: Record<ReturnCodeKey, string> = {
  issueType: 'issueTypeCode',
  sourceDocumentType: 'sourceDocumentTypeCode',
  destinationType: 'destinationTypeCode',
  reason: 'reasonCode',
};

/**
 * 이 화면이 소유한 입력칸 이름. 서버가 준 필드 오류를 **인라인으로 낼지 배너로 올릴지** 가른다.
 *
 * 가르는 잣대는 「그 이름의 오류를 화면이 **보일 자리가 있는가**」다. 공급사 선택칸이 곧
 * `destinationId`이고, 날짜·시각 두 칸이 한 값(`issuedAt`)이라 그 오류는 두 칸 아래 한 자리에
 * 선다. `sendToErp`·`replacementExpected`는 칸은 있으나 오류를 낼 자리를 두지 않았다 —
 * 참·거짓뿐이라 화면이 잘못 만들 값이 없고, 그래도 서버가 오류를 주면 배너가 받는다.
 *
 * `sourceDocumentId`·`sourceWarehouseId`·`businessDate`·`occurredAt`·`lines`·`postImmediately`는
 * 화면이 값을 정하지 않는다(고른 전표·표의 줄·파생·상수에서 온다). 담으면 **어디에도 보이지
 * 않는 오류**가 된다.
 */
export const RETURN_FORM_FIELDS: readonly string[] = [
  ...Object.values(CODE_FIELD_NAMES),
  'destinationId',
  'issuedAt',
  'remarks',
];

/** 「반품 처리」를 열지 말지 가르는 입력. */
export interface ReturnGateInput {
  /**
   * 필수 코드의 **값 목록 자체가 없는가**(`code-options.ts`).
   *
   * 「아직 안 골랐다」와 다르다 — 고를 것이 없는데 「고르세요」라고 말하면 사용자가
   * 자기가 놓친 것을 찾다가 화면을 고장으로 읽는다.
   */
  isCodeListPending: boolean;
  draft: ReturnDraft;
  /**
   * 무엇을 얼마나 보낼지에 대한 판정. **여기서 다시 만들지 않는다**(완료 조건 C31).
   *
   * 줄을 골랐는가·수량이 채워졌는가·상한을 넘었는가는 `return-selection.ts` 한 곳에서 나오고,
   * 이 파일은 그 사유를 **그대로** 낸다. 두 곳이 각자 판정하면 표에는 멀쩡한데 버튼이 잠기거나
   * 그 반대가 되고, **되돌릴 수 없는 쓰기**에서 뒤쪽 어긋남은 잘못된 반품 전표로 남는다.
   */
  selection: ReturnReadyState;
}

const isBlank = (value: string): boolean => value.trim() === '';

/**
 * 왜 막혔는지. 보낼 수 있으면 `null`이다.
 *
 * **차례가 뜻을 정한다.** 코드 목록이 없다는 사정이 가장 앞이다 — 그 상태에서는 나머지를
 * 아무리 채워도 열리지 않으므로, 다른 사유를 먼저 내면 사용자가 할 수 없는 조치를 가리킨다.
 * 그다음은 화면에 놓인 차례다: **무엇을 보내는가**(위의 라인 표) → **누구에게·무엇으로·언제**
 * (아래의 반품 정보).
 */
export const returnBlockReason = (input: ReturnGateInput): string | null => {
  if (input.isCodeListPending) return t.actionReasons.codeListPending;
  if (input.selection.kind === 'blocked') return input.selection.reason;
  if (input.draft.supplier === '') return t.actionReasons.needsSupplier;
  if (REQUIRED_CODE_KEYS.some((key) => isBlank(input.draft.codes[key]))) {
    return t.actionReasons.needsCodes;
  }
  if (input.draft.issuedDate === '') return t.actionReasons.needsIssuedDate;
  if (input.draft.issuedTime === '') return t.actionReasons.needsIssuedTime;

  return null;
};

/**
 * 인라인으로 낼 오류.
 *
 * **보낼 값의 길이를 잰다.** 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 재야
 * 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생기지 않는다.
 *
 * 선택지에서 고른 값이 상한을 넘는 일은 드물다 — 그래도 잡는 이유는, 값 목록이 확정돼
 * 배열이 채워질 때 그 값의 길이를 화면이 정하지 않기 때문이다.
 */
export const validateReturnDraft = (draft: ReturnDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [key, field] of Object.entries(CODE_FIELD_NAMES) as [ReturnCodeKey, string][]) {
    if (draft.codes[key].trim().length > CODE_MAX) {
      errors[field] = t.errors.codeTooLong(CODE_MAX);
    }
  }

  return errors;
};
