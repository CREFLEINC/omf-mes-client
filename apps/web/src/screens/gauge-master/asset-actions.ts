import { messages } from '@omf-mes/i18n';

import { DISPOSED_STATUS_CODE, type CodeOption } from './code-options';
import type { Equipment } from './types';

const t = messages.gaugeMaster.actionReasons;

/** 지금 이 조작을 할 수 있는가. 못 하면 **왜 못 하는지가 함께 온다**(공유계약 G-2). */
export interface ActionAvailability {
  enabled: boolean;
  /** 열려 있으면 `null`. 잠겨 있으면 반드시 문장이 있다 — 감추지 않는다 */
  reason: string | null;
}

const ALLOWED: ActionAvailability = { enabled: true, reason: null };

/** 판정에 필요한 것만 받는다 — 목록 행이 아니라 «상세»가 준다. */
export type RetireTarget = Pick<Equipment, 'isActive' | 'statusCode'>;

/**
 * 상세를 아직 못 받았다.
 *
 * ⛔ **모르면 잠근다.** 열어 두면 확인 창이 그릴 대상을 못 찾아 **눌러도 아무 일도 일어나지
 * 않는다** — 사용자는 자기가 잘못 눌렀다고 여기고 다시 누르며, 화면은 계속 침묵한다.
 */
const unknown = (): ActionAvailability => ({ enabled: false, reason: t.targetUnknown });

/**
 * 사용 중지를 지금 할 수 있는가.
 *
 * 이미 중지된 것에는 **중지할 대상이 없다.** 감추지 않고 사유와 함께 잠근다 —
 * 사라진 버튼은 「원래 없는 기능」과 구분되지 않는다.
 */
export const deactivateAvailability = (target: RetireTarget | null): ActionAvailability => {
  if (target === null) return unknown();

  return target.isActive ? ALLOWED : { enabled: false, reason: t.alreadyInactive };
};

/**
 * 폐기를 지금 할 수 있는가.
 *
 * ⭐ **「목록이 비었는가」가 아니라 「내가 쓰는 코드값이 그 목록에 있는가」를 본다.**
 * 형제 화면(W-05-12)은 값 목록이 비었는지만 보는데, 그것으로는 **환경이 다른 코드값을 쓰는
 * 경우**를 못 잡는다 — 목록은 차 있는데 `DISPOSED` 가 없으면 이미 폐기된 자산을 「아직
 * 안 폐기됨」으로 읽고 버튼을 연다. 여기서는 그 값이 실제로 있을 때만 판정한다.
 *
 * ⚠ 시드가 아직 없어 목록이 빌 수 있다(설계 `omf-mes#182`). 그때도 이 검사가 잡고,
 * 목록이 들어오면 잠금은 저절로 풀린다.
 */
export const disposeAvailability = (
  target: RetireTarget | null,
  statusOptions: readonly CodeOption[],
): ActionAvailability => {
  if (target === null) return unknown();

  if (!statusOptions.some((option) => option.value === DISPOSED_STATUS_CODE)) {
    return { enabled: false, reason: t.disposeUnavailable };
  }

  return target.statusCode === DISPOSED_STATUS_CODE
    ? { enabled: false, reason: t.alreadyDisposed }
    : ALLOWED;
};
