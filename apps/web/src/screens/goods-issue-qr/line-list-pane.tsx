import { Button, Card, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { rowId, type IssueStatus, type LineRow } from './line-rows';

const t = messages.goodsIssueQr;

/**
 * 좌단 — **출고 라인 목록.** 이 화면에서 사람이 고르는 유일한 대상이다.
 *
 * ⛔ **「QR 발행」 체크박스를 두지 않는다**(스펙 §5-3 · REQ-OA-0010). 「전량 출고에도 예외 없이
 * 항상 발행」이 확정 사항이라, 켜고 끄는 컨트롤을 만드는 순간 그 확정이 무너진다. 선택은
 * 「무엇을 찍을까」이지 「찍을까 말까」가 아니다.
 *
 * ⚠ **페이지 이동 컨트롤이 없다.** 계약의 라인 조회에 페이지 축이 없어 전건이 한 번에 온다 —
 * 나눌 것이 없는 자리에 나누는 장치를 두지 않는다.
 */
export interface LineListPaneProps {
  rows: LineRow[];
  selectedIds: string[];
  onSelectionChange: (nextIds: string[]) => void;
  itemNames: LookupSource;
  lotNames: LookupSource;
  uomNames: LookupSource;
  isLoading: boolean;
  isError: boolean;
}

const statusText = (status: IssueStatus): string => {
  switch (status.kind) {
    case 'unknown':
      return t.lines.statusUnknown;
    case 'notIssued':
      return t.lines.statusNotIssued;
    case 'issued':
      return t.lines.statusIssued(status.count);
  }
};

export const LineListPane = ({
  rows,
  selectedIds,
  onSelectionChange,
  itemNames,
  lotNames,
  uomNames,
  isLoading,
  isError,
}: LineListPaneProps) => {
  const allIds = rows.map((row) => rowId(row.line));
  const isAllSelected = allIds.length > 0 && selectedIds.length === allIds.length;

  const emptyText = isError ? t.lines.failed : isLoading ? t.lines.loading : t.lines.empty;

  return (
    <Card bordered className="pop-section" aria-label={t.lines.sectionLabel}>
      <Card.Body>
        <h2 className="pane-title">{t.lines.sectionLabel}</h2>

        <Table
          caption={t.lines.caption}
          density="compact"
          selectable
          getRowId={(row: LineRow) => rowId(row.line)}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          empty={emptyText}
          rows={rows}
          columns={[
            {
              key: 'item',
              header: t.lines.columnItem,
              render: (row: LineRow) => lookupDisplayLabel(itemNames, row.line.itemId),
            },
            {
              key: 'lot',
              header: t.lines.columnLot,
              render: (row: LineRow) => lookupDisplayLabel(lotNames, row.line.lotId),
            },
            {
              key: 'qty',
              header: t.lines.columnQty,
              align: 'end',
              render: (row: LineRow) =>
                `${row.line.issueQty.toLocaleString('ko-KR')} ${lookupDisplayLabel(uomNames, row.line.uomId)}`,
            },
            {
              key: 'status',
              header: t.lines.columnStatus,
              render: (row: LineRow) => statusText(row.status),
            },
          ]}
        />

        {/*
         * 전체 선택은 표 위가 아니라 아래에 선다(스펙 §3 배치). 표 머리의 선택 열이 이미
         * 같은 일을 하지만, 장갑을 낀 손이 누르기에는 그 체크박스가 작다 — 큰 타겟을 따로 둔다.
         */}
        <Button
          variant="outlined"
          size="2xl"
          type="button"
          disabled={allIds.length === 0}
          onClick={() => {
            onSelectionChange(isAllSelected ? [] : allIds);
          }}
        >
          {isAllSelected ? t.lines.clearSelection : t.lines.selectAll}
        </Button>
      </Card.Body>
    </Card>
  );
};
