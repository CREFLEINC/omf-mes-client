import { messages } from '@omf-mes/i18n';

/**
 * 줄 초안 — **아직 보내지 않은 입력**이고, 이 화면에서는 **선택과 수량이 짝**이다.
 *
 * W-01-03은 수량만 받았고 W-01-04는 전 줄이 필수였다. 여기서는 **고른 줄만** 수량이 필요하다
 * (계획 결정 7) — 그래서 초안이 두 조각이다.
 *
 * **친 글자를 그대로 들고 있는다.** 숫자로 강제해 들고 있으면 지우는 도중(`1` → `` → `2`)에
 * 값이 튀고, 「0.」처럼 아직 완성되지 않은 입력이 사라져 소수를 칠 수 없다.
 *
 * ---
 *
 * **초안이 성긴 것이 이 파일의 중심 결정이다** — 라인 응답으로 키를 미리 깔지 않는다.
 *
 * 깔면 「응답이 도착했다」가 초안을 만드는 사건이 되고, 되돌림 effect의 의존성에 라인·잔액
 * 응답이 들어가 **치던 값이 갱신에 사라진다**(#43 · 감지기 M27). 성기게 두면 되돌림 축이
 * **고른 전표(`gr`) 하나**로 남고, 「빈 칸으로 시작한다」(승인 13-7 · 완료 조건 C21)가 읽는
 * 자리의 기본값으로 **구조에 박힌다** — 채우려면 이 파일의 두 함수를 고쳐야 한다.
 *
 * 사라진 줄의 초안이 남는 문제는 **요청 조립이 표에 있는 줄만 싣는 것**으로 막는다
 * (계획 결정 8 — 뒤따르는 회차).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.supplierReturn;

/**
 * 초안 한 벌. **입고 라인 번호가 키다** — 초안이 어느 줄에 묶여 있는지를 자료 구조가 밝힌다.
 *
 * 고른 전표가 바뀌면 두 조각이 통째로 비워진다. 그것이 「대상이 바뀌면 친 값이 뜻을 잃는다」의
 * 구현이다(수명 표 4행).
 */
export interface LineDraft {
  /** 고른 줄. **누른 차례를 그대로 둔다** — 화면은 표의 차례로 그리므로 차례가 뜻을 갖지 않는다. */
  readonly selectedLineIds: readonly number[];
  /** 줄마다 친 글자. 없는 키는 빈 칸이다. */
  readonly qtyTexts: Readonly<Record<number, string>>;
}

export const EMPTY_LINE_DRAFT: LineDraft = { selectedLineIds: [], qtyTexts: {} };

/**
 * 친 글자의 해석 결과. **세 갈래를 타입으로 가른다** — 미입력 · 형식 오류 · 수량.
 * 미입력을 오류와 뭉개면 전표를 여는 순간 전 줄이 붉은 글씨가 된다.
 */
export type QtyParse =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'qty'; value: number };

/**
 * 친 글자를 반품 수량으로 읽는다.
 *
 * **빈 칸은 오류가 아니다** — 「이 줄은 되돌려 보내지 않는다」는 뜻이다. 고른 줄인데 비어 있는
 * 사정은 다음 단계의 사유가 맡는다(`return-selection.ts`).
 *
 * **0을 막는다.** 계약이 `issueQty`에 `exclusiveMinimum: 0`을 두었고 목이 0을 400으로
 * 되돌린다(실측) — 재고실사(`minimum: 0`)와 **반대**인 자리다.
 *
 * `Number()`는 빈 문자열과 공백을 `0`으로 읽고 `Infinity`를 숫자로 읽는다 — 둘 다 여기서
 * 걸러 낸다. 걸러 내지 않으면 요청 본문에 `0`이나 `null`(직렬화한 `Infinity`)이 실린다.
 */
export const parseReturnQty = (raw: string): QtyParse => {
  const text = raw.trim();

  if (text === '') return { kind: 'empty' };

  const value = Number(text);

  if (!Number.isFinite(value)) return { kind: 'invalid', message: t.errors.qtyNotNumber };
  if (value <= 0) return { kind: 'invalid', message: t.errors.qtyNotPositive };

  return { kind: 'qty', value };
};

/**
 * 그 줄의 반품 수량 칸에 보이는 글자. **초안에 없으면 빈 칸이다.**
 *
 * **이 자리가 「빈 칸으로 시작한다」를 지키는 곳이다**(승인 13-7 · 감지기 M22). 입고 수량으로
 * 되돌리려면 이 함수를 고쳐야 하고, 그러면 전량 반품이 기본값처럼 보여 사용자가 그대로
 * 확인하는 순간 **받은 전부가 나간다.**
 */
export const readDraftQty = (draft: LineDraft, goodsReceiptLineId: number): string =>
  draft.qtyTexts[goodsReceiptLineId] ?? '';

/** 한 줄의 반품 수량을 바꾼다. 앞 초안을 고치지 않는다 — 같은 참조를 고치면 화면이 다시 그려지지 않는다. */
export const setDraftQty = (
  draft: LineDraft,
  goodsReceiptLineId: number,
  text: string,
): LineDraft => ({
  ...draft,
  qtyTexts: { ...draft.qtyTexts, [goodsReceiptLineId]: text },
});

/** 그 줄이 초안에서 골라져 있는가. **고를 수 있는 줄인지는 여기서 보지 않는다**(`return-selection.ts`의 몫). */
export const isLineSelected = (draft: LineDraft, goodsReceiptLineId: number): boolean =>
  draft.selectedLineIds.includes(goodsReceiptLineId);

/**
 * 한 줄의 선택을 켜고 끈다.
 *
 * **선택을 풀어도 그 줄에 친 수량은 지우지 않는다.** 잘못 눌러 풀렸을 때 값까지 사라지면
 * 처음부터 다시 친다 — 무엇을 보내는지는 요약(고른 줄 수·합계)과 확인 창이 밝히므로,
 * 남은 값이 조용히 나가는 일은 없다.
 */
export const toggleLineSelection = (draft: LineDraft, goodsReceiptLineId: number): LineDraft => ({
  ...draft,
  selectedLineIds: isLineSelected(draft, goodsReceiptLineId)
    ? draft.selectedLineIds.filter((id) => id !== goodsReceiptLineId)
    : [...draft.selectedLineIds, goodsReceiptLineId],
});
