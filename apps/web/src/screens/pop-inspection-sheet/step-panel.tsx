import { AlertBanner, Button, Checkbox, Chip } from '@crefle/web-ui';
import type { InspectionSheetJudgment, InspectionSheetStep } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { masterName } from '../../patterns/master-name';
import type { StepWriteVariables } from './queries';
import {
  firstFromItems,
  fullProgress,
  type Judgments,
  sameJudgments,
  savedJudgments,
  stepSave,
} from './step-judgment';

const t = messages.popInspectionSheet.step;

const nameOf = (step: InspectionSheetStep): string =>
  masterName({ nameKo: step.nameKo, nameVi: step.nameVi }, step.nameKo);

/** 탭에 붙는 상태 — 미입력 · 입력 중(임시 저장) · OK · NG→OK · NG, 서명은 따로. */
const stateLabel = (step: InspectionSheetStep): string => {
  if (step.result === null) {
    const done = step.items.filter((item) => item.judgmentCode !== null).length;
    return done === 0 ? t.notRecorded : t.inProgress(done, step.items.length);
  }
  const { firstJudgmentCode: first, finalJudgmentCode: last } = step.result;
  return first === last ? first : `${first}→${last}`;
};

export interface StepPanelProps {
  steps: readonly InspectionSheetStep[];
  disabled: boolean;
  isSaving: boolean;
  onSave: (variables: StepWriteVariables) => void;
}

/**
 * 단계별 검사 — 단계를 고르고 항목마다 OK/NG 를 누른다. 1차 판정은 항목이 정한다(하나라도 NG 면 NG).
 * NG 단계는 수리 뒤 재검이 OK 면 「NG → OK」로 저장한다(양식의 판정 칸과 같다).
 */
export const StepPanel = ({ steps, disabled, isSaving, onSave }: StepPanelProps) => {
  const [selected, setSelected] = useState(steps[0]?.stepCode ?? null);
  const step = steps.find((row) => row.stepCode === selected) ?? null;

  return (
    <section className="pane pop-inspection-sheet-steps" aria-label={t.heading}>
      <h2 className="pane-title">{t.heading}</h2>
      <div className="pop-inspection-sheet-tabs" role="group" aria-label={t.tabsLabel}>
        {steps.map((row) => (
          <Button
            key={row.stepCode}
            size="lg"
            variant={row.stepCode === selected ? 'filled' : 'outlined'}
            aria-pressed={row.stepCode === selected}
            onClick={() => setSelected(row.stepCode)}
          >
            {`${nameOf(row)} (${stateLabel(row)}${row.result?.signedAt ? `, ${t.signed}` : ''})`}
          </Button>
        ))}
      </div>
      {step !== null && (
        /* 단계를 바꾸면 그 단계의 저장값으로 입력을 새로 채운다. */
        <StepForm
          key={`${step.stepCode}-${step.result?.inspectedAt ?? ''}`}
          step={step}
          disabled={disabled}
          isSaving={isSaving}
          onSave={onSave}
        />
      )}
    </section>
  );
};

interface StepFormProps {
  step: InspectionSheetStep;
  disabled: boolean;
  isSaving: boolean;
  onSave: (variables: StepWriteVariables) => void;
}

const StepForm = ({ step, disabled, isSaving, onSave }: StepFormProps) => {
  const [judgments, setJudgments] = useState<Judgments>(() => savedJudgments(step));
  const [manualFirst, setManualFirst] = useState<InspectionSheetJudgment | null>(
    step.items.length === 0 ? (step.result?.firstJudgmentCode ?? null) : null,
  );
  const savedRecheckOk =
    step.result !== null &&
    step.result.firstJudgmentCode === 'NG' &&
    step.result.finalJudgmentCode === 'OK';
  const [recheckOk, setRecheckOk] = useState(savedRecheckOk);

  const noteId = useId();
  const oqcLocked = step.result?.sourceCode === 'OQC';
  const first = step.items.length === 0 ? manualFirst : firstFromItems(step, judgments);
  const plan = stepSave(step, judgments, manualFirst);
  const progress = fullProgress(step, judgments);
  const locked = disabled || oqcLocked;
  const name = nameOf(step);
  // 저장값에서 바뀐 것이 없으면 저장할 것이 없다(저장 뒤에는 새 저장값과 같아져 다시 꺼진다).
  const changed =
    !sameJudgments(judgments, savedJudgments(step)) ||
    (step.items.length === 0 && manualFirst !== (step.result?.firstJudgmentCode ?? null)) ||
    (first === 'NG' && recheckOk !== savedRecheckOk);

  const judge = (itemId: number, value: InspectionSheetJudgment) =>
    setJudgments((prev) => ({ ...prev, [itemId]: value }));
  const items = () =>
    Object.entries(judgments).map(([id, judgmentCode]) => ({
      inspectionSheetTemplateItemId: Number(id),
      judgmentCode,
    }));
  const save = () => {
    if (plan.mode === 'blocked' || !changed) return;
    onSave({
      stepCode: step.stepCode,
      body:
        plan.mode === 'draft'
          ? { items: items() }
          : {
              firstJudgmentCode: plan.first,
              finalJudgmentCode: plan.first === 'OK' || recheckOk ? 'OK' : 'NG',
              items: items(),
            },
    });
  };

  return (
    <div className="pop-inspection-sheet-step">
      {oqcLocked && <AlertBanner variant="info">{t.oqcLocked}</AlertBanner>}
      {step.result?.signedAt && !oqcLocked && <p className="field-note">{t.signedWarning}</p>}
      {step.items.length === 0 ? (
        <p className="field-note">{t.noItems}</p>
      ) : (
        <ul className="pop-inspection-sheet-items" aria-label={t.itemsCaption(name)}>
          {step.items.map((item) => {
            const value = judgments[item.inspectionSheetTemplateItemId];
            return (
              <li key={item.inspectionSheetTemplateItemId}>
                <span className="pop-inspection-sheet-item-code">{item.checkItemCode}</span>
                <span className="pop-inspection-sheet-item-name">
                  {masterName(item, item.nameKo)}
                </span>
                <Chip size="sm">{t.method[item.methodCode] ?? item.methodCode}</Chip>
                {(['OK', 'NG'] as const).map((option) => (
                  /* ui-check-ignore: C-4 완료된 검사표이거나 출하검사 화면이 기록한 단계라 잠긴다 — 사유는 위 안내 띠 */
                  <Button
                    key={option}
                    size="lg"
                    variant={value === option ? 'filled' : 'outlined'}
                    aria-pressed={value === option}
                    aria-label={t.itemJudgment(item.checkItemCode, option)}
                    disabled={locked}
                    onClick={() => judge(item.inspectionSheetTemplateItemId, option)}
                  >
                    {option === 'OK' ? t.ok : t.ng}
                  </Button>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      <div className="pop-inspection-sheet-judgment" role="group" aria-label={t.first}>
        <span className="field-label">{t.first}</span>
        {step.items.length === 0 ? (
          (['OK', 'NG'] as const).map((option) => (
            /* ui-check-ignore: C-4 완료된 검사표이거나 출하검사 화면이 기록한 단계라 잠긴다 — 사유는 위 안내 띠 */
            <Button
              key={option}
              size="lg"
              variant={manualFirst === option ? 'filled' : 'outlined'}
              aria-pressed={manualFirst === option}
              disabled={locked}
              onClick={() => setManualFirst(option)}
            >
              {option}
            </Button>
          ))
        ) : (
          <strong>{first ?? '—'}</strong>
        )}
        {step.items.length > 0 && <span className="field-note">{t.firstFromItems}</span>}
      </div>
      {first === 'NG' && (
        <Checkbox
          checked={recheckOk}
          disabled={locked}
          onChange={(event) => setRecheckOk(event.target.checked)}
        >
          {t.recheckOk}
        </Checkbox>
      )}

      <div className="pop-action-bar">
        <div className="pop-action-note" id={noteId}>
          {!locked && progress.total > 0 && (
            <p className="field-note">{t.progress(progress.done, progress.total)}</p>
          )}
          {!locked && changed && plan.mode === 'draft' && (
            <p className="field-note">{t.draftNote}</p>
          )}
          {!locked && changed && plan.mode === 'blocked' && (
            <p className="field-note">{plan.reason}</p>
          )}
        </div>
        <Button
          variant="filled"
          size="xl"
          aria-describedby={noteId}
          disabled={locked || plan.mode === 'blocked' || !changed || isSaving}
          onClick={save}
        >
          {isSaving
            ? messages.popInspectionSheet.saving
            : changed && plan.mode === 'draft'
              ? t.draftSave
              : t.save}
        </Button>
      </div>
    </div>
  );
};
