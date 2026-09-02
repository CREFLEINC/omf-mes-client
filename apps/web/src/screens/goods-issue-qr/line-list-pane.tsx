import {
  Button,
  Card,
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
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
 *
 * ⭐ **표의 결은 먼저 선 POP 화면(`material-input-scan`)을 따른다** — 열을 가운데로 맞추고,
 * 상태는 고정폭 칩으로 두고, 비었을 때와 불러오는 중을 전용 부품으로 낸다. 현장 단말은 멀리서
 * 훑어보는 화면이라 화면마다 표의 결이 다르면 눈이 매번 다시 익혀야 한다.
 *
 * ⚠ **밀도만 다르다** — 이 화면의 스펙(§7)이 `compact` 를 지정했다.
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

/**
 * 발행 현황 → 칩의 시맨틱 색.
 *
 * ⚠ **「발행됨」을 경고색으로 칠한다.** 성공이 아니라 **주의**다 — 이미 라벨이 도는 대상을 또
 * 찍으면 현장에 같은 QR 이 여러 장 남는다(스펙 §6). 「모른다」도 같은 무게로 두지 않는다.
 */
const STATUS_TONE: Record<IssueStatus['kind'], ChipStatus> = {
  notIssued: 'info',
  issued: 'warning',
  unknown: 'idle',
};

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

  /*
   * **여섯 열을 모두 가운데로 맞춘다**(전례 `material-input-scan`). 열마다 정렬이 갈리면
   * 멀리서 훑는 눈이 좌우로 튄다 — 숫자를 오른쪽에 붙이는 관행은 자릿수를 견주는 표의 것이고,
   * 이 표는 줄 사이 크기 비교가 목적이 아니다.
   */
  const columns: Column<LineRow>[] = [
    {
      key: 'item',
      header: t.lines.columnItem,
      align: 'center',
      render: (row) => lookupDisplayLabel(itemNames, row.line.itemId),
    },
    {
      key: 'lot',
      header: t.lines.columnLot,
      align: 'center',
      render: (row) => lookupDisplayLabel(lotNames, row.line.lotId),
    },
    {
      key: 'qty',
      header: t.lines.columnQty,
      width: '112px',
      align: 'center',
      render: (row) =>
        `${row.line.issueQty.toLocaleString('ko-KR')} ${lookupDisplayLabel(uomNames, row.line.uomId)}`,
    },
    {
      /*
       * ⚠ **폭을 고정한다.** 이 칸의 문구는 「미발행」(3자)부터 「발행 현황 확인 불가」(10자)까지
       * 길이가 갈리는데, 폭을 안 주면 긴 문구가 들어온 순간 칸이 세로로 눌려 **품목·LOT 이 쓸
       * 폭까지 가져간다**(실측으로 네 줄로 접혔다).
       */
      key: 'status',
      header: t.lines.columnStatus,
      width: '132px',
      align: 'center',
      render: (row) => (
        <Chip variant="status" size="sm" status={STATUS_TONE[row.status.kind]}>
          {statusText(row.status)}
        </Chip>
      ),
    },
  ];

  return (
    <Card bordered className="pop-section" aria-label={t.lines.sectionLabel}>
      <Card.Body>
        <h2 className="pane-title">{t.lines.sectionLabel}</h2>

        {isLoading ? (
          <div role="status" aria-label={t.lines.loading}>
            <SkeletonText lines={3} />
          </div>
        ) : (
          <Table
            caption={t.lines.caption}
            density="compact"
            selectable
            getRowId={(row: LineRow) => rowId(row.line)}
            selectedIds={selectedIds}
            onSelectionChange={onSelectionChange}
            empty={
              isError ? (
                <EmptyState size="sm" live title={t.lines.failed} />
              ) : (
                <EmptyState size="sm" title={t.lines.empty} />
              )
            }
            rows={rows}
            columns={columns}
          />
        )}

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
