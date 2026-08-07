import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import type { BuMapDraft } from './bu-map-draft';
import { validateBuMapDraft } from './bu-map-validation';
import { FieldLabel } from './field-label';
import { ItemPicker } from './item-picker';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.buMap;

export interface BuMapFormDialogProps {
  /** 편집 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다 */
  draft: BuMapDraft;
  /** 새 줄인가. 창 제목만 가른다 */
  isNew: boolean;
  businessUnitOptions: (selected: string) => SelectOption[];
  /** 지금 고른 대상 품목의 이름. 검색 결과에 없어도 번호가 보이지 않게 한다 */
  selectedItemLabel?: string;
  onClose: () => void;
  /** 표에만 반영한다 — **서버 요청이 나가지 않는다** */
  onConfirm: (draft: BuMapDraft) => void;
}

/**
 * 사업부 매핑 한 줄을 고치는 창.
 *
 * **확인은 저장이 아니다.** 표에만 반영되고 서버로는 「저장」에서 최종 목록이 한 번에 나간다 —
 * 계약이 행 단위 추가·삭제 경로를 두지 않았다(전체 치환). 밝히지 않으면 사용자가
 * 창을 닫는 순간 저장된 줄 안다.
 *
 * **대상 품목은 검색해서 고른다**(결정 8). 품목이 수천 건일 수 있어 선택칸에 다 담을 수 없고,
 * 번호 입력은 내부 식별자를 사용자에게 내는 것이다.
 *
 * **중복을 막지 않는다**(결정 7). 계약이 이 표에 유일 제약을 적지 않았다 —
 * 없는 제약을 흉내 내면 서버가 허용하는 값을 화면이 막는다.
 */
export const BuMapFormDialog = ({
  draft,
  isNew,
  businessUnitOptions,
  selectedItemLabel,
  onClose,
  onConfirm,
}: BuMapFormDialogProps) => {
  const [values, setValues] = useState<BuMapDraft>(draft);
  /** 확인을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fromId = useId();
  const toId = useId();

  const change = (patch: Partial<BuMapDraft>) => {
    setValues((prev) => ({ ...prev, ...patch }));

    // 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of Object.keys(patch)) delete next[field];

      /*
       * 보내는·받는 사업부는 **함께** 구별 제약을 만든다 — 한쪽을 고치면 그 판정을 다시 한다.
       * 유효 시작·종료도 짝으로 오류가 붙는다. 한쪽만 지우면 고친 칸의 오류는 사라지는데
       * 다른 칸에 같은 문구가 남아, 사용자가 이미 고친 것을 다시 고치려 든다.
       */
      if ('fromBusinessUnitId' in patch) delete next.toBusinessUnitId;

      if ('effectiveFrom' in patch || 'effectiveTo' in patch) {
        delete next.effectiveFrom;
        delete next.effectiveTo;
      }

      return next;
    });
  };

  const handleConfirm = () => {
    const found = validateBuMapDraft(values);
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
          label={t.fields.fromBusinessUnit}
          required
          options={businessUnitOptions(values.fromBusinessUnitId)}
          value={values.fromBusinessUnitId}
          onChange={(value) => change({ fromBusinessUnitId: value })}
          error={errors.fromBusinessUnitId}
        />

        <SelectField
          label={t.fields.toBusinessUnit}
          required
          options={businessUnitOptions(values.toBusinessUnitId)}
          value={values.toBusinessUnitId}
          onChange={(value) => change({ toBusinessUnitId: value })}
          error={errors.toBusinessUnitId}
        />

        <ItemPicker
          value={values.toItemId}
          onChange={(value) => change({ toItemId: value })}
          selectedLabel={selectedItemLabel}
          required
          error={errors.toItemId}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={fromId} label={t.fields.effectiveFrom} required />
          <TextField
            id={fromId}
            type="date"
            value={values.effectiveFrom}
            onChange={(event) => change({ effectiveFrom: event.target.value })}
            error={errors.effectiveFrom}
            aria-required
          />
        </div>

        {/* 비우면 무기한이다 — 계약이 널을 허용한다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={toId} label={t.fields.effectiveTo} />
          <TextField
            id={toId}
            type="date"
            value={values.effectiveTo}
            onChange={(event) => change({ effectiveTo: event.target.value })}
            error={errors.effectiveTo}
          />
        </div>
      </div>
    </Dialog>
  );
};
