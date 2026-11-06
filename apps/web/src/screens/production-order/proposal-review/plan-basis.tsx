import { AdjustableNativeTable } from '../process/adjustable-table';
import type { ReviewPlan, ReviewProposal } from './model';

export const PlanBasis = ({
  row,
  plan,
  line,
}: {
  row: ReviewProposal;
  plan: ReviewPlan;
  line: string;
}) => {
  const existing = plan.source !== '신규 제안';
  const values = [
    [
      '생산량',
      `ERP W/O ${row.orderQty.toLocaleString('ko-KR')} ${row.uom}`,
      `${plan.quantity || '—'} ${row.uom}`,
      existing ? '기존 계획 기반 제안' : 'ERP W/O 기반 제안',
    ],
    [
      '계획일',
      row.erpPlanStartDate ? `ERP 계획 시작일 ${row.erpPlanStartDate}` : 'ERP 계획 시작일 미제공',
      plan.date || '미지정',
      existing ? '기존 계획일 기준' : '제안 계획일',
    ],
    ['BOM', existing ? '계획에 연결된 BOM' : 'ERP 기본 BOM 개정', plan.bom || '미지정', ''],
    ['Routing', '계획에 연결된 Routing 개정', plan.routing || '미지정', ''],
    ['생산 라인', '공정별 작업지시의 생산 라인', line, ''],
  ];
  return (
    <section className="proposal-basis">
      <h3>생산계획 제안과 생성 근거</h3>
      <AdjustableNativeTable
        storageKey="proposal-review-basis"
        className="proposal-review-table"
        labels={['항목', '기준 정보', '제안과 판정']}
        widths={[110, 280, 430]}
      >
        <tbody>
          {values.map(([label, source, value, reason]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{source}</td>
              <td>
                <strong>{value}</strong>
                {reason && <span className="proposal-basis-reason">{reason}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </AdjustableNativeTable>
    </section>
  );
};
