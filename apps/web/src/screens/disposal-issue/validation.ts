import { messages } from '@omf-mes/i18n';

import type { PostApproval, Submission } from './approval-progress';
import { isRequiredCodeListPending, REQUIRED_CODE_KEYS, type CodeOptionSets } from './code-options';
import type { DisposalReadyState } from './disposal-selection';
import { readReason } from './reason-draft';
import type { DisposalCodeKey, DisposalDraft } from './types';

/**
 * 보내기 전에 화면이 잡는 것.
 *
 * **검증을 네 층에 나누고 층마다 맡는 것을 겹치지 않게 둔다.**
 *
 * | 갈래 | 어디가 막나 |
 * | --- | --- |
 * | 필수 값(헤더 열·라인 다섯) | 계약 타입 + `issue-request.ts`가 늘 채운다 |
 * | **무엇을 얼마나 보내는가**(줄 선택·수량·상한) | `disposal-selection.ts` — 이 파일은 그 판정을 **받아서 낸다** |
 * | **조건부 필수**(코드 다섯·출고 일시·**상신 사유**) | 이 파일의 `disposalBlockReason` — 버튼 활성/비활성과 사유 |
 * | **길이·형식** | 이 파일의 `validateDisposalDraft` — 인라인 오류 |
 *
 * **막는 곳이 화면뿐인 자리가 셋 있다**(계획 §6.3 실측). 목이 `lines: []`를 201로, `reasonCode`
 * 생략을 201로, **상신 사유 공백만을 202로** 통과시킨다 — 「보내 보고 서버가 막아 주기」를
 * 기대할 수 없다. 그래서 같은 규칙이 **버튼(첫째 겹) · 보내는 자리의 재판정(둘째 겹) ·
 * 본문 조립(마지막 겹)** 세 곳에 선다.
 *
 * **날짜·시각의 형식을 이 파일이 재지 않는다.** 두 값의 출처가 달력 컨트롤과 시각 입력칸뿐이고
 * (조회 조건과 달리 **주소가 소유하지 않아** 사용자가 직접 고칠 길이 없다), 두 컨트롤은
 * `YYYY-MM-DD`·`HH:mm` 외의 값을 방출하지 않는다 — 형식 가지를 두면 닿을 수 없는 안전망이 된다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.disposalIssue;

/** 계약이 정한 코드 길이 상한. */
export const CODE_MAX = 50;

/**
 * 코드 자리 ↔ 계약 필드 이름.
 *
 * **한 곳에 모은다.** 오류를 세우는 자리(`validateDisposalDraft`)와 그 오류를 읽어 내는 자리
 * (`disposal-form.tsx`)와 서버 오류를 인라인으로 낼지 가르는 자리(`DISPOSAL_FORM_FIELDS`)가
 * 같은 이름을 봐야, 서버가 준 오류와 화면이 잡은 오류가 같은 칸에 붙는다.
 *
 * **`disposalAccount`만 이름이 다르다** — 계약에 「폐기 계정」 필드가 없어 도착지 식별자로
 * 옮긴다는 가정이 여기에도 걸린다(계획 §13-5 · `issue-request.ts`의 `toDestinationId`).
 */
export const CODE_FIELD_NAMES: Record<DisposalCodeKey, string> = {
  issueType: 'issueTypeCode',
  sourceDocumentType: 'sourceDocumentTypeCode',
  destinationType: 'destinationTypeCode',
  disposalAccount: 'destinationId',
  reason: 'reasonCode',
};

/**
 * 전표 생성에서 **이 화면이 소유한 입력칸 이름.** 서버가 준 필드 오류를 인라인으로 낼지
 * 배너로 올릴지 가른다.
 *
 * 가르는 잣대는 「그 이름의 오류를 화면이 **보일 자리가 있는가**」다. 날짜·시각 두 칸이 한
 * 값(`issuedAt`)이라 그 오류는 두 칸 아래 한 자리에 선다.
 *
 * `sourceDocumentId`·`sourceWarehouseId`·`businessDate`·`occurredAt`·`lines`·`postImmediately`는
 * 화면이 값을 정하지 않는다(고른 전표·표의 줄·파생·상수에서 온다). 담으면 **어디에도 보이지
 * 않는 오류**가 된다 — 배너가 받아야 사용자가 읽는다.
 */
export const DISPOSAL_FORM_FIELDS: readonly string[] = [
  ...Object.values(CODE_FIELD_NAMES),
  'issuedAt',
  'remarks',
];

/**
 * 상신에서 이 화면이 소유한 입력칸 이름 — **사유 하나뿐이다.**
 *
 * 상신 본문의 필드가 그것 하나라(계약) 넓히면 남의 오류가 사유 칸에 붙는다. 결재선이 없어
 * 400이 오는 갈래(계약 명시)는 **필드 오류가 아니라 배너**로 간다 — 사용자가 고칠 칸이 화면에
 * 없기 때문이다. **코드로 분기해 원인을 지어내지 않고 서버 문구를 그대로 낸다**(계획 결정 16).
 */
export const SUBMIT_FORM_FIELDS: readonly string[] = ['reason'];

/**
 * 전기에서 이 화면이 소유한 입력칸 이름 — **하나도 없다.**
 *
 * 전기 본문은 전표에서 파생한 두 값뿐이고(`post-request.ts`) 사용자가 치는 칸이 없다. 그래서
 * 서버가 준 필드 오류도 **붙일 칸이 없어** 전부 배너로 올라간다 — 여기에 이름을 하나라도
 * 넣으면 **어디에도 보이지 않는 오류**가 생긴다. 빈 배열이 이 화면의 사실이다.
 */
export const POST_FORM_FIELDS: readonly string[] = [];

const isBlank = (value: string): boolean => value.trim() === '';

/** 「품의 상신」을 열지 말지 가르는 입력. */
export interface DisposalGateInput {
  /**
   * 코드 선택지. **값 목록 자체가 없는 것**과 「아직 안 골랐다」를 가르는 근거다
   * (`code-options.ts`의 `isRequiredCodeListPending`).
   *
   * 고를 것이 없는데 「고르세요」라고 말하면 사용자가 자기가 놓친 것을 찾다가 화면을
   * 고장으로 읽는다.
   */
  codeOptions: CodeOptionSets;
  draft: DisposalDraft;
  /**
   * 무엇을 얼마나 보낼지에 대한 판정. **여기서 다시 만들지 않는다** — 줄을 골랐는가·수량이
   * 채워졌는가·상한을 넘었는가는 `disposal-selection.ts` 한 곳에서 나오고 이 파일은 그 사유를
   * **그대로** 낸다. 두 곳이 각자 판정하면 표에는 멀쩡한데 버튼이 잠기거나 그 반대가 된다.
   */
  selection: DisposalReadyState;
}

/**
 * 왜 막혔는지. 보낼 수 있으면 `null`이다.
 *
 * **차례가 뜻을 정한다.** 값 목록이 없다는 사정이 가장 앞이다 — 그 상태에서는 나머지를 아무리
 * 채워도 열리지 않으므로, 다른 사유를 먼저 내면 사용자가 할 수 없는 조치를 가리킨다. 그다음은
 * 화면에 놓인 차례다: **무엇을 보내는가**(위의 라인 표) → **어떤 전표인가**(폼의 코드·일시) →
 * **왜 올리는가**(맨 아래 상신 사유).
 */
export const disposalBlockReason = (input: DisposalGateInput): string | null => {
  if (isRequiredCodeListPending(input.codeOptions)) return t.actionReasons.codeListPending;
  if (input.selection.kind === 'blocked') return input.selection.reason;
  if (REQUIRED_CODE_KEYS.some((key) => isBlank(input.draft.codes[key]))) {
    return t.actionReasons.needsCodes;
  }
  if (input.draft.issuedDate === '') return t.actionReasons.needsIssuedDate;
  if (input.draft.issuedTime === '') return t.actionReasons.needsIssuedTime;
  if (readReason(input.draft.reason).kind === 'empty') return t.actionReasons.needsReason;

  return null;
};

/** 이력 탭의 「재상신」을 열지 말지 가르는 입력. */
export interface ResubmitGateInput {
  /**
   * 상신 여부 **세 갈래**. **판정은 `approval-progress.ts`에서 온다** — 여기서 다시 판정하면
   * 「미상신이라 적어 놓고 재상신은 잠긴」 어긋난 화면이 생긴다.
   *
   * 셋째 갈래(`unusable`)를 미상신으로 접지 않는 것이 이 자리의 요점이다 — 값이 실려 온 이상
   * **이미 올라갔을 수 있고**, 그때 다시 올리면 같은 품의의 결재 요청이 두 벌이 된다.
   */
  submission: Submission['kind'];
  reason: string;
}

/**
 * 왜 막혔는지. **상신 여부가 사유보다 앞이다** — 이미 올라간 건에 「사유를 적으세요」는
 * 사용자가 해 봐야 열리지 않는 조치를 가리킨다.
 */
export const resubmitBlockReason = (input: ResubmitGateInput): string | null => {
  if (input.submission === 'submitted') return t.actionReasons.alreadySubmitted;
  if (input.submission === 'unusable') return t.actionReasons.submissionUnknown;
  if (readReason(input.reason).kind === 'empty') return t.actionReasons.needsReason;

  return null;
};

/** 「기타출고 처리」를 열지 말지 가르는 입력. */
export interface PostGateInput {
  /**
   * 상신 여부 세 갈래. **판정은 `approval-progress.ts`에서 온다.**
   *
   * **`unusable`을 잠그지 않는다** — 재상신과 갈리는 자리다. 저쪽은 되풀이하면 **결재 요청이
   * 두 벌**이 되지만, 여기서 잘못 누르면 돌아오는 것은 **서버의 400**이다. 값이 실려 온 이상
   * 승인이 끝나 있을 수 있고, 그때 잠그면 정당한 처리가 영영 막힌다.
   */
  submission: Submission['kind'];
  /** 승인 판정 네 갈래. **자리표시가 비거나 진행을 못 읽었으면 잠그지 않는다**(§13-2 안 1) */
  approval: PostApproval;
}

/**
 * 왜 막혔는지. 처리할 수 있으면 `null`이다.
 *
 * **화면이 확실히 아는 것만 잠근다.**
 *
 * | 사정 | 근거 | 잠그는가 |
 * | --- | --- | :-: |
 * | 미상신 | 승인 요청 값이 **없다** — 승인이 있을 수 없다 | **잠근다** |
 * | 자리표시가 찼고 승인 전 | 그 요청의 상태가 승인 집합에 **없다** | **잠근다** |
 * | 자리표시가 비었다 | 어떤 코드가 승인인지 **모른다** | 잠그지 않는다 |
 * | 결재 진행을 못 읽었다 | 판정할 자료가 **없다** | 잠그지 않는다 |
 * | 상신 여부를 확인할 수 없다 | 값이 왔으나 쓸 수 없다 | 잠그지 않는다 |
 *
 * **차례가 뜻을 정한다** — 상신조차 되지 않았으면 승인 여부를 말할 것이 없으므로 그 사유가 앞선다.
 */
export const postBlockReason = (input: PostGateInput): string | null => {
  if (input.submission === 'notSubmitted') return t.actionReasons.postNeedsSubmission;
  if (input.approval.kind === 'notApproved') return t.actionReasons.postNotApproved;

  return null;
};

/**
 * 인라인으로 낼 오류.
 *
 * **보낼 값의 길이를 잰다.** 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 재야
 * 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생기지 않는다.
 *
 * **상신 사유는 잠금 사유와 인라인 오류를 함께 갖는다.** 버튼 옆 사유는 「무엇을 해야 열리는가」를
 * 말하고, 인라인 오류는 **고칠 칸 옆에** 선다 — 폼이 길어 버튼과 사유 칸이 한눈에 들어오지 않는다.
 */
export const validateDisposalDraft = (draft: DisposalDraft): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [key, field] of Object.entries(CODE_FIELD_NAMES) as [DisposalCodeKey, string][]) {
    if (draft.codes[key].trim().length > CODE_MAX) {
      errors[field] = t.errors.codeTooLong(CODE_MAX);
    }
  }

  if (readReason(draft.reason).kind === 'empty') errors.reason = t.errors.reasonRequired;

  return errors;
};
