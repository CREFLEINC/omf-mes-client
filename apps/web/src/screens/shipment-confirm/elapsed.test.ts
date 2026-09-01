import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { elapsedOf, formatElapsed, summarize } from './elapsed';
import type { ShipmentRow } from './types';

const NOW = new Date('2026-09-01T12:00:00+09:00');

const row = (shippedAt: string | null, id = 1): ShipmentRow => ({
  shipmentId: id,
  shipmentNo: `SYNTH-SH-${String(id)}`,
  shippedAt,
  statusCode: 'CODE-A',
  erpDeliveryNo: null,
  totalQty: 100,
});

describe('elapsedOf', () => {
  it('막 나간 건은 fresh다', () => {
    expect(elapsedOf(row('2026-09-01T09:00:00+09:00'), NOW).level).toBe('fresh');
  });

  it('24시간을 넘기면 overdue다 — 경계는 포함이다', () => {
    expect(elapsedOf(row('2026-08-31T12:00:00+09:00'), NOW).level).toBe('overdue');
    expect(elapsedOf(row('2026-08-31T12:00:01+09:00'), NOW).level).toBe('fresh');
  });

  it('3일을 넘기면 critical이다', () => {
    expect(elapsedOf(row('2026-08-29T12:00:00+09:00'), NOW).level).toBe('critical');
  });

  /*
   * ⛔ **셀 수 없는 것을 0으로 접지 않는다.** 접으면 실물 출하 시각이 없는 건이 「방금 나갔다」로
   * 보여 **가장 오래 적체된 건이 화면에서 사라진다** — 이 화면이 존재하는 이유가 그 적체다.
   */
  it('⛔ 실물 출하 시각이 없으면 unknown이다 — 0시간 경과가 아니다', () => {
    expect(elapsedOf(row(null), NOW)).toEqual({ level: 'unknown', ms: null });
  });

  it('시각이 쓸 수 없는 값이어도 unknown이다', () => {
    expect(elapsedOf(row('어제'), NOW).level).toBe('unknown');
  });

  /* 시계가 어긋나 미래 시각이 와도 음수를 보이지 않는다. */
  it('미래 시각이면 0으로 둔다', () => {
    expect(elapsedOf(row('2026-09-02T12:00:00+09:00'), NOW).ms).toBe(0);
  });
});

describe('formatElapsed', () => {
  const t = messages.shipmentConfirm;

  it('하루가 안 되면 시간만 말한다', () => {
    expect(formatElapsed(elapsedOf(row('2026-09-01T09:00:00+09:00'), NOW))).toBe(
      t.elapsed.hours(3),
    );
  });

  it('하루가 넘으면 일과 시간을 함께 말한다', () => {
    expect(formatElapsed(elapsedOf(row('2026-08-30T07:00:00+09:00'), NOW))).toBe(
      t.elapsed.days(2, 5),
    );
  });

  it('셀 수 없으면 그 사실을 낸다', () => {
    expect(formatElapsed(elapsedOf(row(null), NOW))).toBe(t.list.elapsedUnknown);
  });
});

describe('summarize', () => {
  /*
   * ⭐ **3일 경과는 24시간 경과에도 든다.** 「24h 이상」이 뜻이고, 구간을 배타로 세면
   * 「24h 4건 · 3일 2건」이 실제로는 6건인지 4건인지 읽는 사람이 알 수 없다.
   */
  it('⭐ 3일 경과 건은 24시간 경과에도 든다 — 구간이 겹친다', () => {
    const summary = summarize(
      [
        row('2026-08-25T12:00:00+09:00', 1),
        row('2026-08-31T00:00:00+09:00', 2),
        row('2026-09-01T09:00:00+09:00', 3),
      ],
      NOW,
    );

    expect(summary).toEqual({ total: 3, overdue: 2, critical: 1 });
  });

  it('셀 수 없는 건은 어느 구간에도 넣지 않는다', () => {
    expect(summarize([row(null, 1)], NOW)).toEqual({ total: 1, overdue: 0, critical: 0 });
  });

  it('빈 목록도 센다', () => {
    expect(summarize([], NOW)).toEqual({ total: 0, overdue: 0, critical: 0 });
  });
});
