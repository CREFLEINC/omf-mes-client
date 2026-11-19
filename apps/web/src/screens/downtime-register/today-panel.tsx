import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import {
  PuButton,
  PuChip,
  PuEmpty,
  PuNote,
  PuPager,
  PuSection,
  useClientPage,
  useFitTableRows,
} from '../../patterns/pop-uniform';
import { toClockLabel, toDurationLabel, toRangeLabel } from './formatting';
import { toLocalDay } from './queries';
import type { TodayRow } from './today-rows';

const t = messages.downtimeRegister;

/** 줄의 「비가동 시간」 칸 — 끝나지 않은 줄에는 길이 대신 「진행 중」(서버가 그 값을 내지 않는다). */
const durationCell = (row: TodayRow): ReactNode =>
  row.endedAt === null ? (
    <PuChip tone="info">{t.today.ongoingRow}</PuChip>
  ) : row.durationMinutes === null ? (
    ''
  ) : (
    toDurationLabel(row.durationMinutes)
  );

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
  /** 위쪽에 서는 진행 중 비가동 줄 · 막힘 안내(있으면). 서면 한 쪽 건수가 저절로 줄어든다. */
  lead?: ReactNode;
  /** 바뀌면 첫 쪽(가장 최근)을 보인다 — 새로 저장했을 때. */
  firstPageKey: number;
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
  lead,
  firstPageKey,
}: TodayPanelProps) => {
  const titleId = useId();
  const tableRef = useRef<HTMLDivElement>(null);
  /* 한 쪽 줄 수 = 구획 높이에 들어가는 만큼(#295 규칙 1) — 구획 안 스크롤 없음. */
  const fit = useFitTableRows(tableRef, { fallback: 3 });
  const paged = useClientPage(rows, fit);
  const { setPage } = paged;

  useEffect(() => {
    setPage(1);
  }, [firstPageKey, setPage]);

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
  const clock = toClockLabel(now.toISOString());
  const basisLabel = clock === null ? null : `${toLocalDay(now)} ${clock}`;

  /*
   * ⛔ 묻지 않았으면 건수를 말하지 않는다 — `0건` 은 「없었다」로 읽힌다.
   *    합계 자리가 이미 지키는 구분을 건수에도 그대로 적용한다.
   */
  const meta =
    isError || isPending || !isAsked ? undefined : (
      <span className="dt-today-meta">
        {t.today.summary(rows.length, totalLabel)}
        {basisLabel !== null && <span>{t.today.basis(basisLabel)}</span>}
      </span>
    );

  /*
   * ⭐ **범위를 말하는 자리는 하나다.** 끊겼으면 「내 단말 입력분만」이고, 붙어 있는데 아직 서버
   *    합계에 안 들어간 줄이 있으면 그 사실이다(#1149). 끊긴 상태에서 둘을 함께 말하지 않는다.
   */
  const scope = isLocalOnly ? (
    <PuNote tone="warn">
      <b>{t.today.localOnly}</b> {t.today.localOnlyDescription}
    </PuNote>
  ) : isAsked && unsettledCount > 0 ? (
    <PuNote tone="warn">
      <b>{t.today.unsettled(unsettledCount)}</b> {t.today.unsettledDescription}
    </PuNote>
  ) : null;

  const body = isError ? (
    /* ⛔ 실패했다고 구획을 걷지 않는다 — 자리는 그대로 두고 내용만 바꾼다(#1094). */
    <PuNote
      tone="bad"
      action={
        <PuButton size="sm" onClick={onRetry}>
          {t.today.retry}
        </PuButton>
      }
    >
      {t.today.loadFailed}
    </PuNote>
  ) : isPending ? null : rows.length === 0 ? (
    <PuEmpty icon="clock" title={isAsked ? t.today.empty : notAskedLabel} />
  ) : (
    <div ref={tableRef} className="dt-table pu-fit">
      <div className="pu-table-wrap">
        <table className="pu-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>{t.today.columns.interval}</th>
              <th style={{ width: '18%' }}>{t.today.columns.duration}</th>
              <th style={{ width: '20%' }}>{t.today.columns.reason}</th>
              <th>{t.today.columns.remarks}</th>
            </tr>
          </thead>
          <tbody>
            {paged.items.map((row) => (
              <tr key={row.key}>
                <td>{toRangeLabel(row.startedAt, row.endedAt)}</td>
                <td>{durationCell(row)}</td>
                <td title={row.reasonLabel}>{row.reasonLabel}</td>
                {/* 긴 메모는 한 줄로 줄여 보인다 — 구획 안 스크롤 없음. */}
                <td title={row.remarks ?? ''}>{row.remarks ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <PuSection title={t.today.title} labelId={titleId} meta={meta} split className="dt-today">
      <div className="dt-today-top">
        {lead}
        {scope}
        {body}
      </div>
      <PuPager
        total={rows.length === 0 ? 0 : paged.total}
        page={paged.page}
        pages={paged.pages}
        label={t.today.title}
        onPage={setPage}
      />
    </PuSection>
  );
};
