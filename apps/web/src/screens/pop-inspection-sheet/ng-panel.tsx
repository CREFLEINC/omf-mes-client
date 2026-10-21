import { Button, Chip, TextField } from '@crefle/web-ui';
import type { InspectionSheet, InspectionSheetNgWrite } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { DateTimeField } from '../../patterns/date-time-field';
import { masterName } from '../../patterns/master-name';
import { PopSelect as Select } from '../../patterns/pop-select';

const t = messages.popInspectionSheet.ng;

/** 화면 안의 한 블록 — 날짜는 입력칸 글자(로컬 시각)로 들고, 보낼 때 ISO 로 바꾼다. */
export interface NgDraft extends Omit<InspectionSheetNgWrite, 'repairedAt' | 'recheckedAt'> {
  key: string;
  repairedAt: string;
  recheckedAt: string;
}

let seed = 0;
const nextKey = () => `ng-${(seed += 1)}`;

/** ISO → `datetime-local` 입력값(브라우저 로컬 시각 = 현장 시각). */
export const toLocalInput = (iso: string | null): string => {
  if (iso === null) return '';
  const date = new Date(iso);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIso = (value: string): string | null =>
  value === '' ? null : new Date(value).toISOString();
const text = (value: string | null | undefined): string | null =>
  value?.trim() ? value.trim() : null;

export const toNgDrafts = (sheet: InspectionSheet): NgDraft[] =>
  sheet.ngs.map((ng) => ({
    key: nextKey(),
    foundDepartmentCode: ng.foundDepartmentCode,
    foundStepCode: ng.foundStepCode,
    occurrenceProcessText: ng.occurrenceProcessText,
    standardNo: ng.standardNo,
    checkItemCode: ng.checkItemCode,
    ngContent: ng.ngContent,
    investigationText: ng.investigationText,
    ngTypeCode: ng.ngTypeCode,
    repairDepartmentCode: ng.repairDepartmentCode,
    repairWorkerNo: ng.repairWorkerNo,
    repairedAt: toLocalInput(ng.repairedAt),
    recheckResultCode: ng.recheckResultCode,
    recheckWorkerNo: ng.recheckWorkerNo,
    recheckedAt: toLocalInput(ng.recheckedAt),
  }));

export const toNgBody = (drafts: readonly NgDraft[]): InspectionSheetNgWrite[] =>
  drafts.map(({ key: _key, repairedAt, recheckedAt, ...ng }) => ({
    ...ng,
    occurrenceProcessText: text(ng.occurrenceProcessText),
    standardNo: text(ng.standardNo),
    checkItemCode: text(ng.checkItemCode),
    ngContent: ng.ngContent.trim(),
    investigationText: text(ng.investigationText),
    repairWorkerNo: text(ng.repairWorkerNo),
    recheckWorkerNo: text(ng.recheckWorkerNo),
    repairedAt: toIso(repairedAt),
    recheckedAt: toIso(recheckedAt),
  }));

const emptyDraft = (): NgDraft => ({
  key: nextKey(),
  foundDepartmentCode: null,
  foundStepCode: null,
  occurrenceProcessText: null,
  standardNo: null,
  checkItemCode: null,
  ngContent: '',
  investigationText: null,
  ngTypeCode: null,
  repairDepartmentCode: null,
  repairWorkerNo: null,
  repairedAt: '',
  recheckResultCode: null,
  recheckWorkerNo: null,
  recheckedAt: '',
});

const nowInput = (): string => toLocalInput(new Date().toISOString());

export interface NgPanelProps {
  sheet: InspectionSheet;
  disabled: boolean;
  isSaving: boolean;
  onSave: (ngs: InspectionSheetNgWrite[]) => void;
}

/**
 * NG·수리·재검 블록 — 양식의 NG 칸(발견 부문·공정, 발생 공정, 표준서·항목 번호, 내용, 조사·수리, 구분, 수리 부문·담당·일,
 * 재검 결과·담당·일)을 한 건씩 적는다. 저장은 통째로 바뀐다. ⛔ 불량 기록(defect_record)은 만들지 않는다(담당자 결정 ⑥).
 */
export const NgPanel = ({ sheet, disabled, isSaving, onSave }: NgPanelProps) => {
  const [initial] = useState<NgDraft[]>(() => toNgDrafts(sheet));
  const [drafts, setDrafts] = useState<NgDraft[]>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // 저장된 기록은 한 줄 요약(이력)으로 접어 두고, 새로 더한 기록과 [수정]을 누른 기록만 입력칸을 연다.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const savedKeys = new Set(initial.map((draft) => draft.key));
  const changed = JSON.stringify(toNgBody(drafts)) !== JSON.stringify(toNgBody(initial));
  const toggle = (key: string, next: boolean) =>
    setOpen((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  const stepName = (code: string | null | undefined) => {
    const step = sheet.steps.find((row) => row.stepCode === code);
    return step === undefined ? t.none : masterName(step, step.nameKo);
  };
  const set = (key: string, patch: Partial<NgDraft>) =>
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  const stepOptions = [
    { value: '', label: t.none },
    ...sheet.steps.map((step) => ({ value: step.stepCode, label: masterName(step, step.nameKo) })),
  ];
  const codeOptions = (codes: Record<string, string>, keys: readonly string[]) => [
    { value: '', label: t.none },
    ...keys.map((code) => ({ value: code, label: codes[code] ?? code })),
  ];

  const save = () => {
    const found = Object.fromEntries(
      drafts.filter((d) => d.ngContent.trim() === '').map((d) => [d.key, t.contentRequired]),
    );
    setErrors(found);
    // 접힌 기록의 오류는 안 보이므로 그 기록을 연다.
    if (Object.keys(found).length > 0) {
      setOpen((prev) => new Set([...prev, ...Object.keys(found)]));
      return;
    }
    onSave(toNgBody(drafts));
  };

  return (
    <section className="pane pop-inspection-sheet-ngs" aria-label={t.heading}>
      <h2 className="pane-title">{t.heading}</h2>
      <p className="field-note">{t.note}</p>
      {drafts.length === 0 && <p className="field-note">{t.empty}</p>}
      {drafts.map((draft, index) => {
        const n = index + 1;
        if (!open.has(draft.key)) {
          const saved = savedKeys.has(draft.key);
          const [label, tone] = !saved
            ? [t.unsaved, 'warning' as const]
            : draft.recheckResultCode
              ? [
                  t.statusRecheck(draft.recheckResultCode),
                  draft.recheckResultCode === 'OK' ? ('success' as const) : ('error' as const),
                ]
              : draft.repairedAt
                ? [t.statusRepaired, 'info' as const]
                : [t.statusOpen, 'warning' as const];
          return (
            <div key={draft.key} className="pop-inspection-sheet-ng-summary">
              <div>
                <strong>{t.block(n)}</strong>{' '}
                <Chip size="sm" status={tone}>
                  {label}
                </Chip>{' '}
                <span className="field-note">
                  {t.summaryWhere(stepName(draft.foundStepCode), draft.checkItemCode || t.none)}
                </span>
                <p>{draft.ngContent || t.none}</p>
              </div>
              <Button
                size="lg"
                variant="outlined"
                aria-label={`${t.block(n)} ${t.edit}`}
                onClick={() => toggle(draft.key, true)}
              >
                {t.edit}
              </Button>
            </div>
          );
        }
        const field = (
          label: string,
          value: string | null | undefined,
          patch: (v: string) => Partial<NgDraft>,
          max = 200,
        ) => (
          <TextField
            label={label}
            size="lg"
            maxLength={max}
            value={value ?? ''}
            disabled={disabled}
            onChange={(event) => set(draft.key, patch(event.target.value))}
          />
        );
        const pick = (
          label: string,
          value: string | null | undefined,
          options: { value: string; label: string }[],
          patch: (v: string | null) => Partial<NgDraft>,
        ) => (
          <div className="field-cell">
            <span className="field-label">{label}</span>
            <Select
              aria-label={`${t.block(n)} ${label}`}
              options={options}
              value={value ?? ''}
              disabled={disabled}
              onChange={(next) => set(draft.key, patch(next === '' ? null : next))}
            />
          </div>
        );
        const when = (label: string, value: string, patch: (v: string) => Partial<NgDraft>) => (
          <div className="field-cell pop-inspection-sheet-when">
            <DateTimeField
              label={label}
              value={value}
              disabled={disabled}
              onChange={(next) => set(draft.key, patch(next))}
            />
            <Button
              size="lg"
              variant="outlined"
              disabled={disabled}
              onClick={() => set(draft.key, patch(nowInput()))}
            >
              {t.now}
            </Button>
          </div>
        );
        return (
          <fieldset key={draft.key} className="pop-inspection-sheet-ng">
            <legend>{t.block(n)}</legend>
            <div className="form-grid">
              {pick(
                t.foundDepartment,
                draft.foundDepartmentCode,
                codeOptions(t.departments, ['PRODUCTION', 'QUALITY']),
                (v) => ({ foundDepartmentCode: v as NgDraft['foundDepartmentCode'] }),
              )}
              {pick(t.foundStep, draft.foundStepCode, stepOptions, (v) => ({ foundStepCode: v }))}
              {field(t.occurrenceProcess, draft.occurrenceProcessText, (v) => ({
                occurrenceProcessText: v,
              }))}
              {field(t.standardNo, draft.standardNo, (v) => ({ standardNo: v }), 50)}
              {field(t.checkItemCode, draft.checkItemCode, (v) => ({ checkItemCode: v }), 30)}
              {pick(t.ngType, draft.ngTypeCode, codeOptions(t.types, ['WORK', 'PART']), (v) => ({
                ngTypeCode: v as NgDraft['ngTypeCode'],
              }))}
            </div>
            <TextField
              label={t.ngContent}
              size="lg"
              maxLength={1000}
              value={draft.ngContent}
              disabled={disabled}
              error={errors[draft.key] || undefined}
              aria-required
              onChange={(event) => set(draft.key, { ngContent: event.target.value })}
            />
            {field(
              t.investigation,
              draft.investigationText,
              (v) => ({ investigationText: v }),
              1000,
            )}
            <div className="form-grid">
              {pick(
                t.repairDepartment,
                draft.repairDepartmentCode,
                codeOptions(t.departments, ['PRODUCTION', 'TECH']),
                (v) => ({ repairDepartmentCode: v as NgDraft['repairDepartmentCode'] }),
              )}
              {field(t.repairWorkerNo, draft.repairWorkerNo, (v) => ({ repairWorkerNo: v }), 50)}
              {when(t.repairedAt, draft.repairedAt, (v) => ({ repairedAt: v }))}
              {pick(
                t.recheckResult,
                draft.recheckResultCode,
                codeOptions({ OK: 'OK', NG: 'NG' }, ['OK', 'NG']),
                (v) => ({ recheckResultCode: v as NgDraft['recheckResultCode'] }),
              )}
              {field(t.recheckWorkerNo, draft.recheckWorkerNo, (v) => ({ recheckWorkerNo: v }), 50)}
              {when(t.recheckedAt, draft.recheckedAt, (v) => ({ recheckedAt: v }))}
            </div>
            <div className="form-actions">
              {!disabled && (
                <Button
                  size="lg"
                  variant="text"
                  onClick={() => setDrafts((prev) => prev.filter((d) => d.key !== draft.key))}
                >
                  {t.remove(n)}
                </Button>
              )}
              <Button size="lg" variant="outlined" onClick={() => toggle(draft.key, false)}>
                {t.collapse}
              </Button>
            </div>
          </fieldset>
        );
      })}
      <div className="form-actions">
        <Button
          size="lg"
          variant="outlined"
          disabled={disabled}
          onClick={() => {
            const added = emptyDraft();
            setDrafts((prev) => [...prev, added]);
            toggle(added.key, true);
          }}
        >
          {t.add}
        </Button>
        <Button
          size="lg"
          // ui-check-ignore: C-4 바뀐 값이 없거나 저장 중일 때만 잠긴다 — 고칠 것이 없다는 것 말고 사유가 없다
          disabled={disabled || isSaving || !changed}
          onClick={save}
        >
          {isSaving ? messages.popInspectionSheet.saving : t.save}
        </Button>
      </div>
    </section>
  );
};
