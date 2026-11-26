import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { useApiClient } from '../../../patterns/api-context';
import { fetchAllPages } from '../../../patterns/fetch-all-pages';
import { runRequest } from '../../../patterns/request';
import { toPlantDateTimeParts } from '../../../patterns/plant-time';
import type { ProductionPlanFact } from '../../production-plan/types';
import { useRoutingOperations } from '../../routing/queries';
import { toWorkOrderFact } from '../../work-order/queries';
import type { ReleaseAttempt } from '../release-runner';
import type { OrderWorkOrder } from './queries';
import { AssignmentFacts, ReleaseInformationTable } from './release-review';
import { AdjustableNativeTable } from './adjustable-table';
import { formatQty } from './process-model';
import { MATERIAL_ISSUE_SHORTAGE_PATH } from './release-step';
import './release-result.css';

interface Props {
  focusedWorkOrderId?: number | null;
  /** 고른 작업지시를 다시 눌러 풀었다 — 첫 작업지시로 되돌리지 않는다. */
  focusCleared?: boolean;
  orderNo: string;
  itemCode?: string;
  itemName?: string;
  plans: ProductionPlanFact[];
  workOrders: OrderWorkOrder[];
  pending: boolean;
  failed: boolean;
  attempts: ReleaseAttempt[];
  shortages: string[];
  plantId: number | null;
  uomLabelOf: (id: number) => string;
  lineNameOf: (id: number | null) => string;
  statusName: (code: string) => string;
  retrying: boolean;
  onRetry: () => void;
  onEdit: () => void;
}
export const releasePresence = (status: string, releasedAt?: string | null) =>
  releasedAt
    ? '배포됨'
    : ['PLANNED', 'CONFIRMED'].includes(status)
      ? '미배포'
      : status === 'CANCELLED'
        ? '취소'
        : ['RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'SUSPENDED'].includes(status)
          ? '배포됨'
          : '확인 필요';
const dateTime = (value?: string | null) => {
  if (!value) return '기록 없음';
  const parts = toPlantDateTimeParts(value);
  return parts ? `${parts.date} ${parts.time}` : value;
};
const issueStatus = (status: string) =>
  ({
    WAITING: '대기',
    RELEASED: '배포',
    IN_PROGRESS: '진행',
    DONE: '완료',
    CANCELLED: '취소',
    REGISTERED: '등록',
    POSTED: '전기 완료',
    CANCEL_REQUESTED: '취소 요청',
  })[status] ?? status;

const SelectedResult = ({
  row,
  plan,
  attempt,
  ...props
}: Props & { row: OrderWorkOrder; plan?: ProductionPlanFact; attempt?: ReleaseAttempt }) => {
  const { client } = useApiClient();
  const detail = useQuery({
    queryKey: ['work-orders', 'release-result', row.workOrderId],
    retry: false,
    queryFn: () =>
      runRequest(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: { path: { workOrderId: row.workOrderId }, query: { withPreIssuedLots: true } },
        }),
      ),
  });
  const requests = useQuery({
    queryKey: ['work-orders', 'release-result-requests', row.workOrderId],
    retry: false,
    queryFn: () =>
      fetchAllPages((page, size) =>
        runRequest(() =>
          client.GET('/logistics/material-issue-requests', {
            params: { query: { workOrderId: row.workOrderId, page, size } },
          }),
        ),
      ),
  });
  const operations = useRoutingOperations(plan?.routingId ?? null);
  const fact = detail.data ? toWorkOrderFact(detail.data) : null;
  const operation = operations.data?.items.find(
    (entry) => entry.routingOperationId === fact?.routingOperationId,
  );
  const docs = requests.data?.items ?? attempt?.materialIssueRequests;
  return (
    <section className="erp-wo-release-result-detail" aria-label="선택 작업지시 배포 상세">
      <h3>선택 작업지시 상세</h3>
      <ReleaseInformationTable
        label="작업지시 정보"
        rows={[
          ['작업지시 번호', row.workOrderNo],
          ['공정', row.operationName],
        ]}
      />
      {attempt && attempt.status !== 'released' && (
        <AlertBanner
          variant="warning"
          title={attempt.status === 'skipped' ? '배포 보류' : '배포 실패'}
        >
          {attempt.reason}
        </AlertBanner>
      )}
      {detail.isError ? (
        <AlertBanner variant="error" title="작업지시 상세 조회 실패" />
      ) : !fact ? (
        <SkeletonText lines={3} />
      ) : (
        <>
          <div className="erp-wo-release-result-detail-grid">
            {props.focusedWorkOrderId === undefined && (
              <section>
                <h4>4M 배정</h4>
                <AssignmentFacts
                  fact={fact}
                  plantId={props.plantId}
                  lineNameOf={props.lineNameOf}
                  equipmentRequired={operation?.equipmentRequired === true}
                  moldRequired={operation?.moldRequired === true}
                />
                {operations.isError && <p>공정별 필수 설정 조회 실패</p>}
                <table className="erp-release-information-table">
                  <tbody>
                    <tr>
                      <th scope="row">계획 시작</th>
                      <td>{dateTime(fact.plannedStartAt)}</td>
                    </tr>
                    <tr>
                      <th scope="row">계획 종료</th>
                      <td>{dateTime(fact.plannedEndAt)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            )}
            <section>
              <h4>배포 및 LOT</h4>
              <ReleaseInformationTable
                paired
                label="배포 및 LOT"
                rows={[
                  ['배포 일시', dateTime(detail.data?.releasedAt)],
                  ['현재 상태', props.statusName(detail.data?.statusCode ?? row.statusCode)],
                  [
                    '선발행 LOT',
                    detail.data?.preIssuedLots
                      ? `${detail.data.preIssuedLots.slotCount}건`
                      : '정보 미제공',
                  ],
                  [
                    '실적 등록 LOT',
                    detail.data?.preIssuedLots
                      ? `${detail.data.preIssuedLots.withResultCount}건`
                      : '정보 미제공',
                  ],
                ]}
              />
            </section>
          </div>
        </>
      )}
      <section>
        <h4>연결 문서</h4>
        {requests.isError && (
          <AlertBanner variant="warning" title="자재 출고요청 조회 실패">
            {docs ? '배포 응답 기준 정보를 표시합니다.' : '문서 생성 여부를 확인하지 못했습니다.'}
          </AlertBanner>
        )}
        {requests.isPending && !docs ? (
          <SkeletonText lines={2} />
        ) : docs?.length ? (
          <AdjustableNativeTable
            storageKey="omf-mes:release-result:requests"
            labels={['구분', '문서 번호', '상태', '작업일']}
            widths={[150, 220, 120, 130]}
            className="erp-wo-final-table"
          >
            <tbody>
              {docs.map((doc) => (
                <tr key={doc.materialIssueRequestId}>
                  <td>자재 출고요청</td>
                  <td>{doc.issueRequestNo}</td>
                  <td>
                    {issueStatus(
                      'displayStatus' in doc
                        ? String(doc.displayStatus ?? doc.statusCode)
                        : doc.statusCode,
                    )}
                  </td>
                  <td>{doc.issueWorkDate ?? '미지정'}</td>
                </tr>
              ))}
            </tbody>
          </AdjustableNativeTable>
        ) : (
          !requests.isError && <p>연결된 자재 출고요청 없음</p>
        )}
      </section>
    </section>
  );
};

export const ReleaseResult = (props: Props) => {
  const retryReasonId = useId();
  const [selected, setSelected] = useState<number | null>(null);
  const [cleared, setCleared] = useState(false);
  const [stacked, setStacked] = useState(false);
  const row =
    (props.focusCleared ?? cleared)
      ? undefined
      : (props.workOrders.find(
          (entry) => entry.workOrderId === (props.focusedWorkOrderId ?? selected),
        ) ?? props.workOrders[0]);
  /* 고른 작업지시를 다시 누르면 푼다(목록 공통). */
  const pick = (workOrderId: number) => {
    setCleared(workOrderId === row?.workOrderId);
    setSelected(workOrderId);
  };
  const immediate = props.attempts.length > 0;
  const failures = props.attempts.filter((entry) => entry.status !== 'released');
  const pending = props.workOrders.filter(
    (entry) => releasePresence(entry.statusCode, entry.releasedAt) === '미배포',
  );
  const successes = props.attempts.filter((entry) => entry.status === 'released').length;
  const plans = props.plans.filter((plan) =>
    props.workOrders.some((entry) => entry.productionPlanId === plan.productionPlanId),
  );
  return (
    <section
      className={`pane erp-wo-step-pane erp-wo-release-result${stacked ? ' is-stacked' : ''}`}
      aria-label="배포 결과"
    >
      <div className="erp-wo-release-result-heading">
        <h2 className="section-title">{immediate ? '배포 결과' : '배포 완료 내역'}</h2>
        <Button variant="outlined" onClick={() => setStacked(!stacked)}>
          {stacked ? '좌우 배치' : '상하 배치'}
        </Button>
      </div>
      <div className="erp-wo-release-result-summary" role="status">
        <div>
          <span>{immediate ? '처리 결과' : '배포 상태'}</span>
          <strong>
            {props.pending
              ? '조회 중'
              : props.failed
                ? '조회 실패'
                : failures.length || pending.length
                  ? '일부 완료'
                  : '완료'}
          </strong>
        </div>
        <div>
          <span>{immediate ? '배포 성공' : '배포된 작업지시'}</span>
          <strong>
            {immediate
              ? successes
              : props.workOrders.filter(
                  (entry) => releasePresence(entry.statusCode, entry.releasedAt) === '배포됨',
                ).length}
            건
          </strong>
        </div>
        <div>
          <span>{immediate ? '실패 / 보류' : '미배포 작업지시'}</span>
          <strong>{immediate ? failures.length : pending.length}건</strong>
        </div>
      </div>
      <table className="erp-release-information-table">
        <tbody>
          <tr>
            <th scope="row">ERP W/O</th>
            <td>{props.orderNo}</td>
          </tr>
          <tr>
            <th scope="row">품목 코드</th>
            <td>{props.itemCode ?? '조회 중'}</td>
          </tr>
          <tr>
            <th scope="row">품목명</th>
            <td>{props.itemName ?? '조회 중'}</td>
          </tr>
        </tbody>
      </table>
      {props.failed && <AlertBanner variant="error" title="작업지시 목록 조회 실패" />}
      {props.pending ? (
        <SkeletonText lines={4} />
      ) : (
        (props.focusedWorkOrderId === undefined ? plans : []).map((plan) => (
          <section key={plan.productionPlanId} className="erp-wo-release-result-plan">
            <h3>생산계획 / {plan.planNo}</h3>
            <table className="erp-release-information-table">
              <tbody>
                <tr>
                  <th scope="row">계획일</th>
                  <td>{plan.planDate}</td>
                </tr>
                <tr>
                  <th scope="row">생산 라인</th>
                  <td>{props.lineNameOf(plan.plannedLineId)}</td>
                </tr>
                <tr>
                  <th scope="row">생산량</th>
                  <td>
                    {formatQty(plan.plannedQty)} {props.uomLabelOf(plan.uomId)}
                  </td>
                </tr>
              </tbody>
            </table>
            <AdjustableNativeTable
              storageKey="omf-mes:release-result:orders"
              labels={[
                '작업지시',
                '공정',
                '지시 수량',
                immediate ? '배포 결과' : '배포 여부',
                '현재 상태',
                '배포 일시',
              ]}
              widths={[220, 170, 120, 120, 130, 170]}
              className="erp-wo-final-table"
            >
              <tbody>
                {props.workOrders
                  .filter((entry) => entry.productionPlanId === plan.productionPlanId)
                  .map((entry) => {
                    const attempt = props.attempts.find(
                      (value) => value.workOrderId === entry.workOrderId,
                    );
                    return (
                      <tr
                        key={entry.workOrderId}
                        className={
                          row?.workOrderId === entry.workOrderId ? 'is-selected' : undefined
                        }
                        onClick={() => pick(entry.workOrderId)}
                      >
                        <td>
                          <button
                            type="button"
                            className="erp-wo-release-result-pick"
                            aria-pressed={row?.workOrderId === entry.workOrderId}
                            onClick={() => pick(entry.workOrderId)}
                          >
                            {entry.workOrderNo}
                          </button>
                        </td>
                        <td>{entry.operationName}</td>
                        <td>
                          {formatQty(entry.orderQty)} {props.uomLabelOf(entry.uomId)}
                        </td>
                        <td>
                          <span className="erp-wo-release-result-status">
                            {attempt
                              ? attempt.status === 'released'
                                ? '성공'
                                : attempt.status === 'failed'
                                  ? '실패'
                                  : '보류'
                              : releasePresence(entry.statusCode, entry.releasedAt)}
                          </span>
                        </td>
                        <td>{props.statusName(entry.statusCode)}</td>
                        <td>{dateTime(entry.releasedAt)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </AdjustableNativeTable>
          </section>
        ))
      )}
      {props.shortages.length > 0 && (
        <AlertBanner
          variant="warning"
          title="배포 완료 / 자재 확인 필요"
          action={
            <Link className="action-link-button" to={MATERIAL_ISSUE_SHORTAGE_PATH}>
              자재 부족분 확인
            </Link>
          }
        >
          <ul>
            {props.shortages.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </AlertBanner>
      )}
      {row && (
        <SelectedResult
          key={row.workOrderId}
          {...props}
          row={row}
          plan={props.plans.find((plan) => plan.productionPlanId === row.productionPlanId)}
          attempt={props.attempts.find((attempt) => attempt.workOrderId === row.workOrderId)}
        />
      )}
      {(failures.length > 0 || pending.length > 0) && (
        <div className="erp-wo-release-result-actions">
          <Button variant="outlined" onClick={props.onEdit} disabled={props.retrying}>
            4M 배정 확인
          </Button>
          <span id={retryReasonId}>
            {props.retrying
              ? '배포 처리 중입니다.'
              : props.pending
                ? '작업지시를 조회하고 있습니다.'
                : props.failed
                  ? '작업지시 목록을 다시 조회한 뒤 배포하세요.'
                  : ''}
          </span>
          <Button
            aria-describedby={retryReasonId}
            onClick={props.onRetry}
            disabled={props.retrying || props.pending || props.failed}
          >
            {props.retrying ? '배포 중' : '미배포 작업지시 다시 배포'}
          </Button>
        </div>
      )}
    </section>
  );
};
