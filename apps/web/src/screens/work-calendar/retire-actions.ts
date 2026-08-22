import { messages } from '@omf-mes/i18n';

import type { WorkCalendar } from './types';

const t = messages.workCalendar.retire;

/** 지금 이 조작을 할 수 있는가. 못 하면 **왜 못 하는지가 함께 온다**(공유계약 G-2). */
export interface ActionAvailability {
  enabled: boolean;
  /** 열려 있으면 `null`. 잠겨 있으면 반드시 문장이 있다 — 감추지 않는다 */
  reason: string | null;
}

/** 판정에 필요한 것만 받는다 — 목록 행이 아니라 «상세»가 준다. */
export type RetireTarget = Pick<WorkCalendar, 'isActive'>;

/**
 * 사용 중지를 지금 할 수 있는가.
 *
 * ⛔ **모르면 잠근다.** 열어 두면 확인 창이 그릴 대상을 못 찾아 **눌러도 아무 일도 일어나지
 * 않는다** — 사용자는 자기가 잘못 눌렀다고 여기고 다시 누르며, 화면은 계속 침묵한다
 * (W-05-11 슬라이스 ③ 에서 실제로 났던 결함이다).
 */
export const deactivateAvailability = (target: RetireTarget | null): ActionAvailability => {
  if (target === null) return { enabled: false, reason: t.targetUnknown };

  return target.isActive
    ? { enabled: true, reason: null }
    : { enabled: false, reason: t.alreadyInactive };
};

/**
 * 확인 창에 함께 보일 「몇이 이 캘린더를 따르는가」.
 *
 * ⭐ **계약이 시킨 것이다** — 「참조가 있으면 확인 문구에 건수를 함께 보인 뒤 부른다」
 * (`:deactivate` 주석 · 공유계약 B-4).
 *
 * ⛔ **세 갈래를 하나로 뭉개지 않는다**(G-9). 「N곳이 따른다」와 「없다」와 「아직 모른다」는
 * 각각 다른 사실이고, 모르는 것을 「없다」로 그리면 **매인 대상이 있는데도 가볍게 누르게 된다.**
 * 이 화면에서는 중지가 곧 그 대상들을 상위 층으로 떨어뜨리는 일이라 그 오해가 비싸다.
 */
export const applicationNote = (applicationCount: number | null): string => {
  if (applicationCount === null) return t.applicationUnknown;

  return applicationCount === 0 ? t.applicationNone : t.applicationCount(applicationCount);
};
