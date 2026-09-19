/**
 * 한 줄에 세우려고 글자를 줄이는 자리 — **목록의 품목 칸이 쓴다.**
 *
 * ## 왜 필요한가
 *
 * 품목은 `품목코드 · 품목명 【도번】` 이라 길다. 실측(2026-09-19 · 현장 자료 · 1024×768):
 * 17px 에서 376~489px 가 필요한데 줄의 가로는 400px 뿐이다. 그대로 두면 품목이 네 줄로 접혀
 * 줄 하나가 148px 까지 부풀고, 405px 짜리 목록에 **두세 줄밖에 서지 못한다.**
 *
 * ⛔ **CSS 만으로는 못 한다.** 글자가 얼마나 긴지는 그려 봐야 알 수 있고 CSS 에는 그 값을 보는
 *    길이 없다. 그래서 그린 뒤 재고 한 단계씩 내린다.
 *
 * ⛔ **끝없이 줄이지 않는다.** 바닥은 12px 다 — 장갑 낀 손으로 1m 떨어져 보는 산업용 패널에서
 *    그 아래는 읽지 못하는 글자다. 바닥에서도 넘치면 말줄임(CSS)이 받고, 값 전체는 접근 이름에
 *    그대로 남는다(`receipt-list` 의 `selectRow`).
 *
 * ⚠ **문자 수로 가르지 않는다.** 한글·영문·`【 』` 가 섞여 글자마다 폭이 달라, 문자 수로 재면
 *   넘치거나 필요 이상으로 작아진다(실측: 같은 40자가 380px 과 313px).
 */

/**
 * 내려가는 차례. **첫 값이 본래 크기**(`--pop-text` 와 같은 17px)이고 마지막이 바닥이다.
 *
 * 16px 을 건너뛰는 것은 한 단계로 줄어드는 폭이 30px 남짓이라 눈에 띄지 않고 되돌이만 늘기
 * 때문이다 — 실측 기준 17→15 가 한 번에 60px 을 던다.
 */
export const FIT_FONT_STEPS: readonly number[] = [17, 15, 14, 13, 12];

/** 재는 데 쓰는 부분만. 감지기가 실물 DOM 없이 같은 판정을 돌릴 수 있게 좁게 잡는다. */
export interface FittableNode {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly style: { fontSize: string };
}

/**
 * 들어가는 첫 크기로 맞추고 그 값을 돌려준다. **고른 크기는 노드에 남는다.**
 *
 * 아직 그려지지 않아 폭이 0 이면(`clientWidth === 0`) 첫 크기로 둔다 — 그 상태에서 줄이면
 * 나중에 폭이 생겨도 작은 글자가 그대로 남는다.
 */
export const fitFontSize = (node: FittableNode, steps = FIT_FONT_STEPS): number => {
  const first = steps[0] ?? 0;
  const floor = steps[steps.length - 1] ?? 0;

  /* 폭을 모르면 재는 뜻이 없다 — 여기서 줄이면 폭이 생긴 뒤에도 작은 글자가 남는다. */
  if (node.clientWidth === 0) {
    node.style.fontSize = `${String(first)}px`;

    return first;
  }

  for (const size of steps) {
    node.style.fontSize = `${String(size)}px`;
    if (node.scrollWidth <= node.clientWidth) return size;
  }

  node.style.fontSize = `${String(floor)}px`;

  return floor;
};
