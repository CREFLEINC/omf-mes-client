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
     * 둘째 줄 — 기준명 · 기준코드 · 검사 유형 · 품목 · 공정을 이름표와 함께. 시안에는 없으나 무엇을 보고 있는지 알 길이라 남긴다.
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
      {/*
       * 이름표를 단 값들 — 한 줄로 이으면 무엇이 품목이고 무엇이 유형인지 알 수 없다(사용자 지시 · #196).
       * 모양은 버전 요약 상자와 같다: 테두리 상자 · 칸마다 이름표 위 · 값 아래 · 칸 사이 세로선(사용자 시안).
       */}
      <dl className="inspection-standard-facts-line inspection-standard-plan-facts">
        {[
          { label: t.fields.inspectionPlanName, value: plan.inspectionPlanName },
          { label: t.fields.inspectionPlanCode, value: plan.inspectionPlanCode },
          { label: t.fields.inspectionType, value: inspectionTypeLabel(plan.inspectionTypeCode) },
          { label: t.fields.item, value: itemLabel ?? t.detail.itemUnset },
          ...(processLabel === null ? [] : [{ label: t.fields.process, value: processLabel }]),
        ].map((fact) => (
          <div key={fact.label}>
            <dt className="field-label">{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
        {/* 기본 생략(omf-all-around#212) — 켜진 기준에만 붙인다. 이 기준이 걸리는 건은 검사 의뢰 없이 넘어간다. */}
        {(plan.defaultSkip ?? plan.pqcSkipAllowed) === true && (
          <div>
            <dt className="field-label">{t.fields.defaultSkip}</dt>
            <dd>
              <Chip variant="status" size="sm" status="info">
                {t.detail.pqcSkipOn}
              </Chip>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};
