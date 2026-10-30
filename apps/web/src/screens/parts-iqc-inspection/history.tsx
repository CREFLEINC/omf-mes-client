import { Chip, EmptyState, Icon } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { Fragment, useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { useDraftRejectionRecords, useMeasurements } from '../iqc-inspection/queries';
import { useRoundHistory } from './queries';

type ItemSpec = components['schemas']['InspectionItemSpec'];

const t = messages.partsIqcInspection;

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

/**
 * 검사 이력(사용자 지시 2026-10-30) — 이 의뢰의 회차를 위에서부터 최신 순으로 읽는다. 줄을 누르면 그 회차의 측정값 ·
 * 판정 항목 · 불량 유형을 펼친다. 읽기 전용이다 — 확정한 회차는 고치지 않는다(재검사는 새 회차).
 */
export const InspectionHistory = ({ inspectionRequestId, specs, defectCodes }: HistoryProps) => {
  const history = useRoundHistory(inspectionRequestId);
  const [openId, setOpenId] = useState<number | null>(null);

  if (history.isPending) return <p className="field-note">{t.history.loading}</p>;
  if (history.isError) return <p className="field-note">{t.history.failed}</p>;
  if (history.data.length === 0)
    /* 아이콘 + 한 줄(사용자 시안 2026-10-30) */
    return (
      <EmptyState size="sm" icon={<Icon name="assignment" size={24} />} title={t.history.empty} />
    );

  return (
    <div className="parts-iqc-grid-scroll">
      <table className="parts-iqc-history">
        <thead>
          <tr>
            <th scope="col">{t.history.round}</th>
            <th scope="col">{t.history.inspectedAt}</th>
            <th scope="col">{t.history.inspector}</th>
            <th scope="col">{t.history.inspectedQty}</th>
            <th scope="col">{t.history.rejectedQty}</th>
            <th scope="col">{t.history.judgment}</th>
            <th scope="col">{t.history.status}</th>
          </tr>
        </thead>
        <tbody>
          {history.data.map((row) => {
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
                  <td>{t.history.roundNo(row.inspectionRound)}</td>
                  <td>{formatPlantDateTime(row.inspectedAt) ?? '-'}</td>
                  <td>{row.inspectorName ?? '-'}</td>
                  <td>{row.inspectedQty}</td>
                  <td>{row.rejectedQty}</td>
                  <td>
                    {row.overallJudgmentCode === '' ? (
                      '-'
                    ) : (
                      <Chip size="sm" status={judgmentStatus(row.overallJudgmentCode)}>
                        {t.judgment[row.overallJudgmentCode] ?? row.overallJudgmentCode}
                      </Chip>
                    )}
                  </td>
                  <td>{t.history.statusOf[row.statusCode] ?? row.statusCode}</td>
                </tr>
                {open && (
                  <tr className="parts-iqc-history-detail">
                    <td colSpan={7}>
                      <RoundDetail
                        inspectionResultId={row.inspectionResultId}
                        remarks={row.remarks ?? null}
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
  );
};

const RoundDetail = ({
  inspectionResultId,
  remarks,
  specs,
  defectCodes,
}: {
  inspectionResultId: number;
  remarks: string | null;
  specs: ItemSpec[];
  defectCodes: HistoryProps['defectCodes'];
}) => {
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
  const defectName = (id: number) =>
    defectCodes.find((code) => code.defectCodeId === id)?.defectName ?? `#${String(id)}`;

  return (
    <div className="parts-iqc-history-body">
      {itemIds.length === 0 ? (
        <p className="field-note">{t.history.noMeasurements}</p>
      ) : (
        <dl className="parts-iqc-history-items">
          {itemIds.map((id) => (
            <div key={id}>
              <dt>{nameOf(id)}</dt>
              <dd>
                {[...(byItem.get(id) ?? [])]
                  .sort((a, b) => a.sampleNo - b.sampleNo)
                  .map((m) => (
                    <span
                      key={m.sampleNo}
                      className={m.judgmentCode === 'REJECTED' ? 'parts-iqc-history-ng' : undefined}
                    >
                      {m.numericValue != null
                        ? `n${String(m.sampleNo)} ${String(m.numericValue)}`
                        : m.booleanValue == null
                          ? '-'
                          : m.booleanValue
                            ? t.ok
                            : t.ng}
                    </span>
                  ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {(defects.data ?? []).length > 0 && (
        <p className="parts-iqc-history-defects">
          <strong>{t.history.defects}</strong>{' '}
          {(defects.data ?? [])
            .map((record) => `${defectName(record.defectCodeId)} ${String(record.defectQty)}`)
            .join(' · ')}
        </p>
      )}
      {remarks !== null && remarks !== '' && (
        <p className="parts-iqc-history-defects">
          <strong>{t.visual.remarks}</strong> {remarks}
        </p>
      )}
    </div>
  );
};
