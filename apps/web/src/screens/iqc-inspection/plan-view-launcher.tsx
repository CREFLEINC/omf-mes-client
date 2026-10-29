import { Button } from '@crefle/web-ui';
import { useState } from 'react';

import { useLeaveFor } from '../../patterns/leave-guard';
import { toMeasurementRows } from './measurement-rows';
import { PlanViewDialog } from './plan-view-dialog';
import { useInspectionItemSpecs, useSamplingRule } from './queries';
import { useUomLookup } from './uom-lookup';

export interface PlanViewLauncherProps {
  inspectionPlanVersionId: number;
  /** 단추 이름 — 기본 정보는 「기준 조회」, 검사 항목 표는 「검사 항목 조회」(#197). */
  label: string;
  size?: 'sm' | 'md';
}

/**
 * 「적용 검사 기준」 창을 여는 단추(#197) — IQC 의 [기준 조회]와 같은 창을 PQC · OQC 에서도 연다. 창의 [수정]은 검사기준 화면으로
 * 옮긴다(저장 안 한 입력이 있으면 화면이 먼저 묻는다 · `LeaveGuardProvider`).
 */
export const PlanViewLauncher = ({
  inspectionPlanVersionId,
  label,
  size = 'md',
}: PlanViewLauncherProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const rule = useSamplingRule(isOpen ? inspectionPlanVersionId : null);
  const specs = useInspectionItemSpecs(isOpen ? inspectionPlanVersionId : null);
  const uoms = useUomLookup();
  const leaveFor = useLeaveFor();

  return (
    <>
      <Button type="button" size={size} variant="outlined" onClick={() => setIsOpen(true)}>
        {label}
      </Button>
      {isOpen && rule.data !== undefined && (
        <PlanViewDialog
          rule={rule.data}
          rows={toMeasurementRows(specs.data ?? [], [], uoms.codeOf)}
          isLoading={specs.isLoading}
          onClose={() => setIsOpen(false)}
          onEdit={() => {
            setIsOpen(false);
            leaveFor(
              `/master-data/inspection-standard?plan=${String(rule.data.inspectionPlanId)}&ver=${String(inspectionPlanVersionId)}`,
            );
          }}
        />
      )}
    </>
  );
};
