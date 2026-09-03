import { Button, Chip, Select } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { DOCUMENT_TYPE_CODES, type CodeValue, type ReprintTarget } from './types';

const t = messages.packingLabelReprint;

export interface ReprintPaneProps {
  targets: readonly ReprintTarget[];
  selectedRowIds: readonly string[];
  onToggle: (rowId: string) => void;
  /** 회차를 못 받았다 — 값이 비는 사유를 말한다 */
  summaryFailed: boolean;
  reasons: readonly CodeValue[];
  reasonsFailed: boolean;
  reasonCode: string;
  onReasonChange: (code: string) => void;
  /** 고른 대상에 재발행이 섞여 있어 사유가 필요하다 */
  reasonRequired: boolean;
  /** 서버가 사유 칸에 준 오류 */
  reasonServerError: string | null;
  /** 재출력 자체가 막힌 사유(권한·사번·단말). `null` 이면 막히지 않았다 */
  blockedReason: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
}

/** 발행 회차 한 줄. **「모른다」와 「0회」를 다르게 말한다.** */
const issueCountText = (target: ReprintTarget): string => {
  if (target.issueCount === null) return t.targets.issueCountUnknown;

  return target.issueCount === 0 ? t.targets.neverIssued : t.targets.issueCount(target.issueCount);
};

/**
 * 우단 《재출력 대상》.
 *
 * ⭐ **사유 칸을 예외 흐름에 숨기지 않는다**(스펙 §5-1 ⭐). 이 화면은 재발행이 정상 경로라
 * 사유가 기본 입력이다 — 대화상자 뒤에 두면 매번 한 걸음이 더 든다.
 */
export const ReprintPane = ({
  targets,
  selectedRowIds,
  onToggle,
  summaryFailed,
  reasons,
  reasonsFailed,
  reasonCode,
  onReasonChange,
  reasonRequired,
  reasonServerError,
  blockedReason,
  isSubmitting,
  onSubmit,
}: ReprintPaneProps) => {
  const reasonId = useId();
  const noteId = `${reasonId}-note`;

  const hasSelection = selectedRowIds.length > 0;
  const reasonMissing = reasonRequired && reasonCode === '';
  const canSubmit = blockedReason === null && hasSelection && !reasonMissing && !isSubmitting;

  const reasonNote = ((): string | null => {
    if (reasonServerError !== null) return reasonServerError;
    if (reasonsFailed) return t.reason.loadFailed;
    if (reasons.length === 0) return t.reason.empty;
    if (!hasSelection) return null;

    return reasonRequired ? t.reason.required : t.reason.notNeeded;
  })();

  return (
    <>
      {targets.length === 0 ? (
        <p className="field-note">{t.targets.empty}</p>
      ) : (
        <ul className="pop-reprint-targets">
          {targets.map((target) => {
            const selected = selectedRowIds.includes(target.rowId);
            const kind =
              target.documentTypeCode === DOCUMENT_TYPE_CODES.packingLabel
                ? t.targets.packingLabel
                : t.targets.identificationTag;

            return (
              <li key={target.rowId} className="pop-reprint-target">
                <div className="pop-reprint-target-head">
                  <span className="pop-reprint-kind">{kind}</span>
                  <span className="pop-reprint-name">{target.displayName}</span>
                  <Button
                    variant={selected ? 'filled' : 'outlined'}
                    size="xl"
                    disabled={target.disabledReason !== null}
                    aria-pressed={selected}
                    aria-label={`${kind} ${target.displayName} ${t.targets.select}`}
                    onClick={() => {
                      onToggle(target.rowId);
                    }}
                  >
                    {selected ? t.targets.selected : t.targets.select}
                  </Button>
                </div>
                <div className="pop-reprint-target-meta">
                  <Chip status={target.issueCount === null ? 'warning' : 'info'}>
                    {issueCountText(target)}
                  </Chip>
                  <span className="field-note">{t.targets.range(target.qty)}</span>
                </div>
                {/* ⛔ 고를 수 없는 줄은 사유를 함께 낸다 — 비활성만 두면 왜 안 되는지 알 수 없다 */}
                {target.disabledReason !== null && (
                  <p className="field-note">{target.disabledReason}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {summaryFailed && <p className="field-error">{t.targets.summaryFailed}</p>}

      <div className="field-cell">
        <label className="field-label" htmlFor={reasonId}>
          {t.reason.label}
        </label>
        <Select
          id={reasonId}
          options={reasons.map((reason) => ({ value: reason.code, label: reason.codeName }))}
          value={reasonCode === '' ? null : reasonCode}
          onChange={onReasonChange}
          placeholder={t.reason.placeholder}
          disabled={reasons.length === 0}
          aria-describedby={reasonNote === null ? undefined : noteId}
        />
        {reasonNote !== null && (
          <span
            id={noteId}
            className={reasonMissing || reasonsFailed ? 'field-error' : 'field-note'}
          >
            {reasonNote}
          </span>
        )}
      </div>

      <Button size="2xl" disabled={!canSubmit} onClick={onSubmit}>
        {isSubmitting ? t.action.submitting : t.action.submit}
      </Button>

      {/* 막힌 사유는 버튼 옆에 둔다 — 누를 수 없는 자리에서 이유를 찾는다 */}
      {blockedReason !== null && <p className="field-error">{blockedReason}</p>}
      {blockedReason === null && !hasSelection && (
        <p className="field-note">{t.action.noSelection}</p>
      )}
    </>
  );
};
