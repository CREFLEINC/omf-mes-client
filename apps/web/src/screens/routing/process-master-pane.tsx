import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  Dialog,
  EmptyState,
  SkeletonText,
  Table,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import {
  SaveErrorBanner,
  codeLockMessage,
  requireIfMatch,
  useMasterWrite,
} from '../../patterns/master';
import { TAB_PAGE_SIZES, type TabPageSize } from '../../patterns/client-page';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { PageNav, type PageNavMeta } from '../../patterns/page-nav';
import { PaneEmptyIcon } from '../../patterns/pane-empty-icon';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { runRequest, toApiError } from '../../patterns/request';
import { PagedSelect, Select } from '../../patterns/select';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  emptyProcessFormValues,
  isSameProcessValues,
  processToFormValues,
  toProcessCreate,
  toProcessUpdate,
} from './process-master';
import { FieldLabel } from './field-label';
import { LeaveGuard } from './leave-guard';
import { PROCESS_FORM_FIELDS, validateProcess } from './process-validation';
import {
  type ListPaging,
  processDetailPath,
  processKeys,
  processListScope,
  useProcessActiveCounts,
  useProcessDetail,
  useProcessList,
  useProcessTypeOptions,
} from './queries';
import { ROUTING_ORIENTATION_KEY } from './split-layout';
import type {
  Process,
  ProcessActiveState,
  ProcessDetailResponse,
  ProcessFilters,
  ProcessFormValues,
} from './types';
import { centerColumns } from './table-align';

const t = messages.routing;
const hubText = messages.common.inspectionHub;

/** 바뀌면 편집 대상(공정 · 추가 중)이 바뀌는 질의 — 「뒤로」로 이 값만 바뀌어도 편집이 사라져 묻는다. */
const PROCESS_EDIT_TARGET_PARAMS = ['sel', 'mode'] as const;

const DEFAULT_FILTERS: ProcessFilters = { q: '', processTypeCode: '', activeState: '' };

/** 사용 여부 라벨(#231) — 「전체」는 두지 않는다. 고른 라벨을 한 번 더 누르면 거르기를 푼다(공정 경로 상태 라벨과 같다). */
const ACTIVE_CHIPS: { value: Exclude<ProcessActiveState, ''>; label: string }[] = [
  { value: 'ACTIVE', label: t.values.active },
  { value: 'INACTIVE', label: t.values.inactive },
];

/** 공정 검색 칸이 한 번에 받는 건수 — 목록 끝에 닿으면 다음 쪽을 받는다. */
const PROCESS_SEARCH_PAGE_SIZE = 20;

interface ProcessFormState {
  source: 'create' | ProcessDetailResponse;
  baseline: ProcessFormValues;
  values: ProcessFormValues;
}

type ActivationIntent = 'activate' | 'deactivate';

const describeLoadError = (error: ApiError): string => {
  switch (error.kind) {
    case 'network':
      return messages.httpError.offline;
    case 'http':
      if (error.status === 403) return messages.httpError.forbidden;
      return error.message === undefined || error.message === ''
        ? messages.httpError.description
        : error.message;
    case 'conflict':
      return error.message === '' ? messages.httpError.description : error.message;
    case 'stateLocked':
    case 'validation': {
      const lines = error.errors.map((item) => item.message).join(' ');
      return lines === '' ? messages.httpError.description : lines;
    }
  }
};

const LoadErrorBanner = ({ error, onRetry }: { error: unknown; onRetry: () => void }) => (
  <div className="banner-slot">
    <AlertBanner
      variant="error"
      title={messages.httpError.loadTitle}
      action={
        <Button variant="outlined" size="sm" onClick={onRetry}>
          {messages.common.retry}
        </Button>
      }
    >
      {describeLoadError(toApiError(error))}
    </AlertBanner>
  </div>
);

/** W-06-01의 두 번째 축. 품목과 무관한 공정 마스터를 목록과 편집 페인으로 관리한다. */
export const ProcessMasterPane = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { client } = useApiClient();
  const toast = useToast();
  /* 조회 상자 · 목록 | 상세 — 공정 경로 탭과 같은 분할 · 같은 배치(#231). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:routing:process-split', 0.45);
  const layout = useSplitOrientation(ROUTING_ORIENTATION_KEY);

  const filters = useMemo<ProcessFilters>(
    () => ({
      q: searchParams.get('q') ?? '',
      processTypeCode: searchParams.get('type') ?? '',
      activeState:
        searchParams.get('active') === '1'
          ? 'ACTIVE'
          : searchParams.get('active') === '0'
            ? 'INACTIVE'
            : '',
    }),
    [searchParams],
  );
  /* 공정 목록 쪽 — 주소가 소유한다(#231). */
  const paging = useMemo<ListPaging>(
    () => ({
      page: Math.max(1, Number(searchParams.get('page')) || 1),
      size: TAB_PAGE_SIZES.find((size) => String(size) === searchParams.get('size')) ?? 20,
    }),
    [searchParams],
  );
  /* 공정 추가는 팝업(사용자 지시 · #231) — 뒤에 고른 공정은 그대로 두고 주소의 `mode` 로 연다(뒤로가기로 닫힌다). */
  const isCreateOpen = searchParams.get('mode') === 'create';
  const selectedId = Number(searchParams.get('sel') ?? '') || null;

  const list = useProcessList(filters, paging);
  const processes = list.data?.items ?? [];
  const detail = useProcessDetail(selectedId);
  const typeOptions = useProcessTypeOptions();

  const [formState, setFormState] = useState<ProcessFormState | null>(null);
  /* 보기 · 수정 — 다른 공정을 고르면 다시 보기로 연다(#231). */
  const [isEditing, setIsEditing] = useState(false);
  const [editingFor, setEditingFor] = useState(selectedId);
  if (editingFor !== selectedId) {
    setEditingFor(selectedId);
    setIsEditing(false);
  }
  const formSource: ProcessFormState['source'] | null = detail.data ?? null;

  if (formSource === null) {
    if (formState !== null) setFormState(null);
  } else if (formState?.source !== formSource) {
    const seeded = processToFormValues(formSource.process);
    setFormState({ source: formSource, baseline: seeded, values: seeded });
  }

  const values = formState?.values ?? emptyProcessFormValues();
  const isDirty = formState !== null && !isSameProcessValues(values, formState.baseline);
  const [localErrors, setLocalErrors] = useState<Partial<Record<keyof ProcessFormValues, string>>>(
    {},
  );

  /** 저장 직후의 이동(새 공정을 고른 상태로)은 묻지 않는다 — 이동이 끝나면 되돌린다. */
  const savedMoveRef = useRef(false);
  useEffect(() => {
    savedMoveRef.current = false;
  }, [searchParams]);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  };

  const write = useMasterWrite<ProcessFormValues, Process>({
    request: (nextValues, headers) =>
      client.PUT('/mdm/processes/{processId}', {
        params: {
          path: { processId: selectedId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body: toProcessUpdate(nextValues),
      }),
    etagPath: selectedId === null ? null : processDetailPath(selectedId),
    invalidateKeys: [processKeys.all],
    knownFields: PROCESS_FORM_FIELDS,
    onSuccess: (saved) => {
      setLocalErrors({});
      const seeded = processToFormValues(saved);
      setFormState((current) =>
        current === null ? current : { source: current.source, baseline: seeded, values: seeded },
      );
      setIsEditing(false);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const [activationIntent, setActivationIntent] = useState<ActivationIntent | null>(null);
  const activationWrite = useMasterWrite<ActivationIntent, Process>({
    request: (intent, headers) =>
      intent === 'deactivate'
        ? client.POST('/mdm/processes/{processId}:deactivate', {
            params: {
              path: { processId: selectedId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': requireIfMatch(headers),
              },
            },
          })
        : client.POST('/mdm/processes/{processId}:activate', {
            params: {
              path: { processId: selectedId ?? 0 },
              header: {
                'Idempotency-Key': headers['Idempotency-Key'],
                'If-Match': requireIfMatch(headers),
              },
            },
          }),
    etagPath: selectedId === null ? null : processDetailPath(selectedId),
    invalidateKeys: [processKeys.all],
    knownFields: [],
    onSuccess: () => {
      setActivationIntent(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  const applyFilters = (nextFilters: ProcessFilters) => {
    updateParams({
      q: nextFilters.q === '' ? null : nextFilters.q,
      type: nextFilters.processTypeCode === '' ? null : nextFilters.processTypeCode,
      /* 「미사용 포함」 확인칸은 사용 여부 라벨로 바뀌었다(#231) — 옛 주소 값은 지운다. */
      inactive: null,
      active:
        nextFilters.activeState === '' ? null : nextFilters.activeState === 'ACTIVE' ? '1' : '0',
      /* 조건이 바뀌면 첫 쪽부터 본다. */
      page: null,
      sel: null,
      mode: null,
    });
  };

  const changeValues = (patch: Partial<ProcessFormValues>) => {
    setFormState((current) =>
      current === null ? current : { ...current, values: { ...current.values, ...patch } },
    );
    for (const field of Object.keys(patch) as (keyof ProcessFormValues)[]) {
      write.clearFieldError(field);
      setLocalErrors((current) => {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const handleSave = () => {
    const errors = validateProcess(values);
    setLocalErrors(errors);
    if (Object.keys(errors).length === 0) write.write(values);
  };

  const reloadDetail = () => {
    write.reset();
    activationWrite.reset();
    setLocalErrors({});
    setFormState(null);
    void detail.refetch();
  };

  const columns: Column<Process>[] = [
    {
      key: 'processCode',
      header: t.fields.processCode,
      /* 코드는 본문 글자 — 줄 아무 곳이나 눌러 고른다. 단추는 키보드·화면 낭독기 길이자 고른 줄 표시 자리다(#231). */
      render: (process) => (
        <button
          type="button"
          className="inspection-standard-plan-open routing-process-open"
          aria-current={process.processId === selectedId ? 'true' : undefined}
          title={process.processCode}
          /* 고른 줄을 한 번 더 누르면 선택을 푼다(사용자 지시 · #231). */
          onClick={() =>
            updateParams({
              sel: process.processId === selectedId ? null : String(process.processId),
              mode: null,
            })
          }
        >
          {process.processCode}
        </button>
      ),
    },
    { key: 'processName', header: t.fields.processName },
    {
      key: 'processTypeCode',
      header: t.fields.processType,
      render: (process) =>
        typeOptions.data?.find((option) => option.value === process.processTypeCode)?.label ??
        process.processTypeCode,
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      /* 사용 여부는 작은 라벨 — 공정 경로 목록의 상태 라벨과 같은 모양(사용자 지시 · #231). */
      render: (process) => (
        <Chip variant="status" size="sm" status={process.isActive ? 'success' : 'idle'}>
          {process.isActive ? t.values.active : t.values.inactive}
        </Chip>
      ),
    },
  ];

  return (
    <>
      {/*
       * 공정 추가 · 편집 중 저장하지 않고 옮기면 묻는다(사용자 지시 · #231) — 다른 공정 · 공정 추가 · 조회 조건(고른 공정이
       * 풀린다) · 다른 탭 · 메뉴 · 뒤로가기. 새로 고침 · 탭 닫기는 브라우저가 묻는다. 공정 경로 탭과 같은 확인 창.
       */}
      <LeaveGuard
        when={isDirty}
        watchedParams={PROCESS_EDIT_TARGET_PARAMS}
        bypassRef={savedMoveRef}
        discardBody={t.discard.bodyProcess}
        showCloseButton={false}
      />
      {/* 사용 여부 라벨은 탭 줄에서 배치 단추 왼쪽 — 먼저 그려야 같은 자리에서 앞에 선다(공정 경로 탭과 같다 · #231). */}
      <ProcessActiveChips filters={filters} onApplyFilters={applyFilters} />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />

      {/* 조회 조건 — 목록과 다른 상자에 둔다. 「공정 추가」는 조회 · 초기화 뒤 구분선 너머에 선다(#231). */}
      <section
        ref={aboveRef}
        className="pane inspection-standard-search routing-search"
        role="search"
      >
        <ProcessFilterBar
          filters={filters}
          typeOptions={typeOptions.data ?? []}
          onApplyFilters={applyFilters}
          onAdd={() => updateParams({ mode: 'create' })}
        />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split routing-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <ProcessListPane
          processes={processes}
          columns={columns}
          filters={filters}
          isLoading={list.isPending}
          loadError={
            list.isError ? (
              <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
            ) : null
          }
          pageMeta={list.data?.page ?? { ...paging, total: 0 }}
          onChangePage={(page) => updateParams({ page: page === 1 ? null : String(page) })}
          onChangePageSize={(size) =>
            updateParams({ page: null, size: size === 20 ? null : String(size) })
          }
        />

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <div className="inspection-standard-detail routing-detail">
          {/*
           * 공정 경로 탭의 상세 카드와 같은 모양(사용자 지시 · #231) — 머리 왼쪽 제목, 오른쪽 「사용 · 미사용」 라벨과
           * 사용 중지 · 다시 사용 단추. 아래는 입력칸, 맨 아래 오른쪽 [취소][저장].
           */}
          <section className="pane routing-detail-card" aria-label={t.panes.processForm}>
            <div className="routing-card-head">
              <h2 className="pane-title routing-card-title">{t.panes.processForm}</h2>
              {detail.data !== undefined && (
                <div className="routing-card-section-tools">
                  <Chip variant="status" status={detail.data.process.isActive ? 'success' : 'idle'}>
                    {detail.data.process.isActive ? t.values.active : t.values.inactive}
                  </Chip>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      activationWrite.reset();
                      setActivationIntent(
                        detail.data?.process.isActive === false ? 'activate' : 'deactivate',
                      );
                    }}
                  >
                    {detail.data.process.isActive
                      ? messages.common.deactivate
                      : t.actions.activateProcess}
                  </Button>
                </div>
              )}
            </div>
            <ProcessFormSlot
              isEditing={isEditing}
              onEdit={() => setIsEditing(true)}
              selectedId={selectedId}
              detail={detail}
              formState={formState}
              values={values}
              fieldErrors={{ ...write.fieldErrors, ...localErrors }}
              typeOptions={typeOptions.data ?? []}
              typeOptionsError={typeOptions.isError}
              isDirty={isDirty}
              isSaving={write.isSaving}
              writeError={write.error}
              onChange={changeValues}
              onSave={handleSave}
              onCancel={() => {
                write.reset();
                setLocalErrors({});
                setFormState((current) =>
                  current === null ? current : { ...current, values: current.baseline },
                );
                setIsEditing(false);
              }}
              onReload={reloadDetail}
            />
          </section>
        </div>
      </div>

      {isCreateOpen && (
        <ProcessCreateDialog
          typeOptions={typeOptions.data ?? []}
          onClose={() => updateParams({ mode: null })}
          onCreated={(saved) => {
            /* 저장하면 팝업을 닫고 새 공정을 골라 오른쪽 상자에 보인다(사용자 지시 · #231). */
            savedMoveRef.current = true;
            updateParams({ mode: null, sel: String(saved.processId) });
            toast.show({ variant: 'success', description: messages.common.saved });
          }}
        />
      )}

      <ProcessActivationDialog
        intent={activationIntent}
        referenceCount={detail.data?.editability.referenceCount ?? null}
        isSaving={activationWrite.isSaving}
        banner={<SaveErrorBanner error={activationWrite.error} onReload={reloadDetail} />}
        onClose={() => setActivationIntent(null)}
        onConfirm={() => {
          if (activationIntent !== null) activationWrite.write(activationIntent);
        }}
      />
    </>
  );
};

/** 사용 · 미사용 라벨 — 누르면 그 값만, 고른 라벨을 다시 누르면 푼다. 건수는 지금 검색어 기준(#231). */
const ProcessActiveChips = ({
  filters,
  onApplyFilters,
}: {
  filters: ProcessFilters;
  onApplyFilters: (filters: ProcessFilters) => void;
}) => {
  const target = useHubActionsTarget();
  const counts = useProcessActiveCounts(
    filters.q,
    filters.processTypeCode,
    ACTIVE_CHIPS.map((chip) => chip.value),
  );
  const group = (
    <div className="inspection-hub-counts" role="group" aria-label={t.fields.isActive}>
      {ACTIVE_CHIPS.map((chip, index) => {
        const isSelected = filters.activeState === chip.value;
        const count = counts[index];
        return (
          <Chip
            key={chip.value}
            variant="filter"
            size="sm"
            selected={isSelected}
            aria-pressed={isSelected}
            onSelectedChange={() =>
              onApplyFilters({ ...filters, activeState: isSelected ? '' : chip.value })
            }
          >
            {count === undefined
              ? chip.label
              : messages.common.inspectionHub.count(chip.label, count)}
          </Chip>
        );
      })}
    </div>
  );
  return target === null ? group : <HubActions target={target}>{group}</HubActions>;
};

interface ProcessFilterBarProps {
  filters: ProcessFilters;
  /** 공정 유형 선택지(공통코드 PROCESS_TYPE). 앞에 「전체」를 붙인다. */
  typeOptions: { value: string; label: string }[];
  onApplyFilters: (filters: ProcessFilters) => void;
  onAdd: () => void;
}

/** 공정 조회 조건 — 검색 · 공정 유형 · 조회 · 초기화 | 공정 추가. */
const ProcessFilterBar = ({
  filters,
  typeOptions,
  onApplyFilters,
  onAdd,
}: ProcessFilterBarProps) => {
  const { client } = useApiClient();
  const searchId = useId();
  const typeId = useId();
  const [draft, setDraft] = useState(filters.q);
  /* 공정 유형도 검색어처럼 「조회」를 눌러야 걸린다(사용자 지시 · #231). */
  const [typeDraft, setTypeDraft] = useState(filters.processTypeCode);

  useEffect(() => setDraft(filters.q), [filters.q]);
  useEffect(() => setTypeDraft(filters.processTypeCode), [filters.processTypeCode]);

  return (
    <div className="filter-bar routing-process-filter">
      {/* 공정 유형을 먼저, 그다음 공정 검색(사용자 지시 · #231). */}
      <div className="field-cell">
        <label className="field-label" htmlFor={typeId}>
          {t.fields.processType}
        </label>
        <Select
          id={typeId}
          options={[{ value: '', label: t.filters.all }, ...typeOptions]}
          value={typeDraft}
          onChange={(value) => setTypeDraft(value ?? '')}
        />
      </div>
      {/*
       * 공정은 칸에서 바로 검색해서 고른다(다른 화면과 같다 · #226 · #231) — 고른 공정코드가 검색어로 들어간다.
       * 「전체」는 조건을 푼다. 조회를 눌러야 목록에 걸린다(종전 검색어와 같은 트리거 · 같은 서버 조건 `q`).
       */}
      <div className="field-cell search-select-cell">
        <label className="field-label" htmlFor={searchId}>
          {t.filters.processSearchLabel}
        </label>
        <PagedSelect
          id={searchId}
          queryKey={[
            'routing-processes',
            'process-select',
            filters.activeState,
            filters.processTypeCode,
          ]}
          fetchPage={async (q, page) => {
            const data = await runRequest(() =>
              client.GET('/mdm/processes', {
                params: {
                  query: {
                    ...(q === '' ? {} : { q }),
                    /* 목록과 같은 범위에서 찾는다 — 목록에 없는 공정을 고르지 않게. */
                    ...processListScope(filters.activeState),
                    ...(filters.processTypeCode === ''
                      ? {}
                      : { processTypeCode: filters.processTypeCode }),
                    page,
                    size: PROCESS_SEARCH_PAGE_SIZE,
                  },
                },
              }),
            );
            return {
              options: data.items.map((process) => ({
                value: process.processCode,
                label: `${process.processCode} · ${process.processName}`,
              })),
              total: data.page.total,
            };
          }}
          selectedOption={draft === '' ? null : { value: draft, label: draft }}
          leadingOptions={[{ value: '', label: t.filters.all }]}
          value={draft}
          placeholder={t.filters.all}
          onChange={setDraft}
        />
      </div>
      <div className="filter-actions field-cell-unlabeled">
        <Button
          onClick={() => onApplyFilters({ ...filters, q: draft, processTypeCode: typeDraft })}
        >
          {messages.common.search}
        </Button>
        <Button variant="outlined" onClick={() => onApplyFilters(DEFAULT_FILTERS)}>
          {messages.common.reset}
        </Button>
        <span className="inspection-standard-filter-divider" aria-hidden />
        <Button onClick={onAdd}>{t.actions.addProcess}</Button>
      </div>
    </div>
  );
};

interface ProcessListPaneProps {
  processes: Process[];
  columns: Column<Process>[];
  filters: ProcessFilters;
  isLoading: boolean;
  loadError: ReactNode;
  /** 쪽 이동 줄 — 총 건수 · 건수 고르기 · 처음/이전/다음/마지막(#231). */
  pageMeta: PageNavMeta;
  onChangePage: (page: number) => void;
  onChangePageSize: (size: TabPageSize) => void;
}

const ProcessListPane = ({
  processes,
  columns,
  filters,
  isLoading,
  loadError,
  pageMeta,
  onChangePage,
  onChangePageSize,
}: ProcessListPaneProps) => {
  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다(표 공통 · #231). */
  const ordered = useColumnOrder('omf-mes:routing:process-columns:order', centerColumns(columns));
  const resizable = useColumnWidths('omf-mes:routing:process-columns', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  let listSlot: ReactNode;
  if (loadError !== null && loadError !== undefined) listSlot = loadError;
  else if (isLoading) {
    listSlot = (
      <div role="status" aria-label={t.loading.processes}>
        <SkeletonText lines={5} />
      </div>
    );
  } else if (processes.length === 0) {
    /*
     * 빈 목록은 빈 표 머리 대신 아이콘 안내 하나 — 상세의 「공정을 고르거나…」와 같은 모양으로 가운데에(사용자 지시 · #231).
     */
    const isFiltered =
      filters.q !== '' || filters.processTypeCode !== '' || filters.activeState !== '';
    listSlot = (
      <div className="routing-detail-empty">
        <EmptyState
          size="sm"
          live
          icon={<PaneEmptyIcon name="layers" />}
          title={isFiltered ? t.empty.processNoMatchTitle : t.empty.processNoneTitle}
          description={
            isFiltered ? t.empty.processNoMatchDescription : t.empty.processNoneDescription
          }
        />
      </div>
    );
  } else {
    listSlot = (
      /* 줄 아무 곳이나 눌러도 고른다 — DS 표에 줄 클릭이 없어 눌린 줄의 코드 단추로 넘긴다. */
      <div
        ref={fit.ref}
        className="inspection-queue-table inspection-standard-plan-rows inspection-standard-table-box wide-table"
        style={resizable.style}
        onClick={(event) => {
          const target = event.target as Element;
          if (target.closest('button, a, input, select, textarea') !== null) return;
          target
            .closest('tbody tr')
            ?.querySelector<HTMLButtonElement>('.routing-process-open')
            ?.click();
        }}
      >
        <Table
          density="compact"
          columns={fit.columns}
          rows={processes}
          getRowId={(process) => String(process.processId)}
        />
      </div>
    );
  }

  return (
    <section
      className="pane inspection-standard-list-pane routing-process-list-pane"
      aria-label={t.panes.processList}
    >
      {/* 제목 글은 두지 않는다 — 공정 경로 탭의 품목 목록과 같다(사용자 지시 · #231). 이름은 구역의 aria-label 이 갖는다. */}
      {listSlot}

      {(loadError === null || loadError === undefined) && !isLoading && (
        <PageNav
          meta={pageMeta}
          buttonSize="md"
          sizes={TAB_PAGE_SIZES}
          onChangePage={onChangePage}
          onChangeSize={onChangePageSize}
        />
      )}
    </section>
  );
};

interface ProcessFormSlotProps {
  /** 고르면 먼저 보기만 하고 [수정]을 눌러야 입력칸이 열린다(사용자 지시 · #231). */
  isEditing: boolean;
  onEdit: () => void;
  selectedId: number | null;
  detail: ReturnType<typeof useProcessDetail>;
  formState: ProcessFormState | null;
  values: ProcessFormValues;
  fieldErrors: Partial<Record<keyof ProcessFormValues, string>>;
  typeOptions: { value: string; label: string }[];
  typeOptionsError: boolean;
  isDirty: boolean;
  isSaving: boolean;
  writeError: ApiError | null;
  onChange: (patch: Partial<ProcessFormValues>) => void;
  onSave: () => void;
  onCancel: () => void;
  onReload: () => void;
}

const ProcessFormSlot = ({
  isEditing,
  onEdit,
  selectedId,
  detail,
  formState,
  values,
  fieldErrors,
  typeOptions,
  typeOptionsError,
  isDirty,
  isSaving,
  writeError,
  onChange,
  onSave,
  onCancel,
  onReload,
}: ProcessFormSlotProps): ReactNode => {
  const typeId = useId();
  const codeId = useId();
  const nameId = useId();
  const codeLockNoteId = useId();
  const typeErrorId = `${typeId}-error`;

  if (selectedId === null) {
    /* 공정 경로 탭의 빈 안내와 같은 모양 — 아이콘 · 제목(#231). */
    return (
      <div className="routing-detail-empty">
        <EmptyState
          size="sm"
          icon={<PaneEmptyIcon name="layers" />}
          title={t.empty.processNotSelected}
        />
      </div>
    );
  }
  if (detail.isError) {
    return <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />;
  }
  if (formState === null) {
    return (
      <div role="status" aria-label={t.loading.processDetail}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  const codeLockReason =
    detail.data !== undefined ? codeLockMessage(detail.data.editability) : null;

  /* 보기 — 같은 요약 줄에 값만, 아래 오른쪽 [수정](사용자 지시 · #231). */
  if (!isEditing) {
    const typeLabel =
      typeOptions.find((option) => option.value === values.processTypeCode)?.label ??
      values.processTypeCode;
    return (
      <>
        <div className="routing-code-line routing-process-form">
          <div className="routing-fact">
            <span className="field-label">{t.fields.processCode}</span>
            <span className="routing-code-value">{values.processCode}</span>
          </div>
          <div className="routing-fact routing-fact-wide">
            <span className="field-label">{t.fields.processName}</span>
            <span className="routing-fact-item-name" title={values.processName}>
              {values.processName}
            </span>
          </div>
          <div className="routing-fact">
            <span className="field-label">{t.fields.processType}</span>
            <span className="routing-code-value">{typeLabel}</span>
          </div>
        </div>
        <div className="form-actions">
          <Button variant="outlined" onClick={onEdit}>
            {t.actions.editProcess}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {typeOptionsError && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      )}
      <SaveErrorBanner error={writeError} onReload={onReload} />
      {/*
       * 공정코드 · 공정명 · 공정 유형 요약 줄 — 공정 경로 탭의 「품목코드 | 품목명 | Routing 코드」 줄과 같은 모양
       * (테두리 상자 · 칸마다 이름 위 · 입력 아래 · 칸 사이 세로 구분선 · 사용자 지시 · #231).
       */}
      <div className="routing-code-line routing-process-form">
        <div className="routing-fact">
          <FieldLabel htmlFor={codeId} label={t.fields.processCode} required />
          <div className="routing-fact-value">
            <TextField
              id={codeId}
              value={values.processCode}
              onChange={(event) => onChange({ processCode: event.target.value })}
              disabled={codeLockReason !== null}
              error={fieldErrors.processCode}
              aria-required
              /* 필수인데 비어 있으면 빨간 테두리(사용자 지시 · #231). */
              containerClassName={
                values.processCode.trim() === '' ? 'routing-required-empty' : undefined
              }
              {...(codeLockReason === null ? {} : { 'aria-describedby': codeLockNoteId })}
            />
            {/* 코드 잠금 사유는 긴 문장 대신 라벨로(Routing 코드와 같다 · #231) — 문장은 라벨 위 마우스 · 숨긴 글. */}
            {codeLockReason !== null && (
              <>
                <span title={codeLockReason}>
                  <Chip variant="status" status="idle" aria-hidden="true">
                    {t.values.codeLockedBadge}
                  </Chip>
                </span>
                <span id={codeLockNoteId} className="visually-hidden">
                  {codeLockReason}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="routing-fact routing-fact-wide">
          <FieldLabel htmlFor={nameId} label={t.fields.processName} required />
          <div className="routing-fact-value">
            <TextField
              id={nameId}
              value={values.processName}
              onChange={(event) => onChange({ processName: event.target.value })}
              error={fieldErrors.processName}
              aria-required
              containerClassName={
                values.processName.trim() === '' ? 'routing-required-empty' : undefined
              }
            />
          </div>
        </div>
        <div className="routing-fact">
          <FieldLabel htmlFor={typeId} label={t.fields.processType} required />
          <div className="routing-fact-value">
            <Select
              id={typeId}
              value={values.processTypeCode}
              options={typeOptions}
              onChange={(value) => onChange({ processTypeCode: value })}
              invalid={fieldErrors.processTypeCode !== undefined || values.processTypeCode === ''}
              aria-required
              aria-describedby={fieldErrors.processTypeCode === undefined ? undefined : typeErrorId}
            />
          </div>
          {fieldErrors.processTypeCode !== undefined && (
            <span id={typeErrorId} className="field-error">
              {fieldErrors.processTypeCode}
            </span>
          )}
        </div>
      </div>
      <div className="form-actions">
        {/* 수정 중 취소 — 고친 값을 되돌리고 보기로 돌아간다. */}
        <Button variant="outlined" onClick={onCancel}>
          {messages.common.cancel}
        </Button>
        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={onSave}>
          {messages.common.save}
        </Button>
      </div>
    </>
  );
};

interface ProcessCreateDialogProps {
  typeOptions: { value: string; label: string }[];
  onClose: () => void;
  onCreated: (saved: Process) => void;
}

/**
 * 공정 추가 팝업(사용자 지시 · #231) — 공정코드 · 공정명 · 공정 유형을 받아 등록한다. 저장 규칙 · 검증은 종전 추가와 같다.
 * 취소 단추가 닫기라 우상단 X 는 두지 않는다. 입력이 남은 채 다른 화면으로 가면 묻는다.
 */
const ProcessCreateDialog = ({ typeOptions, onClose, onCreated }: ProcessCreateDialogProps) => {
  const { client } = useApiClient();
  const codeId = useId();
  const nameId = useId();
  const typeId = useId();
  const [values, setValues] = useState<ProcessFormValues>(emptyProcessFormValues);
  const [localErrors, setLocalErrors] = useState<Partial<Record<keyof ProcessFormValues, string>>>(
    {},
  );
  const isDirty = !isSameProcessValues(values, emptyProcessFormValues());

  const write = useMasterWrite<ProcessFormValues, Process>({
    request: (nextValues, headers) =>
      client.POST('/mdm/processes', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toProcessCreate(nextValues),
      }),
    etagPath: null,
    invalidateKeys: [processKeys.all],
    knownFields: PROCESS_FORM_FIELDS,
    onSuccess: onCreated,
  });
  const errors = { ...write.fieldErrors, ...localErrors };

  const change = (patch: Partial<ProcessFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    for (const field of Object.keys(patch) as (keyof ProcessFormValues)[]) {
      write.clearFieldError(field);
      setLocalErrors((current) => {
        if (!(field in current)) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
  };

  const save = () => {
    const found = validateProcess(values);
    setLocalErrors(found);
    if (Object.keys(found).length === 0) write.write(values);
  };

  return (
    <>
      <LeaveGuard when={isDirty} discardBody={t.discard.bodyProcess} showCloseButton={false} />
      <Dialog
        open
        size="sm"
        closeOnBackdropClick={false}
        showCloseButton={false}
        title={t.actions.addProcess}
        onClose={onClose}
        footer={
          <>
            <Button variant="outlined" onClick={onClose}>
              {messages.common.cancel}
            </Button>
            <Button disabled={write.isSaving} loading={write.isSaving} onClick={save}>
              {messages.common.save}
            </Button>
          </>
        }
      >
        <SaveErrorBanner error={write.error} />
        {/* 세 칸을 한 줄에 하나씩(사용자 지시 · #231). */}
        <div className="form-grid routing-process-create-form">
          <div className="field-cell">
            <FieldLabel htmlFor={codeId} label={t.fields.processCode} required />
            <TextField
              id={codeId}
              value={values.processCode}
              onChange={(event) => change({ processCode: event.target.value })}
              error={errors.processCode}
              aria-required
              /* 필수인데 비어 있으면 빨간 테두리(사용자 지시 · #231). */
              containerClassName={
                values.processCode.trim() === '' ? 'routing-required-empty' : undefined
              }
            />
          </div>
          <div className="field-cell">
            <FieldLabel htmlFor={nameId} label={t.fields.processName} required />
            <TextField
              id={nameId}
              value={values.processName}
              onChange={(event) => change({ processName: event.target.value })}
              error={errors.processName}
              aria-required
              containerClassName={
                values.processName.trim() === '' ? 'routing-required-empty' : undefined
              }
            />
          </div>
          <div className="field-cell">
            <FieldLabel htmlFor={typeId} label={t.fields.processType} required />
            <Select
              id={typeId}
              value={values.processTypeCode}
              options={typeOptions}
              onChange={(value) => change({ processTypeCode: value ?? '' })}
              invalid={errors.processTypeCode !== undefined || values.processTypeCode === ''}
              aria-required
              aria-describedby={
                errors.processTypeCode === undefined ? undefined : `${typeId}-error`
              }
            />
            {errors.processTypeCode !== undefined && (
              <span id={`${typeId}-error`} className="field-error">
                {errors.processTypeCode}
              </span>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
};

interface ProcessActivationDialogProps {
  intent: ActivationIntent | null;
  referenceCount: number | null;
  isSaving: boolean;
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

const ProcessActivationDialog = ({
  intent,
  referenceCount,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: ProcessActivationDialogProps) => {
  const isDeactivate = intent === 'deactivate';

  return (
    <Dialog
      open={intent !== null}
      onClose={onClose}
      size="md"
      closeOnBackdropClick={false}
      /* 취소 단추가 닫기라 우상단 X 는 두지 않는다 — 공정 경로 확인 창과 같다(#231). */
      showCloseButton={false}
      title={isDeactivate ? t.dialog.deactivateProcessTitle : t.dialog.activateProcessTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
            {isDeactivate ? messages.common.deactivate : t.actions.activateProcess}
          </Button>
        </>
      }
    >
      {banner}
      {/* 재사용은 영향 상자가 없어 설명을 보조 글로 한 줄(사용자 시안 · #231). 단추는 주 작업 색(빨강) 그대로. */}
      <p className={isDeactivate ? 'routing-obsolete-description' : 'routing-obsolete-note'}>
        {isDeactivate ? t.dialog.deactivateProcessDescription : t.dialog.activateProcessDescription}
      </p>
      {/*
       * 사용 중지의 영향 — 기존 확정 경로 유지 여부와 현재 참조 건수를 줄을 나눠 보인다(사용자 시안 · #231).
       */}
      {isDeactivate && (
        <dl className="routing-impact-box">
          <div>
            <dt>{t.dialog.deactivateImpactConfirmed}</dt>
            <dd>{t.dialog.deactivateImpactConfirmedValue}</dd>
          </div>
          {referenceCount !== null && (
            <div>
              <dt>{t.dialog.deactivateImpactReferences}</dt>
              <dd>{t.dialog.deactivateImpactReferencesValue(referenceCount)}</dd>
            </div>
          )}
        </dl>
      )}
    </Dialog>
  );
};
