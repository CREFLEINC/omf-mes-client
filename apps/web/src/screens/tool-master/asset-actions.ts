import { messages } from '@omf-mes/i18n';

import { DISPOSED_STATUS_CODE, type CodeOption } from './code-options';
import type { Mold } from './types';

const t = messages.toolMaster.actionReasons;
const r = messages.toolMaster.retire;

/** 지금 이 조작을 할 수 있는가. 못 하면 **왜 못 하는지가 함께 온다**(공유계약 G-2). */
export interface ActionAvailability {
  enabled: boolean;
  /** 열려 있으면 `null`. 잠겨 있으면 반드시 문장이 있다 — 감추지 않는다 */
  reason: string | null;
}

const ALLOWED: ActionAvailability = { enabled: true, reason: null };

/** 판정에 필요한 것만 받는다 — 목록 행이 아니라 «상세»가 준다. */
export type RetireTarget = Pick<Mold, 'isActive' | 'statusCode'>;

/**
 * 상세를 아직 못 받았다.
 *
 * ⛔ **모르면 잠근다.** 열어 두면 확인 창이 그릴 대상을 못 찾아 **눌러도 아무 일도 일어나지
 * 않는다** — 사용자는 자기가 잘못 눌렀다고 여기고 다시 누르며, 화면은 계속 침묵한다.
 * (W-05-11 슬라이스 ③ 에서 실제로 났던 결함이다.)
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
 * 목록이 차 있어도 `DISPOSED` 가 없으면 이미 폐기된 자산을 「아직 안 폐기됨」으로 읽고
 * 버튼을 연다. 시드가 아직 없어 목록이 빌 수 있고(설계 `omf-mes#182`), 그때도 이 검사가 잡는다.
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

/**
 * 확인 창에 함께 보일 「무엇이 이 툴에 매여 있는가」.
 *
 * ⭐ **계약이 시킨 것이다** — 「참조가 있으면 확인 문구에 건수를 함께 보인 뒤 부른다」
 * (`:deactivate` 주석 · 공유계약 B-4). 물리 삭제가 없는 자원이라 그 건수가 판단의 근거다.
 *
 * ⛔ **세 갈래를 하나로 뭉개지 않는다**(공유계약 G-9). 「N건 있다」와 「없다」와 「셀 수 없다」는
 * 각각 다른 사실이고, 셀 수 없는 것을 「없다」로 그리면 매인 자료가 있는데도 가볍게 누르게 된다.
 * 계약이 `referenceCount` 를 선택으로 두고 「`NOT_COUNTABLE` 이면 `null`」이라 못박은 이유다.
 */
export const referenceNote = (referenceCount: number | null | undefined): string => {
  if (referenceCount === null || referenceCount === undefined) return r.referenceUnknown;

  return referenceCount === 0 ? r.referenceNone : r.referenceCount(referenceCount);
};

/**
 * 라벨이 나가 있다는 사실. **참조 건수와 다른 축이다** — 참조 0은 「시스템 안에서 아무도
 * 안 쓴다」이고, 라벨은 **시스템 밖에 나가 있는 것**이라 회수할 수 없다(스펙 §6).
 * 발행된 적이 없으면 할 말이 없다.
 */
export const labelNote = (labelIssueCount: number | null): string | null =>
  labelIssueCount === null || labelIssueCount === 0 ? null : r.labelIssued(labelIssueCount);
