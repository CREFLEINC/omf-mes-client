import { Button, Checkbox, Chip, Dialog, Icon, TextField, useToast } from '@crefle/web-ui';
import type { InspectionSheetLotSlot, InspectionSheetTemplate } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { ItemPickerDialog } from '../../patterns/item-picker';
import { requireIfMatch, SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { Select } from '../../patterns/select';
import {
  emptyDraft,
  layoutSteps,
  LOT_SLOTS,
  type StepDraft,
  type TemplateDraft,
  toBody,
  toDraft,
  validateDraft,
} from './draft';
import { TemplateBasicDialog, type TemplateBasics } from './basic-dialog';
import { templateDetailPath, templateKeys } from './queries';
import { StepEditor, StepList } from './step-editor';

const t = messages.inspectionSheetTemplate;

export interface TemplateEditorProps {
  /** 연 기준. null 이면 새 기준이다. */
  template: InspectionSheetTemplate | null;
  /** 새 기준의 기본 정보 — 화면의 등록 팝업에서 고른 값(#208). 연 기준에는 쓰지 않는다. */
  initialBasics?: TemplateBasics;
  /** 연 기준과 같은 품목의 모든 버전 — 머리의 버전 고르기(검사 기준 탭과 같다 · #208). */
  versions?: readonly InspectionSheetTemplate[];
  onSelectVersion?: (inspectionSheetTemplateId: number) => void;
  /** 로그인 계정의 데이터 범위 사업부 — 새 기준의 사업부는 이 안에서 고른다. */
  businessUnitIds: readonly number[];
  businessUnitNames: ReadonlyMap<number, string>;
  /** 고른 단계 — 저장 뒤 상세를 다시 받아 편집을 새로 그려도 같은 단계에 머물게 화면이 쥔다. */
  stepCode: StepDraft['stepCode'] | null;
  onStepChange: (stepCode: StepDraft['stepCode']) => void;
  /** 새로 만든 기준(새 판 포함)을 연다. */
  onOpened: (id: number) => void;
  onClose: () => void;
}

const STATUS_TONE: Record<string, 'info' | 'success' | 'idle'> = {
  DRAFT: 'info',
  CONFIRMED: 'success',
  OBSOLETE: 'idle',
};

/** 작성중·확정·폐기를 색과 글로 함께 가른다 — 목록과 상세 머리가 같은 표식을 쓴다(상태 칩 · 검사 기준 탭과 같다 · #208). */
export const TemplateStatusChip = ({ statusCode, size }: { statusCode: string; size?: 'sm' }) => (
  <Chip variant="status" size={size} status={STATUS_TONE[statusCode] ?? 'idle'}>
    {t.statuses[statusCode] ?? statusCode}
  </Chip>
);

/** 자재 표시 `이름 (코드)`(C-10)를 코드와 이름으로 나눈다 — 코드는 끝 괄호 안이다. */
const splitLabel = (label: string): [string, string] => {
  const at = label.lastIndexOf(' (');
  return at < 0 || !label.endsWith(')')
    ? [label, '']
    : [label.slice(at + 2, -1), label.slice(0, at)];
};

/** 필수 표시 — 다른 화면과 같은 빨간 `*`(#208). 접근성 이름에 섞이지 않게 숨긴다. */
/** 그 단계(이름·항목) 안에 칸 오류가 있나 — 단계 목록 표시와 저장 실패 때 단계를 여는 데 쓴다. */
const stepInvalid = (step: StepDraft, errors: Record<string, string>): boolean =>
  Boolean(errors[`${step.stepCode}.name`]) ||
  step.items.some((item) => Boolean(errors[`${item.key}.code`] || errors[`${item.key}.name`]));

type Picking = { kind: 'lot'; slot: InspectionSheetLotSlot } | null;

/**
 * 검사표 기준 편집 — 작성중 판만 고친다. 확정·폐기 판은 읽기 전용이고 「새 판 만들기」로 복사한다(서버도 400 으로 막는다).
 * 확정은 저장한 상태에서만 연다 — 저장 안 한 변경을 확정하면 화면과 다른 것이 확정된다.
 */
export const TemplateEditor = ({
  template,
  initialBasics,
  versions = [],
  onSelectVersion,
  businessUnitIds,
  businessUnitNames,
  stepCode,
  onStepChange,
  onOpened,
  onClose,
}: TemplateEditorProps) => {
  const { client } = useApiClient();
  const toast = useToast();
  const ids = {
    status: useId(),
    material: useId(),
    structure: useId(),
    remarks: useId(),
  };
  const pp = { name: useId(), power: useId(), motor: useId() };

  const [draft, setDraft] = useState<TemplateDraft>(() => {
    if (template !== null) return toDraft(template);
    const empty = emptyDraft(businessUnitIds[0] ?? null);
    return initialBasics === undefined
      ? empty
      : { ...empty, ...initialBasics, steps: layoutSteps(initialBasics.formLayoutCode) };
  });
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picking, setPicking] = useState<Picking>(null);
  const [confirming, setConfirming] = useState(false);
  /* 새 기준의 「기본 정보 수정」 팝업 — 처음 고르는 팝업은 화면이 띄운다(뒤 상세를 바꾸지 않게 · #208). */
  const [isBasicOpen, setIsBasicOpen] = useState(false);

  const readOnly = template !== null && template.statusCode !== 'DRAFT';
  const patch = (next: Partial<TemplateDraft>) => {
    setDraft((prev) => ({ ...prev, ...next }));
    setDirty(true);
  };

  const create = useMasterWrite<{ source: TemplateDraft }, InspectionSheetTemplate>({
    request: ({ source }, headers) =>
      client.POST('/quality/inspection-sheet-templates', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: {
          itemId: source.itemId ?? 0,
          businessUnitId: source.businessUnitId ?? 0,
          formLayoutCode: source.formLayoutCode,
          ...toBody(source),
        },
      }),
    etagPath: null,
    invalidateKeys: [templateKeys.all],
    knownFields: [],
    onSuccess: (saved) => {
      toast.show({
        variant: 'success',
        description: template === null ? t.editor.saved : t.editor.copied,
      });
      onOpened(saved.inspectionSheetTemplateId);
    },
  });

  const update = useMasterWrite<{ id: number; source: TemplateDraft }, InspectionSheetTemplate>({
    request: ({ id, source }, headers) =>
      client.PUT('/quality/inspection-sheet-templates/{inspectionSheetTemplateId}', {
        params: {
          path: { inspectionSheetTemplateId: id },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body: toBody(source),
      }),
    etagPath: template === null ? null : templateDetailPath(template.inspectionSheetTemplateId),
    invalidateKeys: [templateKeys.all],
    knownFields: [],
    onSuccess: () => {
      setDirty(false);
      toast.show({ variant: 'success', description: t.editor.saved });
    },
  });

  const confirm = useMasterWrite<{ id: number }, InspectionSheetTemplate>({
    request: ({ id }, headers) =>
      client.POST('/quality/inspection-sheet-templates/{inspectionSheetTemplateId}:confirm', {
        params: {
          path: { inspectionSheetTemplateId: id },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
      }),
    etagPath: template === null ? null : templateDetailPath(template.inspectionSheetTemplateId),
    invalidateKeys: [templateKeys.all],
    knownFields: [],
    onSuccess: () => {
      setConfirming(false);
      toast.show({ variant: 'success', description: t.editor.confirmed });
    },
  });

  const saving = create.isSaving || update.isSaving || confirm.isSaving;
  const writeError = create.error ?? update.error ?? confirm.error;

  const save = () => {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // 고른 단계 밖의 오류는 안 보이므로 그 단계를 연다.
      const failed = draft.steps.find((step) => stepInvalid(step, found));
      if (failed !== undefined) onStepChange(failed.stepCode);
      return;
    }
    if (template === null) create.write({ source: draft });
    else update.write({ id: template.inspectionSheetTemplateId, source: draft });
  };

  const setStep = (next: StepDraft) =>
    patch({ steps: draft.steps.map((step) => (step.stepCode === next.stepCode ? next : step)) });

  const currentStep =
    draft.steps.find((step) => step.stepCode === stepCode) ??
    draft.steps.find((step) => step.enabled) ??
    draft.steps[0]!;

  return (
    <section className="pane inspection-sheet-template-editor" aria-label={t.editor.newHeading}>
      {/*
       * 머리 상자 — 제목 · 판 · 상태 칩, 오른쪽 끝 상태 단추, 아래 이름표 값 줄(검사 기준 탭 상세와 같은 모양 · 사용자 지시 · #208).
       * 모델 · 사업부 · 양식은 등록한 뒤에는 바꿀 수 없다 — 새 기준만 「기본 정보 수정」 팝업으로 고친다.
       */}
      <div className="inspection-standard-plan-head-card">
        <div className="inspection-standard-plan-head">
          <div className="inspection-standard-plan-chips">
            <h2 className="pane-title">
              {template === null ? t.editor.newHeading : t.editor.detailTitle}
            </h2>
            {/*
             * 버전 고르기 — 같은 품목의 버전을 여기서 바꾼다(표는 품목마다 한 줄 · 사용자 지시 · #208).
             * 버전이 하나뿐이면 고를 것이 없어 칩으로만 보인다.
             */}
            {template !== null &&
              (versions.length > 1 && onSelectVersion !== undefined ? (
                <div className="inspection-sheet-template-version-select">
                  <Select
                    aria-label={t.editor.versionSelect}
                    options={[...versions]
                      .sort((left, right) => right.templateVersion - left.templateVersion)
                      .map((version) => ({
                        value: String(version.inspectionSheetTemplateId),
                        label: `${t.editor.versionChip(version.templateVersion)} · ${
                          t.statuses[version.statusCode] ?? version.statusCode
                        }`,
                      }))}
                    value={String(template.inspectionSheetTemplateId)}
                    onChange={(value) => onSelectVersion(Number(value))}
                  />
                </div>
              ) : (
                <Chip variant="status" status="idle">
                  {t.editor.versionChip(template.templateVersion)}
                </Chip>
              ))}
            {template !== null && <TemplateStatusChip statusCode={template.statusCode} />}
          </div>
          <div className="inspection-standard-plan-head-actions">
            {template === null && (
              <Button
                variant="outlined"
                leadingIcon={<Icon name="edit" size={18} />}
                onClick={() => setIsBasicOpen(true)}
              >
                {t.editor.editBasic}
              </Button>
            )}
            {readOnly && template !== null && (
              <Button
                disabled={saving}
                loading={create.isSaving}
                onClick={() =>
                  create.write({
                    source: {
                      ...draft,
                      itemId: template.itemId,
                      businessUnitId: template.businessUnitId,
                    },
                  })
                }
              >
                {t.editor.copyAsNew}
              </Button>
            )}
            {template !== null && !readOnly && (
              <Button
                aria-describedby={ids.status}
                disabled={saving || dirty}
                onClick={() => setConfirming(true)}
              >
                {t.editor.confirm}
              </Button>
            )}
          </div>
        </div>
        <dl className="inspection-standard-facts-line inspection-sheet-template-facts">
          {[
            { label: t.editor.model, value: draft.itemLabel || '—' },
            {
              label: t.editor.businessUnit,
              value:
                draft.businessUnitId === null
                  ? '—'
                  : (businessUnitNames.get(draft.businessUnitId) ?? String(draft.businessUnitId)),
            },
            {
              label: t.editor.layout,
              value: t.layouts[draft.formLayoutCode] ?? draft.formLayoutCode,
            },
          ].map((fact) => (
            <div key={fact.label}>
              <dt className="field-label">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {readOnly && <p className="field-note">{t.editor.readOnly}</p>}
      <SaveErrorBanner
        error={writeError}
        onReload={() => {
          create.reset();
          update.reset();
          confirm.reset();
        }}
      />

      <h3 className="pane-subtitle">{t.editor.headerSection}</h3>
      <p className="field-note">{t.editor.headerNote}</p>
      <div className="inspection-sheet-template-grid">
        <TextField
          label={t.editor.materialText}
          id={ids.material}
          value={draft.materialText}
          maxLength={500}
          disabled={readOnly}
          onChange={(e) => patch({ materialText: e.target.value })}
        />
        <TextField
          label={t.editor.structureText}
          id={ids.structure}
          value={draft.structureText}
          maxLength={500}
          disabled={readOnly}
          onChange={(e) => patch({ structureText: e.target.value })}
        />
        <div className="field-cell inspection-sheet-template-check">
          <Checkbox
            checked={draft.rohsFlag}
            disabled={readOnly}
            onChange={(e) => patch({ rohsFlag: e.target.checked })}
          >
            {t.editor.rohsFlag}
          </Checkbox>
        </div>
        {draft.formLayoutCode === 'PP' && (
          <>
            <TextField
              label={t.editor.productNameText}
              id={pp.name}
              value={draft.productNameText}
              maxLength={200}
              disabled={readOnly}
              onChange={(e) => patch({ productNameText: e.target.value })}
            />
            <TextField
              label={t.editor.powerText}
              id={pp.power}
              value={draft.powerText}
              maxLength={200}
              disabled={readOnly}
              onChange={(e) => patch({ powerText: e.target.value })}
            />
            <TextField
              label={t.editor.motorText}
              id={pp.motor}
              value={draft.motorText}
              maxLength={200}
              disabled={readOnly}
              onChange={(e) => patch({ motorText: e.target.value })}
            />
          </>
        )}
        {/* 비고는 글이 길다(500자) — 한 줄을 다 쓴다(#208). */}
        <div className="inspection-sheet-template-wide">
          <TextField
            label={t.editor.remarks}
            id={ids.remarks}
            value={draft.remarks}
            maxLength={500}
            disabled={readOnly}
            fullWidth
            onChange={(e) => patch({ remarks: e.target.value })}
          />
        </div>
      </div>

      <h3 className="pane-subtitle">{t.editor.lotSection}</h3>
      <p className="field-note">{t.editor.lotNote}</p>
      <div className="inspection-sheet-template-lots">
        {LOT_SLOTS.map((slot) => {
          const sources = draft.lotSources.filter((source) => source.slotCode === slot);
          return (
            <div className="inspection-sheet-template-lot-row" key={slot}>
              <span className="field-label">{t.slots[slot]}</span>
              <ul className="inspection-sheet-template-chips">
                {sources.length === 0 && (
                  <li className="inspection-sheet-template-muted">{t.editor.noLotItem}</li>
                )}
                {sources.map((source) => {
                  const [code, name] = splitLabel(source.label);
                  const content = (
                    <span className="inspection-sheet-template-chip" title={source.label}>
                      <strong>{code}</strong>
                      {name && <span className="inspection-sheet-template-muted">{name}</span>}
                    </span>
                  );
                  return (
                    <li key={source.itemId}>
                      {readOnly ? (
                        <Chip size="sm">{content}</Chip>
                      ) : (
                        <Chip
                          size="sm"
                          removeLabel={t.editor.removeLotItem(source.label)}
                          onRemove={() =>
                            patch({
                              lotSources: draft.lotSources.filter(
                                (row) => !(row.slotCode === slot && row.itemId === source.itemId),
                              ),
                            })
                          }
                        >
                          {content}
                        </Chip>
                      )}
                    </li>
                  );
                })}
              </ul>
              {!readOnly && (
                <Button
                  variant="outlined"
                  leadingIcon={<Icon name="add" size={18} />}
                  aria-label={t.editor.addLotItem(t.slots[slot] ?? slot)}
                  onClick={() => setPicking({ kind: 'lot', slot })}
                >
                  {t.editor.addLot}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="pane-subtitle">{t.editor.stepSection}</h3>
      {errors.steps && <p className="field-error">{errors.steps}</p>}
      <div className="inspection-sheet-template-steps">
        <StepList
          steps={draft.steps}
          selected={currentStep.stepCode}
          isInvalid={(step) => stepInvalid(step, errors)}
          onSelect={onStepChange}
        />
        <StepEditor
          key={currentStep.stepCode}
          step={currentStep}
          readOnly={readOnly}
          errors={errors}
          onChange={setStep}
        />
      </div>

      <div className="inspection-sheet-template-actions">
        <p className="inspection-sheet-template-status" id={ids.status} role="status">
          {!readOnly && dirty && t.editor.dirty}
          {template !== null && !readOnly && dirty && ` ${t.editor.confirmBlocked}`}
        </p>
        {/* 닫기는 테두리 단추 — 검사 기준 탭의 「취소」와 같은 단계(#208). */}
        <Button variant="outlined" onClick={onClose}>
          {t.editor.close}
        </Button>
        {!readOnly && (
          /* 저장은 채운 빨강 — 검사 기준 탭의 저장과 같다(사용자 지시 · #208). */
          <Button disabled={saving} loading={create.isSaving || update.isSaving} onClick={save}>
            {t.editor.save}
          </Button>
        )}
      </div>

      {confirming && template !== null && (
        <Dialog
          open
          onClose={() => setConfirming(false)}
          title={t.confirmDialog.title}
          showCloseButton={false}
          footer={
            <>
              <Button variant="outlined" onClick={() => setConfirming(false)}>
                {messages.common.cancel}
              </Button>
              <Button
                disabled={confirm.isSaving}
                loading={confirm.isSaving}
                onClick={() => confirm.write({ id: template.inspectionSheetTemplateId })}
              >
                {t.confirmDialog.ok}
              </Button>
            </>
          }
        >
          <p>{t.confirmDialog.body(template.itemCode, template.templateVersion)}</p>
        </Dialog>
      )}

      {isBasicOpen && (
        <TemplateBasicDialog
          initial={{
            itemId: draft.itemId,
            itemLabel: draft.itemLabel,
            businessUnitId: draft.businessUnitId,
            formLayoutCode: draft.formLayoutCode,
          }}
          businessUnitIds={businessUnitIds}
          businessUnitNames={businessUnitNames}
          onCancel={() => setIsBasicOpen(false)}
          onConfirm={(basics) => {
            setIsBasicOpen(false);
            patch({
              ...basics,
              steps:
                basics.formLayoutCode === draft.formLayoutCode
                  ? draft.steps
                  : layoutSteps(basics.formLayoutCode, draft.steps),
            });
            setErrors((prev) => ({ ...prev, item: '' }));
          }}
        />
      )}

      {picking !== null && (
        <ItemPickerDialog
          multiple={false}
          showAvailability={false}
          confirmLabel={t.editor.pickLotConfirm}
          onClose={() => setPicking(null)}
          onConfirm={([picked]) => {
            setPicking(null);
            if (picked === undefined) return;
            const label = `${picked.itemName} (${picked.itemCode})`;
            if (
              !draft.lotSources.some(
                (row) => row.slotCode === picking.slot && row.itemId === picked.itemId,
              )
            ) {
              patch({
                lotSources: [
                  ...draft.lotSources,
                  { slotCode: picking.slot, itemId: picked.itemId, label },
                ],
              });
            }
          }}
        />
      )}
    </section>
  );
};
