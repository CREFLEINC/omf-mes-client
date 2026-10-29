import { Button, Dialog, Icon, SearchInput } from '@crefle/web-ui';
import type { InspectionSheetLayoutCode } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { ItemPickerDialog } from '../../patterns/item-picker';
import { Select } from '../../patterns/select';

const t = messages.inspectionSheetTemplate;

/** 새 기준의 기본 정보 — 품목 · 사업부 · 출력 양식. 등록한 뒤에는 바꿀 수 없다. */
export interface TemplateBasics {
  itemId: number | null;
  itemLabel: string;
  businessUnitId: number | null;
  formLayoutCode: InspectionSheetLayoutCode;
}

export interface TemplateBasicDialogProps {
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
 * 새 기준의 기본 정보 팝업 — 검사 기준 탭의 「기준 추가」 창과 같다(사용자 지시 · #208).
 * 값은 창 안에만 들고 있다가 「확인」에서 넘긴다 — 취소하면 아무것도 바뀌지 않는다(뒤 상세 칸도 그대로).
 */
export const TemplateBasicDialog = ({
  initial,
  businessUnitIds,
  businessUnitNames,
  onConfirm,
  onCancel,
}: TemplateBasicDialogProps) => {
  const ids = { item: useId(), bu: useId(), layout: useId() };
  const [values, setValues] = useState<TemplateBasics>(initial);
  const [itemError, setItemError] = useState('');
  const [isPicking, setIsPicking] = useState(false);

  const scopeOptions = businessUnitIds.map((id) => ({
    value: String(id),
    label: businessUnitNames.get(id) ?? String(id),
  }));

  return (
    <>
      <Dialog
        open
        size="lg"
        closeOnBackdropClick={false}
        showCloseButton={false}
        title={t.editor.newHeading}
        onClose={onCancel}
        footer={
          <>
            <Button variant="outlined" onClick={onCancel}>
              {messages.common.cancel}
            </Button>
            <Button
              disabled={scopeOptions.length === 0}
              onClick={() => {
                if (values.itemId === null) {
                  setItemError(t.editor.noModel);
                  return;
                }
                onConfirm(values);
              }}
            >
              {t.editor.basicConfirm}
            </Button>
          </>
        }
      >
        {/* 세 칸을 한 열로 같은 폭에 쌓는다(사용자 지시 · #208). */}
        <div className="form-grid inspection-sheet-template-basic-grid">
          {/* 품목 — 조회 줄의 「품목 검색」과 같은 칸: 누르거나 엔터를 치면 품목 선택 창이 열린다. */}
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
              onClear={() => setValues((prev) => ({ ...prev, itemId: null, itemLabel: '' }))}
            />
          </div>
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
                onChange={(value) =>
                  setValues((prev) => ({ ...prev, businessUnitId: Number(value) }))
                }
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
                setValues((prev) => ({
                  ...prev,
                  formLayoutCode: value as InspectionSheetLayoutCode,
                }))
              }
            />
          </div>
          {/* 양식 안내 — 안내 알약(아이콘 + 한 줄 · 사용자 시안 · #208). */}
          <p className="inspection-standard-notice-label">
            <Icon name="info" size={18} aria-hidden />
            {t.editor.layoutNote}
          </p>
        </div>
      </Dialog>

      {isPicking && (
        <ItemPickerDialog
          multiple={false}
          showAvailability={false}
          confirmLabel={t.editor.pickConfirm}
          onClose={() => setIsPicking(false)}
          onConfirm={([picked]) => {
            setIsPicking(false);
            if (picked === undefined) return;
            setValues((prev) => ({
              ...prev,
              itemId: picked.itemId,
              itemLabel: `${picked.itemName} (${picked.itemCode})`,
            }));
            setItemError('');
          }}
        />
      )}
    </>
  );
};
