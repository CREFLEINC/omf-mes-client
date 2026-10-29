import { messages } from '@omf-mes/i18n';

import type { IssueFailure } from './failure';
import { ISSUE_UNITS, type IssueUnit } from './issue-unit';

const t = messages.popMaterialLotLabel.bar;
const tReprint = messages.popMaterialLotLabel.reprint;

/** 동작 바가 지금 무엇을 말하는가 — 화면이 판정해 넘긴다. */
export type BarState =
  | {
      kind: 'pending';
      supplierName: string | null;
      count: number;
      /** N장마다 멈추고 이어서(`issue-unit`). `null` 은 전체. */
      unit: IssueUnit;
      /** 사번이 없거나 프린터를 모르면 막는다 — 까닭은 맨 위 띠와 머리줄이 말한다. */
      isBlocked: boolean;
    }
  | {
      kind: 'reprint';
      count: number;
      reasonName: string | null;
      /** 고른 LOT 이 라벨을 낼 수 없는 상태 — 그 까닭. */
      blockedReason: string | null;
      isBlocked: boolean;
    }
  | {
      kind: 'running';
      supplierName: string | null;
      done: number;
      total: number;
      isStopping: boolean;
    }
  | {
      /** 한 단위를 다 찍고 쉰다 — 작업자가 라벨을 붙인 뒤 「다음 N장 발행」을 누른다. */
      kind: 'paused';
      done: number;
      total: number;
      remaining: number;
      next: number;
    }
  | {
      kind: 'done';
      printed: number;
      unfinished: number;
      headline: IssueFailure | 'stopped' | null;
      retryCount: number;
      /** 인쇄 실패 사유(PRINT_FAILURE)가 사유 목록에 없어 여기서 다시 보내지 못하는 장. */
      needsReasonCount: number;
    };

export interface IssueBarProps {
  state: BarState;
  onIssue: () => void;
  onClear: () => void;
  /** 도는 중이면 이번 장까지 찍고 멈춘다. 쉬는 중이면 남은 단위를 접는다. */
  onStop: () => void;
  onResume: () => void;
  onConfirm: () => void;
  onRetry: () => void;
  onUnitChange: (unit: IssueUnit) => void;
}

const PrintIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M7 9V3h10v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 6v8M12 18.5v.5" />
  </svg>
);

/**
 * 하단 동작 바 — **왼쪽은 지금 상태 한 줄, 오른쪽은 주 동작**(규범 C-3 · C-5). 늘 같은 자리에 선다.
 *
 * ⭐ 주 동작은 빨강 채움 하나뿐이다. 보조 동작(선택 해제 · 확인)은 테두리 단추다(개편안 2026-10-24).
 * ⚠ 단추 높이는 E-3(40px)보다 크다 — 손가락 크기(48 · 주 동작 56)를 사용자가 승인했다(omf-all-around#184).
 */
export const IssueBar = ({
  state,
  onIssue,
  onClear,
  onStop,
  onResume,
  onConfirm,
  onRetry,
  onUnitChange,
}: IssueBarProps) => {
  if (state.kind === 'running') {
    const ratio = state.total === 0 ? 0 : Math.round((state.done / state.total) * 100);

    return (
      <div className="pop-mlot-action-bar" role="region" aria-label={t.issueIdle}>
        <div className="pop-mlot-progress">
          <span className="pop-mlot-bar-strong">
            {state.supplierName === null ? t.issueIdle : t.running(state.supplierName)}
          </span>
          <span
            className="pop-mlot-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.total}
            aria-valuenow={state.done}
          >
            <span className="pop-mlot-progress-fill" style={{ width: `${String(ratio)}%` }} />
          </span>
          <span className="pop-mlot-bar-note" aria-live="polite">
            {state.isStopping ? t.stopping : t.progress(state.done, state.total)}
          </span>
        </div>
        <div className="pop-mlot-bar-actions">
          <button
            type="button"
            className="pop-mlot-bar-button"
            disabled={state.isStopping}
            onClick={onStop}
          >
            {t.stop}
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'paused') {
    return (
      <div className="pop-mlot-action-bar" role="region" aria-label={t.issueIdle}>
        <div className="pop-mlot-bar-text" data-tone="idle" aria-live="polite">
          <span className="pop-mlot-bar-strong">{t.paused(state.done, state.total)}</span>
          <span className="pop-mlot-bar-note">{t.pausedNote(state.remaining)}</span>
        </div>
        <div className="pop-mlot-bar-actions">
          <button type="button" className="pop-mlot-bar-button" onClick={onStop}>
            {t.stop}
          </button>
          <button type="button" className="pop-mlot-bar-primary" onClick={onResume}>
            <PrintIcon />
            {t.resume(state.next)}
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'done') {
    const isClean = state.unfinished === 0;
    /*
     * 일부러 멈춘 끝은 오류가 아니다 — 단위 사이에서 멈추는 것은 정상 흐름이다. 빨간 표시 없이 남은 장을
     * 이어 찍을 수 있다는 것만 말한다(사용자 지시 2026-10-27). 실패가 하나라도 섞이면 `headline` 이 그 실패다.
     */
    const tone = isClean ? 'ok' : state.headline === 'stopped' ? 'idle' : 'error';
    const note =
      state.headline === null
        ? null
        : state.retryCount === 0 && state.needsReasonCount > 0
          ? t.next.needsReason
          : t.next[state.headline];

    return (
      <div className="pop-mlot-action-bar" role="region" aria-label={t.issueIdle}>
        <div className="pop-mlot-bar-text" data-tone={tone} aria-live="polite">
          {tone !== 'error' ? null : (
            <span className="pop-mlot-bar-icon">
              <AlertIcon />
            </span>
          )}
          <span className="pop-mlot-bar-strong">
            {isClean
              ? t.done(state.printed)
              : state.headline === 'stopped'
                ? t.stopped(state.unfinished)
                : t.failed(state.unfinished)}
          </span>
          {note === null ? null : <span className="pop-mlot-bar-note">{note}</span>}
        </div>
        <div className="pop-mlot-bar-actions">
          <button
            type="button"
            className={state.retryCount > 0 ? 'pop-mlot-bar-button' : 'pop-mlot-bar-primary'}
            onClick={onConfirm}
          >
            {t.confirm}
          </button>
          {state.retryCount > 0 ? (
            <button type="button" className="pop-mlot-bar-primary" onClick={onRetry}>
              <PrintIcon />
              {t.retry(state.retryCount)}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const isReprint = state.kind === 'reprint';
  const hasSelection = state.count > 0;
  const reason = isReprint ? state.reasonName : null;
  const blockedReason = isReprint ? state.blockedReason : null;
  const canSend =
    hasSelection && !state.isBlocked && (!isReprint || (reason !== null && blockedReason === null));
  const label = isReprint
    ? hasSelection
      ? tReprint.action(state.count)
      : tReprint.actionIdle
    : hasSelection
      ? t.issue(state.count)
      : t.issueIdle;
  const unit = isReprint ? null : state.unit;
  /* 고른 장수가 단위보다 많을 때만 「N장마다 멈춤」을 덧붙인다 — 한 단위 안이면 멈출 일이 없다. */
  const unitNote = unit !== null && state.count > unit ? t.unit.note(unit) : null;
  const supplierName = isReprint ? null : state.supplierName;
  const pendingNote =
    supplierName === null || unitNote === null
      ? (supplierName ?? unitNote)
      : `${supplierName} · ${unitNote}`;
  const note = isReprint
    ? (blockedReason ?? (reason === null ? tReprint.reasonPrompt : tReprint.summary(reason)))
    : pendingNote;

  return (
    <div className="pop-mlot-action-bar" role="region" aria-label={t.issueIdle}>
      <div className="pop-mlot-bar-text" data-tone={blockedReason === null ? 'idle' : 'error'}>
        {hasSelection ? (
          <>
            {note === null ? null : <span className="pop-mlot-bar-note">{note}</span>}
            <span className="pop-mlot-bar-strong">{t.selected(state.count)}</span>
          </>
        ) : (
          <span className="pop-mlot-bar-note">{isReprint ? tReprint.empty : t.empty}</span>
        )}
      </div>
      <div className="pop-mlot-bar-actions">
        {isReprint ? null : (
          <div className="pop-mlot-units" role="group" aria-label={t.unit.label}>
            <span className="pop-mlot-units-label" aria-hidden="true">
              {t.unit.label}
            </span>
            {ISSUE_UNITS.map((each) => (
              <button
                key={each ?? 'all'}
                type="button"
                className="pop-mlot-unit"
                aria-pressed={each === unit}
                onClick={() => {
                  onUnitChange(each);
                }}
              >
                {each === null ? t.unit.all : t.unit.each(each)}
              </button>
            ))}
          </div>
        )}
        {hasSelection ? (
          <button type="button" className="pop-mlot-bar-button" onClick={onClear}>
            {t.clear}
          </button>
        ) : null}
        <button
          type="button"
          className="pop-mlot-bar-primary"
          disabled={!canSend}
          onClick={onIssue}
        >
          <PrintIcon />
          {label}
        </button>
      </div>
    </div>
  );
};
