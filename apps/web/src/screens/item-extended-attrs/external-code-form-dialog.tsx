import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import type { ExternalCodeDraft } from './external-code-draft';
import { externalSystemOptions } from './code-catalog';
import { validateExternalCodeDraft } from './external-code-validation';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.itemExtendedAttrs.externalCode;

export interface ExternalCodeFormDialogProps {
  /** 편집 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다 */
  draft: ExternalCodeDraft;
  /** 새 줄인가. 창 제목만 가른다 */
  isNew: boolean;
  /** 중복 판정에 쓰는 나머지 줄. 자기 자신은 초안 키로 걸러진다 */
  otherDrafts: readonly ExternalCodeDraft[];
  partnerOptions: (selected: string) => SelectOption[];
  onClose: () => void;
  /** 표에만 반영한다 — **서버 요청이 나가지 않는다** */
  onConfirm: (draft: ExternalCodeDraft) => void;
}

/**
 * 외부 코드 한 줄을 고치는 창.
 *
 * 외부 시스템 코드는 고정 OpenAPI가 닫은 세 값에서 고른다. 화면이 별도 코드값을 만들지 않는다.
 *
 * **거래처를 비우는 것이 정상 값이다**(A-7). 다만 비운 두 줄은 서버에게 같은 짝이라
 * 중복 문구가 그 사실을 함께 밝힌다.
 */
export const ExternalCodeFormDialog = ({
  draft,
  isNew,
  otherDrafts,
  partnerOptions,
  onClose,
  onConfirm,
}: ExternalCodeFormDialogProps) => {
  const [values, setValues] = useState<ExternalCodeDraft>(draft);
  /** 확인을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const codeId = useId();

  const change = (patch: Partial<ExternalCodeDraft>) => {
    setValues((prev) => ({ ...prev, ...patch }));

    // 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of Object.keys(patch)) delete next[field];

      /*
       * 외부 시스템과 거래처가 **함께** 유일 제약을 만든다 — 중복 문구는 외부 시스템 칸에
       * 붙으므로 거래처를 고쳤을 때도 지운다.
       */
      if ('partnerId' in patch) delete next.externalSystemCode;

      return next;
    });
  };

  const handleConfirm = () => {
    const found = validateExternalCodeDraft(values, otherDrafts);
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
          label={t.fields.externalSystem}
          options={externalSystemOptions}
          value={values.externalSystemCode}
          onChange={(value) =>
            change({ externalSystemCode: value as ExternalCodeDraft['externalSystemCode'] })
          }
          placeholder={t.externalSystemPlaceholder}
          error={errors.externalSystemCode}
          required
        />

        {/*
         * 비우면 「(전체)」다 — 계약이 그 뜻을 널로 표현한다(A-7).
         *
         * **이 칸에는 자기 오류가 없다.** 필수가 아니고, 유일 제약은 외부 시스템과 짝을 이루므로
         * 중복 문구는 위 칸에 붙는다. 늘 비어 있을 오류 자리를 두면 「이 칸도 막힐 수 있다」는
         * 뜻이 되어, 읽는 사람이 없는 규칙을 찾게 된다.
         */}
        <SelectField
          label={t.fields.partner}
          options={[
            { value: '', label: t.values.allPartners },
            ...partnerOptions(values.partnerId),
          ]}
          value={values.partnerId}
          onChange={(value) => change({ partnerId: value })}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={codeId} label={t.fields.externalItemCode} required />
          <TextField
            id={codeId}
            value={values.externalItemCode}
            onChange={(event) => change({ externalItemCode: event.target.value })}
            error={errors.externalItemCode}
            aria-required
          />
        </div>
      </div>
    </Dialog>
  );
};
