import { AlertBanner, Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from './field-label';
import type { QualificationDraft } from './qualification-draft';
import { QUALIFICATION_TYPE_OPTIONS } from './qualification-options';
import { validateQualificationDraft } from './qualification-validation';
import { SelectField } from './select-field';
import type { SelectOption } from './types';

const t = messages.commonCode.qualification;

export interface QualificationFormDialogProps {
  /** 편집 대상. **열 때만 마운트한다** — 닫힌 창을 남기면 지난 값이 살아 있다 */
  draft: QualificationDraft;
  /** 새 줄인가. 창 제목만 가른다 */
  isNew: boolean;
  /** 중복 판정에 쓰는 나머지 줄. 자기 자신은 초안 키로 걸러진다 */
  otherDrafts: readonly QualificationDraft[];
  processOptions: SelectOption[];
  onClose: () => void;
  /** 표에만 반영한다 — **서버 요청이 나가지 않는다** */
  onConfirm: (draft: QualificationDraft) => void;
}

/**
 * 자격 한 줄을 고치는 창.
 *
 * **확인은 저장이 아니다.** 표에만 반영되고 서버로는 「저장」에서 최종 목록이 한 번에 나간다 —
 * 밝히지 않으면 사용자가 창을 닫는 순간 저장된 줄 안다.
 *
 * 자격 유형 선택지는 **자리표시 하나뿐**이다(공통코드 값 목록 미정 §8-5). 감추지 않고
 * 「선택지 준비 중」 안내를 붙인다 — 값을 지어내면 그 코드로 저장된 자료가 남는다.
 */
export const QualificationFormDialog = ({
  draft,
  isNew,
  otherDrafts,
  processOptions,
  onClose,
  onConfirm,
}: QualificationFormDialogProps) => {
  const [values, setValues] = useState<QualificationDraft>(draft);
  /** 확인을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  const certificateId = useId();
  const fromId = useId();
  const toId = useId();

  const change = (patch: Partial<QualificationDraft>) => {
    setValues((prev) => ({ ...prev, ...patch }));

    // 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다.
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of Object.keys(patch)) delete next[field];
      // 유형·공정은 함께 중복을 만든다 — 한쪽을 고치면 그 판정을 다시 한다.
      if ('processId' in patch) delete next.qualificationTypeCode;
      return next;
    });
  };

  const handleConfirm = () => {
    const found = validateQualificationDraft(values, otherDrafts);
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
          label={t.fields.qualificationType}
          required
          options={QUALIFICATION_TYPE_OPTIONS}
          value={values.qualificationTypeCode}
          onChange={(value) => change({ qualificationTypeCode: value })}
          note={messages.pendingCode.note}
          error={errors.qualificationTypeCode}
        />

        {/* 비우는 것이 정상 값이다 — 계약이 그 뜻을 「(전체 공정)」으로 정했다(A-7). */}
        <SelectField
          label={t.fields.process}
          options={[{ value: '', label: t.values.allProcesses }, ...processOptions]}
          value={values.processId}
          onChange={(value) => change({ processId: value })}
          error={errors.processId}
        />

        <div className="field-cell">
          <FieldLabel htmlFor={certificateId} label={t.fields.certificateNo} />
          <TextField
            id={certificateId}
            value={values.certificateNo}
            onChange={(event) => change({ certificateNo: event.target.value })}
            error={errors.certificateNo}
          />
        </div>

        <div className="field-cell">
          <FieldLabel htmlFor={fromId} label={t.fields.validFrom} required />
          <TextField
            id={fromId}
            type="date"
            value={values.validFrom}
            onChange={(event) => change({ validFrom: event.target.value })}
            error={errors.validFrom}
            aria-required
          />
        </div>

        {/* 비우면 무기한이다 — 계약이 널을 허용한다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={toId} label={t.fields.validTo} />
          <TextField
            id={toId}
            type="date"
            value={values.validTo}
            onChange={(event) => change({ validTo: event.target.value })}
            error={errors.validTo}
          />
        </div>
      </div>
    </Dialog>
  );
};
