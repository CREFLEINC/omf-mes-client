import {
  AlertBanner,
  Button,
  type Column,
  EmptyState,
  type SortState as TableSortState,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { ROW_PICK_CLASS, rowPickHandlers } from '../../patterns/row-pick';
import { splitCodeName } from '../../patterns/split-code-name';

import type { PeriodInput } from './period';
import { RateCell } from './rate-cell';
import type { WorkOrderRow } from './row-view';
import { isSortKeyAllowed, type SortKey, type SortState } from './sort';
import { DelayChip, StatusChip } from './status-chips';

export interface WorkOrderTableProps {
  rows: WorkOrderRow[];
  sort: SortState;
  /** 지금 걸린 기간 — 어느 열로 정렬할 수 있는지가 여기에 걸린다. */
  period: PeriodInput;
  isLoading: boolean;
  isError: boolean;
  /** 식별자를 사람이 읽는 이름으로. 이름표를 만드는 일은 화면이 맡는다. */
  itemLabel: (itemIdText: string) => string;
  /** 라인 번호를 「코드 · 이름」으로. 못 찾으면 「이름 확인 중」 — 숫자 번호를 보이지 않는다. */
  lineLabel: (lineIdText: string) => string;
  /**
   * 상태 코드를 마스터의 표시명으로.
   *
   * ⚠ 품목과 달리 **못 찾으면 코드를 그대로 둔다** — 상태 코드는 그 자체가 사람이 읽을 수
   * 있는 말이라, 감추면 오히려 정보가 준다. 그 판단은 이름표가 갖는다.
   */
  statusLabel: (statusCode: string) => string;
  onSort: (key: SortKey) => void;
  onSelect: (workOrderId: number) => void;
  /** 상세를 연 작업지시 — 그 줄을 파랗게 칠한다(#360). */
  selectedWorkOrderId?: number | null;
}

/** DS 의 정렬 표기와 이 화면의 표기를 잇는다 — 방향 낱말이 서로 다르다. */
const toTableSort = (sort: SortState): TableSortState => ({
  key: sort.key,
  direction: sort.direction === 'desc' ? 'descending' : 'ascending',
});

/** 수량 한 칸 — 0 은 흐리게 적어 값이 있는 칸이 먼저 보이게 한다. */
const qtyCell = (text: string) =>
  text === '0' ? <span className="work-order-progress-zero">{text}</span> : text;

/**
 * 진행현황 목록.
 *
 * ⛔ **전부 읽기 전용이다.** 이 화면에는 저장 액션이 없다 — 줄을 누르는 것은 상세를 여는
 * 일이지 고치는 일이 아니다.
 *
 * ⛔ **정렬을 서버에 맡긴다.** 화면이 이 페이지만 다시 늘어놓으면 **서버 전체를 정렬한 것처럼
 * 보이면서 결과가 틀린다** — 50건 안에서의 1등이 128건의 1등은 아니다. 그래서 표의 내부
 * 정렬을 끄고(`sort` 를 제어 값으로 준다) 누름을 밖으로 넘긴다.
 *
 * ⛔ **정렬할 수 없는 열은 머리를 누를 수 없게 둔다.** 눌러도 안 되는 머리를 두면 사용자가
 * 고장으로 읽는다 — 기간이 넓을 때의 달성률이 그렇다(L-4).
 *
 * **보류 · 스크랩 · 재작업 열은 이 쪽에 값이 있을 때만 연다.** 실적이 없는 지시는 0 이 다섯 번 되풀이돼
 * 표가 읽히지 않는다. 양품 · 불량은 늘 두고, 0 은 흐리게 적어 값이 있는 칸이 먼저 보이게 한다.
 * 상세 창의 작업자별 실적과 같은 규칙이다.
 */
export const WorkOrderTable = ({
  rows,
  sort,
  period,
  isLoading,
  isError,
  itemLabel,
  lineLabel,
  statusLabel,
  onSort,
  onSelect,
  selectedWorkOrderId = null,
}: WorkOrderTableProps) => {
  const t = messages.workOrderProgress.list;

  const sortable = (key: SortKey): boolean => isSortKeyAllowed(key, period);

  const columns: Column<WorkOrderRow>[] = [
    {
      key: 'workOrderNo',
      header: t.columns.workOrderNo,
      sortable: sortable('workOrderNo'),
      /*
       * ⛔ **칸에는 번호만 보인다.** 「SYN-WO-0007 상세 열기」를 눈에 보이는 글자로 쓰면
       * 번호 열이 문장 열이 되어, 번호끼리 견주며 훑는 일이 안 된다. 무엇을 여는지는
       * **화면 읽기 도구에만** 들려주면 된다.
       */
      render: (row) => (
        <Button
          aria-label={t.select(row.workOrderNo)}
          aria-current={row.workOrderId === selectedWorkOrderId ? 'true' : undefined}
          className={ROW_PICK_CLASS}
          variant="text"
          onClick={() => {
            onSelect(row.workOrderId);
          }}
        >
          {row.workOrderNo}
        </Button>
      ),
    },
    /*
     * 라인 — W/O 번호 바로 뒤(사용자 지시 2026-11-28). 응답은 라인 번호만 주어 조회 조건의 라인 이름표로 이름을 푼다.
     * 칸에는 이름만 적는다. 라인이 정해지지 않은 지시는 「—」다.
     */
    {
      key: 'productionLine',
      header: t.columns.productionLine,
      render: (row) => {
        if (row.productionLineIdText === null) return t.blank;

        const { code, name } = splitCodeName(lineLabel(row.productionLineIdText), '');
        return name === '' ? code : name;
      },
    },
    /* 품목코드 · 품목명은 두 열(사용자 지시 2026-11-24). */
    {
      key: 'itemId',
      header: t.columns.itemCode,
      render: (row) => splitCodeName(itemLabel(row.itemIdText), t.blank).code,
    },
    {
      key: 'itemName',
      header: t.columns.itemName,
      render: (row) => splitCodeName(itemLabel(row.itemIdText), t.blank).name,
    },
    { key: 'process', header: t.columns.process, render: (row) => row.processText },
    {
      key: 'orderQty',
      header: t.columns.orderQty,
      align: 'end',
      render: (row) => row.orderQtyText,
    },
    {
      key: 'goodQty',
      header: t.columns.goodQty,
      align: 'end',
      render: (row) => qtyCell(row.goodQtyText),
    },
    {
      key: 'defectQty',
      header: t.columns.defectQty,
      align: 'end',
      render: (row) => qtyCell(row.defectQtyText),
    },
    ...(rows.some((row) => row.hasHoldQty)
      ? [
          {
            key: 'holdQty',
            header: t.columns.holdQty,
            align: 'end',
            render: (row) => qtyCell(row.holdQtyText),
          } satisfies Column<WorkOrderRow>,
        ]
      : []),
    ...(rows.some((row) => row.hasScrapQty)
      ? [
          {
            key: 'scrapQty',
            header: t.columns.scrapQty,
            align: 'end',
            render: (row) => qtyCell(row.scrapQtyText),
          } satisfies Column<WorkOrderRow>,
        ]
      : []),
    ...(rows.some((row) => row.hasReworkQty)
      ? [
          {
            key: 'reworkQty',
            header: t.columns.reworkQty,
            align: 'end',
            render: (row) => qtyCell(row.reworkQtyText),
          } satisfies Column<WorkOrderRow>,
        ]
      : []),
    {
      key: 'achievementRate',
      header: t.columns.achievementRate,
      sortable: sortable('achievementRate'),
      render: (row) => (
        <RateCell
          label={t.columns.achievementRate}
          percent={row.achievementPercent}
          text={row.achievementRateText}
        />
      ),
    },
    {
      key: 'statusCode',
      header: t.columns.statusCode,
      align: 'center',
      sortable: sortable('statusCode'),
      render: (row) => (
        <StatusChip label={statusLabel(row.statusCode)} statusCode={row.statusCode} />
      ),
    },
    {
      key: 'plannedEndAt',
      header: t.columns.plannedEndAt,
      /* 넘긴 계획 종료는 지연 칩과 같은 색으로 — 어느 날짜를 넘겼는지가 바로 보인다. */
      render: (row) =>
        row.delay === 'delayed' ? (
          <span className="work-order-progress-late">{row.plannedEndAtText}</span>
        ) : (
          row.plannedEndAtText
        ),
    },
    {
      key: 'delay',
      header: t.columns.delay,
      align: 'center',
      render: (row) => <DelayChip delay={row.delay} />,
    },
  ];

  if (isError) {
    return (
      <section className="pane work-order-progress-pane" aria-label={t.title}>
        <div className="banner-slot">
          <AlertBanner variant="error">{t.loadError}</AlertBanner>
        </div>
      </section>
    );
  }

  return (
    <section className="pane work-order-progress-pane" aria-label={t.title}>
      {/* 구획 제목 「목록」은 두지 않는다 — 표 하나뿐인 구획이라 제목이 보태는 것이 없다. 이름은 접근 이름으로만. */}
      {isLoading && <p role="status">{t.loading}</p>}

      <div className="work-order-progress-table" {...rowPickHandlers}>
        <Table
          density="compact"
          caption={t.title}
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.workOrderId)}
          sort={toTableSort(sort)}
          onSortChange={(next) => {
            if (next !== null) onSort(next.key as SortKey);
          }}
          empty={<EmptyState title={t.empty} />}
        />
      </div>
    </section>
  );
};
