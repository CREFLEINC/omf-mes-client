import { Button, Dialog, EmptyState, Icon, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PlanVersionRule } from './judgment-change';
import { describeSpec, withUnit } from './measurement-grid';
import type { MeasurementRow } from './measurement-rows';

const t = messages.iqcInspection.detail.planView;
const columnText = messages.iqcInspection.measurements.columns;

const FULL_INSPECTION = 'FULL_INSPECTION';

export interface PlanViewDialogProps {
  rule: PlanVersionRule;
  /** 기준 버전의 항목 — 측정 표와 같은 줄(항목 × 샘플)을 받아 항목마다 한 줄로 접는다 */
  rows: MeasurementRow[];
  isLoading: boolean;
  onEdit: () => void;
  onClose: () => void;
}

const columns: Column<MeasurementRow>[] = [
  { key: 'no', header: t.columns.no, width: '10%', render: (row) => row.displayNo },
  {
    key: 'item',
    header: columnText.item,
    /* 필수는 이름 뒤 작은 흐린 글로(사용자 시안 2026-10-27 · #197). */
    render: (row) => (
      <>
        {row.itemName}
        {row.required && <span className="iqc-inspection-plan-view-required">({t.required})</span>}
      </>
    ),
  },
  {
    key: 'spec',
    header: columnText.spec,
    width: '45%',
    render: (row) => withUnit(describeSpec(row.spec), row.spec, row.unit),
  },
  {
    key: 'count',
    /*
     * 측정 횟수는 가운데 맞춤(사용자 시안 2026-10-28 · #197). 칸 폭을 머리글 길이만큼만 잡아 표 오른쪽 끝에 붙인다 —
     * 왼쪽 「No.」처럼 오른쪽 여백도 없게(사용자 지시 2026-10-28).
     */
    align: 'center',
    header: t.columns.count,
    width: '1%',
    render: (row) => t.count(row.sampleCount),
  },
];

/**
 * 「기준 조회」 창(사용자 지시 2026-10-27 · #197) — 조회이므로 화면을 옮기지 않고, 이 검사에 고정된 기준 버전의 샘플링 ·
 * 합격판정개수 · 검사 항목을 보인다. 고치려면 [수정]으로 검사기준 화면에 간다(저장 안 한 입력이 있으면 부르는 쪽이 묻는다).
 */
export const PlanViewDialog = ({ rule, rows, isLoading, onEdit, onClose }: PlanViewDialogProps) => {
  const items = rows.filter((row) => row.sampleNo === 1);
  const sampling =
    rule.samplingMethodCode === FULL_INSPECTION || rule.samplingRatio === null
      ? t.fullInspection
      : t.sampling(rule.samplingRatio);

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      className="iqc-inspection-plan-dialog"
      /* 제목 왼쪽, 버전 라벨 오른쪽 끝(사용자 시안 2026-10-27 · #197). */
      title={
        <span className="iqc-inspection-plan-view-title">
          <span>{t.title}</span>
          <span className="iqc-inspection-plan-view-version">{t.version(rule.planVersion)}</span>
        </span>
      }
      showCloseButton={false}
      footer={
        <>
          <Button
            type="button"
            variant="outlined"
            size="md"
            className="app-button-neutral"
            onClick={onClose}
          >
            {t.close}
          </Button>
          <Button type="button" size="md" onClick={onEdit}>
            {t.edit}
          </Button>
        </>
      }
    >
      <div className="iqc-inspection-plan-view">
        <dl className="iqc-inspection-plan-view-summary">
          <div>
            <dt>{t.samplingLabel}</dt>
            <dd>{sampling}</dd>
          </div>
          <div>
            <dt>{t.acceptanceLabel}</dt>
            <dd>
              {rule.acceptanceNumber === null
                ? t.acceptanceNone
                : t.acceptance(rule.acceptanceNumber)}
            </dd>
          </div>
        </dl>
        <h3 className="iqc-inspection-plan-view-heading">
          {t.itemsHeading}{' '}
          <span className="iqc-inspection-plan-view-heading-count">
            {t.itemsCount(items.length)}
          </span>
        </h3>
        <Table
          className="iqc-inspection-plan-view-table"
          density="compact"
          columns={columns}
          rows={items}
          getRowId={(row) => row.key}
          empty={
            isLoading ? (
              <p className="field-note">{messages.iqcInspection.measurements.loading}</p>
            ) : (
              <EmptyState
                size="sm"
                icon={<Icon name="content_paste_off" size={32} />}
                title={messages.iqcInspection.measurements.noItems}
              />
            )
          }
        />
      </div>
    </Dialog>
  );
};
