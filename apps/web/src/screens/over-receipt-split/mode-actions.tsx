import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { SplitMode } from './types';

const t = messages.overReceiptSplit;

export interface ModeActionsProps {
  /** 갈래별 잠금 사유. `null`이면 열려 있다. */
  blockReasons: Record<SplitMode, string | null>;
  isSaving: boolean;
  /** 지금 보내는 갈래. 그 버튼만 진행을 밝힌다. */
  savingMode: SplitMode | null;
  onSubmit: (mode: SplitMode) => void;
  onCancel: () => void;
}

interface ModeButton {
  mode: SplitMode;
  label: string;
}

/** 세 버튼이 계약의 세 갈래와 1:1이다 — 버튼을 고르는 것이 곧 갈래를 고르는 것이다. */
const MODE_BUTTONS: ModeButton[] = [
  { mode: 'BOTH', label: t.actions.registerBoth },
  { mode: 'NORMAL_ONLY', label: t.actions.registerNormalOnly },
  { mode: 'EXCESS_ONLY', label: t.actions.registerExcessOnly },
];

/**
 * 등록 갈래 세 개와 취소. **「신규 자재 P/O 등록」은 여기 없다** — 늘 잠긴 단추는 할 수 있는 일처럼
 * 읽혀 눈만 끈다. 그 길은 초과분 전표가 만들어진 뒤 등록 결과에 선다(`created-receipts-pane.tsx`).
 */
export const ModeActions = ({
  blockReasons,
  isSaving,
  savingMode,
  onSubmit,
  onCancel,
}: ModeActionsProps) => {
  const reasonId = useId();

  return (
    <div className="form-actions">
      {/* 취소가 등록 갈래보다 앞에 선다 — 되돌릴 수 없는 것이 손 가까이 있으면 안 된다. */}
      <Button variant="text" disabled={isSaving} onClick={onCancel}>
        {messages.common.cancel}
      </Button>

      {MODE_BUTTONS.map(({ mode, label }) => {
        const reason = blockReasons[mode];
        const modeReasonId = `${reasonId}-${mode}`;

        return (
          <div className="field-cell" key={mode}>
            <Button
              variant={mode === 'BOTH' ? 'filled' : 'outlined'}
              disabled={reason !== null || isSaving}
              loading={savingMode === mode}
              aria-describedby={reason === null ? undefined : modeReasonId}
              onClick={() => {
                onSubmit(mode);
              }}
            >
              {label}
            </Button>
            {reason !== null && (
              <span id={modeReasonId} className="field-note">
                {reason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
