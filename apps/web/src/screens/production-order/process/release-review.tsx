import { Fragment, type ReactNode } from 'react';
import { RevisionDetailButton } from './revision-detail';
import { AlertBanner, SkeletonText } from '@crefle/web-ui';
import { useQueries } from '@tanstack/react-query';
import { useApiClient } from '../../../patterns/api-context';
import { runRequest } from '../../../patterns/request';
import { toPlantDateTimeParts } from '../../../patterns/plant-time';
import type { ProductionPlanFact } from '../../production-plan/types';
import { useRoutingOperations } from '../../routing/queries';
import { toWorkOrderFact, workOrderKeys, type WorkOrderFact } from '../../work-order/queries';
import { useWorkOrderEquipment, useWorkOrderLocations } from '../../work-order/resource-queries';
import { useWorkOrderMold } from '../../work-order/people-tool-queries';
import { AdjustableNativeTable } from './adjustable-table';
import type { ReleaseLine } from './release-step';
import { formatQty } from './process-model';
import './release-review.css';

export const ReleaseInformationTable = ({
  rows,
  label,
  paired = false,
}: {
  rows: readonly (readonly ReactNode[])[];
  label: string;
  paired?: boolean;
}) => {
  const count = paired ? 2 : 1;
  const groups = Array.from({ length: Math.ceil(rows.length / count) }, (_, at) =>
    rows.slice(at * count, (at + 1) * count),
  );
  return (
    <table
      className={`erp-release-information-table${paired ? ' is-paired' : ''}`}
      aria-label={label}
    >
      <tbody>
        {groups.map((group, at) => (
          <tr key={at}>
            {group.map(([name, value]) => (
              <Fragment key={String(name)}>
                <th scope="row">{name}</th>
                <td>{value}</td>
              </Fragment>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export interface ReleaseReviewPlan extends ProductionPlanFact {
  revisionContent?: { bom?: ReactNode; routing?: ReactNode };
  bomLabel: string;
  routingLabel: string;
}
interface Props {
  view?: 'plan' | 'assign';
  plans: ReleaseReviewPlan[];
  lines: ReleaseLine[];
  plantId: number | null;
  lineNameOf?: (id: number | null) => string;
  uomLabelOf: (id: number) => string;
}
const dateTime = (value: string | null) => {
  if (!value) return '미지정';
  const parts = toPlantDateTimeParts(value);
  return parts ? `${parts.date} ${parts.time}` : value;
};
const name = (id: number | null, value: string | undefined, pending: boolean, failed: boolean) =>
  id === null
    ? '미지정'
    : value || `${failed ? '명칭 조회 실패' : pending ? '조회 중' : '명칭 확인 필요'} (ID ${id})`;

export const AssignmentFacts = ({
  fact,
  equipmentRequired,
  moldRequired,
  plantId,
  lineNameOf,
}: {
  fact: WorkOrderFact;
  equipmentRequired: boolean;
  moldRequired: boolean;
  plantId: number | null;
  lineNameOf?: Props['lineNameOf'];
}) => {
  const equipment = useWorkOrderEquipment(equipmentRequired ? fact.plannedEquipmentId : null);
  const mold = useWorkOrderMold(moldRequired ? fact.plannedMoldId : null);
  const locations = useWorkOrderLocations(
    [fact.defaultWipLocationId, fact.defaultFgLocationId, fact.defaultScrapLocationId].some(
      (id) => id !== null,
    )
      ? plantId
      : null,
  );
  const locationName = (id: number | null) => {
    const value = locations.items.find((row) => row.locationId === id);
    return name(
      id,
      value ? `${value.locationName} (${value.locationCode})` : undefined,
      locations.isPending,
      locations.isError,
    );
  };
  const values = [
    [
      '생산 라인',
      fact.productionLineId === null
        ? '미지정'
        : lineNameOf?.(fact.productionLineId) || `ID ${fact.productionLineId}`,
    ],
    ...(equipmentRequired
      ? [
          [
            '설비',
            name(
              fact.plannedEquipmentId,
              equipment.data
                ? `${equipment.data.equipmentName} (${equipment.data.equipmentCode})`
                : undefined,
              equipment.isPending,
              equipment.isError,
            ),
          ],
        ]
      : []),
    ...(moldRequired
      ? [
          [
            '금형',
            name(
              fact.plannedMoldId,
              mold.data ? `${mold.data.moldName} (${mold.data.moldCode})` : undefined,
              mold.isPending,
              mold.isError,
            ),
          ],
        ]
      : []),
    ...(fact.fgWarehouseDiffersFromErp
      ? [
          [
            '입고 창고 확인',
            `ERP 입고 창고와 다름: ${fact.erpStorageLocationCode} → ${fact.fgWarehouseCode}`,
          ],
        ]
      : []),
    ['WIP 위치', locationName(fact.defaultWipLocationId)],
    [
      '생산품 입고 창고',
      name(
        fact.defaultFgLocationId,
        (() => {
          const location = locations.items.find(
            (row) => row.locationId === fact.defaultFgLocationId,
          );
          return location?.warehouseName
            ? `${location.warehouseName}${location.warehouseCode ? ` (${location.warehouseCode})` : ''}`
            : undefined;
        })(),
        locations.isPending,
        locations.isError,
      ),
    ],
    ['스크랩 위치', locationName(fact.defaultScrapLocationId)],
  ];
  return <ReleaseInformationTable rows={values} label="4M 배정 정보" />;
};
const ReviewPlan = ({
  plan,
  lines,
  plantId,
  lineNameOf,
  uomLabelOf,
  view,
}: Props & { plan: ReleaseReviewPlan }) => {
  const { client } = useApiClient();
  const operations = useRoutingOperations(plan.routingId);
  const details = useQueries({
    queries: lines.map((line) => ({
      queryKey: workOrderKeys.detail(line.workOrder.workOrderId),
      retry: false,
      queryFn: async () =>
        toWorkOrderFact(
          await runRequest(() =>
            client.GET('/production/work-orders/{workOrderId}', {
              params: { path: { workOrderId: line.workOrder.workOrderId } },
            }),
          ),
        ),
    })),
  });
  return (
    <section className="erp-wo-final-plan" aria-label={`${plan.planNo} 최종 확인`}>
      <h3>{plan.planNo}</h3>
      {view !== 'assign' && (
        <section aria-label="생산계획 정보">
          <h4>생산계획</h4>
          <table className="erp-release-information-table" aria-label="생산계획 정보">
            <tbody>
              {[
                ['계획일', plan.planDate],
                ['생산량', `${formatQty(plan.plannedQty)} ${uomLabelOf(plan.uomId)}`],
                [
                  '생산 라인',
                  lineNameOf?.(plan.plannedLineId) ??
                    (plan.plannedLineId === null ? '미지정' : `ID ${plan.plannedLineId}`),
                ],
                ['BOM', plan.bomLabel],
                ['Routing', plan.routingLabel],
              ].map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td
                    className={
                      label === 'BOM' || label === 'Routing' ? 'erp-wo-final-revision' : undefined
                    }
                  >
                    {value}
                    {label === 'BOM' && (
                      <RevisionDetailButton
                        iconOnly
                        kind="BOM"
                        value={String(plan.bomId)}
                        content={plan.revisionContent?.bom}
                        availabilityContext={{ plantId, quantity: plan.plannedQty }}
                      />
                    )}{' '}
                    {label === 'Routing' && (
                      <RevisionDetailButton
                        iconOnly
                        kind="Routing"
                        content={plan.revisionContent?.routing}
                        value={String(plan.routingId)}
                        label={plan.routingLabel}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section aria-label="공정별 작업지시">
        <h4>공정별 작업지시 {lines.length}건</h4>
        <AdjustableNativeTable
          storageKey="omf-mes:release-final:work-orders"
          className="erp-wo-final-table"
          labels={[
            '공정 순서',
            '작업지시 번호',
            '공정',
            '지시 수량',
            '생산 라인',
            '계획 시작',
            '계획 종료',
          ]}
          widths={[80, 190, 180, 110, 200, 180, 180]}
        >
          <tbody>
            {lines.map((line, index) => {
              const fact = details[index]?.data;
              return (
                <tr key={line.workOrder.workOrderId}>
                  <td>
                    {fact
                      ? (operations.data?.items.find(
                          (operation) => operation.routingOperationId === fact.routingOperationId,
                        )?.operationSeq ?? '확인 필요')
                      : '조회 중'}
                  </td>
                  <td className="nowrap-cell">{line.workOrder.workOrderNo}</td>
                  <td>{line.workOrder.operationName}</td>
                  <td>
                    {formatQty(line.workOrder.orderQty)} {uomLabelOf(line.workOrder.uomId)}
                  </td>
                  <td>
                    {lineNameOf?.(
                      fact?.productionLineId ?? line.workOrder.productionLineId ?? null,
                    ) ?? '—'}
                  </td>
                  <td>
                    {fact
                      ? dateTime(fact.plannedStartAt)
                      : details[index]?.isError
                        ? '조회 실패'
                        : '조회 중'}
                  </td>
                  <td>
                    {fact
                      ? dateTime(fact.plannedEndAt)
                      : details[index]?.isError
                        ? '조회 실패'
                        : '조회 중'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdjustableNativeTable>
      </section>
      {view !== 'plan' && (
        <section aria-label="4M 배정 확인">
          <h4>4M 배정</h4>
          {operations.isError && (
            <AlertBanner variant="warning" title="공정별 필수 설정을 조회하지 못했습니다" />
          )}
          {lines.map((line, index) => {
            const result = details[index];
            const fact = result?.data;
            const operation = operations.data?.items.find(
              (row) => row.routingOperationId === fact?.routingOperationId,
            );
            return (
              <section className="erp-wo-final-operation" key={line.workOrder.workOrderId}>
                <ReleaseInformationTable
                  label="작업지시 정보"
                  rows={[
                    ['작업지시 번호', line.workOrder.workOrderNo],
                    ['공정', line.workOrder.operationName],
                  ]}
                />
                {!fact ? (
                  result?.isError ? (
                    <AlertBanner variant="error" title="작업지시 배정 정보를 조회하지 못했습니다" />
                  ) : (
                    <SkeletonText lines={2} />
                  )
                ) : (
                  <>
                    <AssignmentFacts
                      fact={fact}
                      equipmentRequired={operation?.equipmentRequired === true}
                      moldRequired={operation?.moldRequired === true}
                      plantId={plantId}
                      lineNameOf={lineNameOf}
                    />
                    {operations.isPending && <p className="field-note">공정별 필수 설정 조회 중</p>}
                  </>
                )}
              </section>
            );
          })}
        </section>
      )}
    </section>
  );
};
export const ReleaseReview = (props: Props) => (
  <section className="erp-wo-final-review" aria-label="생산계획 및 4M 최종 확인">
    <h2 className="section-title">
      {props.view === 'plan'
        ? '생산계획'
        : props.view === 'assign'
          ? '4M 배정'
          : '생산계획 및 4M 최종 확인'}
    </h2>
    {props.plans
      .filter((plan) =>
        props.lines.some((line) => line.workOrder.productionPlanId === plan.productionPlanId),
      )
      .map((plan) => (
        <ReviewPlan
          key={plan.productionPlanId}
          {...props}
          plan={plan}
          lines={props.lines.filter(
            (line) => line.workOrder.productionPlanId === plan.productionPlanId,
          )}
        />
      ))}
  </section>
);
