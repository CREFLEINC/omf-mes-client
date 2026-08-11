import { messages } from '@omf-mes/i18n';

import type { CountLineView } from './types';
import { CODE_MAX } from './validation';

/**
 * 라인 초안 — **아직 보내지 않은 입력**이고, 이 화면에서는 줄마다 **칸이 둘**이다
 * (실물 수량 · 차이 사유). W-01-03의 표 안 입력은 칸이 하나였고 칸끼리 얽히지 않았는데,
 * 여기서는 **한 줄의 값이 다른 칸의 필수 여부를 바꾼다**(판정은 `variance-rule.ts`).
 *
 * **친 글자를 그대로 들고 있는다.** 숫자로 강제해 들고 있으면 지우는 도중(`1` → `` → `2`)에
 * 값이 튀고, 「0.」처럼 아직 완성되지 않은 입력이 사라져 소수를 칠 수 없다.
 *
 * ---
 *
 * **초안이 성긴 것이 이 파일의 중심 결정이다** — 라인 응답으로 키를 미리 깔지 않는다.
 *
 * 깔면 「응답이 도착했다」가 초안을 만드는 사건이 되고, 되돌림 effect의 의존성에 라인 응답이
 * 들어가 **치던 값이 갱신에 사라진다**(#43 · 감지기 M35). 성기게 두면 되돌림 축이 **고른
 * 위치(`loc`) 하나**로 남고, 「빈 칸으로 시작한다」(승인 13-4 · 완료 조건 C35)가 읽는 자리의
 * 되돌림 값으로 **구조에 박힌다** — 채우려면 이 파일의 두 함수를 고쳐야 한다.
 *
 * 사라진 줄의 초안이 남는 문제는 **요청 조립이 표에 있는 줄만 싣는 것**으로 막는다
 * (`line-replace-request.ts` · 감지기 M46).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.stocktaking;

/** 한 줄의 초안. **두 칸이 한 짝이다** — 한쪽만 고쳐도 다른 쪽이 남아야 한다. */
export interface LineDraftEntry {
  countedQty: string;
  varianceReason: string;
}

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ENTRY: LineDraftEntry = { countedQty: '', varianceReason: '' };

/**
 * 초안 한 벌. **실사 라인 번호가 키다** — 초안이 어느 줄에 묶여 있는지를 자료 구조가 밝힌다.
 *
 * 위치가 바뀌면 키 집합이 통째로 비워진다. 그것이 「대상이 바뀌면 친 값이 뜻을 잃는다」의 구현이다.
 */
export type LineDrafts = Readonly<Record<number, LineDraftEntry>>;

export const EMPTY_LINE_DRAFTS: LineDrafts = {};

/**
 * 친 글자의 해석 결과. **세 갈래를 타입으로 가른다** — 미입력 · 형식 오류 · 수량.
 * 미입력을 오류와 뭉개면 위치를 여는 순간 전 줄이 붉은 글씨가 된다.
 */
export type QtyParse =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'qty'; value: number };

/**
 * 친 글자를 실물 수량으로 읽는다.
 *
 * **빈 칸은 오류가 아니다** — 「이 줄은 아직 세지 않았다」는 뜻이고, 그 사정은 저장 버튼의
 * 사유가 맡는다(전 줄 필수 · 완료 조건 C36).
 *
 * **0을 막지 않는다.** 계약이 `minimum: 0`이라 「세어 보니 하나도 없었다」가 정상 값이다 —
 * W-01-03의 `exclusiveMinimum: 0`과 갈리는 자리다(완료 조건 C37).
 *
 * `Number()`는 빈 문자열과 공백을 `0`으로 읽고 `Infinity`를 숫자로 읽는다 — 둘 다 여기서
 * 걸러 낸다. 걸러 내지 않으면 요청 본문에 `0`이나 `Infinity`(직렬화하면 `null`)가 실린다.
 */
export const parseCountedQty = (raw: string): QtyParse => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid', message: t.errors.qtyNotNumber };
  if (value < 0) return { kind: 'invalid', message: t.errors.qtyNegative };

  return { kind: 'qty', value };
};

/**
 * 고른 차이 사유의 해석 결과. 수량과 같은 형태로 **세 갈래**를 가른다 —
 * 「안 골랐다」가 오류가 아니어야 차이 없는 줄이 그대로 저장된다.
 */
export type ReasonParse =
  | { kind: 'none' }
  | { kind: 'invalid'; message: string }
  | { kind: 'code'; value: string };

/**
 * 고른 차이 사유를 읽는다.
 *
 * **길이를 재는 이유**: 선택지에서 고른 값이라 길이 오류가 날 리 없어 보이지만, 값 목록은
 * **서버가 내려주는 것**이고(공유계약 G-2) 계약이 `maxLength: 50`을 건다. 51자짜리 코드가
 * 선택지에 실리면 **버튼은 열려 있는데 보낼 수 없는 상태**가 되므로 화면이 그 자리에서 막는다.
 *
 * **보낼 값의 길이를 잰다** — 요청 조립이 앞뒤 공백을 떼고 보내므로 여기서도 뗀 값을 재야
 * 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생기지 않는다(`validation.ts`와 같은 규칙).
 */
export const parseVarianceReason = (raw: string): ReasonParse => {
  const text = raw.trim();

  if (text === '') return { kind: 'none' };
  if (text.length > CODE_MAX) return { kind: 'invalid', message: t.errors.codeTooLong(CODE_MAX) };

  return { kind: 'code', value: text };
};

/**
 * 그 줄의 실물 수량 칸에 보이는 글자. **초안에 없으면 빈 칸이다.**
 *
 * **줄을 통째로 받는 이유가 여기 있다**(완료 조건 C35 · 감지기 M32). 서버가 준 `countedQty`로
 * 되돌리려면 이 함수를 고쳐야 하고, 그 한 자리가 「빈 칸으로 시작한다」를 지키는 곳이다 —
 * 미실사 줄도 계약상 `countedQty`가 필수라 **0으로 내려오며**, 채워 두면 사용자가 그대로
 * 저장하는 순간 세지 않은 줄이 「0개를 셌다」로 바뀐다. 화면은 그 둘을 구분할 수 없다.
 */
export const readDraftQty = (drafts: LineDrafts, line: CountLineView): string =>
  drafts[line.inventoryCountLineId]?.countedQty ?? '';

/**
 * 그 줄의 차이 사유 칸에 보이는 값. **초안에 없으면 빈 값이다.**
 *
 * 앞서 저장된 사유를 물려받지 않는 이유는 두 칸이 한 줄의 짝이기 때문이다 — 수량은 다시 치는데
 * 사유만 남으면 그 사유가 **지금 친 수량에 대한 것**으로 읽힌다.
 */
export const readDraftReason = (drafts: LineDrafts, line: CountLineView): string =>
  drafts[line.inventoryCountLineId]?.varianceReason ?? '';

const patchEntry = (
  drafts: LineDrafts,
  inventoryCountLineId: number,
  patch: Partial<LineDraftEntry>,
): LineDrafts => ({
  ...drafts,
  [inventoryCountLineId]: { ...(drafts[inventoryCountLineId] ?? EMPTY_ENTRY), ...patch },
});

/** 한 줄의 실물 수량을 바꾼다. 앞 초안을 고치지 않는다 — 같은 참조를 고치면 화면이 다시 그려지지 않는다. */
export const setDraftQty = (
  drafts: LineDrafts,
  inventoryCountLineId: number,
  countedQty: string,
): LineDrafts => patchEntry(drafts, inventoryCountLineId, { countedQty });

/** 한 줄의 차이 사유를 바꾼다. 같은 줄의 수량은 그대로 남는다. */
export const setDraftReason = (
  drafts: LineDrafts,
  inventoryCountLineId: number,
  varianceReason: string,
): LineDrafts => patchEntry(drafts, inventoryCountLineId, { varianceReason });

/**
 * 버릴 것이 있는가. 위치를 바꾸거나 취소할 때 확인을 받을지 정한다(계획 결정 15).
 *
 * **잘못 친 값도 채운 것으로 본다** — 사용자가 친 값이라는 사실은 같다.
 * 공백만 친 칸은 버릴 값이 아니다. 그 하나 때문에 확인 창이 뜨면 사용자는 잃을 것이 없는데도
 * 확인을 받게 되고, 그런 확인이 되풀이되면 읽지 않고 누르게 된다.
 */
export const hasAnyLineDraftValue = (drafts: LineDrafts): boolean =>
  Object.values(drafts).some(
    (entry) => entry.countedQty.trim() !== '' || entry.varianceReason.trim() !== '',
  );
