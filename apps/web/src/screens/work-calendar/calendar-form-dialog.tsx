import { Button, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { ActionAvailability } from './retire-actions';
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
  /** 사용 중지를 지금 할 수 있는가. 못 하면 사유가 함께 온다 */
  deactivate: ActionAvailability;
  onClose: () => void;
  onSave: () => void;
  onDeactivate: () => void;
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
  deactivate,
  onClose,
  onSave,
  onDeactivate,
}: CalendarFormDialogProps) => {
  const countLabelId = useId();
  const retireNoteId = useId();

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

        {/*
         * ⭐ **되돌릴 수 없는 조작은 폼 «본문»에 둔다** — 바닥 줄이 아니다. 바닥에 두면 사유
         * 줄까지 함께 붙어 줄이 두 층이 되고, 창이 뷰포트를 넘어 「저장」과 「취소」까지 화면
         * 밖으로 밀려난다(W-05-11 브라우저 확인에서 실측).
         *
         * ⭐ **감추지 않고 잠그고 사유를 붙인다**(공유계약 G-2). 사유는 보이는 DOM 텍스트로
         * 낸다 — 잠긴 버튼은 포커스를 못 받아 툴팁이 닿지 않는다.
         */}
        {mode === 'edit' && (
          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={isSaving || !deactivate.enabled}
              aria-describedby={deactivate.reason === null ? undefined : retireNoteId}
              onClick={onDeactivate}
            >
              {messages.workCalendar.retire.confirm}
            </Button>
            {deactivate.reason !== null && (
              <span id={retireNoteId} className="field-note">
                {deactivate.reason}
              </span>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
};
