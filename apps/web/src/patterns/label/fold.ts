/**
 * 라벨에 다 못 싣는 줄을 **접는다** — 몇 줄을 보이고 몇 줄이 남았는지 정한다.
 *
 * ⛔⛔ **넘친 줄을 말없이 버리지 않는다.** 라벨에 적힌 것이 상자의 전부로 읽히면 현장에서
 *    대조가 어긋난다. 넘치면 **마지막 한 줄을 안내에 내주고** 몇 줄이 더 있는지 수로 말한다.
 *
 * ⛔ **자리에 딱 맞으면 안내를 넣지 않는다.** 세 줄 자리에 세 줄이면 그대로 셋을 싣는다 —
 *    「외 0건」이 서는 일이 없어야 한다.
 *
 * ⚠ **한 곳에 둔 까닭.** 포장 라벨에서 이 셈을 화면 안에 적었다가 **마지막 줄에 덧그리는
 *   결함**을 냈다(점판은 지우지 않아 두 글이 겹쳐 둘 다 못 읽힌다). 납품 라벨도 같은 접기를
 *   쓰므로, 같은 실수를 두 번 하지 않도록 셈을 여기 하나로 모은다.
 */

export interface FoldedRows<T> {
  /** 실제로 찍을 줄. 넘쳤으면 마지막 한 자리를 안내에 내주고 그만큼 적다. */
  shown: T[];
  /** 안내가 말해야 할 줄 수. 넘치지 않았으면 0 이다. */
  hidden: number;
}

export const foldRows = <T>(items: readonly T[], max: number): FoldedRows<T> => {
  /* 자리가 없으면 전부 숨은 것이다 — 안내조차 설 곳이 없으므로 부르는 쪽이 판단한다. */
  if (max <= 0) return { shown: [], hidden: items.length };

  if (items.length <= max) return { shown: [...items], hidden: 0 };

  const shown = items.slice(0, max - 1);

  return { shown, hidden: items.length - shown.length };
};
