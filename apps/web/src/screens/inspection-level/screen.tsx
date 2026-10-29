import {
  AlertBanner,
  Breadcrumb,
  Button,
  type Column,
  EmptyState,
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

import { SaveErrorBanner } from '../../patterns/master';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { PageNav } from '../oqc-inspection/page-nav';
import { toPageView } from '../oqc-inspection/pagination';
import { LEVEL_CODES, LevelDialog } from './level-dialog';
import { useLevelWrite } from './level-write';
import { usePageHub } from '../../patterns/page-hub';
import {
  inspectionLevelKeys,
  type LevelListFilter,
  useInspectionLevelHistories,
  useInspectionLevels,
} from './queries';

const t = messages.inspectionLevel;

const levelName = (code: string | null): string => (code === null ? '' : (t.levels[code] ?? code));

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
  const toast = useToast();
  const keywordId = useId();
  const levelFilterId = useId();

  const [keyword, setKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState<InspectionLevelCode | ''>('');
  const [filter, setFilter] = useState<LevelListFilter>({ q: '', level: '', page: 1 });
  const [historyItem, setHistoryItem] = useState<ItemInspectionLevel | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [editing, setEditing] = useState<{ row: ItemInspectionLevel | null } | null>(null);

  const list = useInspectionLevels(filter);
  const histories = useInspectionLevelHistories(historyItem?.itemId ?? null, historyPage);
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

  const columns: Column<ItemInspectionLevel>[] = [
    { key: 'itemCode', header: t.columns.itemCode, render: (row) => row.itemCode },
    { key: 'itemName', header: t.columns.itemName, render: (row) => row.itemName },
    {
      key: 'level',
      header: t.columns.level,
      width: '96px',
      render: (row) => levelName(row.inspectionLevelCode),
    },
    {
      key: 'updatedAt',
      header: t.columns.updatedAt,
      width: '150px',
      render: (row) => formatPlantDateTime(row.updatedAt) ?? '',
    },
    {
      key: 'actions',
      header: t.columns.actions,
      width: '180px',
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
      header: t.history.columns.changedAt,
      width: '150px',
      render: (row) => formatPlantDateTime(row.changedAt) ?? '',
    },
    {
      key: 'item',
      header: t.history.columns.item,
      render: (row) => `${row.itemCode} · ${row.itemName}`,
    },
    {
      key: 'change',
      header: t.history.columns.change,
      render: (row) =>
        row.fromLevelCode === null
          ? `${levelName(row.toLevelCode)} ${t.history.firstSet}`
          : `${levelName(row.fromLevelCode)} → ${levelName(row.toLevelCode)}`,
    },
    {
      key: 'type',
      header: t.history.columns.type,
      width: '72px',
      render: (row) => t.history.types[row.changeTypeCode] ?? row.changeTypeCode,
    },
    { key: 'reason', header: t.history.columns.reason, render: historyReason },
    {
      key: 'changedBy',
      header: t.history.columns.changedBy,
      render: (row) => row.changedByName ?? '',
    },
  ];

  return (
    <>
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

      <p className="field-note">{t.rule}</p>

      <section className="pane" aria-label={t.list.heading}>
        <h2 className="pane-title">{t.list.heading}</h2>
        {list.isError && (
          <AlertBanner variant="error">
            {t.list.loadFailed}{' '}
            <Button size="sm" variant="text" onClick={() => void list.refetch()}>
              {t.list.retry}
            </Button>
          </AlertBanner>
        )}

        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter({ q: keyword.trim(), level: levelFilter, page: 1 });
          }}
        >
          <div className="field-cell">
            <label className="field-label" htmlFor={keywordId}>
              {t.list.keyword}
            </label>
            <TextField
              id={keywordId}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
          <div className="field-cell">
            <label className="field-label" htmlFor={levelFilterId}>
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
          <div className="field-cell field-cell-unlabeled">
            <Button type="submit" variant="outlined">
              {t.list.search}
            </Button>
          </div>
          <div className="field-cell field-cell-unlabeled">
            <Button onClick={() => openDialog(null)}>{t.list.add}</Button>
          </div>
        </form>

        <div className="wide-table">
          <Table
            caption={t.list.caption}
            density="compact"
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.itemInspectionLevelId)}
            empty={
              <EmptyState size="sm" live title={list.isPending ? t.list.loading : t.list.empty} />
            }
          />
        </div>
        {list.data !== undefined && (
          <PageNav
            view={toPageView(list.data.page, rows.length)}
            onChange={(page) => setFilter((prev) => ({ ...prev, page }))}
          />
        )}
      </section>

      <section className="pane" aria-label={t.history.heading}>
        <h2 className="pane-title">{t.history.heading}</h2>
        {historyItem !== null && (
          <p className="field-note">
            {t.history.filteredBy(historyItem.itemCode)}{' '}
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
          </p>
        )}
        {histories.isError && <AlertBanner variant="error">{t.history.loadFailed}</AlertBanner>}
        <div className="wide-table">
          <Table
            caption={t.history.caption}
            density="compact"
            columns={historyColumns}
            rows={historyRows}
            getRowId={(row) => String(row.itemInspectionLevelHistoryId)}
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
            view={toPageView(histories.data.page, historyRows.length)}
            onChange={setHistoryPage}
          />
        )}
      </section>

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
