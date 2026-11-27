import { Button, Chip, TextField } from '@crefle/web-ui';
import type { InspectionSheet, InspectionSheetNgWrite } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { DateTimeField } from '../../patterns/date-time-field';
import { InfoTip } from '../../patterns/info-tip';
import { masterName } from '../../patterns/master-name';
import { PLANT_UTC_OFFSET, plantNowLocal, toPlantDateTimeParts } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';

const t = messages.inspectionSheetEntry.ng;

/** 화면 안의 한 블록 — 날짜는 입력칸 글자(로컬 시각)로 들고, 보낼 때 ISO 로 바꾼다. */
export interface NgDraft extends Omit<InspectionSheetNgWrite, 'repairedAt' | 'recheckedAt'> {
  key: string;
  repairedAt: string;
  recheckedAt: string;
}

let seed = 0;
const nextKey = () => `ng-${(seed += 1)}`;

/**
 * ISO → 입력칸 값(`YYYY-MM-DDTHH:mm`) — **공장 시각**이다(omf-all-around#364). 브라우저 시간대로
 * 읽으면 한국 PC 에서 공장보다 2시간 늦게 선다.
 */
export const toLocalInput = (iso: string | null): string => {
  if (iso === null) return '';
  const parts = toPlantDateTimeParts(iso);
  return parts === null ? '' : `${parts.date}T${parts.time}`;
};

/** 입력칸 값(공장 시각) → ISO(`…Z`). 글자를 공장 offset 으로 읽는다 — 브라우저 시간대로 읽지 않는다. */
const toIso = (value: string): string | null =>
  value === '' ? null : new Date(`${value}:00${PLANT_UTC_OFFSET}`).toISOString();
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

const nowInput = (): string => plantNowLocal();

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
    <section className="pane inspection-sheet-entry-ngs" aria-label={t.heading}>
      {/* 한 건씩 적는다 · 출력 양식에 나오는 건수는 제목 옆 ⓘ 로(관리웹 정리 시안 A). */}
      <h2 className="pane-title inspection-sheet-entry-title">
        {t.heading}
        <InfoTip text={t.note} />
      </h2>
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
            <div key={draft.key} className="inspection-sheet-entry-ng-summary">
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
                size="md"
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
            size="md"
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
          <div className="field-cell inspection-sheet-entry-when">
            <DateTimeField
              label={label}
              value={value}
              disabled={disabled}
              onChange={(next) => set(draft.key, patch(next))}
            />
            <Button
              size="md"
              variant="outlined"
              disabled={disabled}
              onClick={() => set(draft.key, patch(nowInput()))}
            >
              {t.now}
            </Button>
          </div>
        );
        return (
          <fieldset key={draft.key} className="inspection-sheet-entry-ng">
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
              size="md"
              maxLength={1000}
              value={draft.ngContent}
              disabled={disabled}
              error={errors[draft.key] || undefined}
              required
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
                  size="md"
                  variant="text"
                  onClick={() => setDrafts((prev) => prev.filter((d) => d.key !== draft.key))}
                >
                  {t.remove(n)}
                </Button>
              )}
              <Button size="md" variant="outlined" onClick={() => toggle(draft.key, false)}>
                {t.collapse}
              </Button>
            </div>
          </fieldset>
        );
      })}
      <div className="form-actions">
        <Button
          size="md"
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
          size="md"
          // ui-check-ignore: C-4 바뀐 값이 없거나 저장 중일 때만 잠긴다 — 고칠 것이 없다는 것 말고 사유가 없다
          disabled={disabled || isSaving || !changed}
          onClick={save}
        >
          {isSaving ? messages.inspectionSheetEntry.saving : t.save}
        </Button>
      </div>
    </section>
  );
};
