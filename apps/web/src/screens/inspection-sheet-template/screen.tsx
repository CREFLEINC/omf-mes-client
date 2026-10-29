import {
  AlertBanner,
  Breadcrumb,
  Button,
  type Column,
  EmptyState,
  Icon,
  PageHeader,
  Table,
} from '@crefle/web-ui';
import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useFitColumns } from '../../patterns/column-fit';
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
} from './queries';
import type { StepDraft } from './draft';
import { TemplateEditor, TemplateStatusChip } from './template-editor';
import { usePageHub } from '../../patterns/page-hub';

const t = messages.inspectionSheetTemplate;
const hubText = messages.common.inspectionHub;

const STATUSES: readonly InspectionSheetTemplate['statusCode'][] = [
  'DRAFT',
  'CONFIRMED',
  'OBSOLETE',
];

/** 무엇을 펴 두었나 — 새 기준이거나 목록에서 연 기준. */
type Opened = { kind: 'new' } | { kind: 'existing'; id: number } | null;

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
  const [filter, setFilter] = useState<{
    status: TemplateStatusFilter;
    page: number;
    size: number;
  }>({
    status: '',
    page: 1,
    size: PAGE_SIZE,
  });
  const [opened, setOpened] = useState<Opened>(null);
  const [stepCode, setStepCode] = useState<StepDraft['stepCode'] | null>(null);
  /** 다른 기준을 열면 단계 고름을 처음으로 돌린다. */
  const open = (next: Opened) => {
    setOpened(next);
    setStepCode(null);
  };

  const list = useTemplates(filter.status, filter.page, filter.size);
  const detail = useTemplate(opened?.kind === 'existing' ? opened.id : null);
  const businessUnits = useBusinessUnitNames();
  const rows = list.data?.items ?? [];
  const scopeIds = (session?.scopes ?? []).map((scope) => scope.businessUnitId);
  const names = businessUnits.data ?? new Map<number, string>();

  const openedId = opened?.kind === 'existing' ? opened.id : null;
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
          aria-label={t.list.openRow(row.itemCode, row.templateVersion)}
          aria-current={row.inspectionSheetTemplateId === openedId ? 'true' : undefined}
          onClick={() => open({ kind: 'existing', id: row.inspectionSheetTemplateId })}
        >
          <span className="inspection-sheet-template-open-code">{row.itemCode}</span>
          <span className="inspection-sheet-template-muted">{row.itemName}</span>
        </button>
      ),
    },
    {
      key: 'version',
      align: 'center',
      header: t.columns.version,
      width: '56px',
      render: (row) => row.templateVersion,
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
    {
      key: 'confirmedAt',
      align: 'center',
      header: t.columns.confirmedAt,
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
       * 조회 조건 — 검사 기준 탭처럼 목록 위 카드 한 줄: 상태 → 조회 · 새 기준 등록(#208).
       * 조건이 하나라 단추를 구분선 없이 바로 붙여 한 작업 줄로 둔다(사용자 지시). 「초기화」는 두지 않는다(없던 단추를 만들지 않는다).
       * 규칙 안내는 줄 아래 작은 보조 글 한 줄 — 박스 · 바탕 없이(사용자 지시 · #208).
       */}
      <section ref={aboveRef} className="pane inspection-sheet-template-search" role="search">
        <form
          className="filter-bar"
          onSubmit={(event) => {
            event.preventDefault();
            setFilter((prev) => ({ ...prev, status: statusInput, page: 1 }));
          }}
        >
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
          <div className="filter-actions field-cell-unlabeled">
            <Button type="submit" variant="filled">
              {messages.common.search}
            </Button>
            <Button
              variant="filled"
              leadingIcon={<Icon name="add" size={18} />}
              onClick={() => open({ kind: 'new' })}
            >
              {t.list.add}
            </Button>
          </div>
        </form>
        <p className="inspection-sheet-template-rule">
          <Icon name="info" size={16} />
          {t.rule}
        </p>
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
              getRowId={(row) => String(row.inspectionSheetTemplateId)}
              empty={
                <EmptyState size="sm" live title={list.isPending ? t.list.loading : t.list.empty} />
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
              key="new"
              template={null}
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
    </>
  );
};
