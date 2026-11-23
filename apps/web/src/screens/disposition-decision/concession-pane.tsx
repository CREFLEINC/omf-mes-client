import { Chip, EmptyState, Table, type Column } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { PaneEmptyIcon } from '../../patterns/pane-empty-icon';
import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { dispositionKeys } from './queries';
import { formatQty } from './types';

type Concession = components['schemas']['Concession'];

const t = messages.dispositionDecision.concession;
const STATUS_LABEL: Record<string, string> = t.status;

const concessionKey = (nonconformanceId: number) =>
  [...dispositionKeys.all, 'concessions', nonconformanceId] as const;

export interface ConcessionHistoryProps {
  nonconformanceId: number;
}

/**
 * W-03-10 의 「특채」 이력(omf-all-around#84 · 서버 선행 P-79).
 *
 * ⭐ 특채는 처분 판정에서 저장하면 결재 없이 바로 적용된다(omf-all-around#352) — 이 구획은 보기만 한다.
 * ⭐ 005 FR-038 · D-14 — 특채는 남은 수량 전부만. 자재 관리 LOT 이 여럿이면 서버가 LOT 마다 특채 행을 만든다.
 * ⛔ 사용 가능 수량 · 허용 조건은 기록일 뿐 출고 · 투입에서 막지 않는다(#84 범위 · #207 결정).
 */
/** 이 부적합의 특채 목록 — 구획과 탭 이름의 건수가 같은 조회를 쓴다(#223). */
export const useConcessions = (nonconformanceId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: concessionKey(nonconformanceId ?? 0),
    enabled: nonconformanceId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/concessions', {
          params: { query: { nonconformanceId: nonconformanceId as number } },
        }),
      ).then((response) => response.items),
  });
};

interface ConcessionGroup {
  first: Concession;
  rows: Concession[];
}

/**
 * 한 번에 저장한 특채 행들(자재 관리 LOT 마다 한 행)을 한 줄로 묶는다. 특채는 남은 수량 전부라 저장하면 부적합이
 * 종결된다 — 부적합마다 한 묶음뿐이다(#352).
 */
export const groupConcessions = (rows: readonly Concession[]): ConcessionGroup[] => {
  const groups = new Map<number, ConcessionGroup>();
  for (const row of rows) {
    const group = groups.get(row.nonconformanceId);
    if (group === undefined) groups.set(row.nonconformanceId, { first: row, rows: [row] });
    else group.rows.push(row);
  }
  return [...groups.values()];
};

/** 특채 이력 — 상세 아래 「특채 이력」 탭의 내용(#223). */
export const ConcessionHistory = ({ nonconformanceId }: ConcessionHistoryProps) => {
  const list = useConcessions(nonconformanceId);
  const groups = groupConcessions(list.data ?? []);

  const statusChip = (row: Concession) => (
    <Chip
      variant="status"
      size="sm"
      status={row.statusCode === 'APPROVED' || row.statusCode === 'APPLIED' ? 'success' : 'error'}
    >
      {STATUS_LABEL[row.statusCode] ?? row.statusCode}
    </Chip>
  );

  const columns: Column<ConcessionGroup>[] = [
    {
      key: 'concessionNo',
      align: 'center',
      header: t.columns.concessionNo,
      render: (group) => group.first.concessionNo,
    },
    {
      key: 'target',
      align: 'center',
      header: t.columns.target,
      render: (group) =>
        group.rows.length > 1
          ? t.targetGroup(group.rows.length)
          : (group.first.lotNo ?? String(group.first.lotId)),
    },
    {
      key: 'qty',
      align: 'center',
      header: t.columns.qty,
      render: (group) => formatQty(group.rows.reduce((sum, row) => sum + row.approvedQty, 0)),
    },
    {
      key: 'period',
      align: 'center',
      header: t.columns.period,
      render: (group) =>
        `${group.first.validFrom} ~ ${group.first.validTo ?? t.validToPlaceholder}`,
    },
    {
      key: 'status',
      align: 'center',
      header: t.columns.status,
      render: (group) => statusChip(group.first),
    },
  ];

  if (list.isError) return <p className="field-note">{t.loadFailed}</p>;

  return (
    <div className="disposition-concession" role="group" aria-label={t.historyHeading}>
      <div className="disposition-table disposition-decision-table">
        <Table
          caption={<span className="disposition-table-caption">{t.caption}</span>}
          density="compact"
          columns={columns}
          rows={groups}
          getRowId={(group) => String(group.first.concessionId)}
          /* 처분 이력과 같이 — 없으면 표 안에 한 줄(사용자 지시 · #223 · omf-all-around#275). */
          empty={
            list.isPending ? (
              <p className="field-note disposition-table-empty">{t.loading}</p>
            ) : (
              /* 다른 빈 목록과 같이 아이콘 + 문구(omf-all-around#275). */
              <EmptyState size="sm" icon={<PaneEmptyIcon name="assignment" />} title={t.none} />
            )
          }
        />
      </div>
    </div>
  );
};
