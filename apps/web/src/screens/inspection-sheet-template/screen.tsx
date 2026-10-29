import {
  AlertBanner,
  Breadcrumb,
  Button,
  type Column,
  EmptyState,
  Icon,
  Chip,
  PageHeader,
  SearchInput,
  type SortState,
  Table,
  TextField,
} from '@crefle/web-ui';
import type { InspectionSheetLayoutCode, InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
import { ItemPickerDialog } from '../../patterns/item-picker';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { OaOnlyGate } from '../../patterns/oa-only-gate';
import { PageNav } from '../../patterns/page-nav';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { Select } from '../../patterns/select';
import { useSession } from '../../patterns/session';
import {
  PaneHeightSplitter,
  QUALITY_STANDARD_ORIENTATION_KEY,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  PAGE_SIZE,
  type TemplateStatusFilter,
  useBusinessUnitNames,
  useTemplate,
  useTemplates,
  useUserNames,
} from './queries';
import type { StepDraft } from './draft';
import { TemplateBasicDialog, type TemplateBasics } from './basic-dialog';
import { TemplateEditor, TemplateStatusChip } from './template-editor';
import { UsageChips, type UsageChipValue } from './usage-chips';
import { usePageHub } from '../../patterns/page-hub';

const t = messages.inspectionSheetTemplate;
const hubText = messages.common.inspectionHub;

const STATUSES: readonly InspectionSheetTemplate['statusCode'][] = [
  'DRAFT',
  'CONFIRMED',
  'OBSOLETE',
];

/** 사용 여부로 거르기 — 전체 · 사용(기본) · 미사용(#208). */
type TemplateUsage = UsageChipValue;

/** 작성중 · 확정 판은 사용, 폐기된 판은 미사용이다(#208). */
const isInUse = (row: InspectionSheetTemplate): boolean => row.statusCode !== 'OBSOLETE';

const INITIAL_FILTER = {
  status: '' as TemplateStatusFilter,
  itemId: null as number | null,
  layout: '' as InspectionSheetLayoutCode | '',
  material: '',
  usage: 'active' as TemplateUsage,
  page: 1,
  size: PAGE_SIZE,
};

/** 무엇을 펴 두었나 — 새 기준이거나 목록에서 연 기준. */
type Opened =
  { kind: 'new'; basics: TemplateBasics; seq: number } | { kind: 'existing'; id: number } | null;

/**
 * 검사표 기준(관리웹 · 품질 관리 · W-06-24 · omf-all-around#89). OA 제품 검사표의 모델별 단계·항목·머리 문구를
 * 사업부 관리자가 등록·확정한다. 확정 기준이 있어야 POP 「제품 검사표 입력」에서 그 모델의 검사표가 열린다.
 */
/** OA 공장 전용(omf-all-around#89) — 계정 범위에 OA 공장이 없으면 안내만 보이고 조회를 보내지 않는다. */
export const InspectionSheetTemplateScreen = () => (
  <OaOnlyGate title={t.title} breadcrumbRoot={t.breadcrumbRoot}>
    <InspectionSheetTemplateScreenBody />
  </OaOnlyGate>
);

const InspectionSheetTemplateScreenBody = () => {
  const hub = usePageHub();
  /* 좌우 · 상하 배치 · 폭/높이 손잡이 · 창 높이 맞춤 — 검사 기준 탭과 같다(사용자 지시 · #208). 배치는 탭 묶음이 함께 쓴다. */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:inspection-sheet-template:split', 0.4);
  const layout = useSplitOrientation(QUALITY_STANDARD_ORIENTATION_KEY);
  const statusId = useId();
  const { session } = useSession();
  const [statusInput, setStatusInput] = useState<TemplateStatusFilter>('');
  /* 모델 · 양식 · 재료 조건(사용자 지시 · #208). 모델은 품목 선택 창에서 고른다 — 검사 기준 탭의 품목 검색과 같다. */
  const [modelInput, setModelInput] = useState<{ itemId: number; label: string } | null>(null);
  const [layoutInput, setLayoutInput] = useState<InspectionSheetLayoutCode | ''>('');
  const [materialInput, setMaterialInput] = useState('');
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false);
  const layoutFilterId = useId();
  const materialFilterId = useId();
  const [filter, setFilter] = useState<{
    status: TemplateStatusFilter;
    itemId: number | null;
    layout: InspectionSheetLayoutCode | '';
    material: string;
    usage: TemplateUsage;
    page: number;
    size: number;
  }>(INITIAL_FILTER);
  /* 확정 일시 정렬 — 걸러 낸 전체 줄을 세운 뒤 쪽을 나눈다(#208). */
  const [sort, setSort] = useState<SortState | null>(null);
  const [opened, setOpened] = useState<Opened>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [stepCode, setStepCode] = useState<StepDraft['stepCode'] | null>(null);
  /** 다른 기준을 열면 단계 고름을 처음으로 돌린다. */
  const open = (next: Opened) => {
    setOpened(next);
    setStepCode(null);
  };

  const list = useTemplates(filter.status, filter.itemId);
  const detail = useTemplate(opened?.kind === 'existing' ? opened.id : null);
  const businessUnits = useBusinessUnitNames();
  /*
   * 사용 여부 · 양식 · 재료는 화면이 거른다 — 조건에 맞는 기준을 전부 받아 두었다(#208).
   * 사용 = 작성중 · 확정, 미사용 = 폐기(앞 확정 판은 새 판을 확정하면 폐기된다). 재료는 대소문자 구분 없이 일부만 맞아도 걸린다.
   */
  const materialKeyword = filter.material.trim().toLowerCase();
  const hasFilter =
    filter.layout !== '' ||
    materialKeyword !== '' ||
    filter.status !== '' ||
    filter.itemId !== null ||
    filter.usage !== 'active';
  const matched = (list.data ?? []).filter(
    (row) =>
      (filter.layout === '' || row.formLayoutCode === filter.layout) &&
      (materialKeyword === '' || (row.materialText ?? '').toLowerCase().includes(materialKeyword)),
  );
  /*
   * 표는 품목마다 한 줄 — 검사 기준 탭처럼 버전은 상세에서 고른다(사용자 지시 · #208).
   * 줄은 그 품목의 가장 높은 버전으로 그린다. 사용 여부 · 건수도 그 줄 기준이다.
   */
  const latestByItem = new Map<number, InspectionSheetTemplate>();
  for (const row of matched) {
    const prev = latestByItem.get(row.itemId);
    if (prev === undefined || row.templateVersion > prev.templateVersion) {
      latestByItem.set(row.itemId, row);
    }
  }
  const itemRows = [...latestByItem.values()];
  const usageCounts: Record<TemplateUsage, number> = {
    all: itemRows.length,
    active: itemRows.filter(isInUse).length,
    inactive: itemRows.filter((row) => !isInUse(row)).length,
  };
  const filtered = itemRows.filter(
    (row) => filter.usage === 'all' || (filter.usage === 'active') === isInUse(row),
  );
  const sorted =
    sort === null
      ? filtered
      : [...filtered].sort((left, right) => {
          const order = (left.confirmedAt ?? '').localeCompare(right.confirmedAt ?? '');
          return sort.direction === 'ascending' ? order : -order;
        });
  const rows = sorted.slice((filter.page - 1) * filter.size, filter.page * filter.size);
  const userNameOf = useUserNames(rows.map((row) => row.confirmedBy));
  const scopeIds = (session?.scopes ?? []).map((scope) => scope.businessUnitId);
  const names = businessUnits.data ?? new Map<number, string>();

  /* 연 기준의 품목 — 표의 고른 줄 표시와 상세의 버전 고르기에 쓴다. */
  const openedItemId = detail.data?.itemId ?? null;
  const itemVersions = useTemplates('', openedItemId, openedItemId !== null);
  /* 목록 표는 모든 열을 가운데 정렬한다 — 검사 기준 탭과 같다(#208). */
  const columns: Column<InspectionSheetTemplate>[] = [
    {
      key: 'model',
      align: 'center',
      header: t.columns.model,
      /* 폭을 정하지 않는다 — 남는 폭을 모델 열이 맡는다(검사 기준 탭과 같다 · #208). */
      render: (row) => (
        /*
         * 「코드 이름」 한 줄 — 두 줄이던 칸을 한 줄로 줄여 행 높이를 다른 탭과 맞춘다(#208).
         * 단추는 키보드·화면 낭독기가 줄을 고르는 길이고, 고른 줄 표시(`aria-current`)가 여기 실린다.
         */
        <button
          type="button"
          className="inspection-sheet-template-open"
          title={`${row.itemCode} ${row.itemName}`}
          aria-label={t.list.openRow(row.itemCode)}
          aria-current={row.itemId === openedItemId ? 'true' : undefined}
          onClick={() => open({ kind: 'existing', id: row.inspectionSheetTemplateId })}
        >
          <span className="inspection-sheet-template-open-code">{row.itemCode}</span>
          <span className="inspection-sheet-template-muted">{row.itemName}</span>
        </button>
      ),
    },
    {
      key: 'layout',
      align: 'center',
      header: t.columns.layout,
      width: '96px',
      render: (row) => t.layouts[row.formLayoutCode] ?? row.formLayoutCode,
    },
    {
      key: 'status',
      align: 'center',
      header: t.columns.status,
      width: '80px',
      render: (row) => <TemplateStatusChip size="sm" statusCode={row.statusCode} />,
    },
    /* 사용 여부 — 작성중 · 확정은 사용, 폐기는 미사용(사용자 지시 · #208). */
    {
      key: 'usage',
      align: 'center',
      header: t.columns.usage,
      width: '88px',
      render: (row) => (
        <Chip variant="status" size="sm" status={isInUse(row) ? 'success' : 'idle'}>
          {isInUse(row) ? t.list.usageActive : t.list.usageInactive}
        </Chip>
      ),
    },
    /* 재료 · 확정자 — 목록에서 모델을 가르고 누가 확정했는지 본다(사용자 지시 · #208). */
    {
      key: 'material',
      align: 'center',
      header: t.columns.material,
      width: '120px',
      render: (row) => row.materialText ?? '',
    },
    {
      key: 'confirmedBy',
      align: 'center',
      header: t.columns.confirmedBy,
      width: '112px',
      render: (row) =>
        row.confirmedBy === null ? '' : (userNameOf(row.confirmedBy) ?? String(row.confirmedBy)),
    },
    {
      key: 'confirmedAt',
      align: 'center',
      header: t.columns.confirmedAt,
      /* 머리를 누르면 오름 · 내림차순(사용자 지시 · #208). 확정 전인 판(값 없음)은 오름차순 맨 앞이다. */
      sortable: true,
      /* 「2026-10-29 10:02」가 잘리지 않는 폭(#208) */
      width: '152px',
      render: (row) => (
        <span className="inspection-sheet-template-date">
          {row.confirmedAt === null ? '' : (formatPlantDateTime(row.confirmedAt) ?? '')}
        </span>
      ),
    },
  ];

  /* 열 순서·폭은 사용자가 바꾸고 브라우저에 남는다 — 검사 기준 탭 목록과 같다(#208). */
  const ordered = useColumnOrder('omf-mes:inspection-sheet-template:columns:list:order', columns);
  const resizable = useColumnWidths('omf-mes:inspection-sheet-template:columns:list', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });

  return (
    <>
      {/* 탭 줄 오른쪽 — 사용 여부 칩 다음에 좌우 · 상하 배치(사용자 지시 · #208). */}
      <UsageChips
        counts={list.data === undefined ? null : usageCounts}
        value={filter.usage}
        onChange={(usage) => setFilter((prev) => ({ ...prev, usage, page: 1 }))}
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
       * 조회 조건 — 검사 기준 탭과 같은 한 줄: 양식 · 상태 · 품목 · 재료 → (오른쪽) 조회 · 초기화 | 새 기준 등록(사용자 지시 · #208).
       */}
      <section ref={aboveRef} className="pane inspection-sheet-template-search" role="search">
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter((prev) => ({
              ...prev,
              status: statusInput,
              itemId: modelInput?.itemId ?? null,
              layout: layoutInput,
              material: materialInput,
              page: 1,
            }));
          }}
        >
          {/* 순서: 양식 선택 → 상태 선택 → 품목 검색 → 재료 검색(사용자 지시 · #208). */}
          <div className="field-cell inspection-sheet-template-status-filter">
            <label className="field-label" htmlFor={layoutFilterId}>
              {t.list.layout}
            </label>
            <Select
              id={layoutFilterId}
              options={[
                { value: '', label: t.list.layoutAll },
                ...(['OP', 'PP'] as const).map((code) => ({
                  value: code,
                  label: t.layouts[code] ?? code,
                })),
              ]}
              value={layoutInput}
              onChange={(value) => setLayoutInput(value as InspectionSheetLayoutCode | '')}
            />
          </div>
          <div className="field-cell inspection-sheet-template-status-filter">
            <label className="field-label" htmlFor={statusId}>
              {t.list.status}
            </label>
            <Select
              id={statusId}
              options={[
                { value: '', label: t.list.statusAll },
                ...STATUSES.map((code) => ({ value: code, label: t.statuses[code] ?? code })),
              ]}
              value={statusInput}
              onChange={(value) => setStatusInput(value as TemplateStatusFilter)}
            />
          </div>
          {/* 모델 — 읽기 전용 칸을 누르거나 엔터를 치면 품목 선택 창이 열린다(검사 기준 탭의 품목 검색과 같다 · #208). */}
          <SearchInput
            label={t.list.model}
            placeholder={t.list.modelPlaceholder}
            value={modelInput?.label ?? ''}
            readOnly
            title={modelInput?.label}
            aria-haspopup="dialog"
            clearLabel={t.list.modelClear}
            onClick={() => setIsModelPickerOpen(true)}
            onSearch={() => setIsModelPickerOpen(true)}
            onChange={() => undefined}
            onClear={() => setModelInput(null)}
          />
          <div className="field-cell inspection-sheet-template-material-filter">
            <label className="field-label" htmlFor={materialFilterId}>
              {t.list.material}
            </label>
            <TextField
              id={materialFilterId}
              placeholder={t.list.materialPlaceholder}
              value={materialInput}
              onChange={(event) => setMaterialInput(event.target.value)}
            />
          </div>
          <div className="filter-actions field-cell-unlabeled">
            <Button type="submit" variant="filled">
              {messages.common.search}
            </Button>
            {/* 초기화 — 입력과 적용된 조건을 처음으로(사용 여부는 「사용」) 되돌린다. 검사 기준 탭과 같다. */}
            <Button
              variant="outlined"
              onClick={() => {
                setStatusInput('');
                setModelInput(null);
                setLayoutInput('');
                setMaterialInput('');
                setFilter((prev) => ({ ...INITIAL_FILTER, size: prev.size }));
              }}
            >
              {messages.common.reset}
            </Button>
            <span className="inspection-standard-filter-divider" aria-hidden />
            <Button
              variant="filled"
              leadingIcon={<Icon name="add" size={18} />}
              /* 기본 정보 팝업만 연다 — 뒤 상세 칸은 「확인」 전까지 그대로 둔다(버그 수정 · #208). */
              onClick={() => setIsCreating(true)}
            >
              {t.list.add}
            </Button>
          </div>
        </form>
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split inspection-standard-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section
          className="pane inspection-sheet-template-list-pane quality-standard-list-pane"
          aria-label={t.list.heading}
        >
          {list.isError && (
            <AlertBanner variant="error">
              {t.list.loadFailed}{' '}
              <Button size="sm" variant="text" onClick={() => void list.refetch()}>
                {t.list.retry}
              </Button>
            </AlertBanner>
          )}
          {/*
           * 줄 아무 곳이나 눌러도 고른다 — 눌린 줄의 모델 단추로 넘긴다(검사 기준 탭과 같다 · #208).
           * 키보드·화면 낭독기는 그 단추 하나로 고른다.
           */}
          <div
            ref={fit.ref}
            className="inspection-queue-table inspection-standard-table-box inspection-sheet-template-rows"
            style={resizable.style}
            onClick={(event) => {
              const target = event.target as Element;
              if (target.closest('button, a, input, select, textarea') !== null) return;
              target
                .closest('tbody tr')
                ?.querySelector<HTMLButtonElement>('.inspection-sheet-template-open')
                ?.click();
            }}
          >
            <Table
              caption={<span className="inspection-sheet-template-caption">{t.list.caption}</span>}
              density="compact"
              columns={fit.columns}
              rows={rows}
              sort={sort}
              onSortChange={(next) => {
                setSort(next);
                setFilter((prev) => ({ ...prev, page: 1 }));
              }}
              getRowId={(row) => String(row.inspectionSheetTemplateId)}
              empty={
                <EmptyState
                  size="sm"
                  live
                  title={
                    list.isPending
                      ? t.list.loading
                      : hasFilter || (list.data?.length ?? 0) > 0
                        ? t.list.emptyFiltered
                        : t.list.empty
                  }
                />
              }
            />
          </div>
          {list.data !== undefined && (
            /* 쪽 이동은 다섯 목록이 같은 모양 · 같은 단추 크기 — 검사 기준 목록 기준(사용자 지시 · #208). */
            <PageNav
              meta={{ page: filter.page, size: filter.size, total: sorted.length }}
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

        <div className="inspection-sheet-template-detail quality-standard-detail">
          {opened === null && (
            <section className="pane">
              {/* 둥근 바탕 위 아이콘 · 제목 · 설명 — 검사 기준 탭과 같다(#208). */}
              <EmptyState
                size="sm"
                icon={
                  <span className="inspection-standard-empty-icon">
                    <Icon name="assignment" size={20} />
                  </span>
                }
                title={t.list.selectTitle}
                description={t.list.selectHint}
              />
            </section>
          )}
          {opened?.kind === 'new' && (
            <TemplateEditor
              key={`new-${opened.seq}`}
              template={null}
              initialBasics={opened.basics}
              businessUnitIds={scopeIds}
              businessUnitNames={names}
              stepCode={stepCode}
              onStepChange={setStepCode}
              onOpened={(id) => setOpened({ kind: 'existing', id })}
              onClose={() => open(null)}
            />
          )}
          {opened?.kind === 'existing' && detail.isError && (
            <AlertBanner variant="error">{t.editor.loadFailed}</AlertBanner>
          )}
          {opened?.kind === 'existing' && detail.isPending && (
            <p className="field-note">{t.editor.loading}</p>
          )}
          {opened?.kind === 'existing' && detail.data !== undefined && (
            <TemplateEditor
              /* 저장·확정 뒤 다시 받은 상세로 입력을 새로 채운다 — 서버가 정한 순번·상태가 화면과 같아지게. */
              key={`${opened.id}-${detail.dataUpdatedAt}`}
              template={detail.data}
              versions={itemVersions.data ?? []}
              onSelectVersion={(id) => open({ kind: 'existing', id })}
              businessUnitIds={scopeIds}
              businessUnitNames={names}
              stepCode={stepCode}
              onStepChange={setStepCode}
              onOpened={(id) => setOpened({ kind: 'existing', id })}
              onClose={() => open(null)}
            />
          )}
        </div>
      </div>
      {isCreating && (
        <TemplateBasicDialog
          initial={{
            itemId: null,
            itemLabel: '',
            businessUnitId: scopeIds[0] ?? null,
            formLayoutCode: 'OP',
          }}
          businessUnitIds={scopeIds}
          businessUnitNames={names}
          onCancel={() => setIsCreating(false)}
          onConfirm={(basics) => {
            setIsCreating(false);
            open({ kind: 'new', basics, seq: Date.now() });
          }}
        />
      )}
      {isModelPickerOpen && (
        <ItemPickerDialog
          multiple={false}
          compact
          showAvailability={false}
          confirmLabel={t.editor.pickConfirm}
          onClose={() => setIsModelPickerOpen(false)}
          onConfirm={([picked]) => {
            setIsModelPickerOpen(false);
            if (picked !== undefined) {
              setModelInput({
                itemId: picked.itemId,
                label: `${picked.itemCode} ${picked.itemName}`,
              });
            }
          }}
        />
      )}
    </>
  );
};
