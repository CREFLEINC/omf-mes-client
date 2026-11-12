import type { ReactNode } from 'react';
import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export const PlanCreationTools = ({
  disabled,
  addDisabled,
  onAdd,
  children,
}: {
  disabled: boolean;
  addDisabled?: boolean;
  onAdd: () => void;
  children?: ReactNode;
}) => (
  <section className="erp-wo-plan-create" aria-label="계획 편성 도구">
    <div className="erp-wo-plan-create-label">
      <strong>계획 추가·자동 분배</strong>
      <span className="field-note">직접 추가하거나 조건에 따라 자동 분배하세요.</span>
    </div>
    <Button variant="outlined" disabled={disabled || addDisabled} onClick={onAdd}>
      {messages.erpWorkOrderFlow.process.plan.add}
    </Button>
    {children}
  </section>
);
