import {
  AlertBanner,
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  type SortState,
  Table,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { PAGE_SIZE, useItemInspectionLevelHistories } from './queries';

type ItemInspectionLevelHistory = components['schemas']['ItemInspectionLevelHistory'];

const t = messages.inspectionLevel;

export const levelName = (code: string | null): string =>
  code === null ? '' : (t.levels[code] ?? code);

/** 검사 수준을 글자 + 색으로 가른다(#208) — 무검사는 흐리게, 수월은 초록, 보통은 파랑, 엄격은 주의색. */
const LEVEL_TONE: Record<string, ChipStatus> = {
  NONE: 'idle',
  REDUCED: 'success',
  NORMAL: 'info',
  TIGHTENED: 'warning',
};

export const LevelChip = ({ code }: { code: string | null }) =>
  code === null ? null : (
    <Chip variant="status" size="sm" status={LEVEL_TONE[code] ?? 'idle'}>
      {levelName(code)}
    </Chip>
  );

/** 이력의 사유 칸 — 자동은 연속 합격 수나 불합격 의뢰, 수동은 입력한 사유. */
const EMPTY_REASON = '—';

export const historyReason = (row: ItemInspectionLevelHistory): string => {
  if (row.changeTypeCode === 'AUTO') {
    if (row.consecutiveAcceptCount !== null)
      return t.history.acceptStreak(row.consecutiveAcceptCount);
    return t.history.rejected(row.inspectionRequestNo ?? '');
  }
  return row.reason ?? EMPTY_REASON;
};

/*
 * 품목 이력 표의 열 — 변경 일시 · 변경 전 · 변경 후 · 변경자(사용자 지시 · omf-all-around#357) · 변경 사유.
 * 사유는 「기본 정보 수정」 창에서 받는 값이고, 자동 전환의 근거(연속 합격 · 불합격 의뢰)도 여기에 보여 남긴다.
 * 품목은 창 머리가 말하므로 열에서 뺀다. 변경 사유 외에는 가운데 정렬, 사유는 글이 있으면 왼쪽 · 「—」만 가운데(사용자 지시).
 * 변경 일시는 머리를 눌러 오름 · 내림을 바꾼다(사용자 지시).
 */
const baseColumns = (reasonWidth: number): Column<ItemInspectionLevelHistory>[] => [
  {
    key: 'changedAt',
    header: t.history.itemColumns.changedAt,
    align: 'center',
    sortable: true,
    width: '160px',
    render: (row) => formatPlantDateTime(row.changedAt) ?? '',
  },
  {
    key: 'from',
    header: t.history.itemColumns.from,
    align: 'center',
    width: '96px',
    render: (row) =>
      row.fromLevelCode === null ? (
        <span className="inspection-sheet-template-muted">{t.history.firstSetNote}</span>
      ) : (
        <LevelChip code={row.fromLevelCode} />
      ),
  },
  {
    key: 'to',
    header: t.history.itemColumns.to,
    align: 'center',
    width: '96px',
    render: (row) => <LevelChip code={row.toLevelCode} />,
  },
  {
    key: 'changedBy',
    header: t.history.itemColumns.changedBy,
    align: 'center',
    width: '110px',
    render: (row) => row.changedByName ?? '',
  },
  {
    key: 'reason',
    header: t.history.itemColumns.reason,
    width: `${String(reasonWidth)}px`,
    render: (row) => {
      const reason = historyReason(row);
      return reason === EMPTY_REASON ? (
        <span className="inspection-level-history-reason is-empty">{reason}</span>
      ) : (
        <span className="inspection-level-history-reason" title={reason}>
          {reason}
        </span>
      );
    },
  },
];

const REASON_MIN = 180;
/* 칸 안 여백(좌우) — 글자 폭에 더해 잘리지 않게 한다. */
const CELL_PADDING = 40;

let measureContext: CanvasRenderingContext2D | null | undefined;
/** 표 글꼴로 잰 글자 폭. 잴 수 없으면(시험 환경) 글자 수로 어림한다. */
const textWidth = (text: string, font: string): number => {
  if (measureContext === undefined) {
    try {
      measureContext = document.createElement('canvas').getContext('2d');
    } catch {
      measureContext = null;
    }
  }
  if (measureContext === null) return text.length * 14;
  measureContext.font = font;
  return measureContext.measureText(text).width;
};

export interface ItemLevelHistoryTableProps {
  itemId: number;
}

/**
 * 품목 하나의 검사 수준 전환 이력 표(사용자 시안 · #208). 검사 기준 상세의 「검사 수준 변경 이력」 탭이 쓴다(omf-all-around#357).
 */
export const ItemLevelHistoryTable = ({ itemId }: ItemLevelHistoryTableProps) => {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<number>(PAGE_SIZE);
  /* 처음은 최근 것부터(서버 순서와 같다). 머리를 누를 때마다 오름 ↔ 내림. */
  const [direction, setDirection] = useState<SortState['direction']>('descending');
  const histories = useItemInspectionLevelHistories(itemId);
  const all = useMemo(() => {
    const sorted = [...(histories.data ?? [])].sort(
      (a, b) =>
        Date.parse(a.changedAt) - Date.parse(b.changedAt) ||
        a.itemInspectionLevelHistoryId - b.itemInspectionLevelHistoryId,
    );
    return direction === 'ascending' ? sorted : sorted.reverse();
  }, [histories.data, direction]);
  const total = all.length;
  const current = Math.min(page, Math.max(1, Math.ceil(total / size)));
  const rows = all.slice((current - 1) * size, current * size);
  /*
   * 변경 사유 칸은 이 품목 이력 전체에서 가장 긴 사유만큼 넓힌다(쪽을 넘겨도 열 폭이 흔들리지 않게) — 잘라 「…」로 감추지 않고, 상자보다 넓으면 표 안에서 가로로 굴려 본다
   * (사용자 지시 · omf-all-around#357).
   */
  const reasonWidth = useMemo(() => {
    const font = `${getComputedStyle(document.body).fontSize} ${getComputedStyle(document.body).fontFamily}`;
    const widest = all.reduce(
      (max, row) => Math.max(max, textWidth(historyReason(row), font)),
      textWidth(t.history.itemColumns.reason, font),
    );
    return Math.max(REASON_MIN, Math.ceil(widest) + CELL_PADDING);
  }, [all]);
  /* 열 순서 · 폭은 사용자가 바꾸고 브라우저에 남는다 — 모든 표 공통(useColumnOrder · useColumnWidths). */
  const ordered = useColumnOrder(
    'omf-mes:inspection-level:columns:item-history:order',
    baseColumns(reasonWidth),
  );
  const resizable = useColumnWidths('omf-mes:inspection-level:columns:item-history', ordered, {
    fitContent: true,
  });
  /* 모자라면 상자 폭에 맞춰 늘리고, 넘치면 줄이지 않고 표 안에서 가로로 구른다. */
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  return (
    <div className="inspection-level-history-dialog">
      {histories.isError && <AlertBanner variant="error">{t.history.loadFailed}</AlertBanner>}
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-table-box inspection-level-rows"
        style={resizable.style}
      >
        <Table
          caption={<span className="inspection-standard-visually-hidden">{t.history.caption}</span>}
          density="compact"
          columns={fit.columns}
          rows={rows}
          getRowId={(row) => String(row.itemInspectionLevelHistoryId)}
          sort={{ key: 'changedAt', direction }}
          onSortChange={() => {
            setDirection((prev) => (prev === 'descending' ? 'ascending' : 'descending'));
            setPage(1);
          }}
          empty={
            <EmptyState
              size="sm"
              live
              title={histories.isPending ? t.history.loading : t.history.empty}
            />
          }
        />
      </div>
      {histories.data !== undefined && (
        <PageNav
          meta={{ page: current, size, total }}
          buttonSize="md"
          onChangePage={setPage}
          onChangeSize={(next) => {
            setSize(next);
            setPage(1);
          }}
        />
      )}
    </div>
  );
};
