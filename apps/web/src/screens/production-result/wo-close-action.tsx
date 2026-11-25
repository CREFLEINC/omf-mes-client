import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';

import { masterName } from '../../patterns/master-name';
import { SaveErrorBanner } from '../../patterns/master';
import { PopSelect } from '../../patterns/pop-select';
import {
  PuButton,
  PuDialog,
  PuField,
  PuInput,
  PuNote,
  PuTextKeyboard,
  puToast,
} from '../../patterns/pop-uniform';
import type { FlowGateVerdict } from './flow-gating';
import { useVarianceReasons } from './flow-queries';
import { formatQty } from './quantity-draft';
import {
  CLOSABLE_STATUSES,
  type CloseSessionView,
  planCloseSessions,
  useCloseOpenLots,
  useCloseSequence,
  useCloseSessions,
  useCloseTarget,
} from './wo-close';

const t = messages.productionResult.flow.woClose;
const st = t.sessions;
/** 세션 표 칸 모양 — 단말·작업자·상태는 글자만큼, 끝낼 곳이 남는 폭을 갖고 줄을 바꾼다. */
const SESSION_CELL_CLASS = ['fit', 'fit', 'fit mid', 'pr-close-where'];

type WorkOrderClose = components['schemas']['WorkOrderClose'];
type Disposition = NonNullable<WorkOrderClose['remainderDispositionCode']>;

export interface WorkOrderCloseActionProps {
  workOrderId: number;
  workOrderNo: string;
  statusCode: string;
  workerNo: string | null;
  /** 이 단말. 마감 전에 이 단말의 진행 중 세션만 끝낸다 */
  terminalId: number | null;
  gate: FlowGateVerdict;
  isOnline: boolean;
  pendingCount: number;
  uomLabel: string;
  /** 버튼 모양. 하단 바 주 동작이면 채움, 구획 안 보조 동작이면 테두리(기본). */
  variant?: 'filled' | 'outlined';
  /**
   * 잠긴 사유를 이미 말하는 문장의 id(하단 바 「남은 일」). 주면 곁에 사유 문장을 따로 두지 않고 이 문장에
   * 잇는다(C-4, 같은 사유를 두 번 말하지 않는다).
   */
  reasonId?: string;
  /** 마감한 뒤. 주지 않으면 작업 지시 목록으로 돌아간다. */
  onClosed?: () => void;
}

/** 마감 판정에 쓰는 값만. 화면이 하단 바 「남은 일」을 정할 때도 같은 판정을 쓴다. */
export type CloseBlockInput = Pick<
  WorkOrderCloseActionProps,
  'gate' | 'statusCode' | 'isOnline' | 'pendingCount' | 'workerNo'
>;

/** 왜 지금 마감할 수 없는가. 없으면 null. */
export const blockedReason = (props: CloseBlockInput): string | null => {
  if (props.gate === 'unidentified') return t.blocked.unidentified;
  if (props.gate === 'denied') {
    return t.blocked.denied(messages.workOrderClose.menuPath, messages.terminalProcessMap.menuPath);
  }
  if (props.gate === 'checking') return t.blocked.checking;
  if (props.gate === 'unavailable') return t.blocked.unavailable;
  if (props.statusCode === 'CANCELLED') return t.blocked.cancelled;
  if (!CLOSABLE_STATUSES.includes(props.statusCode)) return t.blocked.status;
  if (!props.isOnline) return t.blocked.offline;
  /* 보내지 못한 실적이 남은 채 마감하면 판정이 그 수량을 빼고 내려진다. */
  if (props.pendingCount > 0) return t.blocked.pending(props.pendingCount);
  if (props.workerNo === null || props.workerNo.trim() === '')
    return messages.popChrome.workerMissing;

  return null;
};

/**
 * P-02-04 의 작업지시 마감 — 관리웹 W/O 마감과 같은 판정·입력을 현장에서 한다.
 *
 * 판정은 서버가 낸 값이다. 이 단말이 끝낼 수 없는 세션(다른 단말, 이 단말의 중단 세션)이 열려
 * 있으면 아무것도 보내지 않고 막는다 — 이 단말 세션만 끝내 놓고 마감이 거부되면 작업만 끊긴다.
 */
export const WorkOrderCloseAction = (props: WorkOrderCloseActionProps) => {
  const { workOrderId, workOrderNo, workerNo, terminalId, uomLabel } = props;
  const navigate = useNavigate();
  const noteId = useId();
  const submitNoteId = useId();
  const remainderTitleId = useId();
  const reasonTitleId = useId();
  const remarksId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  /* 비고 칸을 누르면 칸 바로 아래에 글자판을 연다(사용자 지시 2026-11-19 · 이 창은 키패드 자리가 없다). */
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const target = useCloseTarget(workOrderId, isOpen);
  const openLots = useCloseOpenLots(workOrderId, isOpen);
  const sessions = useCloseSessions(workOrderId, isOpen);
  const reasons = useVarianceReasons(isOpen);

  const sequence = useCloseSequence({
    workOrderId,
    workerNo: workerNo ?? '',
    onClosed: () => {
      /* 화면에 남아 다음 단계를 말하는 곳에서는 알림을 따로 띄우지 않는다(하단 바 「남은 일」이 말한다). */
      if (props.onClosed !== undefined) {
        props.onClosed();
        return;
      }
      puToast(t.done(workOrderNo));
      void navigate('/pop/work-start');
    },
    recheckSessions: async () => {
      const result = await sessions.refetch();
      /* 다시 읽지 못했으면 막는 세션이 없다고 볼 수 없다 — 마감으로 넘어가지 않는다. */
      return result.isError || result.data === undefined
        ? null
        : planCloseSessions(result.data, terminalId);
    },
  });

  if (props.statusCode === 'CLOSED') return null;

  const reason = blockedReason(props);
  const plan = sessions.data === undefined ? null : planCloseSessions(sessions.data, terminalId);
  const workOrder = target.data?.workOrder;
  const progress = workOrder?.progress;
  const judgment = progress?.completionJudgmentCode ?? null;
  const savedReason = workOrder?.completionVarianceReasonCode ?? null;
  const reasonList = reasons.data ?? [];
  /* LOT 을 미달로 마감할 때 고른 사유가 W/O 에 실려 있다 — 같은 것을 다시 고르게 하지 않는다. */
  const effectiveReason =
    reasonCode ??
    (savedReason !== null && reasonList.some((item) => item.code === savedReason)
      ? savedReason
      : null);
  const needsDisposition = judgment === 'UNDER';
  const showKeyboard = keyboardOpen && needsDisposition && disposition === 'WRITE_OFF';
  const needsReason = judgment === 'UNDER' || judgment === 'OVER';
  const missing =
    judgment === null
      ? t.judgmentMissing
      : needsDisposition && disposition === null
        ? t.needRemainder
        : needsReason && effectiveReason === null
          ? t.needReason
          : null;

  const body = (): WorkOrderClose | null => {
    if (judgment === null || missing !== null) return null;
    if (judgment === 'NORMAL') return {};
    if (judgment === 'OVER') return { reasonCode: effectiveReason ?? '' };

    const trimmed = remarks.trim();
    return {
      remainderDispositionCode: disposition ?? 'CARRY_OVER',
      reasonCode: effectiveReason ?? '',
      ...(disposition === 'WRITE_OFF' && trimmed !== '' ? { remarks: trimmed } : {}),
    };
  };
  const etag = target.data?.etag ?? null;
  /*
   * 창 안 [마감]을 막는 까닭 — 하나만 보인다. 다시 읽는 동안에도 막는다: 앞서 읽은 판정이나
   * 세션으로 보내지 않게.
   */
  const submitBlocked = ((): { text: string; shownAbove: boolean } | null => {
    /* 다시 읽는 동안에는 위에 「확인하는 중」이 서지 않는다 — 까닭을 단추 아래에 보인다. */
    if (sessions.isPending || sessions.isFetching)
      return { text: st.checking, shownAbove: sessions.isPending };
    if (sessions.isError || plan === null) return { text: st.loadFailed, shownAbove: true };
    if (plan.blockers.length > 0) return { text: st.blocked, shownAbove: true };
    if (target.isPending || target.isFetching)
      return { text: t.loading, shownAbove: target.isPending };
    if (target.isError || etag === null) return { text: t.loadFailed, shownAbove: true };
    if (judgment === null) return { text: t.judgmentMissing, shownAbove: true };
    /*
     * 고를 것이 남은 까닭(잔량 처리·사유)은 화면에 적지 않는다(사용자 지시 2026-11-16) — 고를 칸이 바로 위에
     * 있다. 단추에는 그대로 이어 화면 읽기 프로그램이 읽는다.
     */
    if (missing !== null) return { text: missing, shownAbove: true };
    if (openLots.isPending) return { text: t.openLotsChecking, shownAbove: false };

    return null;
  })();
  const submitBlockedReason = submitBlocked?.text ?? null;
  const canSubmit = submitBlockedReason === null && !sequence.isSaving;

  const close = () => {
    if (sequence.isSaving) return;
    setIsOpen(false);
    setKeyboardOpen(false);
    sequence.reset();
  };

  /** 열린 작업 세션 표의 칸(단말 · 작업자 · 상태 · 끝낼 곳) — 값은 종전 그대로다. */
  const sessionCells = (row: CloseSessionView): string[] => [
    row.terminalCode ?? st.unknown,
    row.workerName === null || row.workerNo === null
      ? st.unknown
      : st.workerValue(row.workerName, row.workerNo),
    row.isRunning ? st.RUNNING : st.STOPPED,
    row.terminalId === terminalId
      ? st.here(messages.workHoldRegister.title)
      : st.other(messages.workOrderClose.menuPath),
  ];

  const endFailureText =
    sequence.endFailure === 'forbidden'
      ? t.endForbidden
      : sequence.endFailure === 'notFound'
        ? t.endNotFound
        : sequence.endFailure === 'other'
          ? t.endFailed
          : null;
  const variance = progress?.varianceQty;
  const voided = workOrder?.preIssuedLots?.withoutResultCount ?? 0;
  /* 그대로 남는 LOT 은 조회를 못 했으면 모른다 — 세지 않는다(「확인하지 못했다」 안내가 따로 선다). */
  const openLotNos = openLots.isError ? [] : (openLots.data?.lotNos ?? []);
  const voidLotNos = openLots.isError ? [] : (openLots.data?.voidLotNos ?? []);
  /** 파란 안내 줄(정보 아이콘 + 한 줄). */
  const infoNote = (text: string) => <PuNote>{text}</PuNote>;
  /** 폐번될·마감되지 않은 LOT 묶음 — 제목 오른쪽에 건수, 아래 번호 상자. */
  const lotGroup = (title: string, count: number, lotNos: string[]) => (
    <section className="pu-stack pr-close-lots" aria-label={title}>
      <div className="pu-label">
        <span>{title}</span>
        <span className="aside">{t.lotCount(count)}</span>
      </div>
      {lotNos.length > 0 && (
        <ul className="pr-close-lot-box">
          {lotNos.map((lotNo) => (
            <li key={lotNo}>{lotNo}</li>
          ))}
        </ul>
      )}
    </section>
  );
  const retryButton = (onClick: () => void) => (
    <PuButton size="sm" onClick={onClick}>
      {messages.common.retry}
    </PuButton>
  );

  return (
    <>
      {/* 작업 줄 버튼(#295 규칙 2·3) — 잠기면 흐리게만, 까닭은 `reasonId` 문장에 잇는다. */}
      {reason === null ? (
        <PuButton
          variant={props.variant === 'filled' ? 'primary' : 'default'}
          aria-describedby={props.reasonId}
          onClick={() => setIsOpen(true)}
        >
          {t.button}
        </PuButton>
      ) : props.reasonId !== undefined ? (
        <PuButton
          variant={props.variant === 'filled' ? 'primary' : 'default'}
          disabled
          aria-describedby={props.reasonId}
        >
          {t.button}
        </PuButton>
      ) : (
        <div className="field-cell">
          <PuButton disabled aria-describedby={noteId}>
            {t.button}
          </PuButton>
          <span id={noteId} className="field-note">
            {reason}
          </span>
        </div>
      )}

      {/* 되돌릴 수 없는 일이라 확인 창을 거친다(규칙 13). 머리 X 없이 아래 [취소] + [마감](규칙 16). */}
      {isOpen && (
        <PuDialog
          title={t.title(workOrderNo)}
          onClose={close}
          keyboard={
            /*
             * 비고 글자판은 창 밖 화면 아래 판에(사용자 지시 2026-11-24). 소멸 처리가 걸린 창은 판 자리를 늘 비워
             * 두어(`null`) 칸을 눌러 판이 열려도 창이 움직이지 않는다.
             */
            needsDisposition ? (
              showKeyboard ? (
                <div className="pu-stack" role="group" aria-label={t.fields.remarks}>
                  <div className="pu-keypad-head">
                    <span className="pu-keypad-target">
                      <b>{t.fields.remarks}</b>
                    </span>
                  </div>
                  <PuTextKeyboard value={remarks} onChange={setRemarks} />
                </div>
              ) : null
            ) : undefined
          }
          footer={
            <>
              <PuButton disabled={sequence.isSaving} onClick={close}>
                {t.cancel}
              </PuButton>
              <PuButton
                variant="primary"
                disabled={!canSubmit}
                aria-busy={sequence.isSaving || undefined}
                aria-describedby={submitBlockedReason === null ? undefined : submitNoteId}
                onClick={() => {
                  const next = body();
                  if (next === null || plan === null || etag === null || !canSubmit) return;
                  sequence.start({ body: next, etag }, plan.ownSessionId);
                }}
              >
                {t.confirm}
              </PuButton>
            </>
          }
        >
          <div className="wc-wrap">
            <div className="wc-main">
              {endFailureText !== null && <PuNote tone="bad">{endFailureText}</PuNote>}
              {sequence.endedButNotClosed && <PuNote tone="warn">{t.endedButNotClosed}</PuNote>}
              <SaveErrorBanner error={sequence.endError} />
              <SaveErrorBanner error={sequence.closeError} />

              {sessions.isPending ? (
                <p role="status" className="pu-dialog-text">
                  {st.checking}
                </p>
              ) : sessions.isError ? (
                <PuNote tone="bad" action={retryButton(() => void sessions.refetch())}>
                  {st.loadFailed}
                </PuNote>
              ) : plan !== null && plan.blockers.length > 0 ? (
                <>
                  <PuNote tone="warn">{st.blocked}</PuNote>
                  <div className="pu-table-wrap pr-close-sessions">
                    <table className="pu-table" aria-label={st.listLabel}>
                      <thead>
                        <tr>
                          <th scope="col" className="fit">
                            {st.terminal}
                          </th>
                          <th scope="col" className="fit">
                            {st.worker}
                          </th>
                          <th scope="col" className="fit mid">
                            {st.state}
                          </th>
                          <th scope="col">{st.where}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.blockers.map((row) => (
                          <tr key={row.workSessionId}>
                            {sessionCells(row).map((cell, index) => (
                              <td key={index} className={SESSION_CELL_CLASS[index]}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {target.isPending ? (
                <p role="status" className="pu-dialog-text">
                  {t.loading}
                </p>
              ) : target.isError || target.data === undefined || target.data.etag === null ? (
                <PuNote tone="bad" action={retryButton(() => void target.refetch())}>
                  {t.loadFailed}
                </PuNote>
              ) : (
                <>
                  <dl className="pu-kv">
                    <dt>{t.fields.orderQty}</dt>
                    <dd>{`${formatQty(target.data.workOrder.orderQty)} ${uomLabel}`.trim()}</dd>
                    <dt>{t.fields.goodQty}</dt>
                    <dd>{`${formatQty(progress?.goodQty ?? 0)} ${uomLabel}`.trim()}</dd>
                    <dt>{t.fields.judgment}</dt>
                    {/* 정상은 초록, 미달·초과는 노랑(시안). 값은 서버 판정 그대로다. */}
                    <dd>
                      {judgment === null ? (
                        '—'
                      ) : (
                        <span
                          className={judgment === 'NORMAL' ? 'pu-chip ok' : 'pu-chip warn'}
                          data-tone={judgment === 'NORMAL' ? 'success' : undefined}
                        >
                          {t.judgments[judgment]}
                        </span>
                      )}
                    </dd>
                    {variance !== undefined && variance !== 0 && (
                      <>
                        <dt>{variance > 0 ? t.fields.shortfallQty : t.fields.overageQty}</dt>
                        <dd>{`${formatQty(Math.abs(variance))} ${uomLabel}`.trim()}</dd>
                      </>
                    )}
                  </dl>

                  {judgment === null && (
                    <PuNote tone="bad" action={retryButton(() => void target.refetch())}>
                      {t.judgmentMissing}
                    </PuNote>
                  )}

                  {needsDisposition && (
                    <PuField label={t.fields.remainder} required labelId={remainderTitleId}>
                      <div
                        className="pu-tiles"
                        role="group"
                        aria-labelledby={remainderTitleId}
                        style={{ '--cols': '2' } as CSSProperties}
                      >
                        {(['CARRY_OVER', 'WRITE_OFF'] as const).map((code) => (
                          <button
                            key={code}
                            type="button"
                            className={disposition === code ? 'pu-tile is-on' : 'pu-tile'}
                            aria-pressed={disposition === code}
                            onClick={() => setDisposition(code)}
                          >
                            {t.remainder[code]}
                          </button>
                        ))}
                      </div>
                    </PuField>
                  )}

                  {needsReason && (
                    <PuField label={t.fields.reason} required labelId={reasonTitleId}>
                      {reasons.isLoading ? (
                        <p role="status" className="pu-dialog-text">
                          {t.reasonsLoading}
                        </p>
                      ) : reasons.isError ? (
                        <PuNote tone="bad">{t.reasonsFailed}</PuNote>
                      ) : reasonList.length === 0 ? (
                        <p className="pu-dialog-text">{t.reasonsEmpty}</p>
                      ) : (
                        /* 기준 정보에서 오는 사유라 선택 창으로 고른다(시안 · 규칙 7 예외). */
                        <PopSelect
                          aria-labelledby={reasonTitleId}
                          placeholder={t.reasonPlaceholder}
                          options={reasonList.map((item) => ({
                            value: item.code,
                            label: masterName(item, item.codeName),
                          }))}
                          value={effectiveReason}
                          onChange={(value) => setReasonCode(value)}
                        />
                      )}
                    </PuField>
                  )}

                  {needsDisposition && disposition === 'WRITE_OFF' && (
                    <PuField label={t.fields.remarks} htmlFor={remarksId}>
                      <PuInput
                        id={remarksId}
                        value={remarks}
                        autoComplete="off"
                        target={showKeyboard}
                        onFocus={() => setKeyboardOpen(true)}
                        onBlur={() => setKeyboardOpen(false)}
                        onChange={(event) => setRemarks(event.target.value)}
                      />
                    </PuField>
                  )}

                  {/* 폐번 건수는 서버가 센 값(`withoutResultCount`)이 정본이다. 번호는 받은 쪽에서 보인다. */}
                  {voided > 0 && lotGroup(t.voidedTitle, voided, voidLotNos)}
                  {openLotNos.length > 0 && lotGroup(t.openTitle, openLotNos.length, openLotNos)}
                  {openLots.isError && infoNote(t.openLotsUnknown)}
                  {(openLots.data?.uncheckedCount ?? 0) > 0 &&
                    infoNote(t.uncheckedLots(openLots.data?.uncheckedCount ?? 0))}
                  {/* 되돌릴 수 없음 안내(시안 문구 그대로) — 주의 노랑. */}
                  <PuNote tone="warn">{t.irreversible}</PuNote>
                </>
              )}
              {/* 창 위에 이미 띠로 선 까닭·고를 칸이 위에 있는 까닭은 단추에만 이어 둔다 — 같은 말을 두 번 보이지 않게. */}
              {submitBlocked !== null && (
                <p
                  className={submitBlocked.shownAbove ? 'visually-hidden' : 'field-note'}
                  id={submitNoteId}
                >
                  {submitBlocked.text}
                </p>
              )}
            </div>
          </div>
        </PuDialog>
      )}
    </>
  );
};
