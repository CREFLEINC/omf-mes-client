import { messages } from '@omf-mes/i18n';

import type { PostApproval, Submission } from './approval-progress';
import {
  canChooseDisposalPartner,
  isRequiredCodeListPending,
  REQUIRED_CODE_KEYS,
  type CodeOptionSets,
  type DisposalPartnerCondition,
} from './code-options';
import type { DisposalReadyState } from './disposal-selection';
import { readDisposalDestination } from './issue-request';
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
 * | **조건부 필수**(코드 셋·출고 일시·**요청 사유**) | 이 파일의 `disposalBlockReason` — 버튼 활성/비활성과 사유 |
 * | **길이·형식** | 이 파일의 `validateDisposalDraft` — 인라인 오류 |
 *
 * **막는 곳이 화면뿐인 자리가 셋 있다**(계획 §6.3 실측). 목이 `lines: []`를 201로, `reasonCode`
 * 생략을 201로, **요청 사유 공백만을 202로** 통과시킨다 — 「보내 보고 서버가 막아 주기」를
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
 * **도착지 짝 두 이름은 여기 없다**(변경 통지 #124·#128). 이 표는 **코드 선택칸 셋**의 것이고,
 * 도착지는 코드 칸이 아니다 — 유형은 사용자가 고르지 않는 **상수**이고
 * (`DISPOSAL_DESTINATION_TYPE_CODE`), 거래처는 코드가 아니라 **조회로 오는 마스터**다.
 * 거래처 오류가 설 자리는 아래 `DISPOSAL_FORM_FIELDS`가 정한다.
 */
export const CODE_FIELD_NAMES: Record<DisposalCodeKey, string> = {
  issueType: 'issueTypeCode',
  sourceDocumentType: 'sourceDocumentTypeCode',
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
 *
 * **`destinationId`는 담고 `destinationTypeCode`는 담지 않는다**(변경 통지 #128 · 같은 잣대).
 * 폐기 거래처 선택칸이 생겨 거래처 오류를 **보일 자리가 생겼고**, 도착지 유형은 여전히
 * 사용자가 고르는 값이 아니라 상수라 고칠 칸이 없다. 선택칸이 아직 잠겨 있어 지금은 그 오류가
 * 올 수 없지만, **자리를 미리 정해 두지 않으면** 선택지가 살아나는 회차가 「없는 거래처」류
 * 400을 배너로만 받는 상태를 그대로 물려받는다.
 */
export const DISPOSAL_FORM_FIELDS: readonly string[] = [
  ...Object.values(CODE_FIELD_NAMES),
  'issuedAt',
  'remarks',
  'destinationId',
];

/**
 * 승인 요청에서 이 화면이 소유한 입력칸 이름 — **사유 하나뿐이다.**
 *
 * 요청 본문의 필드가 그것 하나라(계약) 넓히면 남의 오류가 사유 칸에 붙는다. 결재선이 없어
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

/** 「승인 요청」을 열지 말지 가르는 입력. */
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
  /**
   * 폐기 거래처 선택칸의 **사정 한 값**(`code-options.ts`의 `readDisposalPartnerCondition`).
   * 도착지 사유가 **셋으로** 갈리는 근거다 — 고를 수 있는가 · 아직 값 목록이 없는가 ·
   * 불러오지 못했거나 없는가에 따라 사용자가 할 수 있는 조치가 다르다.
   *
   * ⛔ **목록 길이를 여기서 다시 세지 않는다**(리뷰 Major B1·Minor M2). 길이로 판정하면
   * 조회 실패·0건에서도 「값 목록이 확정되면 열린다」고 말하게 되고, 같은 칸의 안내·자리표시와
   * **한 컨트롤이 서로 다른 사실을 말하는** 상태가 된다. 사정은 **한 원천**에서 온다.
   *
   * 사정을 인자로 받는 이유는 「채워졌을 때 무엇이 달라지는가」를 감지기가 실제로 잴 수 있게
   * 하기 위해서다 — 자리표시 상수를 여기서 직접 읽으면 그 전환을 시험할 길이 없다.
   */
  disposalPartner: DisposalPartnerCondition;
}

/**
 * 왜 막혔는지. 보낼 수 있으면 `null`이다.
 *
 * **차례가 뜻을 정한다.** 값 목록이 없다는 사정이 가장 앞이다 — 그 상태에서는 나머지를 아무리
 * 채워도 열리지 않으므로, 다른 사유를 먼저 내면 사용자가 할 수 없는 조치를 가리킨다. 그다음은
 * 화면에 놓인 차례다: **무엇을 보내는가**(위의 라인 표) → **어떤 전표인가**(폼의 코드·일시·
 * **도착지**) → **왜 올리는가**(맨 아래 요청 사유).
 *
 * **도착지 사유가 셋으로 갈린다**(변경 통지 #128 §4 ⛔ · 리뷰 Minor M2). 같은 잠금이지만
 * 사용자가 할 수 있는 조치와 **기다리면 열리는지**가 다르다 — 선택칸이 열려 있으면
 * 「고르거나 체크하십시오」, 값 목록이 아직 없으면 「준비되지 않았습니다」(확정되면 열린다),
 * 불러오지 못했거나 0건이면 「지금 고를 수 있는 거래처가 없습니다」(기다린다고 열리지 않는다).
 * 하나로 두면 고를 것이 없는 사용자에게 고르라고 말하거나, 열리지 않을 것을 기다리게 한다.
 */
export const disposalBlockReason = (input: DisposalGateInput): string | null => {
  if (isRequiredCodeListPending(input.codeOptions)) return t.actionReasons.codeListPending;
  if (input.selection.kind === 'blocked') return input.selection.reason;
  if (REQUIRED_CODE_KEYS.some((key) => isBlank(input.draft.codes[key]))) {
    return t.actionReasons.needsCodes;
  }
  if (input.draft.issuedDate === '') return t.actionReasons.needsIssuedDate;
  if (input.draft.issuedTime === '') return t.actionReasons.needsIssuedTime;

  if (readDisposalDestination(input.draft) === null) {
    if (canChooseDisposalPartner(input.disposalPartner)) {
      return t.actionReasons.needsDisposalDestination;
    }

    return input.disposalPartner === 'rolePending'
      ? t.actionReasons.disposalPartnerPending
      : t.actionReasons.disposalPartnerUnavailable;
  }

  if (readReason(input.draft.reason).kind === 'empty') return t.actionReasons.needsReason;

  return null;
};

/** 이력 탭의 「재요청」을 열지 말지 가르는 입력. */
export interface ResubmitGateInput {
  /**
   * 승인 요청 여부 **세 갈래**. **판정은 `approval-progress.ts`에서 온다** — 여기서 다시
   * 판정하면 「미요청이라 적어 놓고 재요청은 잠긴」 어긋난 화면이 생긴다.
   *
   * 셋째 갈래(`unusable`)를 미요청으로 접지 않는 것이 이 자리의 요점이다 — 값이 실려 온 이상
   * **이미 올라갔을 수 있고**, 그때 다시 올리면 같은 건의 결재 요청이 두 벌이 된다.
   */
  submission: Submission['kind'];
  reason: string;
}

/**
 * 왜 막혔는지. **승인 요청 여부가 사유보다 앞이다** — 이미 올라간 건에 「사유를 적으세요」는
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
   * 승인 요청 여부 세 갈래. **판정은 `approval-progress.ts`에서 온다.**
   *
   * **`unusable`을 잠그지 않는다** — 재요청과 갈리는 자리다. 저쪽은 되풀이하면 **결재 요청이
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
 * | 승인 요청 전 | 승인 요청 값이 **없다** — 승인이 있을 수 없다 | **잠근다** |
 * | 자리표시가 찼고 승인 전 | 그 요청의 상태가 승인 집합에 **없다** | **잠근다** |
 * | 자리표시가 비었다 | 어떤 코드가 승인인지 **모른다** | 잠그지 않는다 |
 * | 결재 진행을 못 읽었다 | 판정할 자료가 **없다** | 잠그지 않는다 |
 * | 승인 요청 여부를 확인할 수 없다 | 값이 왔으나 쓸 수 없다 | 잠그지 않는다 |
 *
 * **차례가 뜻을 정한다** — 승인 요청조차 올라가지 않았으면 승인 여부를 말할 것이 없으므로
 * 그 사유가 앞선다.
 *
 * ⭐ **이 잠금의 근거는 MES 내부 승인 정책이다**(변경 통지 #124 · 결정 기록 DR-009). 선행
 * 회차는 「승인 없이 출고할 수 없습니다」를 외부 요구서 항목에서 끌어왔으나, MES가 품의서를
 * 기안하지 않기로 확정되면서 그 근거는 사라지고 **「작업자 요청 → 권한자 승인」이라는 MES
 * 내부 규칙**이 그 자리를 그대로 잇는다. 잠금 자체는 달라지지 않으므로 아래 두 갈래도
 * 그대로 둔다 — 근거만 여기 적어 두는 이유는, 적어 두지 않으면 다음 사람이 없어진 외부
 * 요구서를 다시 찾아 배선하기 때문이다.
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
 * **요청 사유는 잠금 사유와 인라인 오류를 함께 갖는다.** 버튼 옆 사유는 「무엇을 해야 열리는가」를
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
