import {
  AlertBanner,
  Button,
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  Icon,
  Table,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { hasChangedFilters } from '../../patterns/filter-more';
import { SaveErrorBanner } from '../../patterns/master';
import { ItemSelect } from '../../patterns/item-select';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { QUALITY_STANDARD_ORIENTATION_KEY } from '../../patterns/split-orientation';
import { ItemHistoryDialog } from './history-dialog';
import { LEVEL_CODES, LevelDialog } from './level-dialog';
import { useLevelWrite } from './level-write';
import {
  inspectionLevelKeys,
  PAGE_SIZE,
  type LevelListFilter,
  useInspectionLevelCounts,
  useInspectionLevelHistories,
  useInspectionLevels,
} from './queries';
import './layout.css';

type InspectionLevelCode = components['schemas']['ItemInspectionLevel']['inspectionLevelCode'];
type ItemInspectionLevel = components['schemas']['ItemInspectionLevel'];
type ItemInspectionLevelHistory = components['schemas']['ItemInspectionLevelHistory'];

const t = messages.inspectionLevel;

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
 * 검사 수준 칩 — 무검사 · 수월 · 보통 · 엄격, 칩마다 품목 수(사용자 지시 · #208).
 * 「전체」 라벨은 두지 않는다 — 고른 칩을 다시 누르면 전체로 풀리고, 0건 칩은 감춘다(고른 칩은 남긴다 · 사용자 지시 2026-11-24).
 * 탭 묶음 밖에서는 자리가 없어 그리지 않는다.
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
  const options = LEVEL_CODES.map((code) => ({ value: code, label: levelName(code) })).filter(
    (option) => value === option.value || counts === null || counts[option.value] !== 0,
  );

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
              onChange(value === option.value ? '' : option.value);
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
  const toast = useToast();

  /* 품목 — 조회 줄의 「품목 검색」 칸에서 바로 검색해서 고른다(#226). */
  const [itemInput, setItemInput] = useState<{ itemId: number; label: string } | null>(null);
  const itemSelectId = useId();
  const [filter, setFilter] = useState<LevelListFilter>({
    itemId: null,
    level: '',
    page: 1,
    size: PAGE_SIZE,
  });
  /* 「초기화」는 바뀐 것이 있을 때만 보인다(C-6) — 초기화가 검사 수준 칩도 되돌리므로 함께 견준다. */
  const isFilterChanged = hasChangedFilters(
    { itemId: null, level: '' },
    { itemId: itemInput?.itemId ?? null, level: filter.level },
    { itemId: filter.itemId, level: filter.level },
  );
  const [historyItem, setHistoryItem] = useState<ItemInspectionLevel | null>(null);
  /* 목록에서 고른 품목 — 오른쪽 이력이 이 품목만 보인다. 같은 줄을 다시 누르면 풀려 전체 이력(#350 사용자 지시). */
  const [selectedItem, setSelectedItem] = useState<ItemInspectionLevel | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySize, setHistorySize] = useState<number>(PAGE_SIZE);
  const [editing, setEditing] = useState<{ row: ItemInspectionLevel | null } | null>(null);

  const list = useInspectionLevels(filter);
  const histories = useInspectionLevelHistories(
    selectedItem?.itemId ?? null,
    historyPage,
    historySize,
  );
  const selectItem = (row: ItemInspectionLevel) => {
    setSelectedItem((prev) => (prev?.itemId === row.itemId ? null : row));
    setHistoryPage(1);
  };
  /*
   * 조회 조건(품목 · 수준)이나 목록 쪽이 바뀌면 고른 품목을 푼다 — 목록에 보이지 않는 품목의 이력만 남지 않게(#350 회귀
   * 시험 · 리뷰).
   */
  useEffect(() => {
    setSelectedItem(null);
    setHistoryPage(1);
  }, [filter.itemId, filter.level, filter.page, filter.size]);
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
    /*
     * 품목은 코드 · 이름 두 칸이다(사용자 지시 2026-11-20, 한 칸에 붙이던 「코드 · 이름(흐리게)」를 나눴다).
     * 모든 열이 폭을 가져야 좁은 칸에서 이 열이 0 으로 짓눌리지 않고 표가 옆으로 구른다 — 넓으면 비율대로 늘어난다(반응형 · #208).
     */
    {
      key: 'itemCode',
      align: 'center',
      header: t.columns.itemCode,
      width: '140px',
      render: (row) => (
        /*
         * 줄 아무 곳이나 눌러 고른다(#350 사용자 지시) — 품목코드는 링크처럼 보이지 않고, 이 단추는 키보드 · 화면 낭독기가
         * 줄을 고르는 자리로만 남는다(사용자 역할 권한 관리 목록과 같다). 고른 줄 표시는 `aria-current`.
         */
        <button
          type="button"
          className="inspection-level-row-pick"
          aria-current={selectedItem?.itemId === row.itemId ? 'true' : undefined}
          aria-label={t.history.openRow(row.itemCode)}
          title={row.itemCode}
          onClick={() => selectItem(row)}
        >
          {row.itemCode}
        </button>
      ),
    },
    {
      key: 'itemName',
      align: 'center',
      header: t.columns.itemName,
      width: '200px',
      render: (row) => <span title={row.itemName}>{row.itemName}</span>,
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
    /* 품목 코드 · 이름 두 칸(사용자 지시 2026-11-20). */
    {
      key: 'itemCode',
      align: 'center',
      header: t.history.columns.itemCode,
      width: '140px',
      render: (row) => <span title={row.itemCode}>{row.itemCode}</span>,
    },
    {
      key: 'itemName',
      align: 'center',
      header: t.history.columns.itemName,
      width: '200px',
      render: (row) => <span title={row.itemName}>{row.itemName}</span>,
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

  /*
   * 품목 이력 창의 열 — 사용자 시안(#208): 변경 일시 · 검사 수준(새 수준 칩 + 아래 「최초 지정」/「이전 수준에서 변경」) ·
   * 변경 방식 · 변경 사유 · 처리자. 품목은 창 머리가 말하므로 열에서 뺀다. 왼쪽 정렬.
   */
  const itemHistoryColumns: Column<ItemInspectionLevelHistory>[] = [
    {
      key: 'changedAt',
      header: t.history.itemColumns.changedAt,
      width: '150px',
      render: (row) => formatPlantDateTime(row.changedAt) ?? '',
    },
    {
      key: 'level',
      header: t.history.itemColumns.level,
      width: '130px',
      render: (row) => (
        <span className="inspection-level-history-level">
          <LevelChip code={row.toLevelCode} />
          <span className="inspection-sheet-template-muted">
            {row.fromLevelCode === null
              ? t.history.firstSetNote
              : t.history.changedFrom(levelName(row.fromLevelCode))}
          </span>
        </span>
      ),
    },
    {
      key: 'type',
      header: t.history.itemColumns.type,
      width: '90px',
      render: (row) => t.history.types[row.changeTypeCode] ?? row.changeTypeCode,
    },
    {
      key: 'reason',
      header: t.history.itemColumns.reason,
      width: '150px',
      render: (row) => {
        const reason = historyReason(row);
        return <span title={reason}>{reason}</span>;
      },
    },
    {
      key: 'changedBy',
      header: t.history.itemColumns.changedBy,
      width: '120px',
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
      {/*
       * 조회 조건 · 목록 · 상세 통일 배치(검사 조회·판정과 같다 · #350) — 화면 제목 줄은 두지 않는다.
       * 탭 줄 오른쪽 — 검사 수준 칩 다음에 좌우 · 상하 배치(「⋯」).
       */}
      <ListDetailWorkspace
        storageKey="omf-mes:inspection-level"
        /* 좌우 · 상하 배치는 탭 묶음(검사 기준 · 검사표 기준)과 함께 쓴다(#208). */
        orientationKey={QUALITY_STANDARD_ORIENTATION_KEY}
        toolbar={
          <LevelFilterChips
            counts={counts.data ?? null}
            value={filter.level}
            onChange={(level) => setFilter((prev) => ({ ...prev, level, page: 1 }))}
          />
        }
        filter={{
          label: messages.common.paneList.filter,
          content: (
            /* 품목 검색 → (오른쪽) 조회 · 초기화 | 품목 추가. 검사 수준은 탭 줄 오른쪽 칩으로 거른다(#208). */
            <form
              className="filter-bar inspection-level-filter"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                setFilter((prev) => ({
                  ...prev,
                  itemId: itemInput?.itemId ?? null,
                  page: 1,
                }));
              }}
            >
              {/* 품목 — 칸에서 바로 검색해서 고른다(#226). 고르면 바로 조회하고(#208) 「전체」는 종전 × 자리다. */}
              <div className="field-cell search-select-cell">
                <label className="field-label" htmlFor={itemSelectId}>
                  {t.list.keyword}
                </label>
                <ItemSelect
                  id={itemSelectId}
                  /* 칸 글자는 종전처럼 「코드 이름」이다. */
                  selectedOption={
                    itemInput === null
                      ? null
                      : { value: String(itemInput.itemId), label: itemInput.label }
                  }
                  leadingOptions={[{ value: '', label: t.list.all }]}
                  value={itemInput === null ? '' : String(itemInput.itemId)}
                  placeholder={t.list.all}
                  onItemChange={(picked) => {
                    setItemInput({
                      itemId: picked.itemId,
                      label: `${picked.itemCode} ${picked.itemName}`,
                    });
                    setFilter((prev) => ({ ...prev, itemId: picked.itemId, page: 1 }));
                  }}
                  onChange={(value) => {
                    if (value !== '') return;
                    setItemInput(null);
                    setFilter((prev) => ({ ...prev, itemId: null, page: 1 }));
                  }}
                />
              </div>
              <div className="filter-actions field-cell-unlabeled">
                <Button type="submit" variant="filled">
                  {messages.common.search}
                </Button>
                {/* 초기화 — 입력과 적용된 조건을 처음으로 되돌린다. 다른 탭과 같다. */}
                {isFilterChanged && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setItemInput(null);
                      setFilter((prev) => ({ ...prev, itemId: null, level: '', page: 1 }));
                    }}
                  >
                    {messages.common.reset}
                  </Button>
                )}
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
          ),
        }}
        list={{
          label: t.title,
          title: t.list.caption,
          count: list.data?.page.total,
          className: 'inspection-level-list-pane quality-standard-list-pane',
          content: (
            <>
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
                /* 목록은 칸 값을 가운데 정렬한다(#350 사용자 지시 — `cells-start` 를 쓰지 않는다). */
                className="inspection-queue-table inspection-standard-table-box inspection-level-rows inspection-level-pick-rows"
                style={resizable.style}
                onClick={(event) => {
                  const target = event.target;
                  if (!(target instanceof Element)) return;
                  /* 줄 안의 단추(고르기 · 변경 · 이력)는 제 일을 한다. */
                  if (target.closest('button, a, input, select, textarea') !== null) return;
                  target
                    .closest('tbody tr')
                    ?.querySelector<HTMLButtonElement>('.inspection-level-row-pick')
                    ?.click();
                }}
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
            </>
          ),
        }}
        detail={{
          label: t.history.heading,
          className: 'inspection-level-list-pane quality-standard-detail',
          content: (
            <>
              {/* 제목 줄 — 제목 오른쪽에 안내(글자 폭만큼) · #350 사용자 지시. */}
              <div className="inspection-level-history-head">
                <h2 className="pane-title">
                  {t.history.heading}
                  {/* 띄어 읽게 — 화면 낭독기가 제목과 품목을 붙여 읽지 않는다. */}
                  {selectedItem !== null && ' '}
                  {selectedItem !== null && (
                    <span className="inspection-level-history-selected">
                      {t.history.selectedItem(selectedItem.itemCode, selectedItem.itemName)}
                    </span>
                  )}
                </h2>
                <p className="iqc-inspection-action-note" data-tone="info" role="status">
                  <Icon name="info" size={16} aria-hidden />
                  {selectedItem === null ? t.history.allHint : t.history.selectedHint}
                </p>
              </div>
              {histories.isError && (
                <AlertBanner variant="error">{t.history.loadFailed}</AlertBanner>
              )}
              <div
                ref={historyFit.ref}
                className="inspection-queue-table inspection-standard-table-box inspection-level-rows cells-start"
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
            </>
          ),
        }}
      />

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
          columns={itemHistoryColumns}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </>
  );
};
