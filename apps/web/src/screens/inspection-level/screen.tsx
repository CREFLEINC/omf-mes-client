import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  Icon,
  PageHeader,
  Table,
  TextField,
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
import { LEVEL_CODES, LevelDialog } from './level-dialog';
import { useLevelWrite } from './level-write';
import { usePageHub } from '../../patterns/page-hub';
import {
  inspectionLevelKeys,
  PAGE_SIZE,
  type LevelListFilter,
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
  const { splitRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:inspection-level:split', 0.4);
  const layout = useSplitOrientation(QUALITY_STANDARD_ORIENTATION_KEY);
  const toast = useToast();
  const keywordId = useId();
  const levelFilterId = useId();

  const [keyword, setKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState<InspectionLevelCode | ''>('');
  const [filter, setFilter] = useState<LevelListFilter>({
    q: '',
    level: '',
    page: 1,
    size: PAGE_SIZE,
  });
  const [historyItem, setHistoryItem] = useState<ItemInspectionLevel | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySize, setHistorySize] = useState<number>(PAGE_SIZE);
  const [editing, setEditing] = useState<{ row: ItemInspectionLevel | null } | null>(null);

  const list = useInspectionLevels(filter);
  const histories = useInspectionLevelHistories(
    historyItem?.itemId ?? null,
    historyPage,
    historySize,
  );
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
      /* 폭을 정하지 않는다 — 남는 폭을 품목명/코드 열이 맡는다. 위 품목명 · 아래 품목 코드(흐리게) 두 줄(사용자 시안 · #208). */
      render: (row) => (
        <span className="inspection-level-item-cell">
          <span title={row.itemName}>{row.itemName}</span>
          <span className="inspection-level-item-code">{row.itemCode}</span>
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
            onClick={() => {
              setHistoryItem(row);
              setHistoryPage(1);
            }}
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
      /* 폭을 정하지 않는다 — 사유가 가장 길어 남는 폭을 맡는다(#208). */
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

      {/* 품목별 검사 수준(목록) | 전환 이력 — 검사 기준 탭의 목록 | 상세와 같은 분할(#208). */}
      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        {/*
         * 목록 카드 하나에 제목 줄(제목 · 품목 추가) → 검색 줄(품목 · 검사 수준 · 조회) → 규칙 안내 → 표 → 쪽 이동.
         * 따로 있던 조회 카드를 합쳐 세로 공간을 아낀다(사용자 시안 · #208). 「초기화」는 원래 없던 단추라 두지 않는다.
         */}
        <section
          className="pane inspection-level-list-pane quality-standard-list-pane"
          aria-label={t.title}
        >
          <div className="inspection-level-card-head">
            <h2 className="pane-title">{t.title}</h2>
            <Button
              variant="filled"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={() => openDialog(null)}
            >
              {t.list.add}
            </Button>
          </div>
          <form
            className="filter-bar inspection-level-search"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter((prev) => ({ ...prev, q: keyword.trim(), level: levelFilter, page: 1 }));
            }}
          >
            {/* 시안은 라벨 없는 검색 줄 — 라벨은 읽기 도구에만 남긴다(#208). */}
            <div className="field-cell inspection-level-keyword">
              <label className="inspection-standard-visually-hidden" htmlFor={keywordId}>
                {t.list.keyword}
              </label>
              <TextField
                id={keywordId}
                fullWidth
                placeholder={t.list.keywordPlaceholder}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            {/* 「무검사」·「보통」 같은 짧은 값이라 좁게(#208). */}
            <div className="field-cell inspection-level-level-filter">
              <label className="inspection-standard-visually-hidden" htmlFor={levelFilterId}>
                {t.list.level}
              </label>
              <Select
                id={levelFilterId}
                options={[
                  { value: '', label: t.list.levelAll },
                  ...LEVEL_CODES.map((code) => ({ value: code, label: levelName(code) })),
                ]}
                value={levelFilter}
                onChange={(value) => setLevelFilter(value as InspectionLevelCode | '')}
              />
            </div>
            <Button type="submit" variant="filled">
              {messages.common.search}
            </Button>
          </form>
          {/* 규칙 안내 — 박스 · 바탕 없는 흐린 보조 글 한 줄(검사표 기준 탭과 같은 모양 · 사용자 지시 · #208). */}
          <p className="inspection-sheet-template-rule">
            <Icon name="info" size={16} />
            {t.rule}
          </p>
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
          {/*
           * 시안 맨 아래 「전체 전환 이력 보기」 = 이력 칸의 품목 거르기 해제(종전 「전체 보기」)와 같은 일 —
           * 시안 자리로 옮긴다. 한 품목만 보는 중일 때만 보인다(새 기능 아님 · 사용자 시안 · #208).
           */}
          {historyItem !== null && (
            <div className="inspection-level-card-foot">
              <Button
                size="sm"
                variant="text"
                onClick={() => {
                  setHistoryItem(null);
                  setHistoryPage(1);
                }}
              >
                {t.history.showAll}
              </Button>
            </div>
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
          {/* 제목 옆에 「어느 품목만 보는 중」을 같은 줄로 — 해제는 목록 카드 아래 「전체 전환 이력 보기」(#208). */}
          <div className="inspection-level-section-head">
            <h2 className="pane-title">{t.history.heading}</h2>
            {historyItem !== null && (
              <span className="inspection-level-history-filter">
                {t.history.filteredBy(historyItem.itemCode)}
              </span>
            )}
          </div>
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
    </>
  );
};
