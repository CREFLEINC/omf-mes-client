import { messages } from '@omf-mes/i18n';

import type { ShipmentRow } from './types';

/**
 * 경과 — **적체를 보이는 것이 이 화면의 절반**이다(§5-7).
 *
 * ⭐ **기준은 `shippedAt`(실물 출하)이다** — 「물건이 나간 지 24시간」이 업무의 말이다. 미확정
 * 전표가 만들어진 시각을 기준으로 삼으면 **시스템 사정이 업무 시계를 대신하게 된다.**
 *
 * ⚠ 적체가 위험한 이유는 회계가 아니라 **마감된 기간을 연계가 거부**하기 때문이다. 회계 전기일은
 * ERP 소관이다.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** 24시간·3일 두 구간. 스펙 §3 요약 줄이 세는 축과 같은 값이어야 한다. */
const OVERDUE_MS = DAY;
const CRITICAL_MS = 3 * DAY;

export type ElapsedLevel = 'unknown' | 'fresh' | 'overdue' | 'critical';

export interface Elapsed {
  level: ElapsedLevel;
  /** 지난 밀리초. 셀 수 없으면 `null`. */
  ms: number | null;
}

/**
 * 지난 시간과 구간.
 *
 * ⚠ **셀 수 없는 것을 0으로 접지 않는다.** `shippedAt`이 없으면 `unknown`이고, 그때 화면은
 * 「방금 나갔다」가 아니라 **「셀 수 없다」**를 적는다.
 */
export const elapsedOf = (row: ShipmentRow, now: Date): Elapsed => {
  if (row.shippedAt === null) return { level: 'unknown', ms: null };

  const shipped = new Date(row.shippedAt).getTime();
  if (Number.isNaN(shipped)) return { level: 'unknown', ms: null };

  /* 시계가 뒤로 간 경우(시각이 미래) — 음수를 보이지 않고 0으로 둔다. */
  const ms = Math.max(0, now.getTime() - shipped);

  if (ms >= CRITICAL_MS) return { level: 'critical', ms };
  if (ms >= OVERDUE_MS) return { level: 'overdue', ms };

  return { level: 'fresh', ms };
};

/** 사람이 읽는 경과. 초 단위는 이 화면에서 뜻이 없다. */
export const formatElapsed = (elapsed: Elapsed): string => {
  const t = messages.shipmentConfirm;
  if (elapsed.ms === null) return t.list.elapsedUnknown;

  const days = Math.floor(elapsed.ms / DAY);
  const hours = Math.floor((elapsed.ms % DAY) / HOUR);

  return days === 0 ? t.elapsed.hours(hours) : t.elapsed.days(days, hours);
};

/*
 * ⛔ 자동 확정 «예정 시각»은 내지 않는다 — 「출하 자동 확정」 정책 코드가 계약의 값 목록에
 * 아직 없어 설정 시간을 읽을 수 없다(§4-C 「값 미정」). 24를 지어 넣으면 화면이 오지 않을
 * 약속을 한다. 물러난 수준은 문구가 적는다.
 */

/** 요약 줄의 세 수. 목록이 쪽 단위라 **이 쪽에 받은 것만** 센다는 사실은 화면이 적는다. */
export interface ElapsedSummary {
  total: number;
  overdue: number;
  critical: number;
}

export const summarize = (rows: readonly ShipmentRow[], now: Date): ElapsedSummary => {
  let overdue = 0;
  let critical = 0;

  for (const row of rows) {
    const level = elapsedOf(row, now).level;
    /* ⭐ 3일 경과는 24시간 경과에도 든다 — 「24h 이상」이 뜻이고 구간이 겹치지 않으면 합이 안 맞는다. */
    if (level === 'critical') {
      critical += 1;
      overdue += 1;
    } else if (level === 'overdue') {
      overdue += 1;
    }
  }

  return { total: rows.length, overdue, critical };
};
