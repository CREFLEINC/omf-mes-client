import { DATA_TYPES } from './measurement-draft';
import { isOutOfSpec, type MeasurementRow } from './measurement-rows';

/**
 * 자동 판정 — **채우되 잠그지 않는다**(스펙 §5-11).
 *
 * 검사기준 등록 화면이 항목마다 「상·하한으로 합·불을 자동 판정할지」를 스위치로 갖고 있고,
 * **이 화면이 그것을 읽는 유일한 화면**이다.
 *
 * ⭐ **채운 값은 시작점이지 확정이 아니다.** 사람이 바꿀 수 있다 — 스위치가 있는 마스터에서
 * 결과까지 잠그면 스위치를 두 번 쓰는 셈이 된다. 설비 점검 입력 화면이 같은 형태를 «반대»로
 * 정했는데, 그쪽에는 스위치가 없어서다(§9-5). **그 화면을 베끼지 않는다.**
 *
 * ⛔ **종합 판정은 어떤 경우에도 자동으로 내리지 않는다.** 항목이 전부 불합격이어도 종합
 * 판정은 사람이 고른다 — §6의 「자동 불합격 아님」이 가장 강하게 걸리는 자리다. 그래서 이
 * 파일은 **항목 판정만** 다룬다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/** 항목 판정의 두 값. ⛔ 「보류」가 없다 — 그것은 검사 결과 수준의 개념이다(§4-C). */
export const ITEM_JUDGMENTS = {
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
} as const;

/**
 * 이 항목에서 자동 판정이 **서는가** — 셋이 모두 참일 때만이다(§5-11).
 *
 * 하한·상한이 **하나만** 있어도 선다. 「9.9 이상」 같은 한쪽 공차가 실제 검사기준에 흔하고,
 * 둘 다 있을 때만 세면 그런 항목이 영영 자동 판정을 못 받는다.
 */
export const standsAutomatically = (row: MeasurementRow): boolean =>
  row.automaticJudgment &&
  row.dataTypeCode === DATA_TYPES.numeric &&
  (row.spec.lower !== null || row.spec.upper !== null);

/**
 * 자동 판정 플래그는 켜졌는데 **기준이 없어 판정이 서지 않는가**(§6).
 *
 * 저장을 막지 않는다 — 사유를 화면에 보이고 사람이 고른다(조항 G-15).
 */
export const lacksLimits = (row: MeasurementRow): boolean =>
  row.automaticJudgment && row.dataTypeCode === DATA_TYPES.numeric && !standsAutomatically(row);

/**
 * 자동 판정이 내는 값. **잴 값이 없으면 아무것도 내지 않는다** — 아직 재지 않은 항목에
 * 판정을 채우면 사람이 내리지 않은 판정이 저장된다.
 *
 * 규격을 벗어나면 불합격, 들면 합격이다. 벗어남 판정은 `isOutOfSpec` 하나를 쓴다 — 표시와
 * 판정이 서로 다른 자를 쓰면 화면이 「규격 밖」이라 말하면서 합격을 채우는 일이 생긴다.
 */
export const judgeAutomatically = (row: MeasurementRow): string | null => {
  if (!standsAutomatically(row)) return null;
  if (row.measured?.numericValue === null || row.measured?.numericValue === undefined) return null;

  return isOutOfSpec(row) ? ITEM_JUDGMENTS.rejected : ITEM_JUDGMENTS.accepted;
};
