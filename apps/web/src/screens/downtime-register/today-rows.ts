import type { components } from '@omf-mes/api-client';

import { toDowntimeView, type DowntimeView } from './types';

/**
 * ④에 서는 줄. **서버가 준 것과 이 단말이 아직 못 보낸 것을 같은 모양으로** 세운다.
 *
 * ⚠ 두 출처를 한 목록에 섞는 것은 오프라인에서 **이 단말이 넣은 것이라도 보여야** 하기
 * 때문이다. 다만 그 목록이 「오늘 이 설비의 전부」가 아니라는 사실은 화면이 따로 적는다
 * (「내 단말 입력분만」) — 범위를 말하지 않고 줄만 보이면 그것이 전부로 읽힌다.
 */

type DowntimeCreate = components['schemas']['DowntimeCreate'];
type Downtime = components['schemas']['Downtime'];

export interface TodayRow {
  /** 목록의 안정된 이름. 서버 번호가 있으면 그것, 없으면 멱등키다. */
  key: string;
  startedAt: string;
  endedAt: string | null;
  /** 서버가 낸 길이. 아직 안 나갔으면 `null`이고, 그때는 화면이 구간에서 잰다. */
  durationMinutes: number | null;
  reasonLabel: string;
}

/**
 * ⛔ **코드를 이름으로 바꾸는 표를 화면이 갖지 않는다.** 이름은 서버가 준다(계약 `reasonName`).
 * 고객이 늘리는 목록이라(`G-31`) 화면이 표를 들면 늘어난 값만 이름이 없다 — 서버가 비웠으면
 * 코드를 그대로 보인다.
 */
/**
 * 코드 → 이름. **받아 온 목록에서 찾는다.**
 *
 * 아직 서버에 닿지 않은 줄(오프라인 큐)에는 서버가 붙여 줄 이름이 없다. 그렇다고 코드를
 * 그대로 보이면 방금 적은 사유가 `MOLD_CHANGE` 로 서서 다른 줄과 다르게 읽힌다 — 조금 전
 * 자기가 고른 «그 이름»이 목록에 있으므로 거기서 찾는다.
 */
export type ReasonNames = ReadonlyMap<string, string>;

const toReasonLabel = (
  reasonCode: string,
  serverName: string | null,
  names: ReasonNames,
): string => serverName ?? names.get(reasonCode) ?? reasonCode;

export const fromDowntimeView = (downtime: DowntimeView, names: ReasonNames): TodayRow => ({
  key: `downtime:${String(downtime.downtimeId)}`,
  startedAt: downtime.startedAt,
  endedAt: downtime.endedAt,
  durationMinutes: downtime.durationMinutes,
  reasonLabel: toReasonLabel(downtime.reasonCode, downtime.reasonName, names),
});

export const fromAccepted = (downtime: Downtime, names: ReasonNames): TodayRow =>
  fromDowntimeView(toDowntimeView(downtime), names);

export const fromPending = (
  idempotencyKey: string,
  body: DowntimeCreate,
  names: ReasonNames,
): TodayRow => ({
  key: `pending:${idempotencyKey}`,
  startedAt: body.startedAt,
  endedAt: body.endedAt ?? null,
  /*
   * 아직 서버가 이 건을 보지 못했으므로 길이도 없다. 화면이 지어내지 않고 `null`로 둔다 —
   * 표시할 때 구간에서 재는 것과, 저장된 값으로 말하는 것은 다른 사실이다.
   */
  durationMinutes: null,
  reasonLabel: toReasonLabel(body.reasonCode, null, names),
});

/** 같은 날에 시작한 것만. 날짜 글자는 지역 시각 기준(`yyyy-mm-dd`)이다. */
export const startedOn = (row: TodayRow, day: string): boolean => {
  const at = new Date(row.startedAt);
  if (Number.isNaN(at.getTime())) return false;

  const month = String(at.getMonth() + 1).padStart(2, '0');
  const date = String(at.getDate()).padStart(2, '0');

  return `${String(at.getFullYear())}-${month}-${date}` === day;
};

/** 시작이 늦은 것이 위로 — 방금 넣은 것이 눈에 먼저 든다. */
export const byStartedAtDesc = (left: TodayRow, right: TodayRow): number =>
  right.startedAt.localeCompare(left.startedAt);
