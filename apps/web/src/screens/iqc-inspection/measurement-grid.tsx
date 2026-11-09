import {
  AlertBanner,
  Button,
  Chip,
  EmptyState,
  Icon,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useColumnOrder } from '../../patterns/column-grip-order';
import { useClientPage } from '../../patterns/client-page';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { FilterChips } from '../../patterns/filter-chips';
import { PageNav } from '../../patterns/page-nav';
import { Select } from '../../patterns/select';
import type { CodeOption } from './code-options';
import { entryOf, withJudgment, withValue, type MeasureDraft } from './measurement-draft';
import { hasCalibrationWarning, type MeasurementRow, type SpecRange } from './measurement-rows';

/**
 * 항목별 측정치 그리드 — **스펙 §4-C 의 3계층 중 3층이다.**
 *
 * ⭐ **새 부품을 만들지 않았다.** 「편집 가능한 표」가 갭처럼 보이지만 `Table` 의 컬럼이
 * 커스텀 렌더러를 지원해 조합으로 선다(스펙 §7-1 — `c` 조합 · DS 이슈 없음).
 *
 * ⭐ **검사 중인 회차는 여기서 측정값을 넣는다**(omf-all-around#247). 값 칸은 항목 자료형(`dataTypeCode`)으로 갈린다 —
 * 수치는 숫자, 글은 글, 예/아니오는 양호 · 불량. `edit` 를 주지 않으면 종전처럼 읽기다.
 *
 * ⛔ **미검교정을 화면이 계산하지 않는다.** 서버가 측정 시점 기준으로 판정해 내려 준
 * 값을 그대로 보인다(공유계약 L-2). 그리고 **차단하지 않는다** — 무효화 정책이 미결이라
 * (스펙 §8-6) 알리기만 한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.iqcInspection.measurements;

/**
 * 규격을 한 줄로. **없는 것을 지어내지 않되, 있는 것을 빠뜨리지도 않는다.**
 *
 * ⛔ **한쪽만 있는 규격도 규격이다.** 계약이 상하한을 「둘 다 있을 때만」 견주므로 한쪽만
 * 있는 항목이 정상이고, 「9.9 이상」 같은 공차는 실제 검사기준에 흔하다. 둘 다 있을 때만
 * 내면 화면이 **「규격 없음」이라고 말해 검사자가 공차를 모르고 잰다.**
 */
const describeLimits = (spec: SpecRange): string | null => {
  if (spec.lower !== null && spec.upper !== null) return t.range(spec.lower, spec.upper);
  if (spec.lower !== null) return t.atLeast(spec.lower);
  if (spec.upper !== null) return t.atMost(spec.upper);

  return null;
};

/** 단위가 있으면 값 뒤에 붙인다(#133). 규격이 없거나(—) 단위를 모르면 그대로다. */
export const withUnit = (text: string, spec: SpecRange | null, unit: string | null): string => {
  if (unit === null) return text;
  if (spec !== null && spec.target === null && spec.lower === null && spec.upper === null)
    return text;
  return `${text} ${unit}`;
};

/** 부동소수 뺄셈 찌꺼기(0.09999…)를 지운다 — 규격 값은 소수 여섯째 자리를 넘지 않는다. */
const tidy = (value: number): number => Number(value.toFixed(6));

/**
 * 규격 — 기준값과 상하한이 대칭이면 「100 ± 0.5」, 아니면 범위 뒤에 기준값을 괄호로(#133).
 * 「목표 100 · 99.5 ~ 100.5」보다 한눈에 읽힌다.
 */
export const describeSpec = (spec: SpecRange): string => {
  const { target, lower, upper } = spec;

  if (target !== null && lower !== null && upper !== null) {
    const below = tidy(target - lower);
    if (below === tidy(upper - target)) return t.tolerance(target, below);
  }

  const limits = describeLimits(spec);
  if (limits === null) return target === null ? t.notMeasured : t.target(target);

  return target === null ? limits : t.withTarget(limits, target);
};

/**
 * 저장된 측정치를 한 칸으로.
 *
 * ⭐ **자료형을 몰라도 그릴 수 있다** — 계약이 세 칸 중 하나만 채우도록 강제하므로
 * (`num_nonnulls ≤ 1`), 채워진 것을 그대로 보이면 된다. 입력은 자료형을 알아야 하지만
 * 표시는 자료가 스스로 말한다.
 */
const describeValue = (row: MeasurementRow): ReactNode => {
  const measured = row.measured;

  if (measured === null) return t.notMeasured;
  if (measured.numericValue !== null)
    return withUnit(String(measured.numericValue), null, row.unit);
  if (measured.textValue !== null) return measured.textValue;
  /* 예/아니오 항목(외관 등) — 내부 값(true/false) 대신 양호 · 불량을 표식과 함께(#133). */
  if (measured.booleanValue !== null) {
    return (
      <span className="iqc-inspection-measured-flag" data-ok={measured.booleanValue}>
        <Icon name={measured.booleanValue ? 'check_circle' : 'cancel'} size={18} aria-hidden />
        {measured.booleanValue ? t.booleanTrue : t.booleanFalse}
      </span>
    );
  }

  return t.notMeasured;
};

/** 판정 이름표 — 합격은 성공색, 불합격은 오류색, 모르는 코드는 중립(#133). */
const JUDGMENT_STATUS: Record<string, 'success' | 'error'> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
};

export interface MeasurementGridProps {
  rows: MeasurementRow[];
  /** 항목을 부르는 중. 표 자리에 그릴 것을 부르는 쪽이 정한다 */
  isLoading: boolean;
  /** 넘칠 때 줄이지 않고 표 안에서 가로로 구른다(좌우 배치 · 사용자 지시 2026-10-27 · #185). */
  scrollX?: boolean;
  /** 그 검사 항목 바로 아래에 펼칠 내용(입력 중만) — 없으면 `null` */
  renderBelowItem?: (inspectionItemSpecId: number) => ReactNode;
  /** 항목 입력 유형 코드 → 이름(수치 · 텍스트 · 불리언). 없으면 코드 그대로 */
  dataTypeNames?: Record<string, string>;
  /** 검사 중인 회차의 측정 입력(#247). 없으면 읽기다 */
  edit?: MeasureEdit | null;
  /** 적용 검사 기준 창을 연다 — [기준 조회]와 같다(창의 [수정]으로 검사기준 화면에 간다 · #197). 없으면 단추를 두지 않는다 */
  onViewPlan?: () => void;
}

export interface MeasureEdit {
  draft: MeasureDraft;
  onChange: (draft: MeasureDraft) => void;
  /** 측정치 판정 선택지(`INSPECTION_MEASUREMENT_JUDGMENT`) */
  judgmentOptions: CodeOption[];
  disabled: boolean;
  /** 값 칸에 들어가고(`true`) 벗어날 때(`false`) — 치는 도중 불량 등록 줄이 났다 사라지며 표가 밀리지 않게 한다 */
  onTyping: (started: boolean) => void;
}

/* 열 정의는 화면 밖에 고정이라(열 순서 · 폭 기억) 입력 상태는 맥락으로 칸에 넘긴다. */
const EditContext = createContext<MeasureEdit | null>(null);

/** 수치 칸에 치는 도중의 모양 — 「-」 · 「1.」처럼 덜 친 숫자도 받는다. */
const NUMERIC_TYPING = /^-?\d*\.?\d*$/;

/* 입력 유형 이름(공통코드 `INSPECTION_ITEM_SPEC_DATA_TYPE` — 검사 기준 화면과 같은 이름). 모르면 코드 그대로다. */
const TypeNameContext = createContext<Record<string, string>>({});

const TypeCell = ({ row }: { row: MeasurementRow }) => {
  const names = useContext(TypeNameContext);
  return names[row.dataType] ?? row.dataType;
};

const BOOLEAN_OPTIONS: CodeOption[] = [
  { value: 'true', label: t.booleanTrue },
  { value: 'false', label: t.booleanFalse },
];

/** 이 줄의 판정 — 입력 중이면 초안의 판정, 아니면 저장된 판정. 없으면 `''`. */
const judgmentOf = (row: MeasurementRow, edit: MeasureEdit | null): string =>
  edit === null ? (row.measured?.judgmentCode ?? '') : entryOf(edit.draft, row.key).judgment;

const ValueCell = ({ row }: { row: MeasurementRow }) => {
  const edit = useContext(EditContext);
  if (edit === null) {
    return (
      <>
        {describeValue(row)}
        {row.measured?.calibrationExpired === true && (
          <>
            {' '}
            <Chip variant="status" size="sm" status="warning">
              {t.calibrationExpired}
            </Chip>
          </>
        )}
      </>
    );
  }
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
  return (
    <TextField
      size="sm"
      fullWidth
      aria-label={label}
      inputMode={row.dataType === 'NUMERIC' ? 'decimal' : undefined}
      value={entry.value}
      disabled={edit.disabled}
      onFocus={() => edit.onTyping(true)}
      onBlur={() => edit.onTyping(false)}
      onChange={(event) => {
        /* 수치 항목은 숫자 · 소수점 · 앞 「-」 말고는 받지 않는다 — 글자를 치면 칸이 그대로다(사용자 지시 2026-11-09). */
        if (row.dataType === 'NUMERIC' && !NUMERIC_TYPING.test(event.target.value)) return;
        edit.onChange(withValue(edit.draft, row, event.target.value));
      }}
    />
  );
};

const JudgmentCell = ({ row }: { row: MeasurementRow }) => {
  const edit = useContext(EditContext);
  const code = judgmentOf(row, edit);
  if (edit === null) {
    return code === '' ? (
      t.notMeasured
    ) : (
      <Chip variant="status" size="sm" status={JUDGMENT_STATUS[code] ?? 'idle'}>
        {t.judgmentNames[code] ?? code}
      </Chip>
    );
  }
  const entry = entryOf(edit.draft, row.key);
  return (
    <Select
      size="sm"
      aria-label={t.judgmentLabel(row.itemName, row.sampleNo)}
      options={edit.judgmentOptions}
      value={code === '' ? null : code}
      placeholder={t.selectPlaceholder}
      /* 값을 적었는데 판정이 비면 빨간 테두리 — 그 줄 때문에 저장이 막힌다. */
      invalid={code === '' && entry.value.trim() !== ''}
      disabled={edit.disabled || edit.judgmentOptions.length === 0}
      onChange={(value) => edit.onChange(withJudgment(edit.draft, row, value))}
    />
  );
};

/** 표 안에 끼우는 하위 줄(#247) — 불합격 항목 아래 불량 등록. 표가 펼침 행을 주지 않아 한 줄을 만들어 칸을 합친다. */
interface SlotRow {
  slot: true;
  key: string;
  node: ReactNode;
}
type GridRow = MeasurementRow | SlotRow;
const isSlot = (row: GridRow): row is SlotRow => 'slot' in row;

/* 열 순서를 끌어 바꾸면 같은 칸이 앞뒤로 옮겨 다닌다 — 합침 · 감춤을 서로 되돌려 둔다. */
const SlotCell = ({ span, children }: { span: number; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const cell = ref.current?.closest('td');
    if (cell == null) return;
    cell.colSpan = span;
    cell.style.display = '';
  }, [span]);
  return (
    <div ref={ref} className="iqc-inspection-measure-slot">
      {children}
    </div>
  );
};
const SlotGap = () => {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const cell = ref.current?.closest('td');
    if (cell == null) return;
    cell.colSpan = 1;
    cell.style.display = 'none';
  }, []);
  return <span ref={ref} />;
};

/** 같은 항목의 2회차부터 항목 · 유형 · 규격을 비워 회차를 한 묶음으로 보인다(입력 중만). */
const GROUPED_COLUMNS = new Set(['item', 'dataType', 'spec']);

const columns: Column<MeasurementRow>[] = [
  {
    key: 'item',
    align: 'center',
    header: t.columns.item,
    /*
     * 다섯 열 모두 폭을 주어 표가 카드보다 넓을 때 남는 폭을 폭 비율대로 나눠 갖게 한다
     * (항목 열이 혼자 받지 않게). 긴 항목명은 칸 안에서 줄을 바꾼다.
     */
    width: '128px',
    /*
     * 항목명은 칸 한가운데, 「필수」는 같은 칸 왼쪽 끝 — 셋으로 나눈 격자(1fr · 이름 · 1fr)라
     * 「필수」가 있든 없든 이름의 가운데가 같은 자리다(#133 · 담당자 지시).
     */
    render: (row) => (
      <span className="iqc-inspection-item-cell">
        {row.required && (
          <Chip variant="status" size="sm" status="idle">
            {t.requiredMark}
          </Chip>
        )}
        <span className="iqc-inspection-item-name">{row.itemName}</span>
      </span>
    ),
  },
  /* 입력 유형 — 수치 · 텍스트 · 불리언(사용자 지시 2026-11-09). */
  {
    key: 'dataType',
    align: 'center',
    header: t.columns.dataType,
    width: '72px',
    render: (row) => <TypeCell row={row} />,
  },
  {
    key: 'spec',
    align: 'center',
    header: t.columns.spec,
    width: '102px',
    render: (row) => withUnit(describeSpec(row.spec), row.spec, row.unit),
  },
  {
    key: 'sample',
    align: 'center',
    header: t.columns.sample,
    width: '92px',
    render: (row) => t.sampleOf(row.sampleNo),
  },
  {
    key: 'value',
    align: 'center',
    header: t.columns.value,
    width: '110px',
    render: (row) => <ValueCell row={row} />,
  },
  {
    key: 'judgment',
    align: 'center',
    header: t.columns.judgment,
    width: '122px',
    render: (row) => <JudgmentCell row={row} />,
  },
];

/** 거르기 칩의 판정 — 측정치 판정(`INSPECTION_MEASUREMENT_JUDGMENT`) 두 값. */
const JUDGMENT_FILTERS = ['ACCEPTED', 'REJECTED'] as const;

export const MeasurementGrid = ({
  rows,
  isLoading,
  scrollX = false,
  edit = null,
  dataTypeNames = {},
  renderBelowItem,
  onViewPlan,
}: MeasurementGridProps) => {
  /*
   * 목록 표처럼 동작한다(사용자 지시 2026-10-26 · #185) — 열 순서 끌기 · 폭 조절(브라우저에 기억), 한 줄 행, 상자 폭에 맞춤.
   */
  const ordered = useColumnOrder('omf-mes:iqc-inspection:columns:measurements:order', columns);
  const resizable = useColumnWidths('omf-mes:iqc-inspection:columns:measurements', ordered, {
    fitContent: scrollX,
  });
  const fit = useFitColumns(resizable.columns, { scrollX });
  /* 합격 · 불합격으로 거른 뒤 10 · 20 · 50건씩 쪽으로 나눈다(사용자 지시 2026-10-27 · #185). 칩 건수는 거르기 전 전체에서 센다. */
  const [judgmentFilter, setJudgmentFilter] = useState<string | null>(null);
  const countOf = (code: string): number =>
    rows.filter((row) => judgmentOf(row, edit) === code).length;
  const paging = useClientPage(
    judgmentFilter === null ? rows : rows.filter((row) => judgmentOf(row, edit) === judgmentFilter),
  );

  /*
   * 입력 중이면 ② 판정 단계 안에 선다(#247 · 사용자 지시 2026-11-09) — 제목 · 거르기 줄 없이 표만 둔다. 단계 제목이 이미
   * 있고, 적용 기준은 상세 머리의 [기준 조회]로 본다.
   */
  const inStep = edit !== null;
  /* 항목의 이 쪽 마지막 회차 뒤에 하위 줄을 끼운다 — 쪽 나눔은 측정 줄만 센다. */
  const gridRows: GridRow[] = paging.rows.flatMap((row, index): GridRow[] => {
    const isLast = paging.rows[index + 1]?.inspectionItemSpecId !== row.inspectionItemSpecId;
    const node = inStep && isLast ? (renderBelowItem?.(row.inspectionItemSpecId) ?? null) : null;
    return node === null ? [row] : [row, { slot: true, key: `slot-${row.key}`, node }];
  });
  const gridColumns: Column<GridRow>[] = fit.columns.map((column, position) => ({
    key: column.key,
    header: column.header,
    ...(column.align === undefined ? {} : { align: column.align }),
    ...(column.width === undefined ? {} : { width: column.width }),
    render: (row, rowIndex) => {
      if (isSlot(row)) {
        return position === 0 ? (
          <SlotCell span={fit.columns.length}>{row.node}</SlotCell>
        ) : (
          <SlotGap />
        );
      }
      if (inStep && row.sampleNo > 1 && GROUPED_COLUMNS.has(column.key)) return null;
      return column.render?.(row, rowIndex);
    },
  }));

  return (
    <section
      className={inStep ? 'iqc-inspection-step-measure' : 'iqc-inspection-section'}
      aria-label={t.heading}
    >
      {/* 다른 구획처럼 왼쪽 제목으로 선다 — 표 제목(caption)은 화면에서 감추고 접근 이름으로 남긴다. */}
      {!inStep && <h3>{t.caption}</h3>}
      {/*
       * ⛔ 경고일 뿐 차단이 아니다. 무효화 정책이 미결이라(스펙 §8-6) 화면이 값을 빼거나
       * 확정을 막지 않는다 — 무엇을 다시 볼지만 알린다.
       */}
      {hasCalibrationWarning(rows) && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.calibrationWarningTitle}>
            {t.calibrationWarning}
          </AlertBanner>
        </div>
      )}

      {/* 거르기 칩 줄 오른쪽 끝에 [수정] — 검사 항목은 검사기준에서 정한다(사용자 지시 2026-10-28 · #197). */}
      {!inStep && (
        <div className="iqc-inspection-measure-toolbar">
          {rows.length > 0 && (
            <FilterChips
              label={t.filterLabel}
              options={[
                { value: null, label: t.filterAll },
                ...JUDGMENT_FILTERS.map((code) => ({
                  value: code,
                  label: t.judgmentNames[code] ?? code,
                })),
              ]}
              value={judgmentFilter}
              countOf={(code) => (code === null ? rows.length : countOf(code))}
              onChange={setJudgmentFilter}
            />
          )}
          {onViewPlan !== undefined && (
            <Button
              type="button"
              variant="outlined"
              size="sm"
              className="iqc-inspection-measure-edit"
              onClick={onViewPlan}
            >
              {messages.iqcInspection.measurements.viewPlan}
            </Button>
          )}
        </div>
      )}

      {/* 표 전체를 얇은 테두리 상자로 감싼다(#133). */}
      <div
        ref={fit.ref}
        className="iqc-inspection-table-box inspection-queue-table"
        style={resizable.style}
      >
        <TypeNameContext.Provider value={dataTypeNames}>
          <EditContext.Provider value={edit}>
            <Table
              caption={<span className="iqc-inspection-table-caption">{t.caption}</span>}
              density="compact"
              columns={gridColumns}
              rows={gridRows}
              getRowId={(row) => row.key}
              empty={
                isLoading ? (
                  <p className="field-note">{t.loading}</p>
                ) : (
                  /* 목록의 빈 결과와 같은 모양 — 아이콘 · 한 줄 제목 · 안내(사용자 지시 2026-10-26). */
                  <EmptyState
                    size="sm"
                    icon={<Icon name="content_paste_off" size={32} />}
                    title={t.noItems}
                    description={t.noItemsHint}
                  />
                )
              }
            />
          </EditContext.Provider>
        </TypeNameContext.Provider>
      </div>
      {/* 단계 안에서는 한 쪽에 다 들면 쪽 이동 줄을 두지 않는다 — 높이를 줄인다. */}
      {(!inStep || rows.length > paging.rows.length) && <PageNav {...paging.nav} />}
    </section>
  );
};
