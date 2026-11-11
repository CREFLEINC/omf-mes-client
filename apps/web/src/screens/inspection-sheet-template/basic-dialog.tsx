import { Button, Dialog, Icon, SearchInput, TextField } from '@crefle/web-ui';
import type { InspectionSheetLayoutCode } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { Select } from '../../patterns/select';

const t = messages.inspectionSheetTemplate;

/**
 * 새 기준의 기본 정보 — 기준코드 · 기준명(관리용 · omf-all-around#260) · 품목 · 사업부 · 출력 양식.
 * 품목 · 사업부 · 양식은 등록한 뒤에는 바꿀 수 없고, 기준코드 · 기준명은 작성중 버전에서 고친다.
 */
export interface TemplateBasics {
  templateCode: string;
  templateName: string;
  itemId: number | null;
  itemLabel: string;
  businessUnitId: number | null;
  formLayoutCode: InspectionSheetLayoutCode;
}

/** 보일 칸 — `all` 전부, `code` 기준코드 · 기준명만, `scope` 사업부 · 출력 양식만(검사 기준 등록 창의 PQC · #260). */
export type TemplateBasicPart = 'all' | 'code' | 'scope';

/** 칸 오류 — 열쇠는 `item` · `code` · `name`. */
export type TemplateBasicErrors = Partial<Record<'item' | 'code' | 'name', string>>;

/** 확인 전에 거르는 빈 칸 — 고칠 수 있게 보인 칸만 본다. */
export const basicErrorsOf = (
  values: TemplateBasics,
  part: TemplateBasicPart,
): TemplateBasicErrors => {
  const errors: TemplateBasicErrors = {};
  if (part !== 'scope') {
    if (values.templateCode.trim() === '') errors.code = t.editor.noTemplateCode;
    if (values.templateName.trim() === '') errors.name = t.editor.noTemplateName;
  }
  if (part === 'all' && values.itemId === null) errors.item = t.editor.noModel;
  return errors;
};

export interface TemplateBasicDialogProps {
  /** 창 제목 — 없으면 「새 검사표 기준」. 복사는 「검사표 기준 복사」(omf-all-around#255). */
  title?: string;
  part?: TemplateBasicPart;
  initial: TemplateBasics;
  businessUnitIds: readonly number[];
  businessUnitNames: ReadonlyMap<number, string>;
  onConfirm: (basics: TemplateBasics) => void;
  onCancel: () => void;
}

const Required = () => (
  <span className="required-mark" aria-hidden="true">
    {' '}
    *
  </span>
);

/**
 * 품목 · 사업부 · 출력 양식 칸과 양식 안내 — 이 창과 검사 기준 「기준 추가」 창(PQC 를 고른 때 · 사용자 지시)이 같이 쓴다.
 * 품목은 누르거나 엔터를 치면 품목 선택 창이 열린다.
 */
export const TemplateBasicFields = ({
  part = 'all',
  values,
  onChange,
  errors,
  businessUnitIds,
  businessUnitNames,
}: {
  part?: TemplateBasicPart;
  values: TemplateBasics;
  onChange: (patch: Partial<TemplateBasics>) => void;
  errors: TemplateBasicErrors;
  businessUnitIds: readonly number[];
  businessUnitNames: ReadonlyMap<number, string>;
}) => {
  const ids = { code: useId(), name: useId(), item: useId(), bu: useId(), layout: useId() };
  const itemError = errors.item ?? '';
  const [isPicking, setIsPicking] = useState(false);
  const scopeOptions = businessUnitIds.map((id) => ({
    value: String(id),
    label: businessUnitNames.get(id) ?? String(id),
  }));

  return (
    <>
      {/* 세 칸을 한 열로 같은 폭에 쌓는다(사용자 지시 · #208). */}
      <div className="form-grid inspection-sheet-template-basic-grid">
        {part !== 'scope' && (
          <>
            <div className="field-cell">
              <span className="field-label">
                <label htmlFor={ids.code}>{t.editor.templateCode}</label>
                <Required />
              </span>
              <TextField
                id={ids.code}
                fullWidth
                value={values.templateCode}
                onChange={(event) => onChange({ templateCode: event.target.value })}
                error={errors.code}
                aria-required
              />
            </div>
            <div className="field-cell">
              <span className="field-label">
                <label htmlFor={ids.name}>{t.editor.templateName}</label>
                <Required />
              </span>
              <TextField
                id={ids.name}
                fullWidth
                value={values.templateName}
                onChange={(event) => onChange({ templateName: event.target.value })}
                error={errors.name}
                aria-required
              />
            </div>
          </>
        )}
        {/* 품목 — 조회 줄의 「품목 검색」과 같은 칸: 누르거나 엔터를 치면 품목 선택 창이 열린다. */}
        {part === 'all' && (
          <div className="field-cell">
            <span className="field-label">
              <label htmlFor={ids.item}>{t.editor.model}</label>
              <Required />
            </span>
            <SearchInput
              id={ids.item}
              fullWidth
              placeholder={t.list.modelPlaceholder}
              value={values.itemLabel}
              readOnly
              title={values.itemLabel === '' ? undefined : values.itemLabel}
              aria-haspopup="dialog"
              clearLabel={t.list.modelClear}
              error={itemError === '' ? undefined : itemError}
              onClick={() => setIsPicking(true)}
              onSearch={() => setIsPicking(true)}
              onChange={() => undefined}
              onClear={() => onChange({ itemId: null, itemLabel: '' })}
            />
          </div>
        )}
        {part !== 'code' && (
          <>
            <div className="field-cell">
              <span className="field-label">
                <label htmlFor={ids.bu}>{t.editor.businessUnit}</label>
                <Required />
              </span>
              {scopeOptions.length === 0 ? (
                <p className="field-error">{t.editor.noBusinessUnit}</p>
              ) : (
                <Select
                  id={ids.bu}
                  options={scopeOptions}
                  value={String(values.businessUnitId ?? '')}
                  onChange={(value) => onChange({ businessUnitId: Number(value) })}
                />
              )}
            </div>
            <div className="field-cell">
              <span className="field-label">
                <label htmlFor={ids.layout}>{t.editor.layout}</label>
                <Required />
              </span>
              <Select
                id={ids.layout}
                options={(['OP', 'PP'] as const).map((code) => ({
                  value: code,
                  label: t.layouts[code] ?? code,
                }))}
                value={values.formLayoutCode}
                onChange={(value) =>
                  onChange({ formLayoutCode: value as InspectionSheetLayoutCode })
                }
              />
            </div>
            {/* 양식 안내 — 안내 알약(아이콘 + 한 줄 · 사용자 시안 · #208). */}
            <p className="inspection-standard-notice-label">
              <Icon name="info" size={16} aria-hidden />
              {t.editor.layoutNote}
            </p>
          </>
        )}
      </div>

      {isPicking && (
        <ItemPickerDialog
          multiple={false}
          compact
          showAvailability={false}
          confirmLabel={t.editor.pickConfirm}
          onClose={() => setIsPicking(false)}
          onConfirm={([picked]) => {
            setIsPicking(false);
            if (picked === undefined) return;
            onChange({
              itemId: picked.itemId,
              itemLabel: `${picked.itemName} (${picked.itemCode})`,
            });
          }}
        />
      )}
    </>
  );
};

/**
 * 새 기준의 기본 정보 팝업 — 검사 기준 탭의 「기준 추가」 창과 같다(사용자 지시 · #208).
 * 값은 창 안에만 들고 있다가 「확인」에서 넘긴다 — 취소하면 아무것도 바뀌지 않는다(뒤 상세 칸도 그대로).
 */
export const TemplateBasicDialog = ({
  title = t.editor.newHeading,
  part = 'all',
  initial,
  businessUnitIds,
  businessUnitNames,
  onConfirm,
  onCancel,
}: TemplateBasicDialogProps) => {
  const [values, setValues] = useState<TemplateBasics>(initial);
  const [errors, setErrors] = useState<TemplateBasicErrors>({});

  return (
    <Dialog
      open
      size="md"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="outlined" onClick={onCancel}>
            {messages.common.cancel}
          </Button>
          <Button
            disabled={part !== 'code' && businessUnitIds.length === 0}
            onClick={() => {
              const found = basicErrorsOf(values, part);
              setErrors(found);
              if (Object.keys(found).length > 0) return;
              onConfirm({
                ...values,
                templateCode: values.templateCode.trim(),
                templateName: values.templateName.trim(),
              });
            }}
          >
            {t.editor.basicConfirm}
          </Button>
        </>
      }
    >
      <TemplateBasicFields
        part={part}
        values={values}
        onChange={(patch) => {
          setValues((prev) => ({ ...prev, ...patch }));
          /* 고친 칸의 오류만 걷는다. */
          setErrors((prev) => ({
            ...prev,
            ...(patch.itemId !== undefined && patch.itemId !== null ? { item: undefined } : {}),
            ...(patch.templateCode !== undefined ? { code: undefined } : {}),
            ...(patch.templateName !== undefined ? { name: undefined } : {}),
          }));
        }}
        errors={errors}
        businessUnitIds={businessUnitIds}
        businessUnitNames={businessUnitNames}
      />
    </Dialog>
  );
};
