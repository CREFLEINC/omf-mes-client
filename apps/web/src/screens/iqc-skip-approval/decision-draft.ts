import { messages } from '@omf-mes/i18n';

import type { ApprovalDecision, ApprovalRejection } from './types';

const t = messages.iqcSkipApproval;

/**
 * 승인·반려의 **본문을 만드는 유일한 자리**이자, 두 버튼이 잠기는 첫째 겹의 판정.
 *
 * ---
 *
 * **두 조작의 규칙이 서로 다르다.** 계약 실측:
 *
 * | 조작 | `requestBody` | `comment` | 화면이 지키는 것 |
 * | --- | :-: | :-: | --- |
 * | 승인 | **선택** | **선택** | 의견이 비면 **키 자체를 두지 않는다**(빈 의견을 기록에 남기지 않는다) |
 * | 반려 | 필수 | 필수 · `minLength: 1` | 다듬은 결과가 비면 **요청을 만들지 않는다** |
 *
 * **막는 곳이 화면뿐인 자리가 있다.** 목 서버가 공백만인 반려 의견을 200으로 받는다
 * (계획 §6.3 실측). 계약 문면을 믿고 서버에 맡기면 사유가 공백인 반려가 기록에 남고,
 * 상신자는 무엇을 고쳐야 하는지 모른 채 같은 요청을 다시 올린다.
 *
 * **조립을 한 곳에 두는 이유**: 승인과 반려가 각자 본문을 만들면 한쪽만 `trim`을 갖게 되고,
 * 그 어긋남은 「승인 의견은 다듬어지는데 반려 의견은 앞뒤 공백이 그대로 남는」 형태로 나타난다.
 *
 * **여기가 보는 것은 차례와 의견 둘뿐이다.** 이 화면은 판단 근거를 더 그리는 자리라
 * 「근거가 덜 왔으면 막자」는 생각이 들기 쉬운데, 결재 가능 여부의 정본은 서버가 준
 * `isMyTurn` 하나다 — 화면이 조건을 더하면 **서버가 여는 것을 화면이 닫는다.**
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 어느 쪽 결재인가. 본문·문구·잠금 사유가 이 값 하나로 갈린다. */
export type DecisionKind = 'approve' | 'reject';

/** 화면이 소유한 입력칸 이름 — 계약이 두 본문에 쓰는 이름과 같다. */
export const DECISION_COMMENT_FIELD = 'comment';

/**
 * 공통 쓰기 훅에 넘길 필드 이름 목록.
 *
 * **화면에 그 입력칸이 실제로 있는 이름만 담는다.** 없는 이름을 담으면 그 필드의 서버 오류가
 * 인라인으로 흘러가 어느 칸에도 붙지 못하고 조용히 사라진다.
 */
export const DECISION_KNOWN_FIELDS: readonly string[] = [DECISION_COMMENT_FIELD];

/**
 * 앞뒤 공백을 걷어 낸 의견.
 *
 * **말 안의 공백은 건드리지 않는다** — 여러 줄로 적은 반려 사유의 줄바꿈과 들여쓰기가
 * 사용자가 적은 그대로 기록에 남아야 한다. 다듬는 것은 앞뒤뿐이다.
 */
const trimmed = (comment: string): string => comment.trim();

/** 적은 의견이 있는가. 공백만 친 것은 적지 않은 것과 같다. */
const isEmpty = (comment: string): boolean => trimmed(comment) === '';

/**
 * 승인 본문. **의견이 비면 키 자체를 두지 않는다.**
 *
 * 빈 문자열을 실으면 결재 기록에 빈 의견이 남는다 — 「의견 없이 승인함」과 「의견을 비워
 * 승인함」은 나중에 그 기록을 읽는 사람에게 다른 뜻으로 읽힌다.
 */
export const toApproveBody = (comment: string): ApprovalDecision => {
  const value = trimmed(comment);

  return value === '' ? {} : { comment: value };
};

/**
 * 반려 본문. **다듬은 결과가 비면 `null`이고, 그때 요청을 만들지 않는다.**
 *
 * `null`을 「빈 본문」으로 대신하지 않는다 — 보낼 수 없다는 사실이 호출부의 타입에 드러나야
 * 보내는 자리가 그것을 다루지 않고 지나칠 수 없다.
 */
export const toRejectBody = (comment: string): ApprovalRejection | null => {
  const value = trimmed(comment);

  return value === '' ? null : { comment: value };
};

/** 잠금 판정이 보는 것 전부. **둘 다 읽는 자리에서 온 값이다** — 여기서 다시 계산하지 않는다. */
export interface DecisionState {
  /** 서버가 준 `isMyTurn` 그대로. 단계 배열을 훑어 얻은 값이 아니다(계획 결정 7). */
  isMyTurn: boolean;
  /** 입력칸에 적혀 있는 그대로. 다듬기는 이 파일 안에서만 한다. */
  comment: string;
}

/**
 * 버튼이 막히는 사유. 열려 있으면 `null`이다.
 *
 * **차례가 먼저다.** 내 차례가 아닌데 「의견을 적으라」고 하면 사용자가 적어 놓고도 보내지
 * 못한다 — 먼저 걸리는 벽을 먼저 말한다.
 *
 * 사유는 **그 컨트롤의 이름으로 시작한다**(배치 규범 4). 비활성 컨트롤은 포커스를 받지 못해
 * 사유가 시각적으로 끊기면 어느 버튼의 것인지 복원할 단서가 없다.
 */
export const decisionBlockedReason = (kind: DecisionKind, state: DecisionState): string | null => {
  const label = kind === 'approve' ? t.decision.approve : t.decision.reject;

  if (!state.isMyTurn) return t.decision.blockedNotMyTurn(label);

  /* 승인은 의견이 선택이라 여기서 끝난다 — 계약이 그 필드를 선택으로 두었다. */
  if (kind === 'approve') return null;

  return isEmpty(state.comment) ? t.decision.blockedNoComment(label) : null;
};
