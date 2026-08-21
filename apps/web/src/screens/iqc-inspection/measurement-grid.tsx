import { AlertBanner, Chip, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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

/** 규격을 한 줄로. **없는 것을 지어내지 않는다** — 셋 다 없으면 없음 표시다. */
const describeSpec = (spec: SpecRange): string => {
  const parts: string[] = [];

  if (spec.target !== null) parts.push(t.target(spec.target));
  if (spec.lower !== null && spec.upper !== null) parts.push(t.range(spec.lower, spec.upper));

  return parts.length === 0 ? t.notMeasured : parts.join(' · ');
};

/**
 * 저장된 측정치를 한 칸으로.
 *
 * ⭐ **자료형을 몰라도 그릴 수 있다** — 계약이 세 칸 중 하나만 채우도록 강제하므로
 * (`num_nonnulls ≤ 1`), 채워진 것을 그대로 보이면 된다. 입력은 자료형을 알아야 하지만
 * 표시는 자료가 스스로 말한다.
 */
const describeValue = (row: MeasurementRow): string => {
  const measured = row.measured;

  if (measured === null) return t.notMeasured;
  if (measured.numericValue !== null) return String(measured.numericValue);
  if (measured.textValue !== null) return measured.textValue;
  if (measured.booleanValue !== null) return String(measured.booleanValue);

  return t.notMeasured;
};

export interface MeasurementGridProps {
  rows: MeasurementRow[];
  /** 항목을 부르는 중. 표 자리에 그릴 것을 부르는 쪽이 정한다 */
  isLoading: boolean;
}

const columns: Column<MeasurementRow>[] = [
  {
    key: 'item',
    header: t.columns.item,
    render: (row) => (
      <>
        {row.displayNo}. {row.itemName}
        {row.required && <span className="field-note"> {t.requiredMark}</span>}
      </>
    ),
  },
  {
    key: 'spec',
    header: t.columns.spec,
    width: '148px',
    render: (row) => describeSpec(row.spec),
  },
  {
    key: 'sample',
    header: t.columns.sample,
    width: '72px',
    align: 'end',
    render: (row) => t.sampleOf(row.sampleNo, row.sampleCount),
  },
  {
    key: 'value',
    header: t.columns.value,
    width: '96px',
    align: 'end',
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
    header: t.columns.judgment,
    width: '72px',
    render: (row) => row.measured?.judgmentCode ?? t.notMeasured,
  },
];

export const MeasurementGrid = ({ rows, isLoading }: MeasurementGridProps) => (
  <section aria-label={t.heading}>
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

    <Table
      caption={t.caption}
      density="compact"
      columns={columns}
      rows={rows}
      getRowId={(row) => row.key}
      empty={<p className="field-note">{isLoading ? t.loading : t.noItems}</p>}
    />
  </section>
);
