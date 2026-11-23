import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { PlanViewLauncher } from '../iqc-inspection/plan-view-launcher';
import {
  SkippedOverview,
  type SkippedOverviewTab,
  usePlanCode,
} from '../parts-iqc-inspection/skipped-overview';
import type { InspectionRequestDetail } from '../pqc-inspection/types';
import { useItem, useLotDetail } from '../production-result/flow-queries';
import { useTargetLots, useWorkOrder } from '../production-result/queries';

const tp = messages.partsIqcInspection;
const t = messages.pqcInspectionRegister.web.summary;
/** 폐번된 LOT 은 대상이 아니다(`web-summary` 와 같다). */
const VOIDED_LIFECYCLE = 'VOIDED';

/** PQC 생략 건 상세 — IQC 생략 건과 같은 틀(사용자 지시 2026-11-23 · omf-all-around#353). */
export const PqcSkippedOverview = ({
  detail,
  uomCode,
  tabs,
}: {
  detail: InspectionRequestDetail;
  uomCode: string | null;
  /** 검사 이력 탭 — 관리웹 화면이 넘긴다(IQC 와 같은 「검사 진행 · 검사 이력」 · #353). */
  tabs?: SkippedOverviewTab[];
}) => {
  const workOrder = useWorkOrder(detail.workOrderId);
  const item = useItem(detail.itemId);
  const lot = useLotDetail(detail.lotId);
  const workOrderLots = useTargetLots(detail.lotId === null ? detail.workOrderId : null);
  const planCode = usePlanCode(detail.inspectionPlanVersionId);

  const lotNo =
    detail.lotId !== null
      ? (lot.data?.lot.lotNo ?? '-')
      : (workOrderLots.data ?? [])
          .filter((row) => row.lifecycleStatusCode !== VOIDED_LIFECYCLE)
          .map((row) => row.lotNo)
          .join(', ') || '-';
  const itemCode = item.data?.itemCode ?? workOrder.data?.itemCode;

  return (
    <SkippedOverview
      title={tp.skipped.titlePqc}
      {...(tabs === undefined ? {} : { tabs })}
      itemLabel={tp.skipped.item}
      itemParts={
        itemCode === undefined ? null : { code: itemCode, name: item.data?.itemName ?? '-' }
      }
      planCode={planCode}
      planAction={
        detail.inspectionPlanVersionId === null ? null : (
          <PlanViewLauncher
            inspectionPlanVersionId={detail.inspectionPlanVersionId}
            label={messages.iqcInspection.detail.openPlan}
          />
        )
      }
      requestNo={detail.inspectionRequestNo}
      lotNo={lotNo}
      lotFacts={[
        { key: 'workOrder', label: t.workOrder, value: workOrder.data?.workOrderNo ?? '-' },
        {
          key: 'qty',
          label: t.targetQty,
          value:
            uomCode === null ? String(detail.targetQty) : `${String(detail.targetQty)} ${uomCode}`,
        },
        {
          key: 'at',
          label: t.requestedAt,
          value: formatPlantDateTime(detail.requestedAt) ?? detail.requestedAt,
        },
      ]}
    />
  );
};
