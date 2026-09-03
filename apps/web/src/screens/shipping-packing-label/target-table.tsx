import { Button, Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import { formatIssuedAt, type IssueSummaryView, type TargetRow } from './types';

const t = messages.shippingPackingLabel.targets;

export interface TargetTableProps {
  rows: TargetRow[];
  summaries: IssueSummaryView[];
  selectedIds: readonly number[];
  onSelectionChange: (nextIds: number[]) => void;
  /** 이력 창을 여는 자리 — **서버가 아는 대상 식별자**를 넘긴다(줄 식별자가 아니다). */
  onOpenHistory: (issueTargetId: number) => void;
  empty: string;
}

const summaryOf = (
  summaries: readonly IssueSummaryView[],
  targetId: number,
): IssueSummaryView | null => summaries.find((one) => one.targetId === targetId) ?? null;

/**
 * ② 대상 목록 — **스펙 §3 의 네 칸이다: 대상 · 상태 · 최근 발행 · 회차.**
 *
 * ⛔ **발행할 수 없는 대상을 목록에서 빼지 않는다.** 스펙이 검사 대기 건을 「⛔ 발행 불가」로
 * 함께 그린다 — 빼 버리면 그 포장이 어디 갔는지 알 수 없고, 「검사를 기다리는 중」과
 * 「이 출하에 없다」가 같은 모양이 된다(공유계약 G-9). 대신 **고를 수 없게** 한다.
 *
 * ⚠ **디자인 시스템의 `Table` 은 줄 단위 비활성을 주지 않는다.** 그래서 고름이 바뀔 때
 * 발행 불가 대상을 걸러 낸다 — 체크 상자는 눌리지만 선택으로 남지 않고, 그 이유를 상태
 * 칸의 표식과 안내가 함께 말한다.
 *
 * 밀도를 `comfortable` 로 둔다. 장갑 낀 손으로 누르는 표라 `compact` 는 행이 서로 붙는다.
 *
 * ⛔ **정렬을 켜지 않는다.** 서버가 준 순서를 그대로 쓴다 — 화면이 정렬하면 보이는 만큼만
 * 정렬되고 사용자는 전체가 정렬된 것으로 읽는다.
 */
export const TargetTable = ({
  rows,
  summaries,
  selectedIds,
  onSelectionChange,
  onOpenHistory,
  empty,
}: TargetTableProps) => {
  const columns: Column<TargetRow>[] = [
    {
      key: 'target',
      header: t.columns.target,
      render: (row) => row.displayName,
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '160px',
      render: (row) =>
        row.isIssuable ? (
          <Chip status="success">{row.statusLabel}</Chip>
        ) : (
          // 두 가지를 함께 말한다 — 지금 무엇인가(검사 대기)와 그래서 무엇이 막혔는가.
          <span className="stacked-cell">
            <Chip status="warning">{row.statusLabel}</Chip>
            <span className="field-note">{t.status.blocked}</span>
          </span>
        ),
    },
    {
      key: 'lastIssued',
      header: t.columns.lastIssued,
      width: '150px',
      render: (row) => {
        const summary = summaryOf(summaries, row.issueTargetId);

        return summary === null || summary.lastIssuedAt === null
          ? t.neverIssued
          : formatIssuedAt(summary.lastIssuedAt);
      },
    },
    {
      key: 'seq',
      header: t.columns.seq,
      align: 'end',
      width: '140px',
      render: (row) => {
        const summary = summaryOf(summaries, row.issueTargetId);

        // 발행한 적이 없으면 이력을 열 것이 없다 — 빈 창을 여는 버튼을 두지 않는다.
        if (summary === null || summary.issueCount === 0) return t.neverIssued;

        return (
          <Button
            className={popTouchClass('normal')}
            variant="text"
            size="xl"
            onClick={() => {
              onOpenHistory(row.issueTargetId);
            }}
          >
            {String(summary.issueCount)}
          </Button>
        );
      },
    },
  ];

  return (
    <Table
      caption={t.caption}
      columns={columns}
      rows={rows}
      density="comfortable"
      selectable
      selectedIds={selectedIds.map(String)}
      onSelectionChange={(nextIds) => {
        /*
         * ⛔ **발행할 수 없는 대상은 선택으로 남기지 않는다.** 남겨 두면 발행 본문에 실려
         * 서버가 전건 실패로 막는다 — 「하나라도 실패하면 전건 실패」라 **고를 수 있었던
         * 대상까지 함께 못 나간다.**
         */
        const allowed = new Set(
          rows.filter((row) => row.isIssuable).map((row) => String(row.targetId)),
        );

        onSelectionChange(nextIds.filter((id) => allowed.has(id)).map(Number));
      }}
      empty={<p className="field-note pop-slabel-empty">{empty}</p>}
      getRowId={(row) => String(row.targetId)}
    />
  );
};
