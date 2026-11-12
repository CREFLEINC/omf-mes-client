import { Button, Checkbox, type Column, Icon, Table, TextArea, TextField } from '@crefle/web-ui';
import type { InspectionSheetMethodCode } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { Select } from '../../patterns/select';
import { type ItemDraft, nextKey, type StepDraft } from './draft';

const t = messages.inspectionSheetTemplate;

export interface StepEditorProps {
  step: StepDraft;
  readOnly: boolean;
  errors: Record<string, string>;
  onChange: (next: StepDraft) => void;
}

const METHODS: readonly InspectionSheetMethodCode[] = ['FULL', 'SAMPLE'];

/** 항목 이름 상한 — TextArea 의 maxLength 는 알림만 하므로 입력에서 잘라 서버 상한(200)을 넘지 않게 한다. */
const NAME_MAX = 200;

export interface StepListProps {
  steps: readonly StepDraft[];
  selected: StepDraft['stepCode'];
  isInvalid: (step: StepDraft) => boolean;
  onSelect: (stepCode: StepDraft['stepCode']) => void;
}

/**
 * 단계 목록 — 가로 단추 줄(사용자 시안 2026-10-30). 단추 둘째 줄에 사용 여부 · 항목 수를 늘 보인다 — 고르지 않아도 안다(사용자 지시 · 검사 단계 UI/UX).
 * 고른 단계는 테두리로, 사용 여부는 초록 · 회색 점과 글로 따로 보인다. 입력을 고쳐야 할 단계는 붉은 테두리. 서명 여부는 풍선 글(title).
 */
export const StepList = ({ steps, selected, isInvalid, onSelect }: StepListProps) => (
  <ul className="inspection-sheet-template-step-list" aria-label={t.editor.stepList}>
    {steps.map((step) => {
      const label = t.steps[step.stepCode] ?? step.stepCode;
      const summary = step.enabled
        ? [
            step.items.length === 0 ? t.editor.noItemsShort : t.editor.itemCount(step.items.length),
            ...(step.signRequired ? [t.editor.signShort] : []),
          ].join(', ')
        : t.editor.stepUnused;
      const invalid = step.enabled && isInvalid(step);
      /* 고를 단계가 하나뿐이면 단추가 아니라 이름표다 — 누르는 모양 · 동작이 없다(사용자 지시 2026-10-30). */
      if (steps.length === 1)
        return (
          <li key={step.stepCode}>
            <span className="inspection-sheet-template-step-tag" title={summary}>
              {step.enabled ? step.nameKo || label : label}
            </span>
          </li>
        );
      return (
        <li key={step.stepCode}>
          <button
            type="button"
            aria-current={step.stepCode === selected ? 'true' : undefined}
            aria-invalid={invalid || undefined}
            data-enabled={step.enabled}
            title={invalid ? `${summary} · ${t.editor.stepInvalid}` : summary}
            onClick={() => onSelect(step.stepCode)}
          >
            <span className="inspection-sheet-template-step-name">
              {step.enabled ? step.nameKo || label : label}
            </span>
            <span className="inspection-sheet-template-step-meta">
              <span className="inspection-sheet-template-step-dot" aria-hidden="true" />
              {`${step.enabled ? t.editor.stepOnShort : t.editor.stepOffShort} · ${t.editor.itemCountShort(step.items.length)}`}
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);

/** 한 단계 — 사용 여부·이름·서명 필요와 항목 표. 항목 순서가 출력 순서다. */
export const StepEditor = ({ step, readOnly, errors, onChange }: StepEditorProps) => {
  const stepLabel = t.steps[step.stepCode] ?? step.stepCode;
  const setItem = (key: string, patch: Partial<ItemDraft>) =>
    onChange({
      ...step,
      items: step.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    });

  const columns: Column<ItemDraft>[] = [
    {
      key: 'code',
      header: t.editor.itemCode,
      /* 항목 번호는 30자까지 — 「PROCESS_1-1」 정도가 잘리지 않는 폭(#208). */
      width: '140px',
      render: (item) => (
        <TextField
          aria-label={t.editor.itemCode}
          value={item.checkItemCode}
          maxLength={30}
          disabled={readOnly}
          error={errors[`${item.key}.code`] || undefined}
          onChange={(event) => setItem(item.key, { checkItemCode: event.target.value })}
        />
      ),
    },
    {
      key: 'nameKo',
      header: t.editor.itemNameKo,
      render: (item) => (
        <TextArea
          aria-label={t.editor.itemNameKo}
          value={item.nameKo}
          rows={1}
          maxRows={6}
          showCount={false}
          fullWidth
          disabled={readOnly}
          error={errors[`${item.key}.name`] || undefined}
          onChange={(event) => setItem(item.key, { nameKo: event.target.value.slice(0, NAME_MAX) })}
        />
      ),
    },
    {
      key: 'nameVi',
      header: t.editor.itemNameVi,
      render: (item) => (
        <TextArea
          aria-label={t.editor.itemNameVi}
          value={item.nameVi}
          rows={1}
          maxRows={6}
          showCount={false}
          fullWidth
          disabled={readOnly}
          onChange={(event) => setItem(item.key, { nameVi: event.target.value.slice(0, NAME_MAX) })}
        />
      ),
    },
    {
      key: 'method',
      header: t.editor.method,
      width: '124px',
      render: (item) => (
        <Select
          aria-label={t.editor.method}
          options={METHODS.map((code) => ({ value: code, label: t.methods[code] ?? code }))}
          value={item.methodCode}
          disabled={readOnly}
          onChange={(value) =>
            setItem(item.key, { methodCode: value as InspectionSheetMethodCode })
          }
        />
      ),
    },
    ...(readOnly
      ? []
      : [
          {
            key: 'remove',
            header: '',
            width: '64px',
            render: (item: ItemDraft) => (
              <Button
                variant="text"
                aria-label={t.editor.removeItem(item.checkItemCode)}
                onClick={() =>
                  onChange({ ...step, items: step.items.filter((row) => row.key !== item.key) })
                }
              >
                {t.editor.remove}
              </Button>
            ),
          },
        ]),
  ];

  const addItem = () =>
    onChange({
      ...step,
      items: [
        ...step.items,
        { key: nextKey(), checkItemCode: '', nameKo: '', nameVi: '', methodCode: 'FULL' },
      ],
    });

  return (
    <fieldset className="inspection-sheet-template-step" data-enabled={step.enabled}>
      {/*
       * 머리 줄 — 왼쪽 단계 이름 · 항목 수, 오른쪽 사용 · 관리자 서명 체크(사용자 지시 · 검사 단계 UI/UX).
       * 쓰지 않는 단계는 이 줄만 둔다 — 체크를 끄면 항목은 지우지 않고 감춘다(다시 켜면 그대로 보인다).
       */}
      <legend className="inspection-sheet-template-step-head">
        <span className="inspection-sheet-template-step-title">
          <span className="inspection-sheet-template-step-title-name">
            {step.enabled ? step.nameKo || stepLabel : stepLabel}
          </span>
          <span className="inspection-sheet-template-step-count">
            {t.editor.itemsRegistered(step.items.length)}
          </span>
        </span>
        <span className="inspection-sheet-template-step-toggles">
          <Checkbox
            checked={step.enabled}
            disabled={readOnly}
            onChange={(event) => onChange({ ...step, enabled: event.target.checked })}
          >
            {t.editor.stepUse(stepLabel)}
          </Checkbox>
          {step.enabled && (
            <Checkbox
              checked={step.signRequired}
              disabled={readOnly}
              onChange={(event) => onChange({ ...step, signRequired: event.target.checked })}
            >
              {t.editor.signRequired}
            </Checkbox>
          )}
        </span>
      </legend>
      {step.enabled && (
        <>
          <div className="inspection-sheet-template-step-fields">
            <TextField
              label={t.editor.stepNameKo}
              aria-label={`${stepLabel} ${t.editor.stepNameKo}`}
              value={step.nameKo}
              maxLength={100}
              disabled={readOnly}
              error={errors[`${step.stepCode}.name`] || undefined}
              onChange={(event) => onChange({ ...step, nameKo: event.target.value })}
            />
            <TextField
              label={t.editor.stepNameVi}
              aria-label={`${stepLabel} ${t.editor.stepNameVi}`}
              value={step.nameVi}
              maxLength={100}
              disabled={readOnly}
              onChange={(event) => onChange({ ...step, nameVi: event.target.value })}
            />
          </div>
          {/* 「항목 추가」는 검사 항목 칸 오른쪽 위(사용자 지시 · 검사 단계 UI/UX). */}
          <div className="inspection-sheet-template-items-head">
            <span className="inspection-sheet-template-items-title">{t.editor.itemsTitle}</span>
            {!readOnly && (
              <Button
                variant="outlined"
                className="inspection-sheet-template-add-item"
                leadingIcon={<Icon name="add" size={18} />}
                onClick={addItem}
              >
                {t.editor.addItem}
              </Button>
            )}
          </div>
          {step.items.length === 0 && (
            <p className="inspection-sheet-template-muted">{t.editor.noItems}</p>
          )}
          {step.items.length > 0 && (
            /* 표는 둥근 테두리 상자 안에 — 검사 기준 탭 항목 표와 같다(#208). */
            <div className="inspection-sheet-template-items inspection-standard-table-box">
              <Table
                caption={
                  <span className="inspection-sheet-template-caption">
                    {t.editor.itemsCaption(stepLabel)}
                  </span>
                }
                density="compact"
                zebra={false}
                columns={columns}
                rows={step.items}
                getRowId={(item) => item.key}
              />
            </div>
          )}
        </>
      )}
    </fieldset>
  );
};
