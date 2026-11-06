import {
  AlertBanner,
  Breadcrumb,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DatePicker,
  TextField,
  EmptyState,
  PageHeader,
  Tabs,
  Tooltip,
  type Column,
} from '@crefle/web-ui';
import { useId, useMemo, useState } from 'react';
import { PageNav } from '../../../patterns/page-nav';
import { ActionBar } from '../../../patterns/action-bar';
import {
  ReferenceField,
  type ReferenceSource,
  type ReferenceRow,
} from '../../../patterns/reference-picker';
import { AdjustableNativeTable, AdjustableTable } from '../process/adjustable-table';
import { planWeek, shiftPlanDate } from '../process/plan-view-model';
import {
  proposalErrors,
  completionFields,
  proposedQuantity,
  resourceLabels,
  reviewStatus,
  proposalAction,
  type ResourceField,
  type ReviewOperation,
  type ReviewPlan,
  type ReviewProposal,
} from './model';
import './review.css';
import { PlanBasis } from './plan-basis';

const quantity = (value: number) =>
  Number.isFinite(value)
    ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value)
    : '—';
const planLineLabel = (plan: ReviewPlan) =>
  [
    ...new Set(
      plan.operations.map((operation) =>
        operation.resources.productionLineId
          ? `${operation.resources.productionLineId.name} (${operation.resources.productionLineId.code})`
          : '미지정',
      ),
    ),
  ].join(' / ') || '미지정';
const Help = ({ title, children }: { title: string; children: string }) => (
  <Tooltip content={children}>
    <button type="button" className="info-mark" aria-label={`${title} 도움말`}>
      ?
    </button>
  </Tooltip>
);
export interface ProposalReviewProps {
  initialProposals: ReviewProposal[];
  resourceSource: (
    proposal: ReviewProposal,
    operation: ReviewOperation,
    field: ResourceField,
  ) => ReferenceSource | null;
  onClose: () => void;
  onConfirm?: (rows: ReviewProposal[]) => Promise<void>;
  preview?: boolean;
  proposalTime?: string;
}

/** W-C review: table/calendar selection opens one common detail panel below the entire list. */
export const ProposalReview = ({
  initialProposals,
  resourceSource,
  onClose,
  onConfirm,
  preview = false,
  proposalTime,
}: ProposalReviewProps) => {
  const [rows, setRows] = useState(() => structuredClone(initialProposals));
  const [active, setActive] = useState(initialProposals[0]?.id ?? '');
  const [checked, setChecked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [view, setView] = useState('table');
  const [detail, setDetail] = useState('plan');
  const [weekDate, setWeekDate] = useState(
    initialProposals.flatMap((row) => row.plans)[0]?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [dialog, setDialog] = useState<'close' | 'confirm' | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState('');
  const remainingId = useId();
  const selected = rows.find((row) => row.id === active);
  const week = planWeek(weekDate);
  const dirty = rows.some((row) => row.changed) || checked.length > 0;
  const eligible = rows.filter((row) => !proposalErrors(row).length);
  const selectedRows = rows.filter((row) => checked.includes(row.id));
  const ready = selectedRows.length > 0 && selectedRows.every((row) => !proposalErrors(row).length);
  const edit = (planKey: string, update: (plan: ReviewPlan) => ReviewPlan) => {
    if (!selected || pending) return;
    setRows((current) =>
      current.map((row) =>
        row.id !== selected.id
          ? row
          : {
              ...row,
              changed: true,
              plans: row.plans.map((plan) =>
                plan.key === planKey && plan.source !== '기존 확정 계획'
                  ? { ...update(plan), reviewFields: completionFields(row, plan) }
                  : plan,
              ),
            },
      ),
    );
    setChecked((current) => current.filter((id) => id !== selected.id));
    setFailure('');
  };
  const pick = (
    plan: ReviewPlan,
    operation: ReviewOperation,
    field: ResourceField,
    value: ReferenceRow | null,
  ) =>
    edit(plan.key, (current) => ({
      ...current,
      recalculationRequired: current.recalculationRequired || field === 'plannedShiftId',
      operations: current.operations.map((op) =>
        op.key !== operation.key
          ? op
          : {
              ...op,
              resources: {
                ...op.resources,
                [field]: value,
                // Equipment from another line must be reviewed instead of silently surviving a line change.
                ...(field === 'productionLineId' &&
                op.resources.plannedEquipmentId?.parentId !== value?.id
                  ? { plannedEquipmentId: null }
                  : {}),
              },
            },
      ),
    }));
  const columns: Column<ReviewProposal>[] = useMemo(
    () => [
      {
        key: 'selection',
        header: '선택',
        width: '56px',
        render: (row) => (
          <Checkbox
            aria-label={`${row.number} 확정 선택`}
            checked={checked.includes(row.id)}
            disabled={pending || proposalErrors(row).length > 0}
            onChange={(event) =>
              setChecked((current) =>
                event.target.checked
                  ? [...new Set([...current, row.id])]
                  : current.filter((id) => id !== row.id),
              )
            }
          />
        ),
      },
      { key: 'no', header: 'ERP W/O', width: '180px', render: (row) => row.number },
      { key: 'code', header: '품목코드', width: '160px', render: (row) => row.itemCode },
      {
        key: 'name',
        header: '품목명',
        width: '260px',
        render: (row) => <span className="erp-wo-complete-value">{row.itemName}</span>,
      },
      {
        key: 'date',
        header: '계획일',
        width: '110px',
        render: (row) => [...new Set(row.plans.map((plan) => plan.date))].join(' / ') || '—',
      },
      {
        key: 'proposal',
        header: '생산량',
        width: '110px',
        render: (row) =>
          `${quantity(row.plans.reduce((sum, plan) => sum + (Number(plan.quantity) || 0), 0))} ${row.uom}`,
      },
      {
        key: 'line',
        header: '생산 라인',
        width: '200px',
        render: (row) => [...new Set(row.plans.map(planLineLabel))].join(' / ') || '미지정',
      },
      {
        key: 'status',
        header: '확정 검토',
        width: '150px',
        render: (row) => (
          <>
            <Chip
              status={
                reviewStatus(row) === '검토 필요'
                  ? 'warning'
                  : reviewStatus(row) === '변경 없음'
                    ? 'idle'
                    : 'success'
              }
            >
              {reviewStatus(row)}
            </Chip>
            {row.changed && <span className="proposal-changed">수정됨</span>}
          </>
        ),
      },
    ],
    [checked, pending],
  );
  const pageRows = rows.slice((page - 1) * size, page * size);
  const close = () => (dirty ? setDialog('close') : onClose());
  const confirm = async () => {
    if (!ready || !onConfirm || pending) return;
    setPending(true);
    setFailure('');
    try {
      await onConfirm(structuredClone(selectedRows));
      setRows((current) =>
        current.map((row) =>
          selectedRows.some((value) => value.id === row.id)
            ? {
                ...row,
                changed: false,
                confirmedQty: row.confirmedQty + proposedQuantity(row),
                plans: row.plans.map((plan) => ({ ...plan, source: '기존 확정 계획' as const })),
              }
            : row,
        ),
      );
      setChecked([]);
      setDialog(null);
    } catch {
      setFailure('확정 결과를 확인하지 못했습니다. 선택한 ERP W/O와 처리 결과를 확인하세요.');
      setDialog(null);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="proposal-review-page">
      <PageHeader
        title="생산계획 자동 전개 제안"
        actions={<Chip status="idle">검토 중 / 미반영</Chip>}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: '작업계획', href: '/production/production-orders' },
              { label: '생산계획 자동 전개 제안' },
            ]}
          />
        }
      />
      {preview && (
        <div className="proposal-preview-label">
          <Chip status="idle">화면 미리보기</Chip>
          <span>시험 데이터 / 저장 및 확정 미연결</span>
        </div>
      )}
      <main className="proposal-review-body">
        {failure && <AlertBanner variant="error" title={failure} />}
        <section aria-label="ERP W/O 제안 목록">
          <section className="proposal-counts" aria-label="제안 요약">
            {[
              ['제안 대상', rows.length],
              ['확정 가능', eligible.length],
              ['검토 필요', rows.filter((row) => reviewStatus(row) === '검토 필요').length],
              ['변경 없음', rows.filter((row) => reviewStatus(row) === '변경 없음').length],
            ].map(([label, count]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>
                  {count}
                  <small>건</small>
                </strong>
              </div>
            ))}
          </section>
          <div className="proposal-review-toolbar">
            <span className="field-note">
              {proposalTime ? `제안 기준 ${proposalTime}` : '제안 검토'}{' '}
              <Help title="제안 검토">
                행 선택은 상세 확인, 체크박스는 확정 대상 선택입니다. 제안은 미확정 계획량에
                포함되지 않으며 선택 확정 전에는 저장하지 않습니다.
              </Help>
            </span>
            <div>
              <Button
                size="sm"
                variant="outlined"
                disabled={pending || !eligible.length}
                onClick={() => setChecked(eligible.map((row) => row.id))}
              >
                전체 제안 중 확정 가능 {eligible.length}건 선택
              </Button>
              <Button
                size="sm"
                variant="text"
                disabled={pending || !checked.length}
                onClick={() => setChecked([])}
              >
                선택 해제
              </Button>
            </div>
          </div>
          <Tabs
            aria-label="제안 보기"
            value={view}
            onChange={setView}
            items={[
              { value: 'table', label: 'ERP W/O별 표', content: null },
              { value: 'week', label: '주간 편성 보기', content: null },
            ]}
          />
          {view === 'table' ? (
            <>
              <AdjustableTable
                storageKey="proposal-review-orders"
                columns={columns}
                rows={pageRows}
                getRowId={(row) => row.id}
                activeId={active}
                onActivate={(row) => setActive(row.id)}
                rowLabel={(row) => `${row.number} 상세`}
              />
              <PageNav
                meta={{ page, size, total: rows.length }}
                onChangePage={setPage}
                onChangeSize={(next) => {
                  setSize(next);
                  setPage(1);
                }}
              />
            </>
          ) : (
            <>
              <div className="proposal-week-nav">
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={() => setWeekDate(shiftPlanDate(week[0] ?? '', -7))}
                >
                  이전 주
                </Button>
                <strong>
                  {week[0]} ~ {week[6]}
                </strong>
                <Button
                  size="sm"
                  variant="outlined"
                  onClick={() => setWeekDate(shiftPlanDate(week[0] ?? '', 7))}
                >
                  다음 주
                </Button>
              </div>
              <div className="proposal-week-scroll">
                <AdjustableNativeTable
                  storageKey="proposal-review-week"
                  className="erp-wo-week-table"
                  labels={[
                    '생산 라인',
                    ...week.map((date) => (
                      <span key={date}>
                        {date.slice(5)}
                        <span>
                          {
                            ['일', '월', '화', '수', '목', '금', '토'][
                              new Date(`${date}T00:00:00Z`).getUTCDay()
                            ]
                          }
                        </span>
                      </span>
                    )),
                  ]}
                  widths={[180, 170, 170, 170, 170, 170, 170, 170]}
                >
                  <tbody>
                    {[
                      ...new Set(
                        rows.flatMap((row) =>
                          row.plans.filter((plan) => week.includes(plan.date)).map(planLineLabel),
                        ),
                      ),
                    ].map((line) => (
                      <tr key={line}>
                        <th scope="row">{line}</th>
                        {week.map((date) => (
                          <td key={date}>
                            {rows.flatMap((row) =>
                              row.plans
                                .filter(
                                  (plan) => plan.date === date && planLineLabel(plan) === line,
                                )
                                .map((plan) => (
                                  <div
                                    key={`${row.id}-${plan.key}`}
                                    className={`proposal-calendar-card${active === row.id ? ' is-active' : ''}`}
                                  >
                                    <button
                                      type="button"
                                      className="proposal-card-main"
                                      onClick={() => setActive(row.id)}
                                    >
                                      <strong>{row.number}</strong>
                                      <span>{row.itemCode}</span>
                                      <span>{row.itemName}</span>
                                      <span>
                                        {quantity(Number(plan.quantity))} {row.uom}
                                      </span>
                                      <span>
                                        {[
                                          ...new Set(
                                            plan.operations.map(
                                              (op) =>
                                                op.resources.productionLineId?.name ??
                                                '생산 라인 미지정',
                                            ),
                                          ),
                                        ].join(' / ')}
                                      </span>
                                      <span>{plan.source}</span>
                                    </button>
                                    {plan.source !== '기존 확정 계획' && (
                                      <label>
                                        <input
                                          type="checkbox"
                                          aria-label={`${row.number} 확정 선택`}
                                          checked={checked.includes(row.id)}
                                          disabled={pending || proposalErrors(row).length > 0}
                                          onChange={(event) =>
                                            setChecked((current) =>
                                              event.target.checked
                                                ? [...new Set([...current, row.id])]
                                                : current.filter((id) => id !== row.id),
                                            )
                                          }
                                        />
                                        확정 선택
                                      </label>
                                    )}
                                  </div>
                                )),
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </AdjustableNativeTable>
              </div>
              <p className="field-note">
                현재 주 외 계획{' '}
                {rows.reduce(
                  (sum, row) => sum + row.plans.filter((plan) => !week.includes(plan.date)).length,
                  0,
                )}
                건
              </p>
            </>
          )}
        </section>
        {selected ? (
          <section className="proposal-detail" aria-label={`${selected.number} 제안 상세`}>
            <div className="erp-wo-plan-toolbar">
              <h2 className="section-title">
                {selected.number} 상세 검토{' '}
                <Help title="제안 보완">
                  보완값은 이번 제안에만 유지됩니다. 변경한 ERP W/O는 확정 선택이 해제됩니다. BOM은
                  ERP 기본 개정을 적용합니다. 교대와 작업자는 자동 필수 항목이 아니며 공정의 필수
                  조건을 따릅니다.
                </Help>
              </h2>
              <div>
                <Chip
                  status={
                    reviewStatus(selected) === '검토 필요'
                      ? 'warning'
                      : reviewStatus(selected) === '변경 없음'
                        ? 'idle'
                        : 'success'
                  }
                >
                  {reviewStatus(selected)}
                </Chip>
                {selected.changed && <Chip status="idle">수정됨</Chip>}
              </div>
            </div>
            <p className="proposal-review-scope">
              {proposalAction(selected)} /{' '}
              {reviewStatus(selected) === '변경 없음'
                ? '기존 작업지시 유지'
                : `작업지시 ${selected.plans.reduce((sum, plan) => sum + plan.operations.length, 0)}건 생성 예정`}
            </p>
            <dl className="proposal-facts">
              {[
                ['품목코드', selected.itemCode],
                ['품목명', selected.itemName],
                [
                  '현재 계획',
                  selected.plans
                    .map((plan) => (plan.number ? `${plan.number} / ${plan.source}` : plan.source))
                    .join(', '),
                ],
                ['이번 처리', proposalAction(selected)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <dl className="proposal-quantities">
              {[
                ['공장', selected.plant],
                ['ERP W/O 수량', `${quantity(selected.orderQty)} ${selected.uom}`],
                ['확정 계획량', `${quantity(selected.confirmedQty)} ${selected.uom}`],
                ['미확정 계획량', `${quantity(selected.draftQty)} ${selected.uom}`],
                ['미편성 잔량', `${quantity(selected.remainingQty)} ${selected.uom}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {reviewStatus(selected) === '검토 필요' && (
              <AlertBanner variant="warning" title="보완 필요">
                <ul>
                  {proposalErrors(selected).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </AlertBanner>
            )}
            <Tabs
              aria-label="제안 상세 보기"
              value={detail}
              onChange={setDetail}
              items={[
                { value: 'plan', label: '생산계획', content: null },
                {
                  value: 'operations',
                  label: `공정별 작업지시 ${selected.plans.reduce((sum, plan) => sum + plan.operations.length, 0)}건`,
                  content: null,
                },
                { value: 'resources', label: '4M 배정', content: null },
              ]}
            />
            {!selected.plans.length && (
              <EmptyState
                title="생산계획 제안이 없습니다"
                description={selected.issues.join(', ')}
              />
            )}
            {selected.plans.map((plan) => (
              <section className="proposal-plan" key={plan.key}>
                {(selected.plans.length > 1 || plan.recalculationRequired) && (
                  <div className="proposal-plan-heading">
                    <h3>{plan.number ?? '생산계획 제안'}</h3>
                    <Chip status="idle">{plan.source}</Chip>
                    {plan.recalculationRequired && <Chip status="warning">공정 재검증 필요</Chip>}
                  </div>
                )}
                {detail === 'plan' ? (
                  <>
                    <PlanBasis row={selected} plan={plan} line={planLineLabel(plan)} />
                    <section className="proposal-impact">
                      <h3>확정 시 반영 사항</h3>
                      {plan.source === '기존 확정 계획' ? (
                        <p>기존 생산계획과 작업지시를 유지합니다.</p>
                      ) : (
                        <ul>
                          <li>
                            {plan.source === '신규 제안'
                              ? '생산계획 1건 생성 및 확정'
                              : `기존 미확정 계획 ${plan.number ?? ''} 확정`}
                          </li>
                          <li>공정별 작업지시 {plan.operations.length}건 생성 및 4M 보완값 반영</li>
                          <li>배포는 별도 확인 후 진행</li>
                        </ul>
                      )}
                    </section>
                    {completionFields(selected, plan).length > 0 && (
                      <section className="proposal-completion">
                        <h3>
                          제안 보완{' '}
                          <Help title="제안 보완 입력">
                            입력값은 이번 제안에만 유지됩니다. 수정한 ERP W/O는 선택을 해제하므로
                            내용을 확인하고 다시 선택하세요.
                          </Help>
                        </h3>
                        <div className="proposal-plan-fields">
                          {completionFields(selected, plan).includes('date') && (
                            <div className="field-cell">
                              <span className="field-label">계획일</span>
                              <DatePicker
                                aria-label="계획일"
                                value={plan.date || null}
                                disabled={pending || plan.source === '기존 확정 계획'}
                                onChange={(value) =>
                                  edit(plan.key, (current) => ({
                                    ...current,
                                    date: value,
                                    recalculationRequired: true,
                                  }))
                                }
                              />
                            </div>
                          )}
                          {completionFields(selected, plan).includes('quantity') && (
                            <TextField
                              label={`생산량 (${selected.uom})`}
                              aria-label="생산량"
                              inputMode="decimal"
                              value={plan.quantity}
                              error={
                                !plan.quantity ||
                                !Number.isFinite(Number(plan.quantity)) ||
                                Number(plan.quantity) <= 0
                                  ? '생산량은 0보다 커야 합니다'
                                  : undefined
                              }
                              disabled={pending || plan.source === '기존 확정 계획'}
                              onChange={(event) =>
                                edit(plan.key, (current) => ({
                                  ...current,
                                  quantity: event.target.value,
                                  recalculationRequired: true,
                                }))
                              }
                            />
                          )}
                          {completionFields(selected, plan).includes('line') && (
                            <div className="proposal-plan-line">
                              <ReferenceField
                                label="생산 라인"
                                wrapValue
                                placeholder="생산 라인 선택"
                                valueLabel={
                                  planLineLabel(plan) === '미지정' ? '' : planLineLabel(plan)
                                }
                                disabled={pending || plan.source === '기존 확정 계획'}
                                source={
                                  plan.operations[0]
                                    ? resourceSource(
                                        selected,
                                        plan.operations[0],
                                        'productionLineId',
                                      )
                                    : null
                                }
                                onPick={(value) =>
                                  edit(plan.key, (current) => ({
                                    ...current,
                                    operations: current.operations.map((operation) => ({
                                      ...operation,
                                      resources: {
                                        ...operation.resources,
                                        productionLineId: value,
                                        plannedEquipmentId:
                                          operation.resources.plannedEquipmentId?.parentId ===
                                          value.id
                                            ? operation.resources.plannedEquipmentId
                                            : null,
                                      },
                                    })),
                                  }))
                                }
                                onClear={() =>
                                  edit(plan.key, (current) => ({
                                    ...current,
                                    operations: current.operations.map((operation) => ({
                                      ...operation,
                                      resources: {
                                        ...operation.resources,
                                        productionLineId: null,
                                        plannedEquipmentId: null,
                                      },
                                    })),
                                  }))
                                }
                              />
                            </div>
                          )}
                          {completionFields(selected, plan).includes('routing') && (
                            <div className="proposal-plan-routing">
                              <ReferenceField
                                label="Routing"
                                wrapValue
                                valueLabel={plan.routing || ''}
                                placeholder="Routing 선택"
                                disabled={pending || plan.source === '기존 확정 계획'}
                                source={
                                  !plan.routingOptions?.length
                                    ? null
                                    : {
                                        title: 'Routing 선택',
                                        key: ['proposal-routing', selected.id, plan.key],
                                        columns: {
                                          code: 'Routing 코드',
                                          name: 'Routing 명칭/개정',
                                        },
                                        search: async (term, page) => {
                                          const items = plan
                                            .routingOptions!.map((option) => option.value)
                                            .filter((value) =>
                                              `${value.code} ${value.name}`.includes(term),
                                            );
                                          return {
                                            items: items.slice((page - 1) * 20, page * 20),
                                            total: items.length,
                                          };
                                        },
                                      }
                                }
                                onClear={() =>
                                  edit(plan.key, (current) => ({
                                    ...current,
                                    routing: '',
                                    operations: [],
                                    recalculationRequired: true,
                                  }))
                                }
                                onPick={(value) => {
                                  const choice = plan.routingOptions?.find(
                                    (option) => option.value.id === value.id,
                                  );
                                  if (choice)
                                    edit(plan.key, (current) => ({
                                      ...current,
                                      routing: `${value.name} (${value.code})`,
                                      operations: structuredClone(choice.operations),
                                      recalculationRequired: true,
                                    }));
                                }}
                              />
                            </div>
                          )}{' '}
                        </div>
                      </section>
                    )}
                  </>
                ) : detail === 'operations' ? (
                  <AdjustableNativeTable
                    storageKey="proposal-review-operations"
                    className="proposal-review-table"
                    labels={[
                      '공정 순서',
                      '공정코드',
                      '공정명',
                      '작업지시 번호',
                      '지시 수량',
                      '생산 라인',
                      '선행 공정',
                      '계획 시작',
                      '계획 종료',
                    ]}
                    widths={[80, 110, 150, 160, 110, 180, 140, 180, 180]}
                  >
                    <tbody>
                      {plan.operations.map((op) => (
                        <tr key={op.key}>
                          <td>{op.sequence}</td>
                          <td>{op.processCode}</td>
                          <td>{op.name}</td>
                          <td>
                            {plan.source === '기존 확정 계획' ? (op.number ?? '—') : '확정 후 채번'}
                          </td>
                          <td>
                            {quantity(op.quantity)} {selected.uom}
                            {plan.recalculationRequired && ' (변경 전 제안)'}
                          </td>
                          <td>
                            {op.resources.productionLineId
                              ? `${op.resources.productionLineId.name} (${op.resources.productionLineId.code})`
                              : '미지정'}
                          </td>
                          <td>{op.predecessors.join(', ') || '—'}</td>
                          <td className="proposal-nowrap">
                            {op.start || '미지정'}
                            {plan.recalculationRequired && ' (변경 전 제안)'}
                          </td>
                          <td className="proposal-nowrap">
                            {op.end || '미지정'}
                            {plan.recalculationRequired && ' (변경 전 제안)'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </AdjustableNativeTable>
                ) : (
                  plan.operations.map((op, index) => (
                    <details open={index === 0} key={op.key} className="proposal-operation">
                      <summary>
                        {op.sequence} {op.name}
                        <span>
                          {op.required.some((field) => !op.resources[field])
                            ? '필수 배정 보완 필요'
                            : '배정값 확인'}
                        </span>
                      </summary>
                      <div className="proposal-resource-fields">
                        {(Object.keys(resourceLabels) as ResourceField[]).map((field) => (
                          <ReferenceField
                            key={field}
                            label={resourceLabels[field]}
                            placeholder={`${resourceLabels[field]} 선택`}
                            wrapValue
                            valueLabel={
                              op.resources[field]
                                ? `${op.resources[field]!.name} (${op.resources[field]!.code})`
                                : ''
                            }
                            required={op.required.includes(field)}
                            invalid={op.required.includes(field) && !op.resources[field]}
                            disabled={pending || plan.source === '기존 확정 계획'}
                            source={resourceSource(selected, op, field)}
                            onPick={(value) => pick(plan, op, field, value)}
                            onClear={() => pick(plan, op, field, null)}
                          >
                            {op.required.includes(field) && !op.resources[field] && (
                              <span className="field-error">
                                {resourceLabels[field]}을 지정하세요
                              </span>
                            )}
                          </ReferenceField>
                        ))}
                      </div>
                    </details>
                  ))
                )}
              </section>
            ))}
          </section>
        ) : (
          <EmptyState title="검토할 ERP W/O를 선택하세요" />
        )}
      </main>
      <ActionBar
        remainingId={remainingId}
        remaining={`선택 ${checked.length}건${!onConfirm ? ' / 실제 확정 미연결' : ''}`}
      >
        <Button variant="outlined" disabled={pending} onClick={close}>
          제안 닫기
        </Button>
        <Button
          disabled={!ready || !onConfirm || pending}
          aria-describedby={remainingId}
          onClick={() => setDialog('confirm')}
        >
          선택 제안 확정
        </Button>
      </ActionBar>
      {dialog && (
        <Dialog
          open
          title={dialog === 'close' ? '제안을 닫으시겠습니까?' : '선택 제안 확정'}
          onClose={() => !pending && setDialog(null)}
          footer={
            <>
              <Button
                variant="outlined"
                disabled={pending}
                aria-describedby={`${remainingId}-dialog`}
                onClick={() => setDialog(null)}
              >
                돌아가기
              </Button>
              <Button
                disabled={pending}
                aria-describedby={`${remainingId}-dialog`}
                onClick={dialog === 'close' ? onClose : () => void confirm()}
              >
                {dialog === 'close' ? '제안 닫기' : pending ? '확정 중' : '확정'}
              </Button>
            </>
          }
        >
          <p id={`${remainingId}-dialog`}>
            {pending
              ? '확정 처리 중입니다.'
              : dialog === 'close'
                ? '확정하지 않은 보완값과 선택을 폐기합니다.'
                : `${selectedRows.map((row) => row.number).join(', ')}의 제안을 확정합니다.`}
          </p>
        </Dialog>
      )}
    </div>
  );
};
