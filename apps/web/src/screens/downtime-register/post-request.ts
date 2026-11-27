import type { components } from '@omf-mes/api-client';

import { PLANT_UTC_OFFSET, toPlantDateTimeParts } from '../../patterns/plant-time';

import { readInterval, type IntervalDraft } from './interval';

/**
 * 비가동 등록 본문을 만드는 **유일한 자리**.
 *
 * 계약이 필수로 두는 것은 셋이고 전부 화면이 가진 값이다.
 *
 * | 자리 | 어디서 | 근거 |
 * | --- | --- | --- |
 * | `equipmentId` | 주소 | 비가동은 **설비에 붙는다** |
 * | `reasonCode` | 사유 소분류 | 임시 목록에서 고른 값 |
 * | `startedAt` | 시작 칸 | **공장 시각**(+07:00)으로 넣는다 — 칸의 글자가 공장 시각이다(omf-all-around#364) |
 *
 * ⛔ **작업지시(W/O)를 붙이지 않는다.** 비가동은 설비에 붙지 작업에 붙지 않고, 계약의 쓰기
 * 본문에도 그 칸이 없다. 금형 교체·자재 대기는 작업지시 «사이»에 생긴다.
 *
 * ⛔ **「진행 중」 깃발을 보내지 않는다.** 끝 시각을 빼는 것이 곧 진행 중이다 — 깃발을 만들면
 * 계약에 없는 값을 지어내는 것이고, 끝 시각과 어긋날 자리가 생긴다.
 *
 * ⛔ **입력자·기록 시각을 본문에 싣지 않는다.** 귀속 사번은 헤더로 가고, 기록 시각은 서버가
 * 받은 순간이다 — 같은 것을 두 경로가 말하면 어긋날 자리만 생긴다.
 */

type DowntimeCreate = components['schemas']['DowntimeCreate'];

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 계약이 요구하는 offset 있는 시각 문자열.
 *
 * ⛔ **offset 없이 보내지 않는다** — 같은 글자가 지역마다 다른 순간을 가리킨다.
 *
 * **공장 시각과 공장 offset(`PLANT_UTC_OFFSET`)으로 적는다**(omf-all-around#364). 브라우저 시간대로
 * 적으면 한국 PC 에서 칸에 본 시각과 다른 글자(+09:00)가 나간다. 공장 단말은 결과가 같다.
 */
export const toOffsetDateTime = (at: Date): string => {
  const parts = toPlantDateTimeParts(at.toISOString());
  const date = parts?.date ?? at.toISOString().slice(0, 10);
  const time = parts?.time ?? at.toISOString().slice(11, 16);

  return `${date}T${time}:${pad(at.getUTCSeconds(), 2)}${PLANT_UTC_OFFSET}`;
};

export interface DowntimeDraft {
  interval: IntervalDraft;
  /** 사유 코드. **평면 1단이라 이것 하나뿐이다**(스펙 §7 확정 2026-09-03). */
  reasonCode: string | null;
  /** 연결한 고장. 선택이며 비우면 연결하지 않는다. */
  breakdownId: number | null;
  remarks: string;
}

export const EMPTY_REMARKS = '';

/**
 * 아직 아무것도 적지 않았다 — **「다시 입력」을 잠글 기준이다.**
 *
 * ⛔ 비울 것이 없는데 누를 수 있으면, 눌러도 아무 일이 없어 **버튼이 고장 난 것처럼 보인다.**
 * 선례 `P-02-04` 도 그 자리의 활성 조건을 「입력 있음」으로 정했다(§5-2).
 *
 * ⚠ 「아직 진행 중」 체크도 «적은 것»으로 센다 — 되돌릴 것이 생겼다는 뜻이다.
 */
export const isDraftEmpty = (draft: DowntimeDraft): boolean =>
  draft.reasonCode === null &&
  draft.breakdownId === null &&
  draft.remarks === EMPTY_REMARKS &&
  !draft.interval.stillOngoing &&
  draft.interval.startedAt.date === '' &&
  draft.interval.startedAt.time === '' &&
  draft.interval.endedAt.date === '' &&
  draft.interval.endedAt.time === '';

/**
 * 등록 본문. **갖춰지지 않았으면 만들지 않는다**(`null`).
 *
 * ⚠ 부르는 쪽이 이미 검사를 마쳤더라도 여기서 다시 확인한다 — 그 끝에 있는 것은 되돌릴 수
 * 없는 기록이고, 검사와 보내기 사이에 값이 바뀔 수 있다.
 */
export const toDowntimeCreate = (
  equipmentId: number | null,
  draft: DowntimeDraft,
): DowntimeCreate | null => {
  if (equipmentId === null || draft.reasonCode === null || draft.reasonCode === '') return null;

  const { started, ended } = readInterval(draft.interval);
  if (started === null) return null;

  /* 끝이 시작보다 앞선 값은 만들지 않는다 — 저장 측 제약에 걸려 통째로 실패한다. */
  if (ended !== null && ended.getTime() < started.getTime()) return null;

  const remarks = draft.remarks.trim();

  return {
    equipmentId,
    reasonCode: draft.reasonCode,
    startedAt: toOffsetDateTime(started),
    /*
     * 끝은 **있으면 붙이고 없으면 뺀다.** 계약이 「비워 두면 진행 중으로 남는다」로 정했으므로
     * `null`을 명시적으로 실을 이유가 없다 — 빈 자리와 지어낸 값은 다른 뜻이다.
     */
    ...(ended === null ? {} : { endedAt: toOffsetDateTime(ended) }),
    ...(draft.breakdownId === null ? {} : { breakdownId: draft.breakdownId }),
    ...(remarks === '' ? {} : { remarks }),
  };
};
