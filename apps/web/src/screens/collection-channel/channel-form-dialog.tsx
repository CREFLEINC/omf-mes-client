import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CodeOption } from './options';
import { SelectField } from './select-field';
import type { ChannelFormValues } from './types';

const t = messages.collectionChannel;

interface ReadOnlyFieldProps {
  label: string;
  value: string;
  note: string;
}

/**
 * 값을 보여 주기만 하는 칸.
 *
 * **폼 컨트롤을 잠그지 않고 값 표기로 낸다** — 잠긴 입력칸은 「언젠가 여기서 고칠 수 있다」를
 * 뜻하는데, 이 값들은 이 창이 영영 정하지 않는다. 사유는 함께 낸다.
 */
const ReadOnlyField = ({ label, value, note }: ReadOnlyFieldProps) => {
  const labelId = useId();

  return (
    <div className="field-cell">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <p aria-labelledby={labelId}>{value}</p>
      <span className="field-note">{note}</span>
    </div>
  );
};

export interface ChannelFormDialogProps {
  mode: 'create' | 'edit';
  /** 이 채널이 매인 설비. 등록에서도 수정에서도 여기서 옮길 수 없다 */
  equipmentLabel: string;
  values: ChannelFormValues;
  onChange: (patch: Partial<ChannelFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  unitOptions: CodeOption[];
  /** 선택 목록의 한계(잘림·실패) 안내. 없으면 붙이지 않는다 */
  optionsNote?: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}

/**
 * 수집 채널 등록·수정 창.
 *
 * ⭐ **채널명은 등록에서만 정한다** — 계약의 수정 본문에 없다. 수정에서는 잠긴 입력칸이
 * 아니라 **값 표기 + 사유**로 낸다(공유계약 G-2).
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 사용자가 친 값을 지킨다. Escape 와 X 는 남긴다:
 * 둘은 나가겠다고 «말한 것»이라 파기가 곧 그 뜻이다.
 */
export const ChannelFormDialog = ({
  mode,
  equipmentLabel,
  values,
  onChange,
  fieldErrors,
  banner,
  unitOptions,
  optionsNote,
  isSaving,
  onClose,
  onSave,
}: ChannelFormDialogProps) => {
  const isCreate = mode === 'create';

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      title={isCreate ? t.form.createTitle : t.form.editTitle}
      footer={
        <>
          <Button variant="outlined" onClick={onClose} disabled={isSaving}>
            {messages.common.cancel}
          </Button>
          <Button onClick={onSave} loading={isSaving}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner !== null && banner !== undefined && <div className="form-grid-full">{banner}</div>}

        {/* 어느 설비에 더하는지 창이 스스로 말한다 — 좌우가 멀어지면 고른 것을 잊는다. */}
        <ReadOnlyField
          label={t.fields.equipment}
          value={equipmentLabel}
          note={t.actionReasons.equipmentFixed}
        />

        {isCreate ? (
          <TextField
            label={t.fields.channelKey}
            required
            value={values.channelKey}
            onChange={(event) => onChange({ channelKey: event.target.value })}
            error={fieldErrors.channelKey}
          />
        ) : (
          <ReadOnlyField
            label={t.fields.channelKey}
            value={values.channelKey}
            note={t.actionReasons.channelKeyFixed}
          />
        )}

        <TextField
          label={t.fields.signalName}
          value={values.signalName}
          onChange={(event) => onChange({ signalName: event.target.value })}
          error={fieldErrors.signalName}
        />

        <SelectField
          label={t.fields.unit}
          options={unitOptions}
          value={values.unitCode}
          onChange={(value) => onChange({ unitCode: value })}
          placeholder={t.form.unitPlaceholder}
          note={optionsNote}
          error={fieldErrors.unitCode}
        />
      </div>
    </Dialog>
  );
};
