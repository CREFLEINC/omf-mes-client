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
    <Button variant="outlined" disabled={disabled || addDisabled} onClick={onAdd}>
      {messages.erpWorkOrderFlow.process.plan.add}
    </Button>
    {children}
  </section>
);
