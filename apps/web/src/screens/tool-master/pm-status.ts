import { PM_TRIGGER } from './code-options';
import type { Mold } from './types';

/**
 * 예방보전을 네 모양으로 가른다(공유계약 G-13 의 확장).
 *
 * ⭐ **판정 주체가 형제 화면과 다르다.** 계측기 마스터(W-05-11)는 차기 예정일과 오늘을 견줘
 * **화면이** 판정하지만, 툴은 축이 둘(타발수·날짜)이고 타발수는 화면이 가진 값이 아니라
 * **서버가 판정해 `pmDue` 로 내려준다.** 화면이 다시 세면 서버와 다른 답을 낼 수 있다.
 *
 * ⛔ **`pmDue` 는 선택 필드다** — 안 오면 「모른다」이지 「정상」이 아니다(공유계약 G-9).
 * 모르는 것을 정상으로 그리면 도래한 툴이 정상으로 보이고, 그 툴이 계속 돈다.
 */
export type PmStatus = 'notRequired' | 'due' | 'beforeDue' | 'unknown';

/**
 * 판정 하나. **축은 도래한 갈래에만 있다** — 도래하지 않았으면 계약이 `null` 을 준다.
 * 한 모양으로 두면 부르는 쪽마다 닿지 않는 기본값이 붙는다.
 */
export type PmJudgment =
  | { status: Extract<PmStatus, 'notRequired' | 'beforeDue' | 'unknown'>; axis: null }
  | { status: Extract<PmStatus, 'due'>; axis: NonNullable<Mold['pmDueAxisCode']> | null };

export type PmTarget = Pick<Mold, 'pmTriggerTypeCode' | 'pmDue' | 'pmDueAxisCode'>;

/**
 * 예방보전 상태를 판정한다.
 *
 * ⭐ **도래를 가장 먼저 본다.** 판정 주체는 서버이므로, 판정 기준이 「하지 않음」인데도
 * 도래가 내려왔다면 그것은 서버가 아는 사실이다 — 화면이 「대상 아님」으로 덮으면
 * 서버가 도래라고 한 툴이 화면에서만 조용해진다.
 */
export const judgePm = (tool: PmTarget): PmJudgment => {
  if (tool.pmDue === true) {
    const axis = tool.pmDueAxisCode;

    return { status: 'due', axis: axis ?? null };
  }

  if (tool.pmTriggerTypeCode === PM_TRIGGER.none) return { status: 'notRequired', axis: null };

  /* ⛔ 「거짓」과 「안 왔다」를 가른다 — 뒤는 정상이 아니라 모르는 것이다. */
  return tool.pmDue === false
    ? { status: 'beforeDue', axis: null }
    : { status: 'unknown', axis: null };
};
