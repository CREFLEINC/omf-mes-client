import { useId, useState } from 'react';
import { Button, DatePicker, Dialog, TextField } from '@crefle/web-ui';
import { Select } from '../../../patterns/select';
import type { ProductionPlanEditorStateRow } from '../../production-plan/editor-state';
import { validPlanSplit, type PlanSplitPart } from '../../production-plan/quantity-split';
import { shiftPlanDate } from './plan-view-model';
import { formatQty } from './process-model';

export const PlanSplitDialog = ({
  row,
  planName,
  identity,
  lineName,
  unit,
  decimalScale,
  onClose,
  onApply,
}: {
  row: ProductionPlanEditorStateRow;
  planName: string;
  identity?: { orderNo: string; itemCode: string; itemName: string };
  lineName: string;
  unit: string;
  decimalScale: number;
  onClose: () => void;
  onApply: (parts: PlanSplitPart[]) => void;
}) => {
  const validationId = useId();
  const total = Number(row.draft.plannedQty);
  const scale = 10 ** decimalScale;
  const [count, setCount] = useState('1');
  const [method, setMethod] = useState('equal');
  const [per, setPer] = useState('');
  const [dates, setDates] = useState('sequence');
  const [start, setStart] = useState(row.draft.planDate);
  const generate = (number: number, fixed?: number): PlanSplitPart[] => {
    const whole = Math.round(total * scale);
    return Array.from({ length: number }, (_, i) => ({
      plannedQty: String(
        (fixed === undefined
          ? Math.floor(whole / number) + (i < whole % number ? 1 : 0)
          : Math.min(fixed, whole - i * fixed)) / scale,
      ),
      planDate: dates === 'sequence' ? shiftPlanDate(start, i) : start,
    }));
  };
  const [parts, setParts] = useState<PlanSplitPart[]>(() => generate(1));
  const [error, setError] = useState('');
  const [conditionsDirty, setConditionsDirty] = useState(false);
  const sumUnits = parts.reduce(
    (sum, part) => sum + Math.round((Number(part.plannedQty) || 0) * scale),
    0,
  );
  const difference = (Math.round(total * scale) - sumUnits) / scale;
  const valid = validPlanSplit(total, parts, decimalScale);
  const preview = () => {
    const fixed = Math.round(Number(per) * scale);
    const number =
      method === 'fixed' ? Math.ceil(Math.round(total * scale) / fixed) : Number(count);
    if (
      !Number.isInteger(number) ||
      number < 2 ||
      number > 12 ||
      shiftPlanDate(start, 0) === '' ||
      (method === 'fixed' &&
        (!Number.isFinite(fixed) ||
          fixed <= 0 ||
          Number(Number(per).toFixed(decimalScale)) !== Number(per)))
    ) {
      setError('분할 후 계획은 2~12건으로 지정하고 생산량과 편성 시작일을 확인하세요.');
      return;
    }
    const next = generate(number, method === 'fixed' ? fixed : undefined);
    setParts(
      method === 'manual'
        ? next.map((part, i) => ({ ...part, plannedQty: parts[i]?.plannedQty ?? '' }))
        : next,
    );
    setConditionsDirty(false);
    setCount(String(number));
    setError('');
  };
  const facts = [
    ['분할 계획', planName],
    ['품목명', identity?.itemName ?? '—'],
    ['분할 생산량', `${formatQty(total)} ${unit}`],
    ['ERP W/O', identity?.orderNo ?? '—'],
    ['계획일', row.draft.planDate],
    ['생산 라인', lineName || '—'],
  ];
  return (
    <Dialog
      open
      title="계획 분할"
      className="erp-wo-plan-split-dialog"
      closeOnBackdropClick={false}
      onClose={onClose}
      footer={
        <>
          <span className="erp-wo-split-footer-count">분할 후 계획 건수 {parts.length}건</span>
          <Button variant="outlined" onClick={onClose}>
            취소
          </Button>
          <Button
            aria-describedby={!valid || conditionsDirty ? validationId : undefined}
            disabled={!valid || conditionsDirty}
            onClick={() => {
              if (valid && !conditionsDirty) onApply(parts);
            }}
          >
            분할 적용
          </Button>
        </>
      }
    >
      <div className="erp-wo-split-content">
        <p className="visually-hidden" id={validationId}>
          분할 조건을 적용하고 계획일과 단위 소수 자릿수를 확인한 뒤 분할 생산량 합계를 맞추세요.
        </p>
        <dl className="erp-wo-split-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <section className="erp-wo-split-section">
          <h3>분할 조건</h3>
          <div className="erp-wo-split-conditions">
            <TextField
              size="sm"
              label="분할 후 계획 건수"
              aria-label="분할 후 계획 건수"
              inputMode="numeric"
              value={count}
              disabled={method === 'fixed'}
              onChange={(event) => {
                setCount(event.target.value);
                setConditionsDirty(true);
              }}
            />
            <div className="field-cell">
              <span className="field-label">분할 방식</span>
              <Select
                aria-label="분할 방식"
                value={method}
                onChange={(value) => {
                  setMethod(value);
                  setConditionsDirty(true);
                }}
                options={[
                  { value: 'equal', label: '균등 배분' },
                  { value: 'fixed', label: '계획당 생산량 지정' },
                  { value: 'manual', label: '계획별 직접 입력' },
                ]}
              />
            </div>
            {method === 'fixed' && (
              <TextField
                size="sm"
                label={`계획당 생산량 (${unit})`}
                aria-label="계획당 생산량"
                inputMode="decimal"
                value={per}
                onChange={(event) => {
                  setPer(event.target.value);
                  setConditionsDirty(true);
                }}
              />
            )}
            <div className="field-cell">
              <span className="field-label">계획일 설정</span>
              <Select
                aria-label="계획일 설정"
                value={dates}
                onChange={(value) => {
                  setDates(value);
                  setConditionsDirty(true);
                }}
                options={[
                  { value: 'same', label: '동일일' },
                  { value: 'sequence', label: '1일 간격' },
                  { value: 'manual', label: '계획별 지정' },
                ]}
              />
            </div>
            <div className="field-cell">
              <span className="field-label">편성 시작일</span>
              <DatePicker
                size="sm"
                aria-label="편성 시작일"
                value={start}
                onChange={(value) => {
                  setStart(value);
                  setConditionsDirty(true);
                }}
              />
            </div>
          </div>
          <div>
            <Button className="erp-wo-split-action" size="md" variant="tonal" onClick={preview}>
              분할 조건 적용
            </Button>
          </div>
          {error && <p role="alert">{error}</p>}
        </section>
        <section className="erp-wo-split-section">
          <div className="erp-wo-split-heading">
            <h3>분할 계획 {parts.length}건</h3>
            <Button
              className="erp-wo-split-action"
              size="md"
              variant="tonal"
              disabled={parts.length >= 12}
              onClick={() => {
                setCount(String(parts.length + 1));
                setParts((current) => [...current, { plannedQty: '', planDate: start }]);
              }}
            >
              계획 추가
            </Button>
          </div>
          <div className="erp-wo-split-table-scroll">
            <table className="erp-wo-split-table">
              <colgroup>
                <col style={{ width: '70px' }} />
                <col />
                <col />
                <col style={{ width: '65px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>순번</th>
                  <th>생산량 ({unit})</th>
                  <th>계획일</th>
                  <th>
                    <span className="visually-hidden">삭제</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <TextField
                        size="sm"
                        aria-label={`계획 ${i + 1} 생산량`}
                        inputMode="decimal"
                        value={part.plannedQty}
                        onChange={(event) =>
                          setParts((current) =>
                            current.map((p, index) =>
                              index === i ? { ...p, plannedQty: event.target.value } : p,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <DatePicker
                        size="sm"
                        aria-label={`계획 ${i + 1} 계획일`}
                        value={part.planDate}
                        onChange={(planDate) =>
                          setParts((current) =>
                            current.map((p, index) => (index === i ? { ...p, planDate } : p)),
                          )
                        }
                      />
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="outlined"
                        aria-label={`계획 ${i + 1} 삭제`}
                        disabled={parts.length <= 1}
                        onClick={() => {
                          setCount(String(parts.length - 1));
                          setParts((current) => current.filter((_, index) => index !== i));
                        }}
                      >
                        −
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="erp-wo-split-totals" aria-live="polite">
            <div>
              <dt>분할 생산량</dt>
              <dd>
                {formatQty(total)} {unit}
              </dd>
            </div>
            <div>
              <dt>분할 생산량 합계</dt>
              <dd>
                {formatQty(sumUnits / scale)} {unit}
              </dd>
            </div>
            <div>
              <dt>{difference < 0 ? '초과 수량' : '미배분 수량'}</dt>
              <dd>
                {formatQty(Math.abs(difference))} {unit}
              </dd>
            </div>
          </dl>
          {!valid && parts.length > 1 && (
            <p className="field-note" role="status">
              각 생산량과 계획일을 확인하고 합계를 {formatQty(total)} {unit}로 맞추세요.
            </p>
          )}
        </section>
      </div>
    </Dialog>
  );
};
