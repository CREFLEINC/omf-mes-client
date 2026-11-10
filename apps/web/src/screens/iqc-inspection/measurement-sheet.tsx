import { AlertBanner, Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { useClientPage } from '../../patterns/client-page';
import { PageNav } from '../../patterns/page-nav';
import {
  autoJudgmentOf,
  entryOf,
  withItemJudgment,
  withJudgment,
  withValue,
  type MeasureDraft,
  type MeasureEntry,
} from './measurement-draft';
import { ItemCell, describeSpec, withUnit } from './measurement-grid';
import { hasCalibrationWarning, type MeasurementRow } from './measurement-rows';

const t = messages.iqcInspection.measurements;
const tn = messages.partsIqcInspection.dimension;

export interface MeasureEdit {
  draft: MeasureDraft;
  onChange: (draft: MeasureDraft) => void;
  disabled: boolean;
}

export interface MeasurementSheetProps {
  rows: MeasurementRow[];
  edit: MeasureEdit;
}

/** 표의 한 줄 — 검사 항목 하나와 그 측정 회차들. */
interface SheetRow {
  key: string;
  /** 이 표 안의 항목 번호. 1부터 */
  no: number;
  first: MeasurementRow;
  samples: MeasurementRow[];
}

const toSheetRows = (rows: readonly MeasurementRow[]): SheetRow[] => {
  const bySpec = new Map<number, MeasurementRow[]>();
  for (const row of rows) {
    bySpec.set(row.inspectionItemSpecId, [...(bySpec.get(row.inspectionItemSpecId) ?? []), row]);
  }
  return [...bySpec.values()].flatMap((samples, index) => {
    const first = samples[0];
    return first === undefined
      ? []
      : [{ key: String(first.inspectionItemSpecId), no: index + 1, first, samples }];
  });
};

/** 수치 칸에 치는 도중의 모양 — 「-」 · 「1.」처럼 덜 친 숫자도 받는다. */
const NUMERIC_TYPING = /^-?\d*\.?\d*$/;

const ValueInput = ({ row, edit }: { row: MeasurementRow; edit: MeasureEdit }) => {
  const entry = entryOf(edit.draft, row.key);
  const label = t.valueLabel(row.itemName, row.sampleNo);
  /* 규격을 벗어난 값은 그 칸이 붉다(부품 입력표와 같다). */
  const isOut = autoJudgmentOf(row, entry.value) === 'REJECTED';
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

const tidy = (value: number): number => Number(value.toFixed(6));

/** 규격 — 「기준 ± 공차」(위아래가 다르면 「기준 +a/-b」) 아래에 「하한 ~ 상한」(부품 입력표와 같다). */
const SpecLines = ({ row }: { row: MeasurementRow }) => {
  const { target, lower, upper } = row.spec;
  if (target === null || lower === null || upper === null) {
    return withUnit(describeSpec(row.spec), row.spec, row.unit);
  }
  const plus = tidy(upper - target);
  const minus = tidy(target - lower);
  const nominal = plus === minus ? describeSpec(row.spec) : `${target} +${plus}/-${minus}`;
  return (
    <span className="parts-iqc-spec">
      <span>{withUnit(nominal, row.spec, row.unit)}</span>
      <span>{t.range(lower, upper)}</span>
    </span>
  );
};

/** 회차 판정들 → 항목 판정. 불합격이 있으면 불합격, 모두 합격이면 합격, 아직이면 `''`. */
const itemJudgmentOf = (entries: readonly MeasureEntry[]): string =>
  entries.some((entry) => entry.judgment === 'REJECTED')
    ? 'REJECTED'
    : entries.every((entry) => entry.judgment === 'ACCEPTED')
      ? 'ACCEPTED'
      : '';

/** 값만으로 판정이 정해지는 항목인가 — 자동 판정이 켜진 선택형, 또는 규격이 있는 수치. */
const isJudgedByValue = (row: MeasurementRow): boolean =>
  row.autoJudgment &&
  (row.dataType === 'BOOLEAN' ||
    (row.dataType === 'NUMERIC' && (row.spec.lower !== null || row.spec.upper !== null)));

/**
 * 판정 OK · NG 단추(부품 화면과 같다 · 사용자 지시 2026-11-10) — 고르면 그 항목의 모든 회차에 같은 판정이 들어가고, 누른 단추를 다시
 * 누르면 비운다. 선택형은 값도 함께 넣는다 — OK 는 양호, NG 는 불량. ⭐ 저장은 종전대로 회차마다 한 건이다.
 */
const OkNgButtons = ({ row, edit }: { row: SheetRow; edit: MeasureEdit }) => {
  const code = itemJudgmentOf(row.samples.map((sample) => entryOf(edit.draft, sample.key)));
  const setsValue = row.first.dataType === 'BOOLEAN';
  const pick = (judgment: 'ACCEPTED' | 'REJECTED', on: boolean) => {
    if (!setsValue) {
      edit.onChange(withItemJudgment(edit.draft, row.samples, on ? judgment : ''));
      return;
    }
    const value = on ? String(judgment === 'ACCEPTED') : '';
    edit.onChange(
      row.samples.reduce(
        (next, sample) => withJudgment(withValue(next, sample, value), sample, on ? judgment : ''),
        edit.draft,
      ),
    );
  };
  return (
    <span
      className="parts-iqc-check-row"
      role="group"
      aria-label={t.judgmentLabel(row.first.itemName)}
    >
      {(['ACCEPTED', 'REJECTED'] as const).map((value) => (
        <Chip
          key={value}
          variant="filter"
          data-judgment={value}
          aria-pressed={code === value}
          selected={code === value}
          disabled={edit.disabled}
          onSelectedChange={(on) => pick(value, on)}
        >
          {value === 'ACCEPTED' ? t.booleanTrue : t.booleanFalse}
        </Chip>
      ))}
    </span>
  );
};

/**
 * 항목 판정 — 회차 중 불합격이 있으면 불합격, 모두 합격이면 합격, 아직이면 빈 칸. 값으로 판정되는 수치 항목은 「자동」 표시와
 * 글자로, 그 밖(자동 판정이 아니거나 규격이 없는 항목 · 기타 검사 항목)은 OK · NG 단추로 고른다(사용자 지시 2026-11-10).
 */
const JudgmentCell = ({ row, edit }: { row: SheetRow; edit: MeasureEdit }) => {
  const entries = row.samples.map((sample) => entryOf(edit.draft, sample.key));
  const code = itemJudgmentOf(entries);
  const body =
    row.first.dataType === 'NUMERIC' && isJudgedByValue(row.first) ? (
      <span className="iqc-inspection-auto-judgment">
        <Chip variant="status" size="sm" status="idle" title={t.autoJudgmentTitle}>
          {t.autoJudgmentMark}
        </Chip>
        {/* 덜 잰 줄은 「1/3」처럼 잰 수(부품 입력표와 같다). */}
        <span className="parts-iqc-verdict">
          {code !== ''
            ? (t.judgmentNames[code] ?? code)
            : entries.some((entry) => entry.judgment !== '')
              ? `${String(entries.filter((entry) => entry.judgment !== '').length)}/${String(entries.length)}`
              : t.notMeasured}
        </span>
      </span>
    ) : (
      <OkNgButtons row={row} edit={edit} />
    );
  /* 불합격 줄은 바탕이 붉다 — 표가 줄에 표식을 주지 않아 칸의 표식으로 줄을 찾는다(CSS `:has`). */
  return <span data-row-ng={code === 'REJECTED' ? '' : undefined}>{body}</span>;
};

/**
 * 표 둘 — 치수 측정(수치)과 기타 검사 항목(선택형 · 텍스트 · 그 밖). 텍스트 항목은 기타 검사 항목 표의 「측정 결과」 칸에 글을 적는다
 * (부품 화면과 같다 · 사용자 지시 2026-11-10).
 */
const TABLES = ['NUMERIC', 'BOOLEAN'] as const;

const tableKeyOf = (dataType: string): string => (dataType === 'NUMERIC' ? 'NUMERIC' : 'BOOLEAN');

interface TypeTableProps {
  type: string;
  title: string;
  rows: MeasurementRow[];
  edit: MeasureEdit;
}

const TypeTable = ({ type, title, rows, edit }: TypeTableProps) => {
  const sheetRows = toSheetRows(rows);
  const sampleColumns = Math.max(1, ...sheetRows.map((row) => row.samples.length));
  /* 기타 검사 항목 표는 글을 적는 항목(텍스트)이 있을 때만 측정 결과 칸을 둔다. */
  const hasValueColumn =
    type === 'BOOLEAN' && sheetRows.some((row) => row.first.dataType !== 'BOOLEAN');
  const columns: Column<SheetRow>[] = [
    {
      key: 'no',
      align: 'center',
      header: t.columns.no,
      width: '52px',
      render: (row) => row.no,
    },
    {
      key: 'item',
      align: 'center',
      header: t.columns.item,
      width: '116px',
      render: (row) => <ItemCell row={row.first} />,
    },
    ...(type === 'NUMERIC'
      ? [
          {
            key: 'spec',
            align: 'center',
            header: t.columns.spec,
            width: '102px',
            render: (row: SheetRow) => <SpecLines row={row.first} />,
          } satisfies Column<SheetRow>,
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
        ]
      : []),
    ...(hasValueColumn
      ? [
          {
            key: 'value',
            align: 'center',
            header: t.columns.value,
            width: '240px',
            /* 회차가 여럿이면 칸이 위아래로 선다. 선택형 줄은 비어 있다. */
            render: (row: SheetRow) =>
              row.first.dataType === 'BOOLEAN' ? null : (
                <span className="iqc-inspection-measure-values">
                  {row.samples.map((sample) => (
                    <ValueInput key={sample.key} row={sample} edit={edit} />
                  ))}
                </span>
              ),
          } satisfies Column<SheetRow>,
        ]
      : []),
    {
      key: 'judgment',
      align: 'center',
      header: t.columns.judgment,
      width: '150px',
      render: (row) => <JudgmentCell row={row} edit={edit} />,
    },
  ];
  const filled = sheetRows.filter((row) =>
    row.samples.some((sample) => {
      const entry = entryOf(edit.draft, sample.key);
      /* 기타 검사 항목은 판정을 고르면 입력한 것이다. */
      return entry.value.trim() !== '' || (type === 'BOOLEAN' && entry.judgment !== '');
    }),
  ).length;
  const paging = useClientPage(sheetRows);

  return (
    <div className="iqc-inspection-measure-type">
      {/* 표 위 제목 · 진행 현황은 부품 입력표와 같다(사용자 지시 2026-11-09). */}
      <div className="parts-iqc-block-head">
        <h3>{title}</h3>
        <span className="parts-iqc-muted">{tn.progress(filled, sheetRows.length)}</span>
      </div>
      <div className="iqc-inspection-table-box inspection-queue-table iqc-inspection-measure-sheet">
        <Table
          caption={<span className="iqc-inspection-table-caption">{title}</span>}
          density="compact"
          columns={columns}
          rows={paging.rows}
          getRowId={(row) => row.key}
        />
      </div>
      {/* 한 쪽에 다 들면 쪽 이동 줄을 두지 않는다 — 높이를 줄인다. */}
      {sheetRows.length > paging.rows.length && <PageNav {...paging.nav} />}
    </div>
  );
};

/**
 * 검사 중 항목별 입력표(#247 · 사용자 지시 2026-11-09) — 부품 사업부 입력표처럼 한 줄에 항목 · 규격 · n1~nN · 판정. 규격이 있는 수치와
 * 선택형 · 텍스트를 표로 나눈다. 열은 그 표에서 가장 많이 재는 항목의 회차 수만큼이고, 항목마다 자기 회차 수까지만 칸이 열린다.
 */
export const MeasurementSheet = ({ rows, edit }: MeasurementSheetProps) => (
  <section className="iqc-inspection-step-measure" aria-label={t.heading}>
    {/* ⛔ 경고일 뿐 차단이 아니다(스펙 §8-6). */}
    {hasCalibrationWarning(rows) && (
      <div className="banner-slot">
        <AlertBanner variant="warning" title={t.calibrationWarningTitle}>
          {t.calibrationWarning}
        </AlertBanner>
      </div>
    )}
    {TABLES.map((key) => {
      const typeRows = rows.filter((row) => tableKeyOf(row.dataType) === key);
      return typeRows.length === 0 ? null : (
        <TypeTable
          key={key}
          type={key}
          title={t.sheetTitles[key] ?? key}
          rows={typeRows}
          edit={edit}
        />
      );
    })}
  </section>
);
