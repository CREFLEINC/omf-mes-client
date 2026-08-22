import { AlertBanner, Button, Dialog, Radio } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { TARGET_TYPES } from './application-targets';
import { SelectField } from './select-field';
import type { TargetOption } from './queries';

const t = messages.workCalendar.applications;

export interface ApplicationFormDialogProps {
  targetTypeCode: string;
  targetId: string;
  onChangeType: (targetTypeCode: string) => void;
  onChangeTarget: (targetId: string) => void;
  /** 고른 유형의 대상 목록 */
  options: TargetOption[];
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onAssign: () => void;
}

/**
 * 적용 대상 지정 창.
 *
 * ⭐ **공장 기본을 바꾸는 것은 한 번의 부름이다** — 옛 지정 해제와 새 지정을 **서버가 한
 * 트랜잭션으로** 처리한다(계약). 화면이 두 번 부르지 않으며, 사용자에게도 「옮겨진다」고
 * 미리 말한다 — 「이미 다른 캘린더를 따르는데 눌러도 되나」에서 멈추지 않게.
 */
export const ApplicationFormDialog = ({
  targetTypeCode,
  targetId,
  onChangeType,
  onChangeTarget,
  options,
  fieldErrors,
  banner,
  isSaving,
  onClose,
  onAssign,
}: ApplicationFormDialogProps) => {
  const groupId = useId();

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      title={t.addTitle}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button loading={isSaving} disabled={isSaving || targetId === ''} onClick={onAssign}>
            {t.add}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner}

        <div className="form-grid-full">
          <fieldset className="field-cell">
            <legend className="field-label">{t.targetType}</legend>
            <div className="check-group">
              <Radio
                name={groupId}
                value={TARGET_TYPES.plant}
                checked={targetTypeCode === TARGET_TYPES.plant}
                onChange={() => onChangeType(TARGET_TYPES.plant)}
              >
                {t.types.plant}
              </Radio>
              <Radio
                name={groupId}
                value={TARGET_TYPES.equipmentGroup}
                checked={targetTypeCode === TARGET_TYPES.equipmentGroup}
                onChange={() => onChangeType(TARGET_TYPES.equipmentGroup)}
              >
                {t.types.equipmentGroup}
              </Radio>
            </div>
          </fieldset>
        </div>

        <SelectField
          label={t.target}
          required
          options={options}
          value={targetId}
          onChange={onChangeTarget}
          error={fieldErrors.targetId}
          placeholder={t.targetPlaceholder}
        />

        {/* ⭐ 이미 다른 캘린더를 따르는 공장을 골라도 된다 — 서버가 한 번에 옮긴다. */}
        {targetTypeCode === TARGET_TYPES.plant && (
          <div className="form-grid-full">
            <AlertBanner variant="info">{t.plantMovesNote}</AlertBanner>
          </div>
        )}
      </div>
    </Dialog>
  );
};
