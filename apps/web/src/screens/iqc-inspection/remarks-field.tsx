import { TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

const t = messages.iqcInspection.result;

/** 부품 IQC 화면의 비고와 같은 길이. */
const REMARKS_MAX = 200;

/** 회차 비고 — 부품 IQC 화면의 비고와 같은 모양(#247 · 사용자 지시 2026-11-10). 임시 저장 · 확정에 함께 실린다. */
export const RemarksField = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) => {
  const id = useId();
  return (
    <div className="field-cell parts-iqc-stretch">
      <h3 className="parts-iqc-sub-title">
        <label htmlFor={id}>{t.remarks}</label>
      </h3>
      <TextArea
        id={id}
        fullWidth
        placeholder={t.remarksPlaceholder}
        value={value}
        rows={3}
        maxLength={REMARKS_MAX}
        showCount
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};
