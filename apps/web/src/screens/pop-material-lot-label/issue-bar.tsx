import { messages } from '@omf-mes/i18n';

import { PuActionBar, PuButton, PuNote } from '../../patterns/pop-uniform';
import type { IssueFailure } from './failure';
import type { IssueUnit } from './issue-unit';

const t = messages.popMaterialLotLabel.bar;
const tReprint = messages.popMaterialLotLabel.reprint;

/** 작업 줄이 지금 무엇을 하는가 — 화면이 판정해 넘긴다. */
export type BarState =
  | {
      kind: 'pending';
      /** 고른 입하 대기 LOT 수. */
      count: number;
      /** 고른 것 중 라벨 미출력 — 「라벨 N장 발행」의 N. */
      unprinted: number;
      /** N장마다 멈추고 이어서(`issue-unit`). `null` 은 전체. */
      unit: IssueUnit;
      /** 사번이 없거나 공장을 모르면 막는다 — 까닭은 맨 위 띠와 머리줄이 말한다. */
      isBlocked: boolean;
    }
  | {
      kind: 'reprint';
      count: number;
      reasonName: string | null;
      /** 고른 LOT 이 라벨을 낼 수 없는 상태 — 그 까닭. */
      blockedReason: string | null;
      isBlocked: boolean;
      /**
       * 「출력됨(입하 전)」 탭(피처 014 FR-014) — 재인쇄와 함께 폐기도 한다. 고른 입하 대기 수.
       * 없으면 폐기 단추를 두지 않는다(입하된 LOT 탭).
       */
      voidCount?: number;
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
      /** 재인쇄의 결과 — 「기존 라벨을 제거하고 새 라벨을 부착하세요」로 말한다. */
      isReprint: boolean;
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
  /** 고른 입하 대기 LOT 폐기 확인 창을 연다. */
  onVoid: () => void;
  /** 도는 중이면 이번 장까지 찍고 멈춘다. 쉬는 중이면 남은 단위를 접는다. */
  onStop: () => void;
  onResume: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}

/**
 * 아래 작업 줄(규칙 2·3) — **버튼만**. 일을 끝내는 버튼은 오른쪽, 빨간 주 버튼은 하나.
 * 진행 · 결과는 구획 안 안내 줄(`IssueStatusNote`)과 알림이 말한다. 꺼진 버튼은 흐리게만 보인다.
 */
export const IssueBar = ({
  state,
  onIssue,
  onVoid,
  onStop,
  onResume,
  onConfirm,
  onRetry,
}: IssueBarProps) => {
  if (state.kind === 'running') {
    return (
      <PuActionBar label={t.label}>
        <PuButton disabled={state.isStopping} onClick={onStop}>
          {t.stop}
        </PuButton>
      </PuActionBar>
    );
  }

  if (state.kind === 'paused') {
    return (
      <PuActionBar label={t.label}>
        <PuButton onClick={onStop}>{t.stop}</PuButton>
        <PuButton variant="primary" icon="print" onClick={onResume}>
          {t.resume(state.next)}
        </PuButton>
      </PuActionBar>
    );
  }

  if (state.kind === 'done') {
    return (
      <PuActionBar label={t.label}>
        <PuButton variant={state.retryCount > 0 ? 'default' : 'primary'} onClick={onConfirm}>
          {t.confirm}
        </PuButton>
        {state.retryCount > 0 ? (
          <PuButton variant="primary" icon="print" onClick={onRetry}>
            {t.retry(state.retryCount)}
          </PuButton>
        ) : null}
      </PuActionBar>
    );
  }

  if (state.kind === 'reprint') {
    const hasSelection = state.count > 0;
    const canSend =
      hasSelection && !state.isBlocked && state.reasonName !== null && state.blockedReason === null;

    return (
      <PuActionBar label={t.label}>
        {state.voidCount === undefined ? null : (
          <PuButton
            variant="danger"
            icon="trash"
            disabled={state.voidCount === 0 || state.isBlocked}
            onClick={onVoid}
          >
            {state.voidCount > 0 ? t.void(state.voidCount) : t.voidIdle}
          </PuButton>
        )}
        <PuButton variant="primary" icon="print" disabled={!canSend} onClick={onIssue}>
          {hasSelection ? tReprint.action(state.count) : tReprint.actionIdle}
        </PuButton>
      </PuActionBar>
    );
  }

  const hasSelection = state.count > 0;

  return (
    <PuActionBar label={t.label}>
      <PuButton
        variant="danger"
        icon="trash"
        disabled={!hasSelection || state.isBlocked}
        onClick={onVoid}
      >
        {hasSelection ? t.void(state.count) : t.voidIdle}
      </PuButton>
      <PuButton
        variant="primary"
        icon="print"
        disabled={state.unprinted === 0 || state.isBlocked}
        onClick={onIssue}
      >
        {state.unprinted === 0
          ? t.issueIdle
          : state.unit !== null && state.unprinted > state.unit
            ? t.issueEach(state.unprinted, state.unit)
            : t.issue(state.unprinted)}
      </PuButton>
    </PuActionBar>
  );
};

/**
 * 발행 중 · 쉬는 중 · 끝난 뒤의 안내 줄 — 구획 맨 위 안내 자리에 선다(작업 줄에는 글을 두지 않는다).
 * `pending` · `reprint` 는 화면이 할 일 한 줄을 따로 그린다.
 */
export const IssueStatusNote = ({ state }: { state: BarState }) => {
  if (state.kind === 'running') {
    const ratio = state.total === 0 ? 0 : Math.round((state.done / state.total) * 100);

    return (
      <PuNote live>
        <span className="mll-progress-line">
          <b>{state.supplierName === null ? t.issueIdle : t.running(state.supplierName)}</b>
          <span
            className="pu-progress mll-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={state.total}
            aria-valuenow={state.done}
          >
            <i style={{ width: `${String(ratio)}%` }} />
          </span>
          <span>{state.isStopping ? t.stopping : t.progress(state.done, state.total)}</span>
        </span>
      </PuNote>
    );
  }

  if (state.kind === 'paused') {
    return (
      <PuNote live>
        <b>{t.paused(state.done, state.total)}</b>
        {' · '}
        <span>{t.pausedNote(state.remaining)}</span>
      </PuNote>
    );
  }

  if (state.kind === 'done') {
    const isClean = state.unfinished === 0;
    /*
     * 일부러 멈춘 끝은 오류가 아니다 — 단위 사이에서 멈추는 것은 정상 흐름이다. 빨간 표시 없이 남은 장을
     * 이어 찍을 수 있다는 것만 말한다(사용자 지시 2026-10-27). 실패가 하나라도 섞이면 `headline` 이 그 실패다.
     */
    const tone = isClean ? 'ok' : state.headline === 'stopped' ? 'info' : 'bad';
    const note =
      state.headline === null
        ? null
        : state.retryCount === 0 && state.needsReasonCount > 0
          ? t.next.needsReason
          : t.next[state.headline];

    return (
      <PuNote tone={tone} live>
        <b>
          {isClean
            ? state.isReprint
              ? t.reprinted(state.printed)
              : t.done(state.printed)
            : state.headline === 'stopped'
              ? t.stopped(state.unfinished)
              : t.failed(state.unfinished)}
        </b>
        {note === null ? null : (
          <>
            {' · '}
            <span>{note}</span>
          </>
        )}
      </PuNote>
    );
  }

  return null;
};
