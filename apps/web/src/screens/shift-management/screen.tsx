import {
  Button,
  Chip,
  Dialog,
  EmptyState,
  Icon,
  SearchInput,
  Skeleton,
  Table,
  useToast,
  type Column,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type ReactNode } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { InfoTip } from '../../patterns/info-tip';
import { PageNav } from '../../patterns/page-nav';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { useOaAccess, useScopedPlants } from '../../patterns/oa-access';
import { SaveErrorBanner } from '../../patterns/master';
import { useSession } from '../../patterns/session';
import { Select } from '../../patterns/select';
import { EditDialog } from './edit-dialog';
import { useDeactivateShift, usePlants, useShiftDetail, useShifts, type Shift } from './queries';

type SessionScope = components['schemas']['SessionScope'];

const t = messages.shiftManagement;
const NO_SCOPES: readonly SessionScope[] = [];
/** 쪽당 건수 — 단말 관리 목록과 같다(10 · 20 · 50, 처음 20). */
const PAGE_SIZES = [10, 20, 50] as const;
type ShiftPageSize = (typeof PAGE_SIZES)[number];

/** `HH:MM:SS` → `HH:MM`. 교대 시간은 분 단위로 정한다. */
const hhmm = (time: string): string => time.slice(0, 5);

/**
 * W-06-26 교대 관리(omf-all-around#318).
 *
 * 공장마다 주간·야간 교대를 등록 · 수정 · 사용 중지한다. 시간 값은 고객이 정하므로 화면에서 넣는다(시드 없음).
 * 목록은 기존 조회 API(`GET /mdm/shifts`)라 4M 자원배정의 교대 선택과 같은 행을 본다.
 * 틀은 검사 조회·판정 · 단말 관리와 같다 — 머리글 없이 위 조회 상자, 아래 「교대 목록 N건」 상자.
 */
export const ShiftManagementScreen = () => {
  const toast = useToast();
  const plantFieldId = useId();
  const { session } = useSession();
  const plants = usePlants(session?.scopes ?? NO_SCOPES);
  /*
   * 공장은 사용자 설정을 따라 자동으로 고른다 — 계정 범위 공장 중 위 줄에서 고른 동작(OA · 부품)의 공장.
   * 그 공장이 여럿이면 고를 수 있다. 판단 근거를 못 받으면 범위 공장 전체를 후보로 둔다.
   */
  const access = useOaAccess();
  const scoped = useScopedPlants();
  const kindIds =
    scoped.status === 'ready' && (access === 'oa' || access === 'not-oa')
      ? new Set((access === 'oa' ? scoped.oa : scoped.parts).map((each) => each.plantId))
      : null;
  const candidates = (plants.data ?? []).filter(
    (each) => kindIds === null || kindIds.has(each.plantId),
  );
  /*
   * 공장이 지정되지 않은 계정(범위 줄에 공장이 없음)은 「전체」로 볼 수 있는 모든 공장의 교대를 본다(사용자 지시 2026-11-25).
   * 지정된 계정은 위 규칙대로 그 공장을 자동으로 고른다.
   */
  const designated = (session?.scopes ?? NO_SCOPES).some((scope) => scope.plantId !== undefined);
  const plantOptions = designated ? candidates : (plants.data ?? []);
  const [pickedPlant, setPickedPlant] = useState<number | null>(null);
  const plant = designated
    ? (candidates.find((each) => each.plantId === pickedPlant) ?? candidates[0] ?? null)
    : (plantOptions.find((each) => each.plantId === pickedPlant) ?? null);
  const showAll = !designated && plant === null;
  const plantId = plant?.plantId ?? null;
  const list = useShifts(showAll ? (plants.data === undefined ? null : 'all') : plantId);
  const plantName = new Map(plantOptions.map((each) => [each.plantId, each.plantName]));
  /* 추가 창이 처음 고를 공장 — 고른 공장, 「전체」면 위 줄 동작(OA · 부품)의 첫 공장. */
  const defaultPlant = plant ?? candidates[0] ?? plantOptions[0] ?? null;
  /** 교대 코드 · 교대명 검색 — 칸에 친 글(`searchDraft`)은 [조회] · Enter 때 목록에 건다(`query`). */
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  /* [초기화]는 조건이 처음과 다를 때만(C-6). */
  const isChanged = searchDraft !== '' || query !== '' || pickedPlant !== null;
  /** 사용 유무 라벨 — `null` 이면 둘 다 보인다. 공장을 바꾸면 풀린다. */
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | null>(null);
  /* 목록은 한 번에 다 받으므로 쪽 넘김은 화면에서 자른다. 조건이 바뀌면 첫 쪽으로. */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ShiftPageSize>(20);
  const [conditionKey, setConditionKey] = useState('');
  const currentKey = `${String(plantId)}|${query}|${String(statusFilter)}`;
  if (conditionKey !== currentKey) {
    setConditionKey(currentKey);
    setPage(1);
  }

  /** 열린 창 — `null` 닫힘, `'new'` 추가. */
  const [editing, setEditing] = useState<Shift | 'new' | null>(null);
  const [retiring, setRetiring] = useState<Shift | null>(null);
  /* 사용 중지는 상세의 잠금 토큰(ETag)으로 보낸다 — 확인 창이 열리면 상세를 받는다. */
  const retiringDetail = useShiftDetail(retiring?.shiftId ?? null);

  const deactivate = useDeactivateShift(retiring?.shiftId ?? null, () => {
    setRetiring(null);
    toast.show({ variant: 'success', description: t.toast.deactivated });
  });

  const baseColumns: Column<Shift>[] = [
    ...(showAll
      ? [
          {
            key: 'plant',
            header: t.columns.plant,
            align: 'center' as const,
            render: (row: Shift) => plantName.get(row.plantId) ?? '',
          },
        ]
      : []),
    { key: 'code', header: t.columns.code, align: 'center', render: (row) => row.shiftCode },
    { key: 'name', header: t.columns.name, align: 'center', render: (row) => row.shiftName },
    {
      key: 'start',
      header: t.columns.start,
      align: 'center',
      render: (row) => hhmm(row.startTime),
    },
    {
      key: 'end',
      header: t.columns.end,
      align: 'center',
      render: (row) =>
        row.crossesMidnight ? t.values.nextDayEnd(hhmm(row.endTime)) : hhmm(row.endTime),
    },
    {
      key: 'status',
      header: t.columns.status,
      align: 'center',
      render: (row) => (
        <Chip variant="status" size="sm" status={row.isActive ? 'success' : 'idle'}>
          {row.isActive ? t.chips.active : t.chips.inactive}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: t.columns.actions,
      align: 'center',
      /* 사용 중지한 교대는 다시 쓰게 하는 기능이 없어 관리 단추를 두지 않는다(#318 범위). */
      render: (row) =>
        !row.isActive ? null : (
          <span className="shift-management-row-actions">
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.editRow(row.shiftName)}
              onClick={() => setEditing(row)}
            >
              {t.edit}
            </Button>
            <Button
              variant="outlined"
              size="sm"
              aria-label={t.deactivateRow(row.shiftName)}
              onClick={() => {
                deactivate.reset();
                setRetiring(row);
              }}
            >
              {t.deactivate}
            </Button>
          </span>
        ),
    },
  ];
  const ordered = useColumnOrder('omf-mes:shift-management:columns:order', baseColumns);
  const resizable = useColumnWidths('omf-mes:shift-management:columns:v2', ordered);
  const fit = useFitColumns(resizable.columns);

  /* 「전체」는 조건 없이 받으므로 볼 수 있는 공장의 교대만 남긴다. */
  const plantRows = (list.data ?? []).filter((row) => plantName.has(row.plantId));
  const needle = query.trim().toLowerCase();
  /* 검색은 받은 목록에서 거른다 — 사용 유무 라벨 건수도 검색 결과 기준이다. */
  const allRows =
    needle === ''
      ? plantRows
      : plantRows.filter(
          (row) =>
            row.shiftCode.toLowerCase().includes(needle) ||
            row.shiftName.toLowerCase().includes(needle),
        );
  const activeCount = allRows.filter((row) => row.isActive).length;
  const counts = { active: activeCount, inactive: allRows.length - activeCount };
  const rows =
    statusFilter === null
      ? allRows
      : allRows.filter((row) => row.isActive === (statusFilter === 'active'));
  const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
  const shownPage = Math.min(page, lastPage);
  const pageRows = rows.slice((shownPage - 1) * pageSize, shownPage * pageSize);
  /* 0건 라벨은 숨긴다 — 걸려 있는 라벨은 0건이어도 남겨 풀 수 있게 한다. */
  const chips = (['active', 'inactive'] as const).filter(
    (status) => list.data !== undefined && (statusFilter === status || counts[status] > 0),
  );

  const listBody = (): ReactNode => {
    if (plants.isError)
      return <LoadErrorAlert error={plants.error} onRetry={() => void plants.refetch()} />;
    if (plants.isPending) return <Skeleton variant="rect" height="12rem" />;
    if (defaultPlant === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (list.isError)
      return <LoadErrorAlert error={list.error} onRetry={() => void list.refetch()} />;
    if (list.isPending) return <Skeleton variant="rect" height="12rem" />;
    return (
      <div
        ref={fit.ref}
        className="inspection-queue-table shift-management-table"
        style={resizable.style}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={pageRows}
          getRowId={(row) => String(row.shiftId)}
          aria-label={t.tableLabel}
          empty={<EmptyState size="sm" title={needle === '' ? t.empty : t.emptyFiltered} />}
        />
      </div>
    );
  };

  return (
    <>
      {chips.length > 0 && (
        <div className="shift-management-top-actions">
          <div className="inspection-hub-counts" role="group" aria-label={t.chips.label}>
            {chips.map((status) => {
              const label = t.chips[status];
              const isOn = statusFilter === status;
              return (
                <Chip
                  key={status}
                  variant="filter"
                  size="sm"
                  selected={isOn}
                  aria-pressed={isOn}
                  aria-label={isOn ? t.chips.filterOff(label) : t.chips.filterOn(label)}
                  onSelectedChange={(selected) => setStatusFilter(selected ? status : null)}
                >
                  {messages.common.inspectionHub.count(label, counts[status])}
                </Chip>
              );
            })}
          </div>
        </div>
      )}
      {/* 조회 상자는 단말 관리 · 사용자 역할 권한 관리와 같은 틀 — 칸 바닥 맞춤, 추가 단추는 줄 오른쪽 끝. */}
      <section
        className="pane users-roles-search filter-field-surface"
        aria-label={t.filters.label}
      >
        <div className="filter-bar users-roles-filter-row shift-management-filter">
          <div className="field-cell shift-management-plant">
            <span className="field-label">
              <label htmlFor={plantFieldId}>{t.filters.plant}</label>
            </span>
            <Select
              id={plantFieldId}
              value={plantId === null ? '' : String(plantId)}
              options={[
                ...(designated ? [] : [{ value: '', label: t.filters.all }]),
                ...plantOptions.map((each) => ({
                  value: String(each.plantId),
                  label: each.plantName,
                })),
              ]}
              onChange={(value) => {
                setPickedPlant(value === '' ? null : Number(value));
                setStatusFilter(null);
              }}
            />
          </div>
          <SearchInput
            containerClassName="shift-management-search"
            label={t.filters.search}
            value={searchDraft}
            placeholder={t.filters.searchPlaceholder}
            onChange={(event) => setSearchDraft(event.target.value)}
            onSearch={(value) => {
              setQuery(value);
              setStatusFilter(null);
            }}
            clearLabel={messages.common.clear}
          />
          {/* [조회] → [초기화] 순, [초기화]는 조건이 바뀌었을 때만. 교대 추가와는 세로선으로 나눈다(단말 관리와 같다). */}
          <div className="filter-actions field-cell-unlabeled">
            <Button
              onClick={() => {
                setQuery(searchDraft);
                setStatusFilter(null);
              }}
            >
              {t.filters.apply}
            </Button>
            {isChanged && (
              <Button
                variant="outlined"
                onClick={() => {
                  setSearchDraft('');
                  setQuery('');
                  setPickedPlant(null);
                  setStatusFilter(null);
                }}
              >
                {t.filters.clear}
              </Button>
            )}
          </div>
          {/* 볼 수 있는 공장이 없으면 목록이 그 사유를 말한다 — 추가 단추는 두지 않는다. */}
          {defaultPlant !== null && (
            <Button
              className="shift-management-add"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={() => setEditing('new')}
            >
              {t.add}
            </Button>
          )}
        </div>
      </section>
      <section className="pane shift-management-list-pane" aria-label={t.tableLabel}>
        <div className="po-board-list-head">
          <h2 className="pane-title">{t.tableLabel}</h2>
          {list.data !== undefined && (
            <span className="po-board-list-count">
              {messages.common.paneList.count(rows.length)}
            </span>
          )}
          {/* 안내는 아이콘만 — 마우스를 올리면 문장이 뜬다(사용자 지시 2026-11-25). */}
          <InfoTip text={t.intro} />
        </div>
        {listBody()}
        {list.data !== undefined && (
          <PageNav<ShiftPageSize>
            meta={{ page: shownPage, size: pageSize, total: rows.length }}
            sizes={PAGE_SIZES}
            buttonSize="md"
            onChangePage={setPage}
            onChangeSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        )}
      </section>
      {editing !== null && defaultPlant !== null && (
        <EditDialog
          plants={editing === 'new' && showAll ? plantOptions : []}
          plant={
            editing === 'new'
              ? defaultPlant
              : {
                  plantId: editing.plantId,
                  plantName: plantName.get(editing.plantId) ?? '',
                }
          }
          shift={editing === 'new' ? null : editing}
          existingShifts={plantRows}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            toast.show({ variant: 'success', description: t.toast.saved });
          }}
        />
      )}
      <Dialog
        open={retiring !== null}
        onClose={() => setRetiring(null)}
        title={t.deactivateDialog.title(retiring?.shiftName ?? '')}
        size="sm"
        showCloseButton={false}
        footer={
          <>
            <Button variant="outlined" onClick={() => setRetiring(null)}>
              {t.deactivateDialog.cancel}
            </Button>
            <Button
              loading={deactivate.isSaving}
              disabled={retiringDetail.data === undefined}
              onClick={() => deactivate.write()}
            >
              {t.deactivateDialog.confirm}
            </Button>
          </>
        }
      >
        {retiring !== null && (
          <p className="dialog-text">{t.deactivateDialog.body(retiring.shiftName)}</p>
        )}
        {retiringDetail.isError && (
          <LoadErrorAlert
            error={retiringDetail.error}
            onRetry={() => void retiringDetail.refetch()}
          />
        )}
        {deactivate.error !== null && <SaveErrorBanner error={deactivate.error} />}
      </Dialog>
    </>
  );
};
