import type { components } from '@omf-mes/api-client';

/**
 * 취소 사유 초안 — **취소 요청 본문을 만드는 유일한 자리다.**
 *
 * ⭐ **이 사유가 곧 취소 이력이다.** 물류 문서 테이블에 취소 시각·취소자·취소 사유를 담을 컬럼이
 * 하나도 없어(계약 실측) **승인 기록이 그 이력을 대신한다**. 그래서 계약이 `reason`을 필수로
 * 두었고, 빈 사유로 올린 취소는 나중에 「왜 취소했는가」에 아무도 답할 수 없다.
 *
 * | 규칙 | 값 | 근거 |
 * | --- | --- | --- |
 * | 필수 | **빈 값·공백만 거부** | 계약이 `reason`을 필수로 두었다. 공백만도 빈 값과 같다 — 서버가 통과시켜도 이력은 비어 있다 |
 * | 보낼 값 | **`trim`한 원문** | 가운데 줄바꿈은 그대로 둔다. 여러 줄로 근거를 적는 것이 실제 형태다 |
 * | 최소 길이 | **강제하지 않는다** | 착수 이슈·계획이 글자 수를 정하지 않았다(질의 Q3의 기본값). 화면이 정하면 그것도 지어내는 것이다 |
 * | 유도 수단 | 자리표시 문구·보조 문구 | 유도는 **막는 것이 아니라 보이는 것**으로 한다 |
 *
 * ⛔ **첫 줄을 따로 뽑지 않는다.** 전례(`disposal-issue/reason-draft.ts`)는 결재함 목록에서
 * 첫 줄이 요약을 겸한다는 이유로 그것을 갈라 보였는데, 이 화면의 확인 창은 **대상 문서번호와
 * 승인·철회 사실**을 말하는 자리이고 사유를 다시 그리지 않는다(계획 갈래 30). 쓰지 않는 값을
 * 만들어 두면 다음 사본이 그 자리를 지고 간다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];

/**
 * 계약이 정한 사유 필드의 이름.
 *
 * **서버가 준 필드 오류를 사유 칸 옆에 붙이는 열쇠**다(`useMasterWrite`의 `knownFields`). 화면이
 * 쓰는 이름과 서버가 부르는 이름이 갈리면 그 오류는 칸 옆이 아니라 배너로 밀려난다.
 */
export const CANCEL_REASON_FIELD = 'reason';

/**
 * 이 화면이 소유한 입력칸 이름 — **사유 하나뿐이다.**
 *
 * 여기 없는 이름의 오류는 전부 배너로 올라간다. 이름을 하나라도 더 적으면 **붙일 칸이 없는
 * 오류가 어디에도 보이지 않게 된다.**
 */
export const CANCEL_FORM_FIELDS: readonly string[] = [CANCEL_REASON_FIELD];

/**
 * 친 사유를 읽은 결과. **두 갈래를 타입으로 가른다.**
 *
 * 「보낼 수 있다」와 「보낼 값」을 한 자리에서 함께 내는 이유는, 판정과 값이 갈리면 **판정은
 * 통과했는데 다른 문자열을 보내는** 자리가 생기기 때문이다.
 */
export type CancelReasonState =
  | { kind: 'empty' }
  /** 보낼 값 — 앞뒤만 다듬고 **가운데 줄바꿈은 그대로 둔다.** */
  | { kind: 'ready'; reason: string };

/**
 * 친 글자를 읽는다. **공백만은 빈 값과 같다.**
 *
 * 공백만을 서버가 통과시키면 승인 기록에 **빈 이력**이 남는다 — 그 취소는 흔적이 있으되
 * 아무것도 말하지 않는 흔적이고, 그것을 막는 자리가 여기뿐이다.
 */
export const readCancelReason = (raw: string): CancelReasonState => {
  const reason = raw.trim();

  if (reason === '') return { kind: 'empty' };

  return { kind: 'ready', reason };
};

/**
 * 취소 요청 본문을 만든다. **다듬은 사유 하나뿐이다.**
 *
 * 계약의 본문 스키마에 필드가 그것 하나라, 다른 값을 함께 실으면 계약 밖의 요청이 된다.
 * **보낼 수 없으면 만들지 않는다** — 버튼 잠금과 보내는 자리의 재판정이 이미 닫은 길이지만,
 * 그 둘이 뚫려도 빈 사유가 승인에 오르지 않아야 한다.
 */
export const toCancelRequest = (raw: string): ApprovalRequestCreate | null => {
  const state = readCancelReason(raw);

  return state.kind === 'ready' ? { reason: state.reason } : null;
};
