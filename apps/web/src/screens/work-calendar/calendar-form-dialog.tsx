import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CalendarFormValues } from './types';

const t = messages.workCalendar;

export interface CalendarFormDialogProps {
  mode: 'create' | 'edit';
  values: CalendarFormValues;
  onChange: (patch: Partial<CalendarFormValues>) => void;
  fieldErrors: Record<string, string>;
  banner: ReactNode;
  /** null이면 캘린더 코드 편집 가능 */
  codeLockReason: string | null;
  /** 이 캘린더를 따르는 공장·설비 그룹 수. 아직 모르면 `null` */
  applicationCount: number | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
}

/**
 * 캘린더 등록·수정 창.
 *
 * ⭐ **따르는 대상 수를 함께 보인다.** 이 캘린더가 몇 곳에 매여 있는지가 **코드가 잠긴 이유**
 * 이자 **사용 중지 판단의 근거**다 — 잠금 사유 문구만으로는 「몇이 따르는가」를 알 수 없다.
 *
 * ⭐ **스크림 클릭으로 닫히지 않게 한다** — 사용자가 친 값을 지킨다.
 */
export const CalendarFormDialog = ({
  mode,
  values,
  onChange,
  fieldErrors,
  banner,
  codeLockReason,
  applicationCount,
  isSaving,
  onClose,
  onSave,
}: CalendarFormDialogProps) => {
  const countLabelId = useId();

  return (
    <Dialog
      open
      onClose={onClose}
      closeOnBackdropClick={false}
      title={mode === 'create' ? t.form.createTitle : t.form.editTitle}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          <Button disabled={isSaving} onClick={onSave}>
            {messages.common.save}
          </Button>
        </>
      }
    >
      <div className="form-grid dialog-scroll">
        {banner}

        <TextField
          label={t.fields.calendarCode}
          required
          value={values.calendarCode}
          onChange={(event) => onChange({ calendarCode: event.target.value })}
          disabled={codeLockReason !== null}
          disabledReason={codeLockReason ?? undefined}
          error={fieldErrors.calendarCode}
        />

        <TextField
          label={t.fields.calendarName}
          required
          value={values.calendarName}
          onChange={(event) => onChange({ calendarName: event.target.value })}
          error={fieldErrors.calendarName}
        />

        {mode === 'edit' && (
          <div className="field-cell">
            <span className="field-label" id={countLabelId}>
              {t.fields.applicationCount}
            </span>
            {/* ⛔ 모르는 것을 「0곳」으로 그리지 않는다 — 아직 안 불러온 것과 없는 것은 다르다(G-9). */}
            <p aria-labelledby={countLabelId}>
              {applicationCount === null
                ? t.form.applicationUnknown
                : applicationCount === 0
                  ? t.form.applicationNone
                  : t.form.applicationCount(applicationCount)}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
};
