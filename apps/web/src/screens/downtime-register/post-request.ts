import type { components } from '@omf-mes/api-client';

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
 * | `startedAt` | 시작 칸 | **단말 시각을 그대로** 넣는다 |
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

/** 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다. */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * 계약이 요구하는 offset 있는 시각 문자열.
 *
 * ⛔ **offset 없이 보내지 않는다** — 같은 글자가 지역마다 다른 순간을 가리킨다. 현장 단말은
 * 공장 시간대에 있고 서버는 다를 수 있는데, 이 화면에서 그 어긋남은 **구간의 길이**를 바꾼다.
 */
export const toOffsetDateTime = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}T` +
  `${pad(at.getHours(), 2)}:${pad(at.getMinutes(), 2)}:${pad(at.getSeconds(), 2)}` +
  offsetText(at);

export interface DowntimeDraft {
  interval: IntervalDraft;
  /** 사유 소분류 코드. **이것만 보낸다** — 대분류는 화면이 좁히는 장치다. */
  reasonCode: string | null;
  /** 연결한 고장. 선택이며 비우면 연결하지 않는다. */
  breakdownId: number | null;
  remarks: string;
}

export const EMPTY_REMARKS = '';

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
