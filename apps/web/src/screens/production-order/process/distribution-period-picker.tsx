import { useState } from 'react';
import { Button, Dialog, Icon } from '@crefle/web-ui';
import { plantToday } from '../../../patterns/plant-time';

const monthOf = (date: string) => date.slice(0, 7);
const shiftMonth = (month: string, offset: number) => {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year!, number! - 1 + offset, 1)).toISOString().slice(0, 7);
};
const monthDays = (month: string) => {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year!, number! - 1, 1));
  const count = new Date(Date.UTC(year!, number!, 0)).getUTCDate();
  return Array.from({ length: 42 }, (_, index) => {
    const day = index - first.getUTCDay() + 1;
    return day < 1 || day > count ? null : `${month}-${String(day).padStart(2, '0')}`;
  });
};

/** 기간 탐색은 확정한 날짜를 바꾸지 않으며 두 날짜 선택이 끝났을 때만 반영한다. */
export const DistributionPeriodPicker = ({
  label,
  value,
  disabled,
  onChange,
  placeholder = '기간 선택',
}: {
  label: string;
  placeholder?: string;
  value: [string, string];
  disabled: boolean;
  onChange: (value: [string, string]) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value[0] || plantToday()));
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [choosingEnd, setChoosingEnd] = useState(false);
  return (
    <>
      <button
        type="button"
        className="erp-wo-period-trigger"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMonth(monthOf(value[0] || plantToday()));
          setStart(value[0] || null);
          setEnd(value[1] || null);
          setChoosingEnd(false);
          setOpen(true);
        }}
      >
        <span>{value[0] && value[1] ? `${value[0]} ~ ${value[1]}` : placeholder}</span>
        <Icon name="calendar_today" size={20} />
      </button>
      {open && (
        <Dialog
          open
          size="sm"
          title={label}
          className="erp-wo-period-calendar"
          onClose={() => setOpen(false)}
          footer={
            <div className="erp-wo-period-calendar-actions">
              <Button variant="outlined" onClick={() => setMonth(monthOf(plantToday()))}>
                오늘
              </Button>
              <Button variant="text" onClick={() => setOpen(false)}>
                취소
              </Button>
            </div>
          }
        >
          <div className="erp-wo-period-month">
            <Button
              variant="text"
              size="sm"
              aria-label="이전 달"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <Icon name="chevron_left" size={20} />
            </Button>
            <strong aria-live="polite">
              {month.slice(0, 4)}년 {Number(month.slice(5))}월
            </strong>
            <Button
              variant="text"
              size="sm"
              aria-label="다음 달"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <Icon name="chevron_right" size={20} />
            </Button>
          </div>
          <p className="field-note" aria-live="polite">
            {choosingEnd ? '종료일 선택' : '시작일 선택'}
          </p>
          <div className="erp-wo-period-days" aria-label="분배 기간 달력">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <span className="erp-wo-period-weekday" key={day}>
                {day}
              </span>
            ))}
            {monthDays(month).map((date, index) => {
              if (!date) return <span key={`empty-${index}`} />;
              const first = date === start;
              const last = date === end;
              const between = !!start && !!end && date > start && date < end;
              return (
                <div
                  key={date}
                  className="erp-wo-period-day"
                  data-start={first || undefined}
                  data-end={last || undefined}
                  data-between={between || undefined}
                  data-single={(first && (!end || (first && last))) || undefined}
                >
                  <button
                    type="button"
                    aria-label={date}
                    aria-pressed={first || last || between}
                    onClick={() => {
                      if (!choosingEnd || !start || date < start) {
                        setStart(date);
                        setEnd(null);
                        setChoosingEnd(true);
                      } else {
                        setEnd(date);
                        onChange([start, date]);
                        setOpen(false);
                      }
                    }}
                  >
                    {Number(date.slice(-2))}
                  </button>
                </div>
              );
            })}
          </div>
        </Dialog>
      )}
    </>
  );
};
