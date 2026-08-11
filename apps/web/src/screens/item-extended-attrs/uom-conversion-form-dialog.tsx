import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { DateField } from './date-field';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { SelectOption } from './types';
import type { UomConversionDraft } from './uom-conversion-draft';
import { validateUomConversionDraft } from './uom-conversion-validation';

const t = messages.itemExtendedAttrs.uomConversion;

export interface UomConversionFormDialogProps {
  /** 편집 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다 */
  draft: UomConversionDraft;
  /** 새 줄인가. 창 제목만 가른다 */
  isNew: boolean;
  /** 중복 판정에 쓰는 나머지 줄. 자기 자신은 초안 키로 걸러진다 */
  otherDrafts: readonly UomConversionDraft[];
  uomOptions: (selected: string) => SelectOption[];
  onClose: () => void;
  /** 표에만 반영한다 — **서버 요청이 나가지 않는다** */
  onConfirm: (draft: UomConversionDraft) => void;
}

/**
 * 단위 환산 한 줄을 고치는 창.
 *
 * **확인은 저장이 아니다.** 표에만 반영되고 서버로는 「저장」에서 최종 목록이 한 번에 나간다.
 *
 * **환산 비율에 기본값을 지어내지 않는다.** `1`을 미리 넣으면 사용자가 확인하지 않은 값이
 * 그대로 저장된다 — 단위 환산에서 1은 「같은 단위」라는 뜻이라 조용히 틀린 자료가 남는다.
 */
export const UomConversionFormDialog = ({
  draft,
  isNew,
  otherDrafts,
  uomOptions,
  onClose,
  onConfirm,
}: UomConversionFormDialogProps) => {
  const [values, setValues] = useState<UomConversionDraft>(draft);
  /** 확인을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const rateId = useId();

  const change = (patch: Partial<UomConversionDraft>) => {
    setValues((prev) => ({ ...prev, ...patch }));

    // 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of Object.keys(patch)) delete next[field];

      /*
       * 변환 전·변환 후·유효 시작은 **함께** 구별 제약과 유일 제약을 만든다 —
       * 하나를 고치면 그 판정을 다시 한다. 중복 문구는 「변환 전」 칸에 붙으므로
       * 나머지 둘을 고쳤을 때도 지워야 한다.
       */
      if ('toUomId' in patch || 'effectiveFrom' in patch) delete next.fromUomId;
      if ('fromUomId' in patch) delete next.toUomId;

      /* 유효 시작·종료는 짝으로 오류가 붙는다 — 한쪽만 지우면 다른 칸에 같은 문구가 남는다. */
      if ('effectiveFrom' in patch || 'effectiveTo' in patch) {
        delete next.effectiveFrom;
        delete next.effectiveTo;
      }

      return next;
    });
  };

  const handleConfirm = () => {
    const found = validateUomConversionDraft(values, otherDrafts);
    setErrors(found);

    if (Object.keys(found).length > 0) return;

    onConfirm(values);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={isNew ? t.dialog.addTitle : t.dialog.editTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button onClick={handleConfirm}>{t.dialog.confirm}</Button>
        </>
      }
    >
      {/* 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다. */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.dialog.notSavedNotice}</AlertBanner>
      </div>

      <div className="form-grid">
        <SelectField
          label={t.fields.fromUom}
          required
          options={uomOptions(values.fromUomId)}
          value={values.fromUomId}
          onChange={(value) => change({ fromUomId: value })}
          error={errors.fromUomId}
        />

        <SelectField
          label={t.fields.toUom}
          required
          options={uomOptions(values.toUomId)}
          value={values.toUomId}
          onChange={(value) => change({ toUomId: value })}
          error={errors.toUomId}
        />

        {/*
         * `step`을 두지 않는다 — 계약이 `numeric(18,8)`이라 여덟 자리가 실제로 오가는데,
         * `step`을 주면 브라우저가 그 배수만 허용해 정상 값이 막힌다.
         */}
        <div className="field-cell">
          <FieldLabel htmlFor={rateId} label={t.fields.conversionRate} required />
          <TextField
            id={rateId}
            type="number"
            step="any"
            value={values.conversionRate}
            onChange={(event) => change({ conversionRate: event.target.value })}
            error={errors.conversionRate}
            aria-required
          />
        </div>

        {/* 날짜 입력은 DS `DatePicker`다(변경 통지 #63). */}
        <DateField
          label={t.fields.effectiveFrom}
          required
          value={values.effectiveFrom}
          onChange={(effectiveFrom) => change({ effectiveFrom })}
          error={errors.effectiveFrom}
        />

        {/* 비우면 무기한이다 — 계약이 널을 허용한다. */}
        <DateField
          label={t.fields.effectiveTo}
          value={values.effectiveTo}
          onChange={(effectiveTo) => change({ effectiveTo })}
          error={errors.effectiveTo}
        />
      </div>
    </Dialog>
  );
};
