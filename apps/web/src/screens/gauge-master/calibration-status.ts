import type { Equipment } from './types';

/**
 * 검교정을 네 모양으로 가른다 — 화면 스펙 §5-5(공유계약 G-13 의 확장).
 *
 * ⛔ **「아직 안 함」과 「대상 아님」은 다른 것이다.** 앞은 **채워야 할 것**이고 뒤는 **정상**이다.
 * 같은 모양으로 그리면 채워야 할 것이 정상으로 보인다(공유계약 G-9 와 같은 취지).
 */
export type CalibrationStatus = 'notRequired' | 'never' | 'valid' | 'expired';

/**
 * 판정 하나. 날수는 유효면 남은 날, 만료면 지난 날이다.
 * **음수를 쓰지 않는다** — 「-3일 남음」이 아니라 「3일 경과」로 말한다.
 *
 * ⭐ **날수가 있는 갈래와 없는 갈래를 타입으로 가른다.** 「대상 아님」·「이력 없음」에는
 * 견줄 날짜가 아예 없다. 이것을 `number | null` 하나로 두면 부르는 쪽마다 `?? 0` 같은
 * **닿지 않는 기본값**이 붙고, 그 값은 틀려도 아무도 모른다 — 「오늘까지 유효」가 되어 버린다.
 */
export type CalibrationJudgment =
  | { status: Extract<CalibrationStatus, 'notRequired' | 'never'>; days: null }
  | { status: Extract<CalibrationStatus, 'valid' | 'expired'>; days: number };

/** 날짜만 견준다 — 시각이 섞이면 같은 날이 만료로 뒤집힌다. */
const toDayNumber = (isoDate: string): number | null => {
  const parsed = Date.parse(`${isoDate}T00:00:00Z`);

  return Number.isNaN(parsed) ? null : Math.floor(parsed / 86_400_000);
};

/**
 * 검교정 상태를 판정한다.
 *
 * ⭐ **「만료」는 저장된 값이 아니다.** 차기 예정일과 오늘을 견줘 **화면이 판정한다**(§5-2).
 * 컬럼에 두면 「정상 → 만료」가 **달력이 만드는 변화**인데도 매일 도는 배치가 필요하고,
 * 배치가 멈추면 **만료된 계측기가 정상으로 보인다** — 게이트의 근거가 조용히 썩는다.
 *
 * ⭐ **`today` 를 받는다.** 함수 안에서 오늘을 읽으면 시험이 날짜에 흔들리고, 자정을 넘기는
 * 순간 같은 입력이 다른 답을 낸다 — 판정의 입력은 전부 인자로 들어와야 한다.
 *
 * ⚠ **가르는 축이 둘이라는 것을 여기서 지킨다** — `calibrationRequired` 는 「게이트의 판정
 * 대상인가」이지 「이것이 계측기인가」가 아니다. 계측기인데 대상이 아닐 수 있고(단순 게이지),
 * 생산 설비인데 대상일 수 있다(스펙 §3-2).
 */
export const judgeCalibration = (
  equipment: Pick<Equipment, 'calibrationRequired' | 'lastCalibrationDate' | 'calibrationDueDate'>,
  today: string,
): CalibrationJudgment => {
  if (!equipment.calibrationRequired) return { status: 'notRequired', days: null };

  const last = equipment.lastCalibrationDate;
  if (last === null || last === undefined || last === '') {
    return { status: 'never', days: null };
  }

  const due = equipment.calibrationDueDate;
  const dueDay = due === null || due === undefined || due === '' ? null : toDayNumber(due);
  const todayDay = toDayNumber(today);

  /*
   * ⚠ **한 적은 있는데 예정일이 없거나 읽히지 않으면 「아직 안 함」이 아니다.** 그것은 사실이
   * 아니다 — 유효한지 «모르는» 것이고, 모르는 것을 정상으로 그리면 게이트가 헛돈다.
   * 채워야 할 것으로 다룬다(만료와 같은 무게는 아니지만 정상은 아니다).
   */
  if (dueDay === null || todayDay === null) return { status: 'never', days: null };

  return dueDay >= todayDay
    ? { status: 'valid', days: dueDay - todayDay }
    : { status: 'expired', days: todayDay - dueDay };
};
