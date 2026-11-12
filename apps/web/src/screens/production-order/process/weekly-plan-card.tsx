import { Chip } from '@crefle/web-ui';
export const WeeklyPlanCard = ({
  planNo,
  orderNo,
  itemCode,
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
    {[
      ['계획 번호', planNo],
      ['ERP W/O', orderNo],
      ['품목 코드', itemCode],
      ['품목명', itemName],
      ['생산량', quantity],
    ]
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => (
        <span className="erp-wo-week-card-field" key={name}>
          <span className="erp-wo-week-card-label">{name}</span>
          <span className="erp-wo-week-card-value">{value}</span>
        </span>
      ))}
    <span className="erp-wo-week-card-field">
      <span className="erp-wo-week-card-label">상태</span>
      <span>
        <Chip
          className="erp-wo-week-card-status"
          size="sm"
          variant="status"
          status={confirmed ? 'success' : 'idle'}
        >
          {status}
        </Chip>
      </span>
    </span>
  </button>
);
