import { Chip, EmptyState, Icon, type Column } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { Fragment, useState } from 'react';

import { useClientPage } from '../../patterns/client-page';
import { useFitColumns } from '../../patterns/column-fit';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { useColumnWidths } from '../../patterns/column-resize';
import { PageNav } from '../../patterns/page-nav';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { useDraftRejectionRecords, useMeasurements } from '../iqc-inspection/queries';
import { useUomLookup, withUom } from '../iqc-inspection/uom-lookup';
import { specLines } from './measurement-table';
import { useRoundHistory } from './queries';

type ItemSpec = components['schemas']['InspectionItemSpec'];
type InspectionResultRow = components['schemas']['InspectionResult'];

const t = messages.partsIqcInspection;
const tm = messages.iqcInspection.measurements;
const tr = messages.iqcInspection.result.rejection;

interface HistoryProps {
  inspectionRequestId: number;
  /** 이 의뢰 검사기준의 항목 — 측정값을 항목 이름 · 차례로 읽는다. */
  specs: ItemSpec[];
  defectCodes: readonly { defectCodeId: number; defectName: string }[];
}

const judgmentStatus = (code: string): 'success' | 'error' | 'warning' | 'idle' =>
  code === 'ACCEPTED'
    ? 'success'
    : code === 'REJECTED'
      ? 'error'
      : code === 'HELD'
        ? 'warning'
        : 'idle';

/** 수량 + 단위 — 단위를 모르면 수량만. */
const QtyCell = ({ qty, uomId }: { qty: number; uomId: number }) => {
  const uoms = useUomLookup();
  return withUom(String(qty), uoms.codeOf(uomId));
};

/* 수입검사 목록 표처럼 열 폭 끌기 · 순서 바꾸기(사용자 지시 2026-11-04). 줄을 펼치는 표라 DS 표 대신 이 열 정의로 직접 그린다. */
const HISTORY_COLUMNS: Column<InspectionResultRow>[] = [
  {
    key: 'round',
    header: t.history.round,
    width: '80px',
    render: (row) => t.history.roundNo(row.inspectionRound),
  },
  {
    key: 'inspectedAt',
    header: t.history.inspectedAt,
    width: '160px',
    render: (row) => formatPlantDateTime(row.inspectedAt) ?? '-',
  },
  { key: 'inspector', header: t.history.inspector, render: (row) => row.inspectorName ?? '-' },
  {
    key: 'inspectedQty',
    header: t.history.inspectedQty,
    width: '100px',
    render: (row) => <QtyCell qty={row.inspectedQty} uomId={row.uomId} />,
  },
  {
    key: 'rejectedQty',
    header: t.history.rejectedQty,
    width: '100px',
    render: (row) => <QtyCell qty={row.rejectedQty} uomId={row.uomId} />,
  },
  {
    key: 'judgment',
    header: t.history.judgment,
    width: '96px',
    /* 판정 전 회차(작성 중)는 빈 라벨 대신 「-」(#247 · 사용자 지시 2026-11-10). */
    render: (row) =>
      row.overallJudgmentCode == null || row.overallJudgmentCode === '' ? (
        '-'
      ) : (
        <Chip size="sm" status={judgmentStatus(row.overallJudgmentCode)}>
          {t.judgment[row.overallJudgmentCode] ?? row.overallJudgmentCode}
        </Chip>
      ),
  },
  {
    key: 'status',
    header: t.history.status,
    width: '96px',
    /* 상태도 라벨로 — 작성 중은 파랑, 확정은 회색(#247 · 사용자 지시 2026-11-10). */
    render: (row) => (
      <Chip size="sm" status={row.statusCode === 'DRAFT' ? 'info' : 'idle'}>
        {t.history.statusOf[row.statusCode] ?? row.statusCode}
      </Chip>
    ),
  },
];

/**
 * 검사 이력(사용자 지시 2026-10-30) — 이 의뢰의 회차를 위에서부터 최신 순으로 읽는다. 줄을 누르면 그 회차의 측정값 ·
 * 판정 항목 · 불량 유형을 펼친다. 읽기 전용이다 — 확정한 회차는 고치지 않는다(재검사는 새 회차).
 */
export const InspectionHistory = ({ inspectionRequestId, specs, defectCodes }: HistoryProps) => {
  const history = useRoundHistory(inspectionRequestId);
  const [openId, setOpenId] = useState<number | null>(null);
  const ordered = useColumnOrder('omf-mes:parts-iqc:columns:history:order', HISTORY_COLUMNS);
  const resizable = useColumnWidths('omf-mes:parts-iqc:columns:history', ordered, {
    fitContent: true,
  });
  const fit = useFitColumns(resizable.columns, { scrollX: true });
  /* 건수 · 쪽 표시는 목록 표 아래 줄과 같은 부품(「총 N건」 · 쪽 크기 · 쪽 넘김 · 사용자 지시 2026-11-04). */
  const paging = useClientPage(history.data ?? []);

  if (history.isPending) return <p className="field-note">{t.history.loading}</p>;
  if (history.isError) return <p className="field-note">{t.history.failed}</p>;
  if (history.data.length === 0)
    /* 첨부 파일 탭의 빈 화면과 같은 모양 — 아이콘 · 제목 · 안내(#247 · 사용자 지시 2026-11-10). */
    return (
      <EmptyState
        size="sm"
        icon={<Icon name="assignment" size={32} />}
        title={t.history.empty}
        description={t.history.emptyHint}
      />
    );

  return (
    <>
      <div ref={fit.ref} className="parts-iqc-grid-scroll wide-table" style={resizable.style}>
        <table className="parts-iqc-history">
          <thead>
            <tr>
              {fit.columns.map((column) => (
                <th key={column.key} scope="col" style={{ width: column.width }}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paging.rows.map((row) => {
              const open = openId === row.inspectionResultId;
              return (
                <Fragment key={row.inspectionResultId}>
                  <tr
                    className={open ? 'is-open' : undefined}
                    aria-expanded={open}
                    tabIndex={0}
                    onClick={() => setOpenId(open ? null : row.inspectionResultId)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setOpenId(open ? null : row.inspectionResultId);
                    }}
                  >
                    {fit.columns.map((column, index) => (
                      <td key={column.key}>{column.render?.(row, index)}</td>
                    ))}
                  </tr>
                  {open && (
                    <tr className="parts-iqc-history-detail">
                      <td colSpan={fit.columns.length}>
                        <RoundDetail
                          inspectionResultId={row.inspectionResultId}
                          remarks={row.remarks ?? null}
                          uomId={row.uomId}
                          specs={specs}
                          defectCodes={defectCodes}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <PageNav {...paging.nav} />
    </>
  );
};

type Measurement = components['schemas']['InspectionMeasurement'];

const valueTextOf = (m: Measurement): string => {
  if (m.numericValue != null) return String(m.numericValue);
  if (m.textValue != null && m.textValue !== '') return m.textValue;
  if (m.booleanValue != null) return m.booleanValue ? tm.booleanTrue : tm.booleanFalse;
  return '-';
};

/** 항목 판정 — 회차 중 불합격이 있으면 불합격, 모두 합격이면 합격. 판정이 없으면 `''`. */
const itemJudgmentOf = (samples: readonly Measurement[]): string => {
  if (samples.some((m) => m.judgmentCode === 'REJECTED')) return 'REJECTED';
  return samples.length > 0 && samples.every((m) => m.judgmentCode === 'ACCEPTED')
    ? 'ACCEPTED'
    : '';
};

/** 규격 — 입력표와 같은 두 줄. 단위는 윗줄 끝에 붙인다. */
const HistorySpec = ({
  spec,
  unitOf,
}: {
  spec: ItemSpec;
  unitOf: (uomId: number | undefined) => string | null;
}) => {
  const [nominal, range] = specLines(spec);
  const top = nominal || range;
  const unit = top === '-' ? null : unitOf(spec.uomId ?? undefined);
  return (
    <>
      <span>{unit === null ? top : `${top} ${unit}`}</span>
      {nominal !== '' && range !== nominal && range !== '-' && <span>{range}</span>}
    </>
  );
};

const RoundDetail = ({
  inspectionResultId,
  remarks,
  uomId,
  specs,
  defectCodes,
}: {
  inspectionResultId: number;
  remarks: string | null;
  uomId: number;
  specs: ItemSpec[];
  defectCodes: HistoryProps['defectCodes'];
}) => {
  const uoms = useUomLookup();
  const measurements = useMeasurements(inspectionResultId);
  const defects = useDraftRejectionRecords(inspectionResultId);
  if (measurements.isPending) return <p className="field-note">{t.history.loading}</p>;
  if (measurements.isError) return <p className="field-note">{t.history.failed}</p>;

  /* 기준 차례로 — 기준에 없는 측정(기준이 바뀐 뒤의 옛 회차)은 뒤에 번호로 둔다. */
  const order = new Map(specs.map((spec, index) => [spec.inspectionItemSpecId, index]));
  const byItem = new Map<number, typeof measurements.data>();
  for (const m of measurements.data) {
    byItem.set(m.inspectionItemSpecId, [...(byItem.get(m.inspectionItemSpecId) ?? []), m]);
  }
  const itemIds = [...byItem.keys()].sort(
    (a, b) => (order.get(a) ?? Number.MAX_SAFE_INTEGER) - (order.get(b) ?? Number.MAX_SAFE_INTEGER),
  );
  const nameOf = (id: number) =>
    specs.find((spec) => spec.inspectionItemSpecId === id)?.inspectionItemName ?? `#${String(id)}`;
  const sampleColumns = Math.max(1, ...measurements.data.map((m) => m.sampleNo));
  const defectName = (id: number) =>
    defectCodes.find((code) => code.defectCodeId === id)?.defectName ?? `#${String(id)}`;

  return (
    <div className="parts-iqc-history-body">
      {itemIds.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Icon name="assignment" size={32} />}
          title={t.history.noMeasurements}
          description={t.history.emptyHint}
        />
      ) : (
        <>
          <h4 className="parts-iqc-history-heading">{tm.caption}</h4>
          <div className="parts-iqc-grid-scroll">
            <table className="parts-iqc-grid">
              <thead>
                <tr>
                  <th scope="col">{tm.columns.no}</th>
                  <th scope="col">{tm.columns.item}</th>
                  <th scope="col" className="parts-iqc-spec">
                    {tm.columns.spec}
                  </th>
                  {Array.from({ length: sampleColumns }, (_, index) => (
                    <th key={index} scope="col">
                      {t.dimension.sample(index + 1)}
                    </th>
                  ))}
                  <th scope="col" className="parts-iqc-verdict-head">
                    {tm.columns.judgment}
                  </th>
                </tr>
              </thead>
              <tbody>
                {itemIds.map((id, position) => {
                  const samples = byItem.get(id) ?? [];
                  const spec = specs.find((item) => item.inspectionItemSpecId === id);
                  const judgment = itemJudgmentOf(samples);
                  return (
                    <tr key={id}>
                      <td>{position + 1}</td>
                      <td>{nameOf(id)}</td>
                      <td className="parts-iqc-spec">
                        {spec === undefined ? (
                          '-'
                        ) : (
                          <HistorySpec spec={spec} unitOf={uoms.codeOf} />
                        )}
                      </td>
                      {Array.from({ length: sampleColumns }, (_, index) => {
                        const sample = samples.find((m) => m.sampleNo === index + 1);
                        if (sample === undefined) {
                          return (
                            <td key={index} className="parts-iqc-cell-off" aria-hidden="true" />
                          );
                        }
                        return (
                          <td
                            key={index}
                            className={
                              sample.judgmentCode === 'REJECTED'
                                ? 'parts-iqc-history-cell-ng'
                                : undefined
                            }
                          >
                            {valueTextOf(sample)}
                          </td>
                        );
                      })}
                      <td className="parts-iqc-verdict">
                        {judgment === '' ? '-' : (tm.judgmentNames[judgment] ?? judgment)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {(defects.data ?? []).length > 0 && (
        <>
          <h4 className="parts-iqc-history-heading">{t.history.defects}</h4>
          <div className="parts-iqc-grid-scroll">
            <table className="parts-iqc-grid">
              <thead>
                <tr>
                  <th scope="col">{tr.defectType}</th>
                  <th scope="col">{tr.defectQty}</th>
                  <th scope="col">{tr.description}</th>
                </tr>
              </thead>
              <tbody>
                {(defects.data ?? []).map((record) => (
                  <tr key={record.defectRecordId}>
                    <td>{defectName(record.defectCodeId)}</td>
                    <td>{withUom(String(record.defectQty), uoms.codeOf(uomId))}</td>
                    <td>{record.defectDescription ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {remarks !== null && remarks !== '' && (
        <p className="parts-iqc-history-defects">
          <strong>{t.visual.remarks}</strong> {remarks}
        </p>
      )}
    </div>
  );
};
