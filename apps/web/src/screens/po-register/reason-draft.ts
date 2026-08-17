import type { components } from '@omf-mes/api-client';

/**
 * 상신 사유 초안 — **둘째 쓰기의 본문을 만드는 유일한 자리다.**
 *
 * 계약이 승인 요청의 업무 값을 **사유 하나**로 두었다(`ApprovalRequestCreate` = `reason`).
 * 그래서 결재함 목록에서 **이 문장의 첫 줄이 요약을 겸한다**(공유계약 A-12) — 이 화면은 그
 * 요약을 만드는 자리이고, 결재함(W-CO-09)이 그것을 읽는 자리다.
 *
 * | 규칙 | 값 | 근거 |
 * | --- | --- | --- |
 * | 필수 | **빈 값·공백만 거부** | 계약 `minLength: 1`. **목이 공백만을 202로 통과시킨다**(실측) — 막는 곳이 화면뿐이다 |
 * | 보낼 값 | **`trim`한 원문** | 줄바꿈은 유지한다 — 첫 줄이 요약이고 나머지가 근거다 |
 * | 최소 길이 | **강제하지 않는다** | 계약이 정한 것은 「한 글자 이상」뿐이다. 화면이 글자 수를 정하면 그것도 지어내는 것이다 |
 * | 유도 수단 | 자리표시 문구 · 보조 문구 · **확인 창이 전문과 첫 줄을 나눠 보인다** | 유도는 막는 것이 아니라 보이는 것으로 한다 |
 *
 * **승인 유형·승인자·결재선을 여기서 만들지 않는다**(착수 이슈 §6 ④ · 계획 결정 8). 본문에
 * 실을 자리가 계약에 없고, 사유 문자열에 섞어 보내면 결재함 목록의 요약이 오염된다.
 *
 * 이 화면이 소유한다 — 전례에서 사본으로 가져왔고, **다른 화면 슬라이스의 같은 이름 파일을
 * 참조하지 않는다.**
 */

type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];

/**
 * 친 사유를 읽은 결과. **두 갈래를 타입으로 가른다.**
 *
 * 「보낼 수 있다」와 「보낼 값」이 한 자리에서 함께 나오는 이유는, 갈리면 **판정은 통과했는데
 * 다른 문자열을 보내는** 자리가 생기기 때문이다 — 확인 창이 보이는 글자와 요청에 실리는 값도
 * 여기서 함께 나온다.
 */
export type ReasonState =
  | { kind: 'empty' }
  | {
      kind: 'ready';
      /** 보낼 값 — 앞뒤만 다듬고 **가운데 줄바꿈은 그대로 둔다.** */
      reason: string;
      /** 결재함 목록에서 요약을 겸할 첫 줄. 확인 창이 이 값을 따로 보인다. */
      firstLine: string;
    };

/**
 * 사유 전문에서 **첫 줄**을 뽑는다.
 *
 * CRLF를 함께 다루는 이유는 붙여넣기로 들어오는 글이 실제로 그 모양이기 때문이다 — 캐리지
 * 리턴이 남으면 첫 줄 끝에 보이지 않는 글자가 붙는다.
 *
 * **뽑은 줄의 앞뒤를 다듬는다.** 사유가 빈 줄로 시작하면 첫 줄이 빈 문자열이 되는데, 요약
 * 자리에 빈 글자가 서면 결재함 목록에서 그 건만 이름 없는 줄이 된다.
 */
export const firstLineOf = (reason: string): string =>
  (reason.trim().split(/\r?\n/)[0] ?? '').trim();

/**
 * 친 글자를 읽는다. **공백만은 빈 값과 같다.**
 *
 * 목이 공백만을 202로 통과시키는 것이 실측이므로(계획 §5.2.3) 이 판정이 없으면 **요약이 빈
 * 결재 요청**이 실제로 만들어진다.
 */
export const readReason = (raw: string): ReasonState => {
  const reason = raw.trim();

  if (reason === '') return { kind: 'empty' };

  return { kind: 'ready', reason, firstLine: firstLineOf(reason) };
};

/**
 * 상신 본문을 만든다. **다듬은 사유 하나뿐이다**(완료 조건 C29).
 *
 * **보낼 수 없으면 만들지 않는다** — 버튼 잠금과 보내는 자리의 재판정이 이미 닫은 길이지만,
 * 그 둘이 뚫려도 공백만인 사유가 결재에 오르지 않아야 한다(등록 조립 `po-request.ts`와 같은 규율).
 */
export const toApprovalRequest = (raw: string): ApprovalRequestCreate | null => {
  const state = readReason(raw);

  return state.kind === 'ready' ? { reason: state.reason } : null;
};

/**
 * 줄바꿈 없는 공백(U+00A0).
 *
 * **escape로 적고 `export`한다**(전례 `disposal-issue`·`iqc-skip-approval`과 같은 형태).
 * 원시 글자로 두면 저장소의 「비가시 공백 정리」 한 번이 **제품과 시험을 함께 지나**
 * `toVisibleLine`을 무동작으로 만드는데, 기대값이 같은 글자를 다시 쓰고 있으면 감지기가 아무
 * 말도 하지 않는다(자기참조). `export`는 시험이 이 값을 문자열 리터럴이 아니라 **상수로**
 * 참조하게 하려는 것이다.
 */
export const NO_BREAK_SPACE = '\u00a0';

/**
 * 사유 전문을 **줄로 가른다.** CRLF를 함께 다루는 이유는 첫 줄 뽑기와 같다.
 *
 * **빈 갈래를 두지 않는다** — 이 함수를 부르는 자리는 확인 창뿐이고, 그 창은 보낼 수 있는
 * 사유(`kind: 'ready'`)일 때만 열린다. 빈 글자를 위한 문구를 미리 만들면 보일 일이 없는
 * 자리표시가 남는다.
 */
export const toReasonLines = (reason: string): string[] => reason.split(/\r?\n/);

/**
 * 사유 한 줄을 **보이는 글자**로 만든다.
 *
 * 빈 줄과 들여쓴 줄은 HTML에서 접힌다 — 둘 다 「보이지 않게 되는」 자리라 글자를 세워 상자가
 * 높이를 갖게 한다. 접히면 사용자가 **확인한 글자**와 결재함에 실릴 글자가 갈린다.
 *
 * **`white-space`를 주지 않는다.** 이 슬라이스는 배치를 기존 클래스로만 하고 `app.css`를
 * 고치지 않는다 — 전역 스타일시트에 이 화면만 쓰는 규칙을 더하면 다른 화면이 그것을 물려받는다.
 *
 * **줄 가운데·끝 공백은 바꾸지 않는다.** 축약돼도 읽는 데 지장이 없고, 전부 바꾸면 사용자가
 * 복사해 간 사유에 보통 공백이 하나도 남지 않는다.
 */
export const toVisibleLine = (line: string): string => {
  if (line === '') return NO_BREAK_SPACE;

  const indentLength = line.length - line.trimStart().length;

  return indentLength === 0 ? line : NO_BREAK_SPACE.repeat(indentLength) + line.slice(indentLength);
};
