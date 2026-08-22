import { messages } from '@omf-mes/i18n';

import type { ShotFigure } from './shot-counts';

const t = messages.toolMaster.shots;

/** 타발수는 자릿수가 커서 무리 짓지 않으면 읽기 어렵다 — 50 만과 5 만이 눈으로 갈리지 않는다. */
export const countText = (count: number): string => count.toLocaleString('ko-KR');

/** 초과율은 소수 한 자리까지. 계약이 백분율로 내려 준다 — 화면이 다시 셈하지 않는다. */
export const ratioText = (ratio: number): string => t.percent(ratio.toFixed(1));

/**
 * 판정 하나를 글자로. **못 세는 두 갈래를 다른 말로 그린다** —
 * 「적정타수 미입력」은 채우면 풀리는 것이고 「산출 불가」는 그렇지 않다.
 */
export const figureText = (figure: ShotFigure, format: (value: number) => string): string => {
  switch (figure.kind) {
    case 'value':
      return format(figure.value);
    case 'guaranteedMissing':
      return t.guaranteedMissing;
    case 'notCalculable':
      return t.notCalculable;
  }
};
