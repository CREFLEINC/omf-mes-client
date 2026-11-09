import { AlertBanner, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useClientPage } from '../../patterns/client-page';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';
import { Select } from '../../patterns/select';
import type { CodeOption } from './code-options';
import {
  autoJudgmentOf,
  entryOf,
  withItemJudgment,
  withValue,
  type MeasureDraft,
} from './measurement-draft';
import { ItemCell, describeSpec, withUnit } from './measurement-grid';
import { hasCalibrationWarning, type MeasurementRow } from './measurement-rows';

const t = messages.iqcInspection.measurements;
const tn = messages.partsIqcInspection.dimension;

export interface MeasureEdit {
  draft: MeasureDraft;
  onChange: (draft: MeasureDraft) => void;
  /** 측정치 판정 선택지(`INSPECTION_MEASUREMENT_JUDGMENT`) */
  judgmentOptions: CodeOption[];
  disabled: boolean;
}

export interface MeasurementSheetProps {
  rows: MeasurementRow[];
  /** 항목 입력 유형 코드 → 이름(수치 · 텍스트 · 선택형). 없으면 코드 그대로 */
  dataTypeNames: Record<string, string>;
  edit: MeasureEdit;
}

/** 표의 한 줄 — 검사 항목 하나와 그 측정 회차들. */
interface SheetRow {
  key: string;
  first: MeasurementRow;
  samples: MeasurementRow[];
}

const toSheetRows = (rows: readonly MeasurementRow[]): SheetRow[] => {
  const bySpec = new Map<number, MeasurementRow[]>();
  for (const row of rows) {
    bySpec.set(row.inspectionItemSpecId, [...(bySpec.get(row.inspectionItemSpecId) ?? []), row]);
  }
  return [...bySpec.values()].flatMap((samples) => {
    const first = samples[0];
    return first === undefined ? [] : [{ key: String(first.inspectionItemSpecId), first, samples }];
  });
};

/** 수치 칸에 치는 도중의 모양 — 「-」 · 「1.」처럼 덜 친 숫자도 받는다. */
const NUMERIC_TYPING = /^-?\d*\.?\d*$/;

const BOOLEAN_OPTIONS: CodeOption[] = [
  { value: 'true', label: t.booleanTrue },
  { value: 'false', label: t.booleanFalse },
];

const ValueInput = ({ row, edit }: { row: MeasurementRow; edit: MeasureEdit }) => {
  const entry = entryOf(edit.draft, row.key);
  const label = t.valueLabel(row.itemName, row.sampleNo);
  if (row.dataType === 'BOOLEAN') {
    return (
      <Select
        size="sm"
        aria-label={label}
        options={BOOLEAN_OPTIONS}
        value={entry.value === '' ? null : entry.value}
        placeholder={t.selectPlaceholder}
        disabled={edit.disabled}
        onChange={(value) => edit.onChange(withValue(edit.draft, row, value))}
      />
    );
  }
  /* 규격을 벗어난 값은 그 칸이 붉다(부품 입력표와 같다). 자동 판정 여부와 상관없이 규격으로 본다. */
  const isOut = autoJudgmentOf({ ...row, autoJudgment: true }, entry.value) === 'REJECTED';
  return (
    <input
      className={isOut ? 'parts-iqc-cell parts-iqc-cell-ng' : 'parts-iqc-cell'}
      aria-label={label}
      aria-invalid={isOut || undefined}
      inputMode={row.dataType === 'NUMERIC' ? 'decimal' : undefined}
      value={entry.value}
      disabled={edit.disabled}
      onChange={(event) => {
        /* 수치 항목은 숫자 · 소수점 · 앞 「-」 말고는 받지 않는다 — 글자를 치면 칸이 그대로다(사용자 지시 2026-11-09). */
        if (row.dataType === 'NUMERIC' && !NUMERIC_TYPING.test(event.target.value)) return;
        edit.onChange(withValue(edit.draft, row, event.target.value));
      }}
    />
  );
};

/** 규격 — 「기준 ± 공차」 아래에 「하한 ~ 상한」(부품 입력표와 같다). */
const SpecLines = ({ row }: { row: MeasurementRow }) => {
  const text = withUnit(describeSpec(row.spec), row.spec, row.unit);
  const { target, lower, upper } = row.spec;
  if (target === null || lower === null || upper === null) return text;
  return (
    <span className="parts-iqc-spec">
      <span>{text}</span>
      <span>{t.range(lower, upper)}</span>
    </span>
  );
};

/**
 * 항목 판정 — 회차 중 불합격이 있으면 불합격, 모두 합격이면 합격, 아직이면 빈 칸. 고르면 그 항목의 모든 회차에 같은 판정이
 * 들어간다. ⭐ 저장은 종전대로 회차마다 한 건이다.
 */
const JudgmentSelect = ({ row, edit }: { row: SheetRow; edit: MeasureEdit }) => {
  const entries = row.samples.map((sample) => entryOf(edit.draft, sample.key));
  const code = entries.some((entry) => entry.judgment === 'REJECTED')
    ? 'REJECTED'
    : entries.every((entry) => entry.judgment === 'ACCEPTED')
      ? 'ACCEPTED'
      : '';
  return (
    <Select
      size="sm"
      aria-label={t.judgmentLabel(row.first.itemName)}
      options={edit.judgmentOptions}
      value={code === '' ? null : code}
      placeholder={t.selectPlaceholder}
      /* 값을 적었는데 판정이 빈 회차가 있으면 빨간 테두리 — 그 줄 때문에 저장이 막힌다. */
      invalid={entries.some((entry) => entry.value.trim() !== '' && entry.judgment === '')}
      disabled={edit.disabled || edit.judgmentOptions.length === 0}
      onChange={(value) => edit.onChange(withItemJudgment(edit.draft, row.samples, value))}
    />
  );
};

/**
 * 검사 중 항목별 입력표(#247 · 사용자 지시 2026-11-09) — 부품 사업부 입력표처럼 한 줄에 항목 · 규격 · n1~nN · 판정. 열은 가장 많이
 * 재는 항목의 회차 수만큼이고, 항목마다 자기 회차 수까지만 칸이 열린다. 열 순서 · 폭 조절은 다른 표와 같다.
 */
export const MeasurementSheet = ({ rows, dataTypeNames, edit }: MeasurementSheetProps) => {
  const sheetRows = toSheetRows(rows);
  const sampleColumns = Math.max(1, ...sheetRows.map((row) => row.samples.length));
  const columns: Column<SheetRow>[] = [
    {
      key: 'item',
      align: 'center',
      header: t.columns.item,
      width: '128px',
      render: (row) => <ItemCell row={row.first} />,
    },
    {
      key: 'dataType',
      align: 'center',
      header: t.columns.dataType,
      width: '66px',
      render: (row) => dataTypeNames[row.first.dataType] ?? row.first.dataType,
    },
    {
      key: 'spec',
      align: 'center',
      header: t.columns.spec,
      width: '92px',
      render: (row) => <SpecLines row={row.first} />,
    },
    ...Array.from({ length: sampleColumns }, (_, index): Column<SheetRow> => ({
      key: `n${String(index + 1)}`,
      align: 'center',
      header: tn.sample(index + 1),
      width: '80px',
      /* 이 항목이 재지 않는 회차는 칸을 비워 둔다(바탕이 어둡다). */
      render: (row) => {
        const sample = row.samples[index];
        return sample === undefined ? null : <ValueInput row={sample} edit={edit} />;
      },
    })),
    {
      key: 'judgment',
      align: 'center',
      header: t.columns.judgment,
      width: '106px',
      render: (row) => <JudgmentSelect row={row} edit={edit} />,
    },
  ];
  const ordered = useColumnOrder('omf-mes:iqc-inspection:columns:measure-sheet:order', columns);
  const resizable = useColumnWidths('omf-mes:iqc-inspection:columns:measure-sheet', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  const paging = useClientPage(sheetRows);

  return (
    <section className="iqc-inspection-step-measure" aria-label={t.heading}>
      {/* ⛔ 경고일 뿐 차단이 아니다(스펙 §8-6). */}
      {hasCalibrationWarning(rows) && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.calibrationWarningTitle}>
            {t.calibrationWarning}
          </AlertBanner>
        </div>
      )}
      <div
        ref={fit.ref}
        className="iqc-inspection-table-box inspection-queue-table iqc-inspection-measure-sheet"
        style={resizable.style}
      >
        <Table
          caption={<span className="iqc-inspection-table-caption">{t.caption}</span>}
          density="compact"
          columns={fit.columns}
          rows={paging.rows}
          getRowId={(row) => row.key}
        />
      </div>
      {/* 한 쪽에 다 들면 쪽 이동 줄을 두지 않는다 — 높이를 줄인다. */}
      {sheetRows.length > paging.rows.length && <PageNav {...paging.nav} />}
    </section>
  );
};
