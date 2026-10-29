import {
  AlertBanner,
  Button,
  type Column,
  Dialog,
  Table,
  TextField,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { masterName } from '../../patterns/master-name';
import { SaveErrorBanner } from '../../patterns/master';
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
  const toast = useToast();
  const navigate = useNavigate();
  const noteId = useId();
  const submitNoteId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');

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
      toast.show({ variant: 'success', description: t.done(workOrderNo) });
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
  const isPrefilled = reasonCode === null && effectiveReason !== null;
  const needsDisposition = judgment === 'UNDER';
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
    if (missing !== null) return { text: missing, shownAbove: false };
    if (openLots.isPending) return { text: t.openLotsChecking, shownAbove: false };

    return null;
  })();
  const submitBlockedReason = submitBlocked?.text ?? null;
  const canSubmit = submitBlockedReason === null && !sequence.isSaving;

  const close = () => {
    if (sequence.isSaving) return;
    setIsOpen(false);
    sequence.reset();
  };

  const sessionColumns: Column<CloseSessionView>[] = [
    { key: 'terminal', header: st.terminal, render: (row) => row.terminalCode ?? st.unknown },
    {
      key: 'worker',
      header: st.worker,
      render: (row) =>
        row.workerName === null || row.workerNo === null
          ? st.unknown
          : st.workerValue(row.workerName, row.workerNo),
    },
    { key: 'state', header: st.state, render: (row) => (row.isRunning ? st.RUNNING : st.STOPPED) },
    {
      key: 'where',
      header: st.where,
      render: (row) =>
        row.terminalId === terminalId
          ? st.here(messages.workHoldRegister.title)
          : st.other(messages.workOrderClose.menuPath),
    },
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

  return (
    <div className="production-flow-wo-close">
      {reason === null ? (
        <Button
          variant={props.variant ?? 'outlined'}
          size="xl"
          aria-describedby={props.reasonId}
          onClick={() => setIsOpen(true)}
        >
          {t.button}
        </Button>
      ) : props.reasonId !== undefined ? (
        <Button
          variant={props.variant ?? 'outlined'}
          size="xl"
          disabled
          aria-describedby={props.reasonId}
        >
          {t.button}
        </Button>
      ) : (
        <div className="field-cell">
          <Button variant="outlined" size="xl" disabled aria-describedby={noteId}>
            {t.button}
          </Button>
          <span id={noteId} className="field-note">
            {reason}
          </span>
        </div>
      )}

      {isOpen && (
        <Dialog
          open
          size="lg"
          title={t.title(workOrderNo)}
          showCloseButton={false}
          /* 터치 단말의 오조작 — 바깥을 눌러 닫히지 않는다. */
          closeOnBackdropClick={false}
          onClose={close}
          footer={
            <>
              <Button variant="outlined" size="xl" disabled={sequence.isSaving} onClick={close}>
                {t.cancel}
              </Button>
              <Button
                size="xl"
                disabled={!canSubmit}
                loading={sequence.isSaving}
                aria-describedby={submitBlockedReason === null ? undefined : submitNoteId}
                onClick={() => {
                  const next = body();
                  if (next === null || plan === null || etag === null || !canSubmit) return;
                  sequence.start({ body: next, etag }, plan.ownSessionId);
                }}
              >
                {t.confirm}
              </Button>
            </>
          }
        >
          {endFailureText !== null && (
            <div className="banner-slot">
              <AlertBanner variant="error" title={endFailureText} />
            </div>
          )}
          {sequence.endedButNotClosed && (
            <div className="banner-slot">
              <AlertBanner variant="warning" title={t.endedButNotClosed} />
            </div>
          )}
          <SaveErrorBanner error={sequence.endError} />
          <SaveErrorBanner error={sequence.closeError} />

          {sessions.isPending ? (
            <p role="status">{st.checking}</p>
          ) : sessions.isError ? (
            <AlertBanner
              variant="error"
              title={st.loadFailed}
              action={
                <Button variant="outlined" size="sm" onClick={() => void sessions.refetch()}>
                  {messages.common.retry}
                </Button>
              }
            />
          ) : plan !== null && plan.blockers.length > 0 ? (
            <div className="banner-slot">
              <AlertBanner variant="warning" title={st.blocked} />
              <Table
                density="compact"
                caption={st.listLabel}
                columns={sessionColumns}
                rows={plan.blockers}
                getRowId={(row) => String(row.workSessionId)}
              />
            </div>
          ) : null}

          {target.isPending ? (
            <p role="status">{t.loading}</p>
          ) : target.isError || target.data === undefined || target.data.etag === null ? (
            <AlertBanner
              variant="error"
              title={t.loadFailed}
              action={
                <Button variant="outlined" size="sm" onClick={() => void target.refetch()}>
                  {messages.common.retry}
                </Button>
              }
            />
          ) : (
            <>
              <dl className="pop-figures">
                <div>
                  <dt>{t.fields.orderQty}</dt>
                  <dd>{`${formatQty(target.data.workOrder.orderQty)} ${uomLabel}`.trim()}</dd>
                </div>
                <div>
                  <dt>{t.fields.goodQty}</dt>
                  <dd>{`${formatQty(progress?.goodQty ?? 0)} ${uomLabel}`.trim()}</dd>
                </div>
                <div>
                  <dt>{t.fields.judgment}</dt>
                  <dd>{judgment === null ? '—' : t.judgments[judgment]}</dd>
                </div>
                {variance !== undefined && variance !== 0 && (
                  <div>
                    <dt>{variance > 0 ? t.fields.shortfallQty : t.fields.overageQty}</dt>
                    <dd>{`${formatQty(Math.abs(variance))} ${uomLabel}`.trim()}</dd>
                  </div>
                )}
              </dl>

              {judgment === null && (
                <AlertBanner
                  variant="error"
                  title={t.judgmentMissing}
                  action={
                    <Button variant="outlined" size="sm" onClick={() => void target.refetch()}>
                      {messages.common.retry}
                    </Button>
                  }
                />
              )}

              {needsDisposition && (
                <fieldset className="field-cell">
                  <legend className="field-label">{t.fields.remainder}</legend>
                  <div className="production-flow-reason-tiles">
                    {(['CARRY_OVER', 'WRITE_OFF'] as const).map((code) => (
                      <Button
                        key={code}
                        size="xl"
                        variant={disposition === code ? 'filled' : 'outlined'}
                        aria-pressed={disposition === code}
                        onClick={() => setDisposition(code)}
                      >
                        {t.remainder[code]}
                      </Button>
                    ))}
                  </div>
                  <p className="field-note">{t.carryOverNote(messages.productionOrder.menuPath)}</p>
                </fieldset>
              )}

              {needsReason && (
                <fieldset className="field-cell">
                  <legend className="field-label">{t.fields.reason}</legend>
                  {reasons.isLoading ? (
                    <p role="status">{t.reasonsLoading}</p>
                  ) : reasons.isError ? (
                    <AlertBanner variant="error" title={t.reasonsFailed} />
                  ) : reasonList.length === 0 ? (
                    <p>{t.reasonsEmpty}</p>
                  ) : (
                    <div className="production-flow-reason-tiles">
                      {reasonList.map((item) => (
                        <Button
                          key={item.code}
                          size="xl"
                          variant={effectiveReason === item.code ? 'filled' : 'outlined'}
                          aria-pressed={effectiveReason === item.code}
                          onClick={() => setReasonCode(item.code)}
                        >
                          {masterName(item, item.codeName)}
                        </Button>
                      ))}
                    </div>
                  )}
                  {isPrefilled && <p className="field-note">{t.prefilled}</p>}
                </fieldset>
              )}

              {needsDisposition && disposition === 'WRITE_OFF' && (
                <TextField
                  label={t.fields.remarks}
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              )}

              {voided > 0 && <p>{t.voidedSlots(voided)}</p>}
              {openLots.isError ? (
                <p>{t.openLotsUnknown}</p>
              ) : (
                <>
                  {(openLots.data?.lotNos.length ?? 0) > 0 && (
                    <p>
                      {t.openLots(
                        openLots.data?.lotNos.length ?? 0,
                        openLots.data?.lotNos.join(', ') ?? '',
                      )}
                    </p>
                  )}
                  {(openLots.data?.uncheckedCount ?? 0) > 0 && (
                    <p>{t.uncheckedLots(openLots.data?.uncheckedCount ?? 0)}</p>
                  )}
                </>
              )}
              <p>{t.irreversible}</p>
            </>
          )}
          {/* 창 위에 이미 띠로 선 까닭은 단추에만 이어 둔다 — 같은 말을 두 번 보이지 않게. */}
          {submitBlocked !== null && (
            <p
              className={submitBlocked.shownAbove ? 'visually-hidden' : 'field-note'}
              id={submitNoteId}
            >
              {submitBlocked.text}
            </p>
          )}
        </Dialog>
      )}
    </div>
  );
};
