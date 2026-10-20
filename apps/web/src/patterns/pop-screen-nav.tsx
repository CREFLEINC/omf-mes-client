import type { PopScreen } from './pop-screen-catalog';

/**
 * 화면 이동의 **갈 곳 주소** — 홈·작업 메뉴·이상 보고 단추가 같은 규칙을 쓴다(공유계약 G-34).
 *
 * ⭐ **작업지시 문맥은 주소 하나로만 흐른다**(사용자 승인 2026-09-15). 지금 보는 화면이
 *    작업지시를 달고 있고 갈 화면도 그 인자를 받는 화면이면, 그 값을 그대로 실어 준다. 싣지
 *    않으면 작업자가 자재 투입에서 생산 실적으로 갈 때 「작업지시를 받지 못했다」로 막혀
 *    작업 시작 화면까지 되돌아가야 했다(WIP-CHAIN-01 D10).
 *
 * ⛔ **받는다고 표기된 화면에만 싣는다.** 모르는 화면에 실으면 그 화면이 쓰지 않는 값이 주소에
 *    남고, 뒤에 같은 이름을 쓰게 되면 남이 남긴 값으로 조회가 선다. 표기는 `pop-screen-catalog`.
 *
 * ⚠ 머리줄에 떠 있던 [화면 이동] 선택기는 걷었다 — 작업장 콘솔의 상태바(홈·이전·작업 메뉴)가
 *   그 자리를 맡는다(omf-all-around#147).
 */
export const destinationOf = (screen: PopScreen, search: string): string => {
  if (screen.acceptsWorkOrderId !== true) return screen.path;

  const workOrderId = new URLSearchParams(search).get('workOrderId');
  if (workOrderId === null || workOrderId === '') return screen.path;

  return `${screen.path}?workOrderId=${encodeURIComponent(workOrderId)}`;
};
