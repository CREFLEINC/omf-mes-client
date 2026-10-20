import { POP_SCREENS, type PopScreen } from '../pop-screen-catalog';

/**
 * 작업장 콘솔의 **작업 단계** — 시작 → 투입 → 실적.
 *
 * ⭐ **왜 단계를 보이는가.** 지금까지 작업자는 [화면 이동] 목록에서 다음 화면을 스스로 찾아야
 *    했다. 「지금 몇 번째 일을 하고 있고 다음이 무엇인가」가 화면에 없어, 투입을 건너뛰고
 *    실적으로 가거나 작업 시작 화면으로 되돌아가 길을 찾았다(#1395). 상용 MES 의 단계형 안내
 *    (Opcenter·Tulip)와 같은 자리다.
 *
 * ⭐ **세 단계다.** 검사(PQC)와 세션 종료는 생산 작업 화면 안에서 함께 일어난다 — 실적과 PQC 가
 *    한 화면으로 합쳐졌고(#1432) 실적을 저장하면 세션이 스스로 닫힌다. 단계로 따로 세우면 갈 곳이
 *    없는 단계가 생긴다.
 *
 * ⛔ **지나온 단계에 ✓ 를 붙이지 않는다.** 단계는 «위치»이지 «완료 판정»이 아니다 — 투입 화면을
 *    지나쳤다고 투입이 끝난 것은 아니고, 화면이 그것을 알 길도 없다.
 *
 * ⚠ 이름은 화면 목록(`pop-screen-catalog`)의 이름을 그대로 쓴다 — 단계에서 누른 이름과 열린
 *   화면의 머리줄이 같은 말이어야 한다.
 */
export interface PopWorkStep {
  key: 'start' | 'input' | 'result';
  screen: PopScreen;
}

const screenAt = (path: string): PopScreen => {
  const screen = POP_SCREENS.find((candidate) => candidate.path === path);

  /* 화면 목록과 라우트 표는 감지기가 대조한다 — 여기서 못 찾으면 목록이 바뀐 것이다. */
  if (screen === undefined) throw new Error(`작업 단계 화면이 목록에 없습니다: ${path}`);

  return screen;
};

export const POP_WORK_STEPS: readonly PopWorkStep[] = [
  { key: 'start', screen: screenAt('/pop/work-start') },
  { key: 'input', screen: screenAt('/pop/material-input') },
  { key: 'result', screen: screenAt('/pop/production-result') },
];

/** 지금 주소가 몇 번째 단계인가. 단계가 아닌 화면이면 `-1`. */
export const stepIndexOf = (pathname: string): number =>
  POP_WORK_STEPS.findIndex((step) => step.screen.path === pathname);

/**
 * 그 단계로 가는 주소. **작업지시가 필요한 단계인데 모르면 `null`** — 그 단계는 잠긴다.
 *
 * ⛔ **작업지시 없이 투입·실적으로 보내지 않는다.** 두 화면 모두 작업지시를 주소로만 받고,
 *    없으면 「작업 시작 화면에서 고르라」로 막힌다 — 단계 단추가 그 막힘으로 데려가면 고장으로
 *    보인다.
 */
export const stepDestination = (step: PopWorkStep, workOrderId: number | null): string | null => {
  if (step.screen.acceptsWorkOrderId !== true) return step.screen.path;
  if (workOrderId === null) return null;

  return `${step.screen.path}?workOrderId=${String(workOrderId)}`;
};

/** 지금 단계의 다음 단계. 마지막이거나 단계가 아닌 화면이면 `null`. */
export const nextStepOf = (pathname: string): PopWorkStep | null => {
  const index = stepIndexOf(pathname);

  if (index < 0) return null;

  return POP_WORK_STEPS.at(index + 1) ?? null;
};
