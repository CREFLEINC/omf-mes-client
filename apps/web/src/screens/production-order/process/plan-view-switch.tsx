import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
const t = messages.erpWorkOrderFlow.process.plan.workspace;
export const PlanViewSwitch = ({
  value,
  onChange,
  layoutToolsId,
}: {
  value: string;
  layoutToolsId?: string;
  onChange: (value: string) => void;
}) => (
  <div className="erp-wo-plan-view-switch">
    <div className="erp-wo-plan-view-buttons" role="group" aria-label={t.views}>
      {[
        ['week', t.week, 'calendar_month'],
        ['grid', t.grid, 'view_list'],
      ].map(([key, label, icon]) => (
        <Button
          key={key}
          size="sm"
          variant="text"
          aria-pressed={value === key}
          onClick={() => onChange(key!)}
          leadingIcon={<Icon name={icon!} size={18} />}
        >
          {label}
        </Button>
      ))}
    </div>
    {layoutToolsId && <div id={layoutToolsId} className="erp-wo-plan-layout-slot" />}
  </div>
);
