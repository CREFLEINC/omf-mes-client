import {
  AlertBanner,
  Breadcrumb,
  Button,
  type Column,
  EmptyState,
  PageHeader,
  Select,
  Table,
} from '@crefle/web-ui';
import type { InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { OaOnlyGate } from '../../patterns/oa-only-gate';
import { useSession } from '../../patterns/session';
import { PageNav } from '../oqc-inspection/page-nav';
import { toPageView } from '../oqc-inspection/pagination';
import {
  type TemplateStatusFilter,
  useBusinessUnitNames,
  useTemplate,
  useTemplates,
} from './queries';
import type { StepDraft } from './draft';
import { TemplateEditor, TemplateStatusChip } from './template-editor';

const t = messages.inspectionSheetTemplate;

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
  const statusId = useId();
  const { session } = useSession();
  const [statusInput, setStatusInput] = useState<TemplateStatusFilter>('');
  const [filter, setFilter] = useState<{ status: TemplateStatusFilter; page: number }>({
    status: '',
    page: 1,
  });
  const [opened, setOpened] = useState<Opened>(null);
  const [stepCode, setStepCode] = useState<StepDraft['stepCode'] | null>(null);
  /** 다른 기준을 열면 단계 고름을 처음으로 돌린다. */
  const open = (next: Opened) => {
    setOpened(next);
    setStepCode(null);
  };

  const list = useTemplates(filter.status, filter.page);
  const detail = useTemplate(opened?.kind === 'existing' ? opened.id : null);
  const businessUnits = useBusinessUnitNames();
  const rows = list.data?.items ?? [];
  const scopeIds = (session?.scopes ?? []).map((scope) => scope.businessUnitId);
  const names = businessUnits.data ?? new Map<number, string>();

  const openedId = opened?.kind === 'existing' ? opened.id : null;
  const columns: Column<InspectionSheetTemplate>[] = [
    {
      key: 'model',
      header: t.columns.model,
      render: (row) => (
        <span className="inspection-sheet-template-model">
          <button
            type="button"
            className="link-cell"
            title={row.itemCode}
            aria-label={t.list.openRow(row.itemCode, row.templateVersion)}
            aria-current={row.inspectionSheetTemplateId === openedId ? 'true' : undefined}
            onClick={() => open({ kind: 'existing', id: row.inspectionSheetTemplateId })}
          >
            {row.itemCode}
          </button>
          <span
            className="inspection-sheet-ellipsis inspection-sheet-template-muted"
            title={row.itemName}
          >
            {row.itemName}
          </span>
        </span>
      ),
    },
    {
      key: 'version',
      header: t.columns.version,
      width: '40px',
      align: 'end',
      render: (row) => row.templateVersion,
    },
    {
      key: 'layout',
      header: t.columns.layout,
      width: '84px',
      render: (row) => t.layouts[row.formLayoutCode] ?? row.formLayoutCode,
    },
    {
      key: 'status',
      header: t.columns.status,
      width: '68px',
      render: (row) => <TemplateStatusChip statusCode={row.statusCode} />,
    },
    {
      key: 'confirmedAt',
      header: t.columns.confirmedAt,
      width: '96px',
      render: (row) =>
        row.confirmedAt === null ? '' : (formatPlantDateTime(row.confirmedAt) ?? ''),
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <p className="field-note inspection-sheet-template-rule">{t.rule}</p>

      <div className="two-pane inspection-sheet-template-layout">
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
            className="inspection-sheet-template-filter"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter({ status: statusInput, page: 1 });
            }}
          >
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
            <Button type="submit" variant="outlined">
              {t.list.search}
            </Button>
            <Button className="inspection-sheet-template-add" onClick={() => open({ kind: 'new' })}>
              {t.list.add}
            </Button>
          </form>
          <div className="inspection-sheet-template-list">
            <Table
              caption={<span className="inspection-sheet-template-caption">{t.list.caption}</span>}
              density="compact"
              columns={columns}
              rows={rows}
              getRowId={(row) => String(row.inspectionSheetTemplateId)}
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

        <div className="inspection-sheet-template-detail">
          {opened === null && (
            <section className="pane">
              <EmptyState size="sm" title={t.list.selectHint} />
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
