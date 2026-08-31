import type { StatCardDelta } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatFigure } from './types';

/**
 * 직전 기준일 대비 증감을 카드의 증감 표시로 옮긴다.
 *
 * ⭐ **화살표 방향을 «보이는 숫자»에서 정한다.** 비율 원값으로 방향을 정하면 0.0004처럼 아주
 * 작은 증가가 「0%」로 반올림되면서 **0%인데 위 화살표**가 붙는다 — 사용자는 그것을 「올랐다는
 * 건가 아니라는 건가」로 읽고, 둘 중 어느 쪽도 화면에서 확인할 수 없다.
 *
 * ⛔ **비교 대상이 없으면 아무것도 그리지 않는다.** 계약이 「비교 대상이 없으면 비운다」로
 * 두었고, 그것을 0%로 그리면 **어제와 같았다**는 사실을 지어내는 셈이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.dashboard;

export const toDelta = (deltaRatio: number | null): StatCardDelta | undefined => {
  if (deltaRatio === null) return undefined;

  /* 비율(0.08)을 백분율(8)로 옮긴 뒤 표기 자리수(소수 첫째)까지 접는다. */
  const percent = Math.round(deltaRatio * 1000) / 10;
  /* -0을 0으로 눕힌다 — 그냥 두면 「-0%」가 그려진다. */
  const settled = percent === 0 ? 0 : percent;
  const text = `${formatFigure(settled)}%`;

  if (settled > 0) {
    return { direction: 'up', value: `+${text}`, label: t.cards.deltaUp(text) };
  }

  if (settled < 0) {
    /* 부호는 숫자가 이미 달고 있다 — 여기서 다시 붙이면 「--0.8%」가 된다. */
    return { direction: 'down', value: text, label: t.cards.deltaDown(text) };
  }

  return { direction: 'flat', value: text, label: t.cards.deltaFlat };
};
