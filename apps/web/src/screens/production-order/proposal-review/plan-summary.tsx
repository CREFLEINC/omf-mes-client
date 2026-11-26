import { PlanningDayNotice } from '../process/planning-working-days';
import { RevisionDetailButton } from '../process/revision-detail';
import { AdjustableNativeTable } from '../process/adjustable-table';
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
    <PlanningDayNotice day={plan.planDateCalendar} />
    {plan.planDateAdjustment?.outcomeCode === 'ADJUSTED' && (
      <p className="erp-wo-planning-day-notice">
        휴일 제외: {plan.planDateAdjustment.originalDate} → {plan.date}
      </p>
    )}
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
          <dd
            className={
              label === 'BOM' || label === 'Routing' ? 'proposal-revision-value' : undefined
            }
          >
            <span>{value}</span>
            {label === 'BOM' && (
              <RevisionDetailButton
                iconOnly
                kind="BOM"
                value={String(plan.bomId ?? '')}
                availabilityContext={{
                  plantId: row.plantId ?? null,
                  quantity: Number(plan.quantity) > 0 ? Number(plan.quantity) : null,
                }}
                content={
                  plan.bomId ? undefined : plan.bomComponents ? (
                    <AdjustableNativeTable
                      storageKey="proposal-preview-bom-detail"
                      className="proposal-revision-popup-table"
                      labels={['자재코드', '자재명', '소요량', '단위']}
                      widths={[160, 260, 110, 90]}
                    >
                      <tbody>
                        {plan.bomComponents.map((component) => (
                          <tr key={component.itemCode}>
                            <td>{component.itemCode}</td>
                            <td>{component.itemName}</td>
                            <td>{component.quantity.toLocaleString('ko-KR')}</td>
                            <td>{component.uom}</td>
                          </tr>
                        ))}
                      </tbody>
                    </AdjustableNativeTable>
                  ) : undefined
                }
              />
            )}{' '}
            {label === 'Routing' && (
              <RevisionDetailButton
                iconOnly
                kind="Routing"
                value={String(plan.routingId ?? '')}
                label={plan.routing}
                itemId={row.itemId}
                content={
                  plan.routingId ? undefined : (
                    <AdjustableNativeTable
                      storageKey="proposal-preview-routing-detail"
                      className="proposal-revision-popup-table"
                      labels={['공정 순서', '공정코드', '공정명', '설비 필수', '금형 필수']}
                      widths={[90, 130, 220, 100, 100]}
                    >
                      <tbody>
                        {plan.operations.map((operation) => (
                          <tr key={operation.key}>
                            <td>{operation.sequence}</td>
                            <td>{operation.processCode}</td>
                            <td>{operation.name}</td>
                            <td>
                              {operation.required.includes('plannedEquipmentId') ? '필수' : '선택'}
                            </td>
                            <td>
                              {operation.required.includes('plannedMoldId') ? '필수' : '선택'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </AdjustableNativeTable>
                  )
                }
              />
            )}
          </dd>
        </div>
      ))}
    </dl>
  </section>
);
