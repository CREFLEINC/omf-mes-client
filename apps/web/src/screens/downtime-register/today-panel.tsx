import { Card, Chip, Skeleton, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toClockLabel, toDurationLabel, toRangeLabel } from './formatting';
import type { TodayRow } from './today-rows';

const t = messages.downtimeRegister;

/*
 * ⚠ **열은 모두 가운데로 세운다**(사용자 결정 2026-09-07 · 다섯 POP 목록에 같은 처리). 열을
 *    양 끝에 붙여 두면 첫 열이 남는 폭을 다 가져가 값과 값 사이가 손바닥만큼 벌어진다.
 */
const TODAY_COLUMNS: Column<TodayRow>[] = [
  {
    key: 'interval',
    header: t.today.columns.interval,
    align: 'center',
    render: (row) => toRangeLabel(row.startedAt, row.endedAt),
  },
  {
    key: 'duration',
    header: t.today.columns.duration,
    align: 'center',
    width: '120px',
    /*
     * 끝나지 않은 줄에는 길이 대신 「진행 중」이 선다 — 서버가 그 값을 내지 않고(끝나지
     * 않았다), 화면이 지어내면 아직 늘고 있는 구간이 끝난 것처럼 보인다.
     */
    render: (row) =>
      row.endedAt === null
        ? t.today.ongoingRow
        : row.durationMinutes === null
          ? ''
          : toDurationLabel(row.durationMinutes),
  },
  {
    key: 'reason',
    header: t.today.columns.reason,
    align: 'center',
    render: (row) => row.reasonLabel,
  },
];

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
  /*
   * 합계를 못 받은 이유가 둘이다 — 끊겨서 아예 부르지 않았거나, 불렀는데 실패했거나.
   * **0으로 채우지 않는다**: 없는 값과 모르는 값을 같은 모양으로 그리면 오늘 비가동이 없었던
   * 것처럼 읽힌다.
   */
  const totalLabel =
    totalMinutes === null
      ? isLocalOnly
        ? t.today.localOnly
        : t.errors.summaryUnavailable
      : toDurationLabel(totalMinutes);
  const basisLabel = toClockLabel(now.toISOString());

  return (
    <Card bordered className="pop-section pop-fixed downtime-today">
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
                <Chip variant="status" size="md" status="warning">
                  {t.today.localOnly}
                </Chip>
                <span>{t.today.localOnlyDescription}</span>
              </p>
            )}

            {/*
             * ⭐ **목록은 `Table` 이다**(스펙 §7 DS 매핑 —「오늘 목록 | a | `Table`」). 줄을
             *    `<ul>` 로 직접 그리면 열 폭·줄무늬·빈 상태가 다른 POP 목록과 따로 놀고,
             *    같은 화면 안에서 열이 어긋나 보인다.
             *
             * ⚠ 스펙 §3 도면에는 열 이름 줄이 없다. DS `Table` 은 머리 줄을 끄지 못하므로
             *    그대로 서고, 그만큼(약 40px) ④ 의 몫을 더 쓴다 — 이 구획은 남는 높이를
             *    갖고 제 안에서 굴리므로 잘리지는 않는다(§3-1 예산은 요청서로 올렸다).
             */}
            <div className="downtime-today-list">
              <Table
                columns={TODAY_COLUMNS}
                rows={[...rows]}
                getRowId={(row) => row.key}
                density="compact"
                empty={t.today.empty}
              />
            </div>
          </>
        )}
      </section>
    </Card>
  );
};
