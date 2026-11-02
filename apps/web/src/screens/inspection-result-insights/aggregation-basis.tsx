import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

const t = messages.inspectionResultInsights;

/** 말풍선이 떠 있는 시간 — 3초 뒤 저절로 닫힌다(사용자 2026-10-30). */
export const BASIS_TIP_MS = 3000;

/**
 * 「ⓘ 집계 기준」 — 누르면 불량률 분모 안내를 말풍선으로 보인다(사용자 2026-10-30 · #217). 요약 아래에 늘 깔던 회색 안내 줄을
 * 대신한다. 다시 누르거나 3초가 지나면 닫힌다.
 */
export const AggregationBasis = () => {
  const [isOpen, setIsOpen] = useState(false);
  const tipId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = window.setTimeout(() => setIsOpen(false), BASIS_TIP_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  return (
    <span className="inspection-results-basis">
      <button
        type="button"
        className="inspection-results-basis-button"
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tipId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon name="info" size={16} aria-hidden />
        {t.overview.basis}
      </button>
      {isOpen && (
        <span id={tipId} role="tooltip" className="inspection-results-basis-tip">
          {t.summary.defectRateNote}
        </span>
      )}
    </span>
  );
};
