import type { ReviewPlan, ReviewProposal } from './model';

export const PlanSummary = ({
  row,
  plan,
  line,
}: {
  row: ReviewProposal;
  plan: ReviewPlan;
  line: string;
}) => (
  <section className="proposal-plan-summary" aria-label="생산계획 정보">
    <h3>생산계획</h3>
    <dl className="proposal-plan-information">
      {[
        ['계획일', plan.date || '미지정'],
        ['생산량', `${plan.quantity || '—'} ${row.uom}`],
        ['생산 라인', line],
        ['BOM', plan.bom || '미지정'],
        ['Routing', plan.routing || '미지정'],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  </section>
);
