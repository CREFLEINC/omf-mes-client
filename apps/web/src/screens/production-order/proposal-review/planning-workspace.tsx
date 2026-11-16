import { useProductionLineReferenceQuery } from '../../production-plan/reference-queries';
import { useRef, useState } from 'react';
import { AlertBanner, Button, Tabs } from '@crefle/web-ui';
import {
  ReferenceField,
  type ReferenceSource,
  type ReferenceRow,
} from '../../../patterns/reference-picker';
import { DateTimeField } from '../../../patterns/date-time-field';
import { AdjustableLayout } from '../process/adjustable-layout';
import { AdjustableNativeTable, AdjustableTable } from '../process/adjustable-table';
import { MasterDetails } from '../process/master-details';
import { PlanStep } from '../process/plan-step';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import {
  resourceLabels,
  type ReviewPlan,
  type ReviewProposal,
  type ReviewOperation,
  type ResourceField,
} from './model';
import { PlanSummary } from './plan-summary';

interface Props {
  row: ReviewProposal;
  pending: boolean;
  onPlansChange: (plans: ReviewPlan[]) => void;
  source: (
    row: ReviewProposal,
    operation: ReviewOperation,
    field: ResourceField,
  ) => ReferenceSource | null;
  edit: (key: string, update: (plan: ReviewPlan) => ReviewPlan) => void;
  pick: (
    plan: ReviewPlan,
    op: ReviewOperation,
    field: ResourceField,
    value: ReferenceRow | null,
  ) => void;
}
export const ProposalPlanningWorkspace = ({
  row,
  pending,
  onPlansChange,
  source,
  edit,
  pick,
}: Props) => {
  const [stage, setStage] = useState('plan');
  const template = useRef(row.plans[0]);
  const addPlan = () => {
    const original = template.current;
    if (!original || pending) return;
    const remaining = Math.max(
      0,
      row.orderQty -
        row.confirmedQty -
        row.plans
          .filter((p) => p.source !== '기존 확정 계획')
          .reduce((sum, p) => sum + Number(p.quantity || 0), 0),
    );
    if (!remaining) return;
    const key = crypto.randomUUID();
    onPlansChange([
      ...row.plans,
      {
        ...structuredClone(original),
        key,
        number: undefined,
        source: '신규 제안',
        quantity: String(remaining),
        recalculationRequired: true,
        operations: original.operations.map((op) => ({
          ...structuredClone(op),
          key: `${key}-${op.key}`,
          number: undefined,
        })),
      },
    ]);
  };
  const [activeOperation, setActiveOperation] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const plan = row.plans.find((p) => p.key === activePlan) ?? row.plans[0];
  const operations = row.plans.flatMap((p) => p.operations.map((op) => ({ plan: p, op })));
  const selected = operations.find((entry) => entry.op.key === activeOperation) ?? operations[0];
  const lineReference = useProductionLineReferenceQuery(row.plantId ?? null);
  const lines = [
    ...new Map(
      [
        ...(lineReference.data?.items ?? []).map((line) => ({
          id: line.productionLineId,
          code: line.lineCode,
          name: line.lineName,
        })),
        ...operations.flatMap(({ op }) =>
          op.resources.productionLineId ? [op.resources.productionLineId] : [],
        ),
      ].map((line) => [line.id, { id: line.id, code: line.code, name: line.name }]),
    ).values(),
  ];
  const editorRows: ProductionPlanEditorStateRow[] = row.plans.map((p, index) => ({
    key: p.key,
    displayNo: index + 1,
    planNo: p.number ?? null,
    productionPlanId: null,
    statusCode: p.source === '기존 확정 계획' ? 'CONFIRMED' : 'PLANNED',
    confirmed: p.source === '기존 확정 계획',
    isPending: false,
    errors: {},
    baseline: null,
    versionNo: null,
    isDirty: !!row.changed,
    draft: {
      planDate: p.date,
      plannedQty: p.quantity,
      bomId: String(p.bomId ?? ''),
      routingId: String(p.routingId ?? ''),
      plannedLineId: String(p.operations[0]?.resources.productionLineId?.id ?? ''),
      remarks: '',
      ...(p.planDateSourceCode ? { planDateSourceCode: p.planDateSourceCode } : {}),
    },
  }));
  const locked = pending || plan?.source === '기존 확정 계획';
  const changeLine = (p: ReviewPlan, value: ReferenceRow | null) =>
    edit(p.key, (current) => ({
      ...current,
      recalculationRequired: true,
      operations: current.operations.map((op) => ({
        ...op,
        resources: {
          ...op.resources,
          productionLineId: value,
          plannedEquipmentId:
            op.resources.plannedEquipmentId?.parentId === value?.id
              ? op.resources.plannedEquipmentId
              : null,
        },
      })),
    }));
  const operationTable = (p: ReviewPlan) => (
    <AdjustableNativeTable
      storageKey="proposal-manual-style:operations"
      className="proposal-review-table"
      labels={[
        '공정 순서',
        '공정 코드',
        '공정명',
        '작업지시 번호',
        '지시 수량',
        '생산 라인',
        '계획 시작',
        '계획 종료',
      ]}
      widths={[80, 120, 150, 160, 110, 180, 180, 180]}
    >
      <tbody>
        {p.operations.map((op) => (
          <tr key={op.key}>
            <td>{op.sequence}</td>
            <td>{op.processCode}</td>
            <td>{op.name}</td>
            <td>{op.number ?? '확정 후 채번'}</td>
            <td>
              {op.quantity.toLocaleString()} {row.uom}
              {p.recalculationRequired ? ' (변경 전 제안)' : ''}
            </td>
            <td>{op.resources.productionLineId?.name ?? '미지정'}</td>
            <td>{op.start || '미지정'}</td>
            <td>{op.end || '미지정'}</td>
          </tr>
        ))}
      </tbody>
    </AdjustableNativeTable>
  );
  const routingSource: ReferenceSource = {
    title: 'Routing 선택',
    key: ['proposal-routing-workspace', row.id, plan?.key ?? ''],
    columns: { code: 'Routing 코드', name: 'Routing 명칭/개정' },
    search: async (term, page) => {
      const items = (plan?.routingOptions ?? [])
        .map((option) => option.value)
        .filter((option) => `${option.code} ${option.name}`.includes(term));
      return { items: items.slice((page - 1) * 20, page * 20), total: items.length };
    },
  };
  return (
    <section className="proposal-manual-workspace" aria-label="자동 전개 편성 검토">
      <Tabs
        className="erp-wo-stage-tabs"
        aria-label="자동 전개 검토 단계"
        value={stage}
        onChange={setStage}
        items={[
          { value: 'master', label: 'BOM·Routing', content: null },
          { value: 'plan', label: '생산계획', content: null },
          { value: 'resources', label: '4M 배정', content: null },
          { value: 'review', label: '확정 검토', content: null },
        ]}
      />
      {!plan ? (
        <div>
          <p>검토할 생산계획이 없습니다.</p>
          <Button variant="outlined" disabled={pending || !template.current} onClick={addPlan}>
            계획 추가
          </Button>
        </div>
      ) : (
        <>
          {stage === 'master' && (
            <>
              {plan.bomId && plan.routingId ? (
                <MasterDetails
                  bomId={String(plan.bomId)}
                  routingId={String(plan.routingId)}
                  itemId={row.itemId}
                  locked={plan.source === '기존 확정 계획'}
                  disabled={pending}
                  options={
                    plan.routingOptions?.length
                      ? plan.routingOptions.map((option) => ({
                          value: String(option.value.id),
                          label: `${option.value.name} (${option.value.code})`,
                        }))
                      : [{ value: String(plan.routingId), label: plan.routing }]
                  }
                  onRoutingChange={(value) => {
                    const choice = plan.routingOptions?.find(
                      (option) => String(option.value.id) === value,
                    );
                    if (choice)
                      edit(plan.key, (current) => ({
                        ...current,
                        routingId: choice.value.id,
                        routing: `${choice.value.name} (${choice.value.code})`,
                        operations: structuredClone(choice.operations),
                        recalculationRequired: true,
                      }));
                  }}
                />
              ) : (
                <>
                  <h3>BOM 구성</h3>
                  <p>{plan.bom || 'ERP 기본 BOM 확인 필요'}</p>
                  <AdjustableNativeTable
                    storageKey="proposal-manual-style:bom"
                    className="proposal-review-table"
                    labels={['자재 코드', '자재명', '소요량', '단위']}
                    widths={[160, 260, 110, 90]}
                  >
                    <tbody>
                      {plan.bomComponents?.map((material) => (
                        <tr key={material.itemCode}>
                          <td>{material.itemCode}</td>
                          <td>{material.itemName}</td>
                          <td>{material.quantity}</td>
                          <td>{material.uom}</td>
                        </tr>
                      ))}
                    </tbody>
                  </AdjustableNativeTable>
                  <ReferenceField
                    wrapValue
                    label="Routing"
                    valueLabel={plan.routing}
                    disabled={locked}
                    source={routingSource}
                    onPick={(value) => {
                      const choice = plan.routingOptions?.find(
                        (option) => option.value.id === value.id,
                      );
                      if (choice)
                        edit(plan.key, (current) => ({
                          ...current,
                          routingId: value.id,
                          routing: value.name,
                          operations: structuredClone(choice.operations),
                          recalculationRequired: true,
                        }));
                    }}
                    onClear={() =>
                      edit(plan.key, (current) => ({
                        ...current,
                        routing: '',
                        operations: [],
                        recalculationRequired: true,
                      }))
                    }
                  />
                  {operationTable(plan)}
                </>
              )}
            </>
          )}
          {stage === 'plan' && (
            <>
              <dl className="erp-wo-plan-totals" role="group" aria-label="ERP W/O 계획 수량">
                {[
                  ['ERP W/O 수량', row.orderQty],
                  ['확정 계획량', row.confirmedQty],
                  ['미확정 계획량', row.draftQty],
                  ['미계획 수량', row.remainingQty],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>
                      {Number(value).toLocaleString()} {row.uom}
                    </dd>
                  </div>
                ))}
              </dl>
              <PlanStep
                rows={editorRows}
                orderQty={row.orderQty}
                confirmedQty={row.confirmedQty}
                plantId={row.plantId ?? null}
                lines={lines}
                uomLabel={row.uom}
                disabled={pending}
                failures={[]}
                statusNameOf={(code) => (code === 'CONFIRMED' ? '확정' : '제안')}
                rowIdentityOf={() => ({
                  orderNo: row.number,
                  itemCode: row.itemCode,
                  itemName: row.itemName,
                })}
                onSelectedKeyChange={setActivePlan}
                onAdd={addPlan}
                onAppend={(drafts) => {
                  const original = template.current;
                  if (!original || pending) return;
                  onPlansChange([
                    ...row.plans,
                    ...drafts.map((draft) => {
                      const key = crypto.randomUUID();
                      const line = lines.find((line) => String(line.id) === draft.plannedLineId);
                      return {
                        ...structuredClone(original),
                        key,
                        number: undefined,
                        source: '신규 제안' as const,
                        date: draft.planDate,
                        quantity: draft.plannedQty,
                        recalculationRequired: true,
                        operations: original.operations.map((op) => ({
                          ...structuredClone(op),
                          key: `${key}-${op.key}`,
                          number: undefined,
                          resources: {
                            ...op.resources,
                            productionLineId: line ?? null,
                            plannedEquipmentId:
                              op.resources.plannedEquipmentId?.parentId === line?.id
                                ? op.resources.plannedEquipmentId
                                : null,
                          },
                        })),
                      };
                    }),
                  ]);
                }}
                onSplit={(entry, parts) => {
                  const original = row.plans.find((plan) => plan.key === entry.key);
                  if (!original || pending || original.source === '기존 확정 계획') return;
                  onPlansChange(
                    row.plans.flatMap((plan) =>
                      plan.key !== entry.key
                        ? [plan]
                        : parts.map((part, index) => {
                            const key = index === 0 ? original.key : crypto.randomUUID();
                            return {
                              ...structuredClone(original),
                              key,
                              number: index === 0 ? original.number : undefined,
                              date: part.planDate,
                              quantity: part.plannedQty,
                              planDateSourceCode: part.planDateSourceCode,
                              recalculationRequired: true,
                              operations: original.operations.map((op) => ({
                                ...structuredClone(op),
                                key: `${key}-${op.key}`,
                                number: undefined,
                              })),
                            };
                          }),
                    ),
                  );
                }}
                addDisabled={
                  pending ||
                  row.orderQty -
                    row.confirmedQty -
                    row.plans
                      .filter((p) => p.source !== '기존 확정 계획')
                      .reduce((sum, p) => sum + Number(p.quantity || 0), 0) <=
                    0
                }
                hideTotals
                unconfirmedLabel="제안"
                onChange={(key, field, value) => {
                  const p = row.plans.find((candidate) => candidate.key === key);
                  if (!p) return;
                  if (field === 'plannedLineId') {
                    const line = lines.find((candidate) => String(candidate.id) === value);
                    changeLine(p, line ?? null);
                  } else
                    edit(key, (current) => ({
                      ...current,
                      ...(field === 'planDate'
                        ? { date: value, planDateSourceCode: 'USER' as const }
                        : field === 'plannedQty'
                          ? { quantity: value }
                          : {}),
                      recalculationRequired: true,
                    }));
                }}
                onRemove={(entry) => onPlansChange(row.plans.filter((p) => p.key !== entry.key))}
              />
            </>
          )}
          {stage === 'resources' && (
            <AdjustableLayout
              storageKey="omf-mes:proposal-review:assignment-layout"
              label="작업지시 목록과 4M 배정"
              ratio={0.36}
            >
              <section className="pane erp-wo-assign-list" aria-label="작업지시 목록">
                <h3 className="section-title">작업지시 목록 {operations.length}건</h3>
                <AdjustableTable
                  storageKey="proposal-manual-style:assignment-rows"
                  columns={[
                    {
                      key: 'operation',
                      header: '공정',
                      render: ({ plan: p, op }: (typeof operations)[number]) => (
                        <span className="erp-wo-assign-target">
                          <span>{op.name}</span>
                          <small>
                            {p.date} / {op.quantity.toLocaleString()} {row.uom}
                          </small>
                          <small>{op.number ?? '확정 후 채번'}</small>
                        </span>
                      ),
                    },
                    {
                      key: 'state',
                      header: '배정',
                      render: ({ op }: (typeof operations)[number]) =>
                        op.required.some((field) => !op.resources[field])
                          ? '보완 필요'
                          : '배정값 확인',
                    },
                  ]}
                  rows={operations}
                  getRowId={(entry) => entry.op.key}
                  activeId={selected?.op.key ?? null}
                  rowLabel={(entry) => `${entry.op.sequence} ${entry.op.name} 배정`}
                  onActivate={(entry) => setActiveOperation(entry.op.key)}
                />
              </section>
              <section className="pane erp-wo-assign-editor" aria-label="4M 배정 입력">
                <h3 className="section-title">4M 배정</h3>
                {selected && (
                  <>
                    <p>
                      {selected.op.sequence}. {selected.op.name} / {selected.plan.date}
                    </p>
                    {selected.plan.recalculationRequired && (
                      <AlertBanner
                        variant="warning"
                        title="공정 재검증 필요 / 변경 전 작업지시 정보"
                      />
                    )}
                    <div className="proposal-resource-fields">
                      {[...selected.op.required]
                        .sort(
                          (a, b) =>
                            [
                              'productionLineId',
                              'plannedEquipmentId',
                              'plannedMoldId',
                              'responsibleWorkerId',
                              'plannedShiftId',
                              'defaultWipLocationId',
                              'defaultFgLocationId',
                              'defaultScrapLocationId',
                            ].indexOf(a) -
                            [
                              'productionLineId',
                              'plannedEquipmentId',
                              'plannedMoldId',
                              'responsibleWorkerId',
                              'plannedShiftId',
                              'defaultWipLocationId',
                              'defaultFgLocationId',
                              'defaultScrapLocationId',
                            ].indexOf(b),
                        )
                        .filter(
                          (field) =>
                            field !== 'defaultFgLocationId' ||
                            !row.erpStorage?.erpStorageLocationCode,
                        )
                        .map((field) => (
                          <ReferenceField
                            key={field}
                            wrapValue
                            label={resourceLabels[field]}
                            valueLabel={
                              selected.op.resources[field]
                                ? `${selected.op.resources[field]!.name} (${selected.op.resources[field]!.code})`
                                : ''
                            }
                            required
                            invalid={!selected.op.resources[field]}
                            disabled={pending || selected.plan.source === '기존 확정 계획'}
                            source={source(row, selected.op, field)}
                            onPick={(value) => pick(selected.plan, selected.op, field, value)}
                            onClear={() => pick(selected.plan, selected.op, field, null)}
                          />
                        ))}
                    </div>
                    <section aria-label="생산품 입고 창고">
                      <dl className="erp-wo-final-facts">
                        <div>
                          <dt>생산품 입고 창고</dt>
                          <dd>
                            {row.erpStorage?.warehouse
                              ? `${row.erpStorage.warehouse.name} (${row.erpStorage.warehouse.code})`
                              : (row.erpStorage?.erpStorageLocationCode ?? 'ERP 미지정')}
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <div className="assign-plan-row">
                      <DateTimeField
                        label="계획 시작"
                        value={selected.op.start.replace(' ', 'T')}
                        disabled={pending || selected.plan.source === '기존 확정 계획'}
                        onChange={(value) =>
                          edit(selected.plan.key, (current) => ({
                            ...current,
                            recalculationRequired: true,
                            operations: current.operations.map((op) =>
                              op.key === selected.op.key ? { ...op, start: value } : op,
                            ),
                          }))
                        }
                      />
                      <DateTimeField
                        label="계획 종료"
                        value={selected.op.end.replace(' ', 'T')}
                        disabled={pending || selected.plan.source === '기존 확정 계획'}
                        onChange={(value) =>
                          edit(selected.plan.key, (current) => ({
                            ...current,
                            recalculationRequired: true,
                            operations: current.operations.map((op) =>
                              op.key === selected.op.key ? { ...op, end: value } : op,
                            ),
                          }))
                        }
                      />
                    </div>
                  </>
                )}
              </section>
            </AdjustableLayout>
          )}
          {stage === 'review' &&
            row.plans.map((p) => (
              <section key={p.key} className="proposal-plan">
                <PlanSummary
                  row={row}
                  plan={p}
                  line={p.operations[0]?.resources.productionLineId?.name ?? '미지정'}
                />
                {p.recalculationRequired && (
                  <AlertBanner variant="warning" title="변경한 내용의 재검증이 필요합니다" />
                )}
                {operationTable(p)}
                <h3>4M 배정</h3>
                {p.operations.map((op) => (
                  <dl key={op.key} className="erp-wo-final-facts">
                    <div>
                      <dt>공정</dt>
                      <dd>{op.name}</dd>
                    </div>
                    {op.required.map((field) => (
                      <div key={field}>
                        <dt>{resourceLabels[field]}</dt>
                        <dd>{op.resources[field]?.name ?? '미지정'}</dd>
                      </div>
                    ))}
                  </dl>
                ))}
              </section>
            ))}
          <div className="proposal-workspace-navigation">
            <Button
              variant="outlined"
              disabled={stage === 'master'}
              onClick={() =>
                setStage(
                  ['master', 'plan', 'resources', 'review'][
                    ['master', 'plan', 'resources', 'review'].indexOf(stage) - 1
                  ]!,
                )
              }
            >
              이전
            </Button>
            {stage !== 'review' && (
              <Button
                onClick={() =>
                  setStage(
                    ['master', 'plan', 'resources', 'review'][
                      ['master', 'plan', 'resources', 'review'].indexOf(stage) + 1
                    ]!,
                  )
                }
              >
                다음: {stage === 'master' ? '생산계획' : stage === 'plan' ? '4M 배정' : '확정 검토'}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
};
