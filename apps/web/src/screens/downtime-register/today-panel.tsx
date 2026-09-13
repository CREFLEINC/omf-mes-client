import { Button, Card, Chip, Skeleton, Table, type Column } from '@crefle/web-ui';
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
  /**
   * 조회를 걸었는가. 설비가 정해지기 전에는 걸지 않으므로 건수도 목록도 «모른다» —
   * `isPending` 은 «꺼 둔» 조회에 대해 거짓이라 그것만으로는 두 상태가 구별되지 않는다.
   */
  isAsked: boolean;
  /** 조회를 걸지 «못한» 이유를 담은 문구(#1094). `isAsked` 가 참이면 쓰이지 않는다. */
  notAskedLabel: string;
  /**
   * 조회가 실패했는가(#1094).
   *
   * ⛔ **실패했다고 구획을 걷지 않는다.** 종전에는 화면이 이 패널을 통째로 배너로 갈아
   *    끼워 **제목과 집계 자리가 함께 사라졌다** — 화면의 구조가 서버 상태에 따라 바뀌어,
   *    작업자는 「오늘 이 설비」 칸이 어디 갔는지부터 찾는다. 자리는 그대로 두고 **내용만**
   *    무엇이 잘못됐는지로 바꾼다.
   */
  isError: boolean;
  /** 실패했을 때 다시 시도하는 길. */
  onRetry: () => void;
  /** 이 단말이 아는 것만 보이는 상태인가 — 범위를 이름으로 말해야 한다. */
  isLocalOnly: boolean;
  /**
   * 줄에는 섰는데 **서버 합계에는 아직 안 들어간** 건수(#1149).
   *
   * ⚠ 0 이면 건수와 합계가 같은 것을 센다. 0 이 아니면 **두 숫자의 모집단이 다르고**, 그
   *    사실을 화면이 말하지 않으면 작업자는 어느 쪽을 믿어야 하는지 알 수 없다 — 저장한
   *    구간이 「0분」으로 사라진 것처럼 읽힌다(88단계 3회차).
   */
  unsettledCount: number;
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
  isAsked,
  notAskedLabel,
  isError,
  onRetry,
  isLocalOnly,
  unsettledCount,
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

        {isError ? (
          <p className="downtime-today-summary">
            {t.today.loadFailed}{' '}
            <Button variant="text" size="md" onClick={onRetry}>
              {t.today.retry}
            </Button>
          </p>
        ) : isPending ? (
          <Skeleton height="72px" aria-label={t.today.title} />
        ) : (
          <>
            <p className="downtime-today-summary">
              {/*
               * ⛔ 묻지 않았으면 건수를 말하지 않는다 — `0건` 은 「없었다」로 읽힌다.
               *    합계 자리가 이미 지키는 구분을 건수에도 그대로 적용한다.
               */}
              {isAsked ? t.today.summary(rows.length, totalLabel) : notAskedLabel}
              {isAsked && basisLabel !== null && (
                <span className="downtime-today-basis">{t.today.basis(basisLabel)}</span>
              )}
            </p>

            {/*
             * ⭐ **범위를 말하는 자리는 하나다.** 끊겼으면 「내 단말 입력분만」이고, 붙어
             *    있는데 아직 서버 합계에 안 들어간 줄이 있으면 그 사실이다(#1149).
             *
             * ⛔ **끊긴 상태에서 둘을 함께 말하지 않는다** — 끊겨 있으면 목록 전체가 이 단말
             *    것이라 앞 문장이 이미 그 말을 하고 있다.
             */}
            {isLocalOnly ? (
              <p className="downtime-today-scope">
                <Chip variant="status" size="md" status="warning">
                  {t.today.localOnly}
                </Chip>
                <span>{t.today.localOnlyDescription}</span>
              </p>
            ) : (
              isAsked &&
              unsettledCount > 0 && (
                <p className="downtime-today-scope">
                  <Chip variant="status" size="md" status="warning">
                    {t.today.unsettled(unsettledCount)}
                  </Chip>
                  <span>{t.today.unsettledDescription}</span>
                </p>
              )
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
                empty={isAsked ? t.today.empty : notAskedLabel}
              />
            </div>
          </>
        )}
      </section>
    </Card>
  );
};
