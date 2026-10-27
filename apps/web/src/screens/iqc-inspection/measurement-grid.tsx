import { AlertBanner, Chip, EmptyState, Icon, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnOrder } from '../../patterns/column-order';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnWidths } from '../../patterns/column-resize';
import { hasCalibrationWarning, type MeasurementRow, type SpecRange } from './measurement-rows';

/**
 * 항목별 측정치 그리드 — **스펙 §4-C 의 3계층 중 3층이다.**
 *
 * ⭐ **새 부품을 만들지 않았다.** 「편집 가능한 표」가 갭처럼 보이지만 `Table` 의 컬럼이
 * 커스텀 렌더러를 지원해 조합으로 선다(스펙 §7-1 — `c` 조합 · DS 이슈 없음).
 *
 * ⚠ **이 회차는 읽기다.** 측정치 입력은 항목의 자료형(`dataTypeCode`)에 따라 세 칸 중
 * 하나만 채워야 하는데, 그 값 목록이 아직 확정되지 않았다(omf-mes#179). 모양으로 추론해
 * 그리면 불리언 항목이 텍스트로 떨어져 자료가 틀어진다 — 답이 온 뒤에 붙인다.
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
const withUnit = (text: string, spec: SpecRange | null, unit: string | null): string => {
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
const describeSpec = (spec: SpecRange): string => {
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
}

const columns: Column<MeasurementRow>[] = [
  {
    key: 'item',
    align: 'center',
    header: t.columns.item,
    /*
     * 다섯 열 모두 폭을 주어 표가 카드보다 넓을 때 남는 폭을 폭 비율대로 나눠 갖게 한다
     * (항목 열이 혼자 받지 않게). 긴 항목명은 칸 안에서 줄을 바꾼다.
     */
    width: '200px',
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
  {
    key: 'spec',
    align: 'center',
    header: t.columns.spec,
    width: '148px',
    render: (row) => withUnit(describeSpec(row.spec), row.spec, row.unit),
  },
  {
    key: 'sample',
    align: 'center',
    header: t.columns.sample,
    width: '96px',
    render: (row) => t.sampleOf(row.sampleNo),
  },
  {
    key: 'value',
    align: 'center',
    header: t.columns.value,
    width: '96px',
    render: (row) => (
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
    ),
  },
  {
    key: 'judgment',
    align: 'center',
    header: t.columns.judgment,
    width: '96px',
    render: (row) =>
      row.measured === null ? (
        t.notMeasured
      ) : (
        <Chip
          variant="status"
          size="sm"
          status={JUDGMENT_STATUS[row.measured.judgmentCode] ?? 'idle'}
        >
          {t.judgmentNames[row.measured.judgmentCode] ?? row.measured.judgmentCode}
        </Chip>
      ),
  },
];

export const MeasurementGrid = ({ rows, isLoading, scrollX = false }: MeasurementGridProps) => {
  /*
   * 목록 표처럼 동작한다(사용자 지시 2026-10-26 · #185) — 열 순서 끌기 · 폭 조절(브라우저에 기억), 한 줄 행, 상자 폭에 맞춤.
   */
  const ordered = useColumnOrder('omf-mes:iqc-inspection:columns:measurements:order', columns);
  const resizable = useColumnWidths('omf-mes:iqc-inspection:columns:measurements', ordered, {
    fitContent: scrollX,
  });
  const fit = useFitColumns(resizable.columns, { scrollX });

  return (
    <section className="iqc-inspection-section" aria-label={t.heading}>
      {/* 다른 구획처럼 왼쪽 제목으로 선다 — 표 제목(caption)은 화면에서 감추고 접근 이름으로 남긴다. */}
      <h3>{t.caption}</h3>
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

      {/* 표 전체를 얇은 테두리 상자로 감싼다(#133). */}
      <div
        ref={fit.ref}
        className="iqc-inspection-table-box inspection-queue-table"
        style={resizable.style}
      >
        <Table
          caption={<span className="iqc-inspection-table-caption">{t.caption}</span>}
          density="compact"
          columns={fit.columns}
          rows={rows}
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
      </div>
    </section>
  );
};
