import { Button, Chip, Table, TextField, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useClientPage } from '../../patterns/client-page';
import { PageNav } from '../../patterns/page-nav';
import { PlanViewLauncher } from '../iqc-inspection/plan-view-launcher';
import { lacksLimits } from '../pqc-inspection/auto-judgment';
import { isKnownCode, type CodeOption } from '../pqc-inspection/code-options';
import {
  DATA_TYPES,
  EMPTY_MEASUREMENT_DRAFT,
  isValueInvalid,
  judgedCount,
  type MeasurementDrafts,
} from '../pqc-inspection/measurement-draft';
import {
  isOutOfSpec,
  type MeasurementRow,
  type SpecRange,
} from '../pqc-inspection/measurement-rows';

const t = messages.pqcInspectionRegister.web.items;
const tMeasure = messages.pqcInspection.measurements;
const empty = messages.pqcInspection.emptyValue;

export interface WebItemTableProps {
  rows: MeasurementRow[];
  drafts: MeasurementDrafts;
  onValueChange: (key: string, value: string) => void;
  onJudgmentChange: (key: string, judgment: string) => void;
  judgmentOptions: CodeOption[];
  uomCodeOf: (uomId: number | null) => string | null;
  isLoading: boolean;
  isLocked: boolean;
  /** 적용 검사 기준 버전 — 제목 줄 오른쪽 [검사 항목 조회]가 그 기준 창을 연다(IQC 와 같다 · #197). */
  inspectionPlanVersionId: number;
  /** 단계 안에 선다(#197) — 단계 머리가 제목을 대신해 제목 줄을 그리지 않고, 표 아래 오른쪽에 `footer`([확정])를 둔다. */
  inStep?: boolean;
  footer?: ReactNode;
}

/** 부동소수 뺄셈 찌꺼기를 지운다 — 규격 값은 소수 여섯째 자리를 넘지 않는다. */
const tidy = (value: number): number => Number(value.toFixed(6));

/** 규격 — 기준값과 상하한이 대칭이면 「100 ± 0.5」, 아니면 범위 뒤에 기준값을 괄호로(IQC #133 과 같다). */
const describeSpec = (spec: SpecRange, unit: string | null): string => {
  const { target, lower, upper } = spec;
  let text: string | null = null;

  if (
    target !== null &&
    lower !== null &&
    upper !== null &&
    tidy(target - lower) === tidy(upper - target)
  ) {
    text = t.tolerance(target, tidy(target - lower));
  } else {
    const limits =
      lower !== null && upper !== null
        ? tMeasure.range(lower, upper)
        : lower !== null
          ? tMeasure.atLeast(lower)
          : upper !== null
            ? tMeasure.atMost(upper)
            : null;
    text =
      limits === null
        ? target === null
          ? null
          : t.target(target)
        : target === null
          ? limits
          : t.withTarget(limits, target);
  }

  if (text === null) return empty;
  return unit === null ? text : `${text} ${unit}`;
};

/**
 * W-03-11 관리웹 「검사 항목별 결과」(omf-all-around#135) — IQC 판정 화면(#133)의 표와 같은 짜임에 입력을 더했다.
 * 검사 항목(필수) · 규격 · 측정 회차 · 측정 결과(입력) · 판정(합격/불합격 단추).
 * ⛔ 값·판정 규칙은 POP 과 같은 `withMeasuredValue`·`withJudgment` 를 부르는 쪽(패널)이 정한다 — 이 표는 보이기만 한다.
 */
export const WebItemTable = ({
  rows,
  drafts,
  onValueChange,
  onJudgmentChange,
  judgmentOptions,
  uomCodeOf,
  isLoading,
  isLocked,
  inspectionPlanVersionId,
  inStep = false,
  footer = null,
}: WebItemTableProps) => {
  /* 목록 표 아래와 같은 쪽 이동 줄 — 10 · 20 · 50건(사용자 지시 2026-10-28 · #197). 적은 값은 쪽을 옮겨도 남는다(`drafts`). */
  const paging = useClientPage(rows);
  const columns: Column<MeasurementRow>[] = [
    {
      key: 'item',
      header: t.columns.item,
      width: '28%',
      render: (row) => (
        <span className="pqc-web-item-cell">
          {row.required && (
            <Chip variant="status" size="sm" status="idle">
              {tMeasure.requiredMark}
            </Chip>
          )}
          <span className="pqc-web-item-name">{row.itemName}</span>
        </span>
      ),
    },
    {
      key: 'spec',
      header: t.columns.spec,
      width: '18%',
      render: (row) => describeSpec(row.spec, uomCodeOf(row.spec.uomId)),
    },
    {
      key: 'sample',
      header: t.columns.sample,
      width: '10%',
      render: (row) => t.sampleOf(row.sampleNo),
    },
    {
      key: 'value',
      header: t.columns.value,
      width: '22%',
      render: (row) => {
        const draft = drafts[row.key] ?? EMPTY_MEASUREMENT_DRAFT;
        /* 육안(예/아니오) 항목은 값 칸 없이 판정만으로 성립한다 — POP 과 같다. */
        if (row.dataTypeCode === DATA_TYPES.boolean) return empty;
        return (
          <span className="pqc-web-value-cell">
            <TextField
              size="sm"
              aria-label={t.valueLabel(row.itemName, row.sampleNo)}
              inputMode={row.dataTypeCode === DATA_TYPES.numeric ? 'decimal' : 'text'}
              value={draft.value}
              disabled={isLocked}
              error={isValueInvalid(row, draft) ? tMeasure.valueInvalid : undefined}
              onChange={(event) => onValueChange(row.key, event.target.value)}
            />
            {/* 표시일 뿐 판정이 아니다 — 판정은 사람이 고른다(§6). */}
            {isOutOfSpec(row) && (
              <Chip variant="status" size="sm" status="error">
                {tMeasure.outOfSpec}
              </Chip>
            )}
          </span>
        );
      },
    },
    {
      key: 'judgment',
      header: t.columns.judgment,
      width: '22%',
      render: (row) => {
        const draft = drafts[row.key] ?? EMPTY_MEASUREMENT_DRAFT;
        return (
          <span className="pqc-web-judgment-cell">
            <span
              className="pqc-web-judgment-buttons"
              role="group"
              aria-label={t.judgmentLabel(row.itemName, row.sampleNo)}
            >
              {judgmentOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={draft.judgment === option.value ? 'filled' : 'outlined'}
                  data-judgment={option.value}
                  aria-pressed={draft.judgment === option.value}
                  disabled={isLocked}
                  onClick={() =>
                    onJudgmentChange(row.key, draft.judgment === option.value ? '' : option.value)
                  }
                >
                  {option.label}
                </Button>
              ))}
            </span>
            {judgmentOptions.length === 0 && (
              <span className="field-note">{tMeasure.judgmentUnavailable}</span>
            )}
            {!isKnownCode(judgmentOptions, draft.judgment) && (
              <span className="field-note">{tMeasure.judgmentUnknown(draft.judgment)}</span>
            )}
            {lacksLimits(row) && (
              <span className="field-note">{tMeasure.autoJudgmentNoLimits}</span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <section className={inStep ? 'pqc-web-step-items' : 'pqc-web-section'} aria-label={t.heading}>
      <div className="pqc-web-section-head">
        {!inStep && <h3>{t.heading}</h3>}
        {/* 무엇이 남았는지가 이 구획의 정보다 — 제목 줄 오른쪽 끝에. */}
        {rows.length > 0 && (
          <span className="pqc-web-section-meta">
            {t.progress(judgedCount(rows, drafts), rows.length)}
          </span>
        )}
        {/* IQC 「검사 항목별 결과」와 같은 단추 — 적용 검사 기준 창을 연다(사용자 지시 2026-10-28 · #197). */}
        <PlanViewLauncher
          inspectionPlanVersionId={inspectionPlanVersionId}
          label={messages.iqcInspection.measurements.viewPlan}
          size="sm"
        />
      </div>
      <div className="pqc-web-table-box">
        <Table
          caption={<span className="visually-hidden">{t.heading}</span>}
          density="compact"
          columns={columns}
          rows={paging.rows}
          getRowId={(row) => row.key}
          empty={<p className="field-note">{isLoading ? tMeasure.loading : tMeasure.noItems}</p>}
        />
      </div>
      <PageNav {...paging.nav} />
      {footer !== null && <div className="inspection-step-footer">{footer}</div>}
    </section>
  );
};
