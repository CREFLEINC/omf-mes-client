import { Card, Chip, EmptyState, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toClockLabel, toDurationLabel, toRangeLabel } from './formatting';
import type { TodayRow } from './today-rows';

const t = messages.downtimeRegister;

export interface TodayPanelProps {
  rows: readonly TodayRow[];
  /** 서버가 낸 합계(분). 오프라인이거나 못 받았으면 `null`이다. */
  totalMinutes: number | null;
  isPending: boolean;
  /** 이 단말이 아는 것만 보이는 상태인가 — 범위를 이름으로 말해야 한다. */
  isLocalOnly: boolean;
  now: Date;
}

/**
 * ④ 오늘 이 설비.
 *
 * ⭐ **오프라인에서는 범위를 이름으로 말한다**(스펙 §6-2 · §9-3). 여러 단말과 관리웹이 함께
 * 채우는 합계라, 이 단말이 아는 것만으로 다시 계산해 그리면 **틀린 숫자가 맞는 것처럼** 보인다.
 * 그래서 합계 자리를 비우지 않고 「내 단말 입력분만」이라고 적는다 — 모르는 값과 없는 값은
 * 다르게 그린다.
 *
 * ⛔ **화면이 합계를 더하지 않는다.** 겹친 구간을 한 번만 세는 규칙이 서버에 있고, 단순히
 * 더하면 겹친 만큼 부풀어 오른다.
 */
export const TodayPanel = ({
  rows,
  totalMinutes,
  isPending,
  isLocalOnly,
  now,
}: TodayPanelProps) => {
  const totalLabel = totalMinutes === null ? t.today.localOnly : toDurationLabel(totalMinutes);
  const basisLabel = toClockLabel(now.toISOString());

  return (
    <Card>
      <section className="downtime-section" aria-label={t.today.title}>
        <h2 className="pane-title">{t.today.title}</h2>

        {isPending ? (
          <Skeleton height="72px" aria-label={t.today.title} />
        ) : (
          <>
            <p className="downtime-today-summary">
              {t.today.summary(rows.length, totalLabel)}
              {basisLabel !== null && (
                <span className="downtime-today-basis">{t.today.basis(basisLabel)}</span>
              )}
            </p>

            {isLocalOnly && (
              <p className="downtime-today-scope">
                <Chip variant="status" size="sm" status="warning">
                  {t.today.localOnly}
                </Chip>
                <span>{t.today.localOnlyDescription}</span>
              </p>
            )}

            {rows.length === 0 ? (
              <EmptyState size="sm" title={t.today.empty} />
            ) : (
              <ul className="downtime-today-list">
                {rows.map((row) => (
                  <li key={row.key} className="downtime-today-row">
                    <span>{toRangeLabel(row.startedAt, row.endedAt)}</span>
                    {/*
                     * 끝나지 않은 줄에는 길이 대신 「진행 중」이 선다 — 서버가 그 값을 내지
                     * 않고(끝나지 않았다), 화면이 지어내면 아직 늘고 있는 구간이 끝난 것처럼
                     * 보인다.
                     */}
                    <span>
                      {row.endedAt === null
                        ? t.today.ongoingRow
                        : row.durationMinutes === null
                          ? ''
                          : toDurationLabel(row.durationMinutes)}
                    </span>
                    <span>{row.reasonLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </Card>
  );
};
