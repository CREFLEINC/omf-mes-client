import { useId, useState } from 'react';
import { Button, DatePicker, TextField } from '@crefle/web-ui';
import { Select } from '../../../patterns/select';
import { plantToday } from '../../../patterns/plant-time';
import { shiftPlanDate } from './plan-view-model';
import type { DistributionOptions } from './distribution-model';
import type { PlanLine } from './plan-step';

export const DistributionControls = ({
  lines,
  disabled,
  onDistribute,
}: {
  lines: readonly PlanLine[];
  disabled: boolean;
  onDistribute: (options: DistributionOptions) => string;
}) => {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(plantToday());
  const [end, setEnd] = useState(shiftPlanDate(plantToday(), 6));
  const [line, setLine] = useState('');
  const [qty, setQty] = useState('');
  const [result, setResult] = useState('');
  return (
    <section className="erp-wo-distribution">
      <Button variant="outlined" disabled={disabled} onClick={() => setOpen(!open)}>
        자동 분배
      </Button>
      {open && (
        <div className="pane erp-wo-distribution-settings">
          <h2 className="section-title">자동 분배 조건</h2>
          <p className="field-note">
            기존 계획을 보존하고 미계획 수량을 편성합니다. 입력한 일일 수량은 이 화면에서 선택한
            오더에 적용하며, 다른 오더의 설비 능력을 보장하지 않습니다.
          </p>
          <div className="erp-wo-distribution-fields">
            <div className="field-cell">
              <span className="field-label">시작일</span>
              <DatePicker
                size="sm"
                aria-label="분배 시작일"
                value={start}
                disabled={disabled}
                onChange={setStart}
              />
            </div>
            <div className="field-cell">
              <span className="field-label">종료일</span>
              <DatePicker
                size="sm"
                aria-label="분배 종료일"
                value={end}
                disabled={disabled}
                onChange={setEnd}
              />
            </div>
            <div className="field-cell">
              <span className="field-label">생산 라인</span>
              <Select
                size="sm"
                aria-label="분배 생산 라인"
                value={line}
                options={lines.map((item) => ({
                  value: String(item.id),
                  label: `${item.name} (${item.code})`,
                }))}
                disabled={disabled}
                onChange={setLine}
              />
            </div>
            <TextField
              size="sm"
              label="일일 편성 수량"
              aria-label="일일 편성 수량"
              inputMode="numeric"
              value={qty}
              disabled={disabled}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <Button
            aria-describedby={reasonId}
            disabled={disabled || !start || !end || !line || !qty}
            onClick={() => {
              try {
                setResult(onDistribute({ start, end, lineId: line, dailyQty: Number(qty) }));
              } catch (error) {
                setResult(error instanceof Error ? error.message : '분배 조건을 확인하세요.');
              }
            }}
          >
            분배안 만들기
          </Button>
          <p className="field-note" role="status" id={reasonId}>
            {result || '분배안은 미저장 계획으로 추가됩니다. 확인 후 하단에서 저장하세요.'}
          </p>
        </div>
      )}
    </section>
  );
};
