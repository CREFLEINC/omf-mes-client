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
}

/** 왜 지금 마감할 수 없는가. 없으면 null. */
const blockedReason = (props: WorkOrderCloseActionProps): string | null => {
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
      toast.show({ variant: 'success', description: t.done(workOrderNo) });
      void navigate('/pop/work-start');
    },
    recheckSessions: async () => {
      const result = await sessions.refetch();
      return result.data === undefined ? null : planCloseSessions(result.data, terminalId);
    },
  });

  if (props.statusCode === 'CLOSED') return null;

  const reason = blockedReason(props);
  const plan = sessions.data === undefined ? null : planCloseSessions(sessions.data, terminalId);
  const progress = target.data?.progress;
  const judgment = progress?.completionJudgmentCode ?? null;
  const savedReason = target.data?.completionVarianceReasonCode ?? null;
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
  const canSubmit =
    body() !== null && plan !== null && plan.blockers.length === 0 && !sequence.isSaving;

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
  const voided = target.data?.preIssuedLots?.withoutResultCount ?? 0;

  return (
    <div className="production-flow-wo-close">
      {reason === null ? (
        <Button variant="outlined" size="xl" onClick={() => setIsOpen(true)}>
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
                onClick={() => {
                  const next = body();
                  if (next === null || plan === null || !canSubmit) return;
                  sequence.start(next, plan.ownSessionId);
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
          ) : target.isError || target.data === undefined ? (
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
                  <dd>{`${formatQty(target.data.orderQty)} ${uomLabel}`.trim()}</dd>
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
              {missing !== null && judgment !== null && <p className="field-note">{missing}</p>}
              <p>{t.irreversible}</p>
            </>
          )}
        </Dialog>
      )}
    </div>
  );
};
