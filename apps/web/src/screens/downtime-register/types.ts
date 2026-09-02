import type { components } from '@omf-mes/api-client';

/**
 * P-05-02 화면 슬라이스의 계약.
 *
 * `api-client`는 `import type`으로만 참조한다 — 런타임 코드를 끌어오지 않아야 화면의 순수성이
 * 유지된다. 이 파일은 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 *
 * ⛔ **「진행 중」을 상태 값으로 만들지 않는다**(스펙 §5-3 · 계약 설명). 끝 시각이 비어 있는
 * 것이 곧 진행 중이고, 별도 깃발을 두면 두 값이 어긋날 자리가 생긴다 — 상태=종료인데 종료
 * 시각이 없는 줄을 아무도 설명하지 못한다.
 *
 * ⛔ **길이를 화면이 저장하지 않는다.** `durationMinutes`는 서버가 낸 파생값이고(공유계약 L-2),
 * 진행 중이면 값이 없다. 화면이 그 자리를 계산해 채우면 서버와 다른 숫자가 두 곳에 남는다.
 */

type DowntimeResponse = components['schemas']['Downtime'];
type BreakdownResponse = components['schemas']['Breakdown'];

/** 화면이 다루는 비가동 한 건. */
export interface DowntimeView {
  downtimeId: number;
  equipmentId: number;
  reasonCode: string;
  /** 서버가 풀어 준 사유 이름. 없으면 코드를 그대로 보인다. */
  reasonName: string | null;
  startedAt: string;
  /** **비어 있으면 진행 중이다.** */
  endedAt: string | null;
  /** 끝난 구간에만 값이 있다 — 서버 파생. */
  durationMinutes: number | null;
  breakdownId: number | null;
  remarks: string | null;
}

/**
 * 진행 중인가 — **끝 시각의 부재로만 판정한다.**
 *
 * 이 함수가 이 슬라이스에서 「진행 중」을 말하는 유일한 자리다. 곳곳에서 `endedAt == null`을
 * 다시 쓰면 한 곳이 `undefined`를 빠뜨렸을 때 같은 줄이 화면마다 다르게 읽힌다.
 */
export const isOngoing = (downtime: Pick<DowntimeView, 'endedAt'>): boolean =>
  downtime.endedAt === null;

/** 응답 한 건을 화면 타입으로 옮기는 **유일한 지점**이다. */
export const toDowntimeView = (downtime: DowntimeResponse): DowntimeView => ({
  downtimeId: downtime.downtimeId,
  equipmentId: downtime.equipmentId,
  reasonCode: downtime.reasonCode,
  reasonName: downtime.reasonName ?? null,
  startedAt: downtime.startedAt,
  /*
   * 계약이 `null`을 명시하지만 응답에서 칸 자체가 빠져 올 수도 있다 — 두 모양 다 「끝나지
   * 않았다」이므로 여기서 하나로 접는다. 접지 않으면 `undefined`가 진행 중 판정을 지나친다.
   */
  endedAt: downtime.endedAt ?? null,
  durationMinutes: downtime.durationMinutes ?? null,
  breakdownId: downtime.breakdownId ?? null,
  remarks: downtime.remarks ?? null,
});

/** 화면이 다루는 열린 고장 한 건 — 연결 후보다. */
export interface BreakdownView {
  breakdownId: number;
  breakdownNo: string | null;
  symptom: string;
  /** 모르면 비어 있다. 있으면 시작 시각의 **제안값**이 된다(스펙 §5-4). */
  stoppedAt: string | null;
}

export const toBreakdownView = (breakdown: BreakdownResponse): BreakdownView => ({
  breakdownId: breakdown.breakdownId,
  breakdownNo: breakdown.breakdownNo ?? null,
  symptom: breakdown.symptom,
  stoppedAt: breakdown.stoppedAt ?? null,
});
