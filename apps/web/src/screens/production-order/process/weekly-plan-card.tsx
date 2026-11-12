import { Chip } from '@crefle/web-ui';
export const WeeklyPlanCard = ({
  itemName,
  quantity,
  status,
  confirmed,
  other = false,
  selected,
  label,
  controls,
  onSelect,
}: {
  planNo: string;
  orderNo?: string;
  itemCode?: string;
  itemName?: string;
  quantity: string;
  status: string;
  confirmed: boolean;
  other?: boolean;
  selected: boolean;
  label: string;
  controls: string;
  onSelect: () => void;
}) => (
  <button
    type="button"
    className={`erp-wo-week-plan${other ? ' erp-wo-week-plan-other' : ''}`}
    aria-label={label}
    aria-pressed={selected}
    aria-controls={controls}
    onClick={onSelect}
  >
    <span className="erp-wo-week-card-item">{itemName || '품목명 확인 필요'}</span>
    <span className="erp-wo-week-card-bottom">
      <span className="erp-wo-week-card-quantity">{quantity}</span>
      <Chip
        className="erp-wo-week-card-status"
        size="sm"
        variant="status"
        status={confirmed ? 'success' : 'idle'}
      >
        {status}
      </Chip>
    </span>
  </button>
);
