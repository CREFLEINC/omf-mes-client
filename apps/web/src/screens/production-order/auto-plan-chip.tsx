import { Chip } from '@crefle/web-ui';
import type { AutoPlanReason, ProductionOrderAutoPlan } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

const t = messages.productionOrder;

export const autoPlanReasonLabels = (reasons: readonly AutoPlanReason[]): string[] =>
  reasons.map((reason) => t.values.autoPlanReasons[reason]);

export interface AutoPlanChipProps {
  autoPlan: ProductionOrderAutoPlan | null;
  /** 사유를 따로 보이는 자리(기본 정보)에서는 끈다 — 같은 말을 두 번 읽지 않게. */
  withReasonHint?: boolean;
}

export const AutoPlanChip = ({ autoPlan, withReasonHint = true }: AutoPlanChipProps) => {
  if (autoPlan === null) return null;

  const reasons = withReasonHint ? autoPlanReasonLabels(autoPlan.reasons).join(' · ') : '';
  return (
    /* 사유는 표 칸에 넣기에 길어 마우스 올림과 읽어 주기로만 낸다. */
    <Chip
      variant="status"
      status={autoPlan.status === 'DONE' ? 'success' : 'warning'}
      size="sm"
      title={reasons === '' ? undefined : reasons}
    >
      {t.values.autoPlanStatus[autoPlan.status]}
      {reasons !== '' && <span className="production-order-visually-hidden">: {reasons}</span>}
    </Chip>
  );
};
