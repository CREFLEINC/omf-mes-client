import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  Icon,
  SearchInput,
  PageHeader,
  Table,
  useToast,
} from '@crefle/web-ui';
import type {
  InspectionLevelCode,
  ItemInspectionLevel,
  ItemInspectionLevelHistory,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { SaveErrorBanner } from '../../patterns/master';
import { ItemPickerDialog } from '../../patterns/item-picker';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { PageNav } from '../../patterns/page-nav';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import {
  PaneHeightSplitter,
  QUALITY_STANDARD_ORIENTATION_KEY,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { ItemHistoryDialog } from './history-dialog';
import { LEVEL_CODES, LevelDialog } from './level-dialog';
import { useLevelWrite } from './level-write';
import { usePageHub } from '../../patterns/page-hub';
import {
  inspectionLevelKeys,
  PAGE_SIZE,
  type LevelListFilter,
  useInspectionLevelCounts,
  useInspectionLevelHistories,
  useInspectionLevels,
} from './queries';

const t = messages.inspectionLevel;
const hubText = messages.common.inspectionHub;

const levelName = (code: string | null): string => (code === null ? '' : (t.levels[code] ?? code));

/** 검사 수준을 글자 + 색으로 가른다(#208) — 무검사는 흐리게, 수월은 초록, 보통은 파랑, 엄격은 주의색. */
const LEVEL_TONE: Record<string, ChipStatus> = {
  NONE: 'idle',
  REDUCED: 'success',
  NORMAL: 'info',
  TIGHTENED: 'warning',
};

const LevelChip = ({ code }: { code: string | null }) =>
  code === null ? null : (
    <Chip variant="status" size="sm" status={LEVEL_TONE[code] ?? 'idle'}>
      {levelName(code)}
    </Chip>
  );

/**
 * 검사 수준 칩 — 전체 · 무검사 · 수월 · 보통 · 엄격, 칩마다 품목 수(사용자 지시 · #208).
 * 하나만 고른다 — 고른 칩을 다시 눌러도 풀리지 않는다. 탭 묶음 밖에서는 자리가 없어 그리지 않는다.
 */
const LevelFilterChips = ({
  counts,
  value,
  onChange,
}: {
  counts: Record<InspectionLevelCode | '', number> | null;
  value: InspectionLevelCode | '';
  onChange: (next: InspectionLevelCode | '') => void;
}) => {
  const target = useHubActionsTarget();
  if (target === null) return null;
  const options: { value: InspectionLevelCode | ''; label: string }[] = [
    { value: '', label: t.list.levelAll },
    ...LEVEL_CODES.map((code) => ({ value: code, label: levelName(code) })),
  ];

  return (
    <HubActions target={target}>
      <div className="inspection-hub-counts" role="group" aria-label={t.list.level}>
        {options.map((option) => (
          <Chip
            key={option.value}
            variant="filter"
            size="sm"
            selected={value === option.value}
            aria-pressed={value === option.value}
            onSelectedChange={() => {
              if (value !== option.value) onChange(option.value);
            }}
          >
            {counts === null ? option.label : t.list.levelCount(option.label, counts[option.value])}
          </Chip>
        ))}
      </div>
    </HubActions>
  );
};

/** 빈 상태의 둥근 바탕 아이콘 — 검사 기준 탭과 같다(#208). */
const emptyIcon = (
  <span className="inspection-standard-empty-icon">
    <Icon name="assignment" size={20} />
  </span>
);

/** 이력의 사유 칸 — 자동은 연속 합격 수나 불합격 의뢰, 수동은 입력한 사유. */
export const historyReason = (row: ItemInspectionLevelHistory): string => {
  if (row.changeTypeCode === 'AUTO') {
    if (row.consecutiveAcceptCount !== null)
      return t.history.acceptStreak(row.consecutiveAcceptCount);
    return t.history.rejected(row.inspectionRequestNo ?? '');
  }
  return row.reason ?? '—';
};

/**
 * 검사 수준 관리(관리웹 · 품질 관리). 품목별 IQC 검사 수준을 지정·수동 변경하고 전환 이력을 본다.
 * 자동 전환은 없다 — 사용자가 정한 수준만 쓴다(omf-all-around#133). 이력의 「자동」 줄은 그 전 기록이다.
 */
export const InspectionLevelScreen = () => {
  const hub = usePageHub();
  /* 좌우 · 상하 배치 · 폭/높이 손잡이 · 창 높이 맞춤 — 검사 기준 탭과 같다(사용자 지시 · #208). 배치는 탭 묶음이 함께 쓴다. */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:inspection-level:split', 0.4);
  const layout = useSplitOrientation(QUALITY_STANDARD_ORIENTATION_KEY);
  const toast = useToast();

  /* 품목 — 조회 줄의 「품목 검색」 칸을 누르면 품목 선택 창이 열린다(검사표 기준 탭과 같다 · 사용자 지시 · #208). */
  const [itemInput, setItemInput] = useState<{ itemId: number; label: string } | null>(null);
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [filter, setFilter] = useState<LevelListFilter>({
    itemId: null,
    level: '',
    page: 1,
    size: PAGE_SIZE,
  });
  const [historyItem, setHistoryItem] = useState<ItemInspectionLevel | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySize, setHistorySize] = useState<number>(PAGE_SIZE);
  const [editing, setEditing] = useState<{ row: ItemInspectionLevel | null } | null>(null);

  const list = useInspectionLevels(filter);
  /* 아래 「전환 이력」 카드는 늘 전체 이력 — 한 품목 이력은 줄의 「이력」 창으로 본다(사용자 지시 · #208). */
  const histories = useInspectionLevelHistories(null, historyPage, historySize);
  const counts = useInspectionLevelCounts(filter.itemId, LEVEL_CODES);
  const rows = list.data?.items ?? [];
  const historyRows = histories.data?.items ?? [];

  const formWrite = useLevelWrite(() => {
    setEditing(null);
    toast.show({ variant: 'success', description: messages.common.saved });
  });

  /* 목록을 다시 받는 동안에는 줄의 `versionNo`가 곧 낡는다. */
  const rowLocked = list.isFetching;

  const openDialog = (row: ItemInspectionLevel | null) => {
    formWrite.reset();
    setEditing({ row });
  };

  /* 목록 표는 모든 열을 가운데 정렬한다 — 검사 기준 탭과 같다(#208). */
  const columns: Column<ItemInspectionLevel>[] = [
    {
      key: 'item',
      align: 'center',
      header: t.columns.item,
      /*
       * 품목 코드 · 품목명(흐리게) 한 줄 — 검사표 기준 탭과 같다(사용자 지시 · #208).
       * 모든 열이 폭을 가져야 좁은 칸에서 이 열이 0 으로 짓눌리지 않고 표가 옆으로 구른다 — 넓으면 비율대로 늘어난다(반응형 · #208).
       */
      width: '280px',
      render: (row) => (
        <span className="inspection-level-item-cell">
          <span className="inspection-level-item-code">{row.itemCode}</span>
          <span className="inspection-sheet-template-muted" title={row.itemName}>
            {row.itemName}
          </span>
        </span>
      ),
    },
    {
      key: 'level',
      align: 'center',
      header: t.columns.level,
      width: '104px',
      render: (row) => <LevelChip code={row.inspectionLevelCode} />,
    },
    {
      key: 'updatedAt',
      align: 'center',
      header: t.columns.updatedAt,
      width: '150px',
      render: (row) => (
        <span className="inspection-sheet-template-date">
          {formatPlantDateTime(row.updatedAt) ?? ''}
        </span>
      ),
    },
    {
      key: 'actions',
      align: 'center',
      header: t.columns.actions,
      width: '168px',
      render: (row) => (
        <>
          <Button
            size="sm"
            variant="text"
            disabled={rowLocked}
            aria-label={t.actions.changeLevelRow(row.itemCode)}
            onClick={() => openDialog(row)}
          >
            {t.actions.changeLevel}
          </Button>
          <Button
            size="sm"
            variant="text"
            aria-label={t.actions.showHistoryRow(row.itemCode)}
            onClick={() => setHistoryItem(row)}
          >
            {t.actions.showHistory}
          </Button>
        </>
      ),
    },
  ];

  const historyColumns: Column<ItemInspectionLevelHistory>[] = [
    {
      key: 'changedAt',
      align: 'center',
      header: t.history.columns.changedAt,
      width: '150px',
      render: (row) => (
        <span className="inspection-sheet-template-date">
          {formatPlantDateTime(row.changedAt) ?? ''}
        </span>
      ),
    },
    {
      key: 'item',
      align: 'center',
      header: t.history.columns.item,
      width: '240px',
      render: (row) => {
        const label = `${row.itemCode} · ${row.itemName}`;
        return <span title={label}>{label}</span>;
      },
    },
    {
      key: 'change',
      align: 'center',
      header: t.history.columns.change,
      width: '160px',
      render: (row) =>
        row.fromLevelCode === null
          ? `${levelName(row.toLevelCode)} ${t.history.firstSet}`
          : `${levelName(row.fromLevelCode)} → ${levelName(row.toLevelCode)}`,
    },
    {
      key: 'type',
      align: 'center',
      header: t.history.columns.type,
      width: '72px',
      render: (row) => t.history.types[row.changeTypeCode] ?? row.changeTypeCode,
    },
    {
      key: 'reason',
      align: 'center',
      header: t.history.columns.reason,
      /* 사유가 가장 길어 가장 넓게 — 폭을 정해 둬야 좁은 칸에서 짓눌리지 않고 표가 옆으로 구른다(반응형 · #208). */
      width: '240px',
      render: (row) => {
        const reason = historyReason(row);
        return <span title={reason}>{reason}</span>;
      },
    },
    {
      key: 'changedBy',
      align: 'center',
      header: t.history.columns.changedBy,
      width: '112px',
      render: (row) => row.changedByName ?? '',
    },
  ];

  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다 — 검사 기준 탭 목록과 같다(#208). */
  const ordered = useColumnOrder('omf-mes:inspection-level:columns:list:order', columns);
  const resizable = useColumnWidths('omf-mes:inspection-level:columns:list', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  const historyOrdered = useColumnOrder(
    'omf-mes:inspection-level:columns:history:order',
    historyColumns,
  );
  const historyResizable = useColumnWidths(
    'omf-mes:inspection-level:columns:history',
    historyOrdered,
    { fitContent: true },
  );
  const historyFit = useFitColumns(historyResizable.columns, { scrollX: true });

  return (
    <>
      {/* 탭 줄 오른쪽 — 검사 수준 칩 다음에 좌우 · 상하 배치(검사 기준 탭의 사용 여부 칩과 같은 자리 · 사용자 지시 · #208). */}
      <LevelFilterChips
        counts={counts.data ?? null}
        value={filter.level}
        onChange={(level) => setFilter((prev) => ({ ...prev, level, page: 1 }))}
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 탭 묶음(품질 기준 정보) 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(#208 · 검사 기준 탭과 같다). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}

      {/*
       * 조회 조건 — 검사 기준 · 검사표 기준 탭과 같은 카드 한 줄(사용자 지시 · #208):
       * 품목 검색 → (오른쪽) 조회 · 초기화 | 품목 추가. 검사 수준은 탭 줄 오른쪽 칩으로 거른다.
       */}
      <section ref={aboveRef} className="pane inspection-level-search" role="search">
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter((prev) => ({
              ...prev,
              itemId: itemInput?.itemId ?? null,
              page: 1,
            }));
          }}
        >
          <SearchInput
            label={t.list.keyword}
            placeholder={t.list.keywordPlaceholder}
            value={itemInput?.label ?? ''}
            readOnly
            title={itemInput?.label}
            aria-haspopup="dialog"
            clearLabel={t.list.keywordClear}
            onClick={() => setIsItemPickerOpen(true)}
            onSearch={() => setIsItemPickerOpen(true)}
            onChange={() => undefined}
            onClear={() => {
              setItemInput(null);
              setFilter((prev) => ({ ...prev, itemId: null, page: 1 }));
            }}
          />
          <div className="filter-actions field-cell-unlabeled">
            <Button type="submit" variant="filled">
              {messages.common.search}
            </Button>
            {/* 초기화 — 입력과 적용된 조건을 처음으로 되돌린다. 다른 탭과 같다. */}
            <Button
              variant="outlined"
              onClick={() => {
                setItemInput(null);
                setFilter((prev) => ({ ...prev, itemId: null, level: '', page: 1 }));
              }}
            >
              {messages.common.reset}
            </Button>
            <span className="inspection-standard-filter-divider" aria-hidden />
            <Button
              variant="filled"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={() => openDialog(null)}
            >
              {t.list.add}
            </Button>
          </div>
        </form>
      </section>

      {/* 품목별 검사 수준(목록) | 전환 이력 — 검사 기준 탭의 목록 | 상세와 같은 분할(#208). */}
      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        {/*
         * 목록 카드 — 표 → 쪽 이동. 조회 줄은 위 카드에 따로 둔다(다른 탭과 같다 · #208).
         */}
        <section
          className="pane inspection-level-list-pane quality-standard-list-pane"
          aria-label={t.title}
        >
          {list.isError && (
            <AlertBanner variant="error">
              {t.list.loadFailed}{' '}
              <Button size="sm" variant="text" onClick={() => void list.refetch()}>
                {t.list.retry}
              </Button>
            </AlertBanner>
          )}
          <div
            ref={fit.ref}
            className="inspection-queue-table inspection-standard-table-box inspection-level-rows"
            style={resizable.style}
          >
            <Table
              /* 표 이름은 카드 제목과 겹친다 — 화면에서는 감추고 읽기 도구에만 남긴다(#208). */
              caption={
                <span className="inspection-standard-visually-hidden">{t.list.caption}</span>
              }
              density="compact"
              columns={fit.columns}
              rows={rows}
              getRowId={(row) => String(row.itemInspectionLevelId)}
              empty={
                list.isPending ? (
                  <EmptyState size="sm" live title={t.list.loading} />
                ) : (
                  <EmptyState
                    size="sm"
                    live
                    icon={emptyIcon}
                    title={t.list.empty}
                    description={t.list.emptyHint}
                  />
                )
              }
            />
          </div>
          {list.data !== undefined && (
            /* 쪽 이동은 다섯 목록이 같은 모양 · 같은 단추 크기 — 검사 기준 목록 기준(사용자 지시 · #208). */
            <PageNav
              meta={list.data.page}
              buttonSize="md"
              onChangePage={(page) => setFilter((prev) => ({ ...prev, page }))}
              onChangeSize={(size) => setFilter((prev) => ({ ...prev, size, page: 1 }))}
            />
          )}
        </section>

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <section
          className="pane inspection-level-list-pane quality-standard-detail"
          aria-label={t.history.heading}
        >
          <h2 className="pane-title">{t.history.heading}</h2>
          {histories.isError && <AlertBanner variant="error">{t.history.loadFailed}</AlertBanner>}
          <div
            ref={historyFit.ref}
            className="inspection-queue-table inspection-standard-table-box inspection-level-rows"
            style={historyResizable.style}
          >
            <Table
              caption={
                <span className="inspection-standard-visually-hidden">{t.history.caption}</span>
              }
              density="compact"
              columns={historyFit.columns}
              rows={historyRows}
              getRowId={(row) => String(row.itemInspectionLevelHistoryId)}
              empty={
                histories.isPending ? (
                  <EmptyState size="sm" live title={t.history.loading} />
                ) : (
                  <EmptyState
                    size="sm"
                    live
                    icon={emptyIcon}
                    title={t.history.empty}
                    description={t.history.emptyHint}
                  />
                )
              }
            />
          </div>
          {histories.data !== undefined && (
            <PageNav
              meta={histories.data.page}
              buttonSize="md"
              onChangePage={setHistoryPage}
              onChangeSize={(size) => {
                setHistorySize(size);
                setHistoryPage(1);
              }}
            />
          )}
        </section>
      </div>

      {editing !== null && (
        <LevelDialog
          row={editing.row}
          fieldErrors={formWrite.fieldErrors}
          banner={
            <SaveErrorBanner
              error={formWrite.error}
              onReload={() => {
                formWrite.reset();
                setEditing(null);
                void list.refetch();
              }}
            />
          }
          isSaving={formWrite.isSaving}
          onClose={() => {
            formWrite.reset();
            setEditing(null);
          }}
          onSave={(values) => formWrite.write({ row: editing.row, values })}
        />
      )}

      {historyItem !== null && (
        <ItemHistoryDialog
          item={historyItem}
          /* 품목 열은 빼고(창 제목이 말한다), 사유 폭을 줄여 일시 · 처리자가 창 안에서 잘리지 않게(#208). */
          columns={historyColumns
            .filter((column) => column.key !== 'item')
            .map((column) =>
              column.key === 'reason'
                ? { ...column, width: '140px' }
                : column.key === 'change'
                  ? { ...column, width: '150px' }
                  : column,
            )}
          onClose={() => setHistoryItem(null)}
        />
      )}

      {isItemPickerOpen && (
        <ItemPickerDialog
          multiple={false}
          compact
          showAvailability={false}
          confirmLabel={t.dialog.pickConfirm}
          onClose={() => setIsItemPickerOpen(false)}
          onConfirm={([picked]) => {
            setIsItemPickerOpen(false);
            if (picked === undefined) return;
            setItemInput({ itemId: picked.itemId, label: `${picked.itemCode} ${picked.itemName}` });
            /* 「선택」하면 바로 조회한다 — 「조회」를 한 번 더 누르지 않게(검사표 기준 탭과 같다 · #208). */
            setFilter((prev) => ({ ...prev, itemId: picked.itemId, page: 1 }));
          }}
        />
      )}
    </>
  );
};
