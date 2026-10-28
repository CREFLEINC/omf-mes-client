import { Button, Chip, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { inspectionTypeLabel } from './code-options';
import { formatApprovedAt } from './plan-mappers';
import type { InspectionPlan } from './types';

const t = messages.inspectionStandard;

export interface PlanDetailHeadProps {
  plan: InspectionPlan;
  /** 품목 표시 이름. 비었으면(전 품목 공통 기준) 「품목 미지정」 */
  itemLabel: string | null;
  /** 공정 표시 이름. 없으면 적지 않는다 */
  processLabel: string | null;
  onEdit: () => void;
}

/**
 * 검사 기준 상세 카드의 머리(omf-all-around#196) — 기준명 · 기준 코드 · 승인/사용 칩 · 「유형 · 품목」 한 줄.
 * 기본 정보(코드 · 이름 · 유형 · 품목 · 공정 · 라우팅)는 「기본 정보 수정」 창에서 고친다.
 */
export const PlanDetailHead = ({ plan, itemLabel, processLabel, onEdit }: PlanDetailHeadProps) => {
  const approvedAt = formatApprovedAt(plan.approvedAt);

  return (
    /*
     * 첫 줄 — 「검사 기준 상세」 · 승인/사용 칩, 오른쪽 끝 기본 정보 수정(사용자 시안 · #196).
     * 둘째 줄 — 기준명 · 코드 · 유형 · 품목 · 공정. 시안에는 없으나 무엇을 보고 있는지 알 길이라 남긴다.
     */
    <div className="inspection-standard-plan-head-card">
      <div className="inspection-standard-plan-head">
        <div className="inspection-standard-plan-chips">
          <h2 className="pane-title">{t.detail.title}</h2>
          {/* 승인 · 사용은 전용 액션으로만 바뀐다 — 값 표기로만 낸다. */}
          <Chip variant="status" status={approvedAt === null ? 'warning' : 'success'}>
            {approvedAt === null ? t.detail.chipNotApproved : t.values.approvedAt(approvedAt)}
          </Chip>
          <Chip variant="status" status={plan.isActive ? 'success' : 'idle'}>
            {plan.isActive ? t.detail.chipActive : t.detail.chipInactive}
          </Chip>
        </div>
        <Button variant="outlined" leadingIcon={<Icon name="edit" size={18} />} onClick={onEdit}>
          {t.detail.editBasic}
        </Button>
      </div>
      <p className="inspection-standard-plan-meta">
        {[
          plan.inspectionPlanName,
          plan.inspectionPlanCode,
          inspectionTypeLabel(plan.inspectionTypeCode),
          itemLabel ?? t.detail.itemUnset,
          processLabel,
        ]
          .filter((part): part is string => part !== null)
          .join(' · ')}
        {/* PQC 생략 허용(omf-all-around#119) — 켜진 PQC 기준에만 붙인다. 이 기준으로 배포한 W/O 의 PQC 가 생략된다. */}
        {plan.inspectionTypeCode === 'PQC' && plan.pqcSkipAllowed === true && (
          <Chip variant="status" size="sm" status="info">
            {t.fields.pqcSkipAllowed}
          </Chip>
        )}
      </p>
    </div>
  );
};
