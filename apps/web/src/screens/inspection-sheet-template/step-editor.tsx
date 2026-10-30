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
 * 단계 목록 — 가로 단추 줄(사용자 시안 2026-10-30). 쓰지 않는 단계는 흐리게, 입력을 고쳐야 할 단계는 붉은 테두리.
 * 항목 수 · 서명 여부는 단추 풍선 글(title)로 남긴다.
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
            {step.enabled ? step.nameKo || label : label}
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
    <fieldset className="inspection-sheet-template-step">
      {/* 사용 · 관리자 서명 체크와 「항목 추가」가 한 줄, 아래 구분선 뒤에 단계 이름 칸(사용자 시안 2026-10-30). */}
      <legend className="inspection-sheet-template-step-head">
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
        {step.enabled && !readOnly && (
          <Button
            variant="outlined"
            className="inspection-sheet-template-add-item"
            leadingIcon={<Icon name="add" size={18} />}
            onClick={addItem}
          >
            {t.editor.addItem}
          </Button>
        )}
      </legend>
      {!step.enabled ? (
        <p className="inspection-sheet-template-muted">{t.editor.stepOff}</p>
      ) : (
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
