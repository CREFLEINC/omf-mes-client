import { SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { InfoTip } from '../../patterns/info-tip';
import { ListEmptyRow } from '../../patterns/list-empty';
import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { formatBaseQty } from '../../patterns/package-qty';
import { formatDotDate } from '../../patterns/po-board';
import { useOpenPoLines } from './queries';
import type { Group } from './types';

const tp = messages.materialLotIssue.poLines;

export interface PoLinesProps {
  plantId: number;
  group: Group;
  /** 품목 기본 단위 번호 — 단위가 다른 라인을 뺀다. 모르면 null. */
  uomId: number | null;
}

/**
 * 고른 공급사·품목의 미입고 P/O — **입하 마감이 위에서부터 채우는 차례**로(사용자 지시 2026-11-19).
 * 자재 관리 LOT 는 발행할 때 P/O 와 묶이지 않고, 어느 P/O 로 갈지는 서버가 입하 마감 때 이 차례로 정한다(피처 005).
 * 납기만 따로 보이면 그 P/O 몫으로 읽히기 쉬워 채우는 차례 그대로 늘어놓고, 그 차례의 뜻은 제목 옆 ⓘ 가 말한다.
 */
export const PoLines = ({ plantId, group, uomId }: PoLinesProps) => {
  const lines = useOpenPoLines(plantId, group, uomId);

  const body = () => {
    if (lines.isError) {
      return <LoadErrorAlert error={lines.error} onRetry={() => void lines.refetch()} />;
    }
    if (lines.isPending) return <SkeletonText lines={2} />;

    return (
      <div className="mlot-issue-table-scroll">
        <table className="mlot-issue-table" aria-label={tp.title}>
          <thead>
            <tr>
              <th scope="col">{tp.columns.purchaseOrderNo}</th>
              <th scope="col" className="is-number">
                {tp.columns.lineNo}
              </th>
              <th scope="col">{tp.columns.orderDate}</th>
              <th scope="col">{tp.columns.dueDate}</th>
              <th scope="col" className="is-number">
                {tp.columns.remainingQty}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.data.length === 0 ? <ListEmptyRow colSpan={5} title={tp.empty} /> : null}
            {lines.data.map((line) => (
              <tr key={line.purchaseOrderLineId}>
                <td className="mlot-issue-code">{line.purchaseOrderNo}</td>
                <td className="is-number">{line.lineNo}</td>
                <td>{formatDotDate(line.orderDate)}</td>
                <td>
                  {line.expectedReceiptDate == null ? '—' : formatDotDate(line.expectedReceiptDate)}
                </td>
                <td className="is-number">{formatBaseQty(line.remainingQty, group.uomCode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <div className="mlot-issue-section-head">
        <h2 className="pane-title">
          {tp.title}
          {lines.data !== undefined && lines.data.length > 0 && (
            <>
              {' '}
              <span className="mlot-issue-count">{tp.count(lines.data.length)}</span>
            </>
          )}
        </h2>
        {/* 채우는 차례는 제목 옆 ⓘ 로 — 늘 펼쳐 둘 문장은 아니다(관리웹 정리 시안 A). */}
        {lines.data !== undefined && lines.data.length > 0 && <InfoTip text={tp.fillOrder} />}
      </div>
      {body()}
    </>
  );
};
