import { Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { codeLabel, PLACEHOLDER_HISTORY_TYPES, PLACEHOLDER_RESULT_CODES } from './code-options';
import { updatesMaster, type CalibrationDraft } from './form-draft';
import type { SelectOption } from './types';

const t = messages.gaugeCalibration;

/**
 * 저장 직전에 되읽어 줄 한 줄. 「검교정 · 2026-08-11 · 합격 · 유효 ~2027-08-10」 꼴이다.
 *
 * ⭐ **고른 값을 이름으로 되읽는다.** 코드를 그대로 보이면 방금 고른 것이 맞는지 확인할 수
 * 없다 — 확인 창의 목적이 사라진다. 이름을 못 찾으면 코드를 그대로 쓴다.
 */
export const summarize = (draft: CalibrationDraft, equipmentLabel: string): string => {
  const parts = [
    equipmentLabel,
    codeLabel(draft.historyTypeCode, PLACEHOLDER_HISTORY_TYPES),
    draft.performedOn,
    codeLabel(draft.resultCode, PLACEHOLDER_RESULT_CODES),
  ];

  if (draft.nextDueOn !== '') parts.push(t.confirm.validUntil(draft.nextDueOn));
  if (draft.agencyName.trim() !== '') parts.push(draft.agencyName.trim());

  return parts.filter((part) => part.trim() !== '').join(' · ');
};

export interface SaveConfirmDialogProps {
  open: boolean;
  draft: CalibrationDraft;
  equipmentOptions: SelectOption[];
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 저장 전 확인.
 *
 * ⭐ **이력을 고칠 수 없기 때문에 있는 창이다.** 되돌릴 수 있는 저장이었다면 두지 않았다 —
 * 확인 창은 값이 싸지 않을 때만 값을 한다.
 *
 * 파급을 **양쪽 다** 말한다. 갱신되는 경우와 갱신되지 않는 경우가 서로 다른 사실이라, 한쪽만
 * 말하면 나머지 경우에 사용자가 무엇이 바뀌는지 모른 채 저장한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SaveConfirmDialog = ({
  open,
  draft,
  equipmentOptions,
  isSaving,
  onConfirm,
  onCancel,
}: SaveConfirmDialogProps) => {
  const equipmentLabel =
    equipmentOptions.find((option) => option.value === draft.equipment)?.label ?? draft.equipment;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={t.confirm.title}
      /* 되돌릴 수 없는 저장이라 바깥을 눌러 닫히게 두지 않는다 — 실수로 닫으면 다시 확인해야 한다. */
      closeOnBackdropClick={false}
      footer={
        <>
          <Button variant="outlined" onClick={onCancel} disabled={isSaving}>
            {t.confirm.cancel}
          </Button>
          <Button onClick={onConfirm} disabled={isSaving}>
            {t.confirm.submit}
          </Button>
        </>
      }
    >
      {/* 단말 사용 중지 창과 같은 짜임 — 대상 상자 · 질문 · 안내 줄(#360). 계측기 이름 아래 나머지 값 한 줄. */}
      <div className="users-roles-worker-dialog">
        <div className="users-roles-worker-block">
          <span className="users-roles-worker-block-caption">{t.confirm.caption}</span>
          <strong>{equipmentLabel}</strong>
          <span>{summarize(draft, '')}</span>
        </div>
        <p>{t.confirm.question}</p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="warning">
          <Icon name="warning" size={16} aria-hidden />
          {t.confirm.lead}
        </p>
        <p className="iqc-inspection-action-note users-roles-dialog-note" data-tone="info">
          <Icon name="info" size={16} aria-hidden />
          {updatesMaster(draft) ? t.confirm.masterEffect : t.confirm.noMasterEffect}
        </p>
      </div>
    </Dialog>
  );
};
