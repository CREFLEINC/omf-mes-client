import { isPastPlanningDate } from './planning-date-policy';
import { plantToday } from '../../../patterns/plant-time';
import { usePlanningDays, planningDayKey, PlanningDayNotice } from './planning-working-days';
import { useId, useState } from 'react';
import { AlertBanner, Button, DatePicker, Dialog, TextField } from '@crefle/web-ui';
import { Select } from '../../../patterns/select';
import type { NewProductionPlanDefaults } from '../../production-plan/editor-state';
import {
  validateProductionPlanDraft,
  type ProductionPlanDraft,
} from '../../production-plan/editor-model';
import { DistributionLinePicker } from './distribution-line-picker';
import { formatQty } from './process-model';
import type { PlanLine } from './plan-step';
export interface PlanAddTarget {
  plantId?: number | null;
  id: string;
  label: string;
  remaining: number;
  unit: string;
  decimalScale?: number;
  defaults: NewProductionPlanDefaults;
  lines: readonly PlanLine[];
}
export const PlanAddDialog = ({
  targets,
  initialOrder,
  onClose,
  onAdd,
}: {
  targets: readonly PlanAddTarget[];
  initialOrder?: string;
  onClose: () => void;
  onAdd: (id: string, draft: ProductionPlanDraft) => void;
}) => {
  const validationId = useId();
  const initial =
    targets.find((target) => target.id === initialOrder) ??
    (targets.length === 1 ? targets[0] : undefined);
  const [id, setId] = useState(initial?.id ?? '');
  const makeDraft = (target?: PlanAddTarget): ProductionPlanDraft => ({
    bomId: '',
    routingId: '',
    planDate: '',
    plannedLineId: '',
    plannedQty: '',
    remarks: '',
    ...target?.defaults,
    ...(target?.plantId ? { planDateSourceCode: 'SYSTEM' as const } : {}),
    ...(target
      ? {
          plannedQty: String(
            Math.min(target.remaining, Number(target.defaults.plannedQty) || target.remaining),
          ),
        }
      : {}),
  });
  const [draft, setDraft] = useState(() => makeDraft(initial));
  const target = targets.find((target) => target.id === id);
  const calendar = usePlanningDays(
    target?.plantId
      ? [
          {
            plantId: target.plantId,
            productionLineId: draft.plannedLineId ? Number(draft.plannedLineId) : null,
            from: draft.planDate,
            to: draft.planDate,
          },
        ]
      : [],
  );
  const day = target?.plantId
    ? calendar.data?.get(
        planningDayKey(
          target.plantId,
          draft.plannedLineId ? Number(draft.plannedLineId) : null,
          draft.planDate,
        ),
      )
    : undefined;
  const qty = Number(draft.plannedQty);
  const scale = 10 ** (target?.decimalScale ?? 6);
  const valid =
    !!target &&
    target.remaining > 0 &&
    !isPastPlanningDate(draft.planDate) &&
    Number.isFinite(qty) &&
    qty > 0 &&
    qty <= target.remaining &&
    Math.abs(qty * scale - Math.round(qty * scale)) < 0.00001 &&
    Object.keys(validateProductionPlanDraft(draft)).length === 0;
  return (
    <Dialog
      open
      title="계획 추가"
      className="erp-wo-plan-add-dialog"
      closeOnBackdropClick={false}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            취소
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (valid && target) onAdd(target.id, draft);
            }}
          >
            추가
          </Button>
        </>
      }
    >
      <div className="erp-wo-plan-add-form">
        {!draft.bomId ? <AlertBanner variant="warning" title="ERP 기본 BOM 확인 필요" /> : null}
        {!draft.routingId ? <AlertBanner variant="warning" title="Routing 확인 필요" /> : null}
        <p className="visually-hidden" id={validationId}>
          ERP W/O와 계획일을 지정하고 추가 편성 가능한 수량 이내에서 생산량과 단위 소수 자릿수를
          확인하세요.
        </p>
        <div className="field-cell">
          <span className="field-label">계획을 추가할 ERP W/O</span>
          <Select
            aria-label="계획을 추가할 ERP W/O"
            value={id}
            options={targets
              .filter((target) => target.remaining > 0)
              .map((target) => ({ value: target.id, label: target.label }))}
            onChange={(id) => {
              setId(id);
              setDraft(makeDraft(targets.find((target) => target.id === id)));
            }}
          />
        </div>
        {target && (
          <dl className="erp-wo-plan-add-summary">
            <div>
              <dt>추가 편성 가능</dt>
              <dd>
                {formatQty(target.remaining)} {target.unit}
              </dd>
            </div>
          </dl>
        )}
        <div className="erp-wo-plan-add-fields">
          <div className="field-cell">
            <span className="field-label">계획일</span>
            <DatePicker
              min={plantToday()}
              placeholder="계획일 선택"
              aria-label="추가할 계획일"
              value={draft.planDate}
              disabled={!target}
              onChange={(planDate) =>
                setDraft((current) => ({
                  ...current,
                  planDate,
                  ...(target?.plantId ? { planDateSourceCode: 'USER' as const } : {}),
                }))
              }
            />
          </div>
          <TextField
            label="추가할 계획 수량"
            inputMode="decimal"
            disabled={!target}
            value={draft.plannedQty}
            onChange={(event) =>
              setDraft((current) => ({ ...current, plannedQty: event.target.value }))
            }
          />
          <div className="field-cell erp-wo-plan-add-line">
            <span className="field-label">생산 라인</span>
            <DistributionLinePicker
              combined
              label="추가할 계획 생산 라인"
              lines={target?.lines ?? []}
              value={draft.plannedLineId}
              disabled={!target}
              onChange={(plannedLineId) => setDraft((current) => ({ ...current, plannedLineId }))}
            />
          </div>
        </div>
        {calendar.isError ? (
          <p className="erp-wo-planning-day-notice" role="status">
            근무일 정보를 조회하지 못했습니다.
          </p>
        ) : (
          <PlanningDayNotice day={day} />
        )}
      </div>
    </Dialog>
  );
};
