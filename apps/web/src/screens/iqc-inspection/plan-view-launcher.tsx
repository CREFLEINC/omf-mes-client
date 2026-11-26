import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useLeaveFor } from '../../patterns/leave-guard';
import { DrawingImages, PlanDialog } from '../parts-iqc-inspection/plan-dialog';
import { useDrawings, useInspectionPlan, usePlanVersion } from '../parts-iqc-inspection/queries';
import { useInspectionItemSpecs } from './queries';
import { useItemNames } from './reference-lookup';
import { useUomLookup } from './uom-lookup';

export interface PlanViewLauncherProps {
  inspectionPlanVersionId: number;
  /** 단추 이름 — 기본 정보는 「기준 조회」, 검사 항목 표는 「검사 항목 조회」(#197). */
  label: string;
  size?: 'sm' | 'md';
}

/**
 * 「검사 기준 상세」 창을 여는 단추(#197) — PQC · OQC 도 IQC [기준 조회]와 같은 창을 연다(사용자 지시 2026-11-23 · #353).
 * 창의 [수정]은 검사기준 화면으로 옮긴다(저장 안 한 입력이 있으면 화면이 먼저 묻는다 · `LeaveGuardProvider`).
 */
export const PlanViewLauncher = ({
  inspectionPlanVersionId,
  label,
  size = 'md',
}: PlanViewLauncherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const versionId = isOpen ? inspectionPlanVersionId : null;
  const version = usePlanVersion(versionId);
  const specs = useInspectionItemSpecs(versionId);
  const plan = useInspectionPlan(version.data?.inspectionPlanId ?? null);
  const drawings = useDrawings(versionId);
  const items = useItemNames([plan.data?.itemId]);
  const uoms = useUomLookup();
  const leaveFor = useLeaveFor();

  return (
    <>
      <Button type="button" size={size} variant="outlined" onClick={() => setIsOpen(true)}>
        {label}
      </Button>
      {isOpen && version.data !== undefined && specs.data !== undefined && (
        <PlanDialog
          planCode={plan.data?.inspectionPlanCode ?? '-'}
          itemParts={plan.data?.itemId == null ? null : items.partsOf(plan.data.itemId)}
          version={version.data}
          specs={[...specs.data].sort((a, b) => a.sequenceNo - b.sequenceNo)}
          uomCodeOf={uoms.codeOf}
          drawings={<DrawingImages drawings={drawings.data ?? []} />}
          itemLabels={{
            code: messages.partsIqcInspection.skipped.itemCode,
            name: messages.partsIqcInspection.skipped.itemName,
          }}
          onClose={() => setIsOpen(false)}
          onEdit={(href) => {
            setIsOpen(false);
            leaveFor(href);
          }}
        />
      )}
    </>
  );
};
