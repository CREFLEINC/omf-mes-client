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
      <Button disabled={disabled || addDisabled} onClick={onAdd}>
        {messages.erpWorkOrderFlow.process.plan.add}
      </Button>
      {children}
    </div>
  </section>
);
