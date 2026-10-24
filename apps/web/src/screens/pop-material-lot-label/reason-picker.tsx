import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ReissueReasonOption } from './queries';

const t = messages.popMaterialLotLabel.reprint;

export interface ReasonPickerProps {
  reasons: readonly ReissueReasonOption[];
  isLoading: boolean;
  isError: boolean;
  selected: string | null;
  isLocked: boolean;
  onSelect: (code: string) => void;
}

/**
 * 다시 인쇄 사유 — **큰 단추로 한 번에 고른다**(개편안 2026-10-24).
 *
 * ⭐ 옛 화면은 대화상자 안의 선택 팝업이라 「재인쇄 → 창 → [선택] → 목록 → 고르기 → 재인쇄」였다. 값이
 *    다섯 남짓이라 늘어놓으면 한 번에 고른다.
 * ⛔ **화면이 값을 지어내지 않는다.** 이름은 코드 사전이 준 그대로다(계약 명시 · 고객이 늘린다).
 * ⚠ 비어 오면 보낼 수 없다 — 사유 없이 보내면 422 다. 감추지 않고 왜 못 하는지 말한다.
 */
export const ReasonPicker = ({
  reasons,
  isLoading,
  isError,
  selected,
  isLocked,
  onSelect,
}: ReasonPickerProps) => (
  <div className="pop-mlot-reasons" role="group" aria-label={t.reasonLabel}>
    <span className="pop-mlot-reasons-label">{t.reasonLabel}</span>
    {isError ? <AlertBanner variant="error">{t.reasonsFailed}</AlertBanner> : null}
    {!isError && !isLoading && reasons.length === 0 ? (
      <AlertBanner variant="warning">{t.reasonsEmpty}</AlertBanner>
    ) : null}
    {reasons.length === 0 ? null : (
      <div className="pop-mlot-reason-options">
        {reasons.map((reason) => (
          <button
            key={reason.code}
            type="button"
            className="pop-mlot-reason"
            aria-pressed={reason.code === selected}
            disabled={isLocked}
            onClick={() => {
              onSelect(reason.code);
            }}
          >
            {reason.name}
          </button>
        ))}
      </div>
    )}
  </div>
);
