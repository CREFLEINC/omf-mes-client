import type { ReactNode } from 'react';
import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export const PlanCreationTools = ({
  disabled,
  addDisabled,
  onAdd,
  children,
  viewControl,
  context,
}: {
  disabled: boolean;
  addDisabled?: boolean;
  onAdd: () => void;
  children?: ReactNode;
  viewControl?: ReactNode;
  context?: ReactNode;
}) => (
  <section className="erp-wo-plan-create" aria-label="계획 편성 도구">
    {(viewControl || context) && (
      <div className="erp-wo-plan-create-view">
        {viewControl}
        {context}
      </div>
    )}
    <div className="erp-wo-plan-create-actions">
      {/* 자동 분배가 기본 동작으로 보이게 채운 단추는 자동 분배에 두고, 수동 분배는 테두리 단추다(사용자 지시 2026-11-27). */}
      <Button variant="outlined" disabled={disabled || addDisabled} onClick={onAdd}>
        {messages.erpWorkOrderFlow.process.plan.add}
      </Button>
      {children}
    </div>
  </section>
);
