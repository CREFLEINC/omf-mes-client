import { AlertBanner, IconButton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';

import { useBackStep } from '../../patterns/back-step';
import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { useLoadFailure } from '../../patterns/load-failure';
import { createIdempotencyKey, useOutbox } from '../../patterns/outbox';
import { toApiError } from '../../patterns/request';
import { signal } from '../../patterns/scan-feedback';
import { ScanZone } from '../../patterns/scan-zone';
import { useScreenTitle } from '../../patterns/screen-title';
import { useScanField } from '../../patterns/use-scan-field';
import { useWorkerSession } from '../../patterns/worker-session';
import { FindByWorkOrder } from './find-by-wo';
import { useLocationLookup, useReturnLookup, useSendReturn } from './queries';
import {
  doneOf,
  locationLookupFailureOf,
  lookupMessageOf,
  lotOf,
  parseQty,
  qtyProblemOf,
  qtyReady,
  qtyText,
  sendFailureOf,
  toReceiveBody,
  toReturnDraft,
  type Done,
  type ReturnLot,
  type ReturnTarget,
} from './return';
import './screen.css';

const t = messages.materialReturn;

type Step = 'lot' | 'qty' | 'location' | 'done';

/** 위치 단계의 판정 — 서버가 보낼 때 판정한다(지정 품목만 받기 · 미지정 확인 · 적치 009 와 같다). */
type LocationState =
  | { kind: 'checking'; code: string }
  | { kind: 'confirm'; target: ReturnTarget }
  | { kind: 'blocked'; code: string; message: string };

/**
 * 위치 스캔이 막힌 까닭 — 없는 코드 · 생산창고 위치 아님, 또는 조회 실패(문구는 그릴 때 PDA 공통 규칙으로 고른다).
 */
type LocationError =
  | { kind: 'notFound'; code: string }
  | { kind: 'notProduction'; code: string }
  | { kind: 'rejected'; message: string }
  | { kind: 'failed'; cause: unknown };

/**
 * `M-01-15` 반납 입고 (PDA · 피처 019 · omf-all-around#367 · 시안 ④·⑤ 확정 2026-11-27).
 *
 * LOT 스캔 → 수량(빈칸에서 시작) → 놓을 위치 스캔(건너뛰면 적치 대기) → 바로 보낸다. 한 번에 LOT 하나다.
 * 위치를 스캔하면 입고와 적치가 한 번에 끝나고, 「적치 대기로 받기」는 출고 생산창고 적치 대기로 들어가 적치 지시가
 * 생긴다(「적치·입고 완료」에서 옮긴다 · 2026-11-28 사용자 결정).
 *
 * ⭐ 단계 막대 세 칸, 지난 단계는 카드로 접혀 남고 누르면 그 단계로 돌아간다.
 * ⭐ 귀속 W/O 는 그리지 않는다(FR-013). 거절 문구는 오류 코드로 단말 언어 문구를 꺼낸다(모르는 코드만 서버 문구).
 * ⭐ 위치 코드는 공장의 생산창고 어디서든 찾는다 — 출고 생산창고가 아니어도 받고, 그 창고 이름을 카드에 함께 보인다
 *    (2026-11-28 사용자 결정 · 반납 전용 위치 조회). 생산창고 위치가 아니면 받지 않는다.
 * ⭐ 연결이 없거나 응답을 못 받으면 같은 멱등 키 · 본문으로 대기열에 담고 다음 LOT 으로 간다(다른 PDA 화면과 같다).
 */
export const MaterialReturnScreen = () => {
  useScreenTitle(t.pda.title);

  const { worker } = useWorkerSession();
  const { enqueue } = useOutbox();
  const lookup = useReturnLookup();
  const locationLookup = useLocationLookup();
  const send = useSendReturn();
  const failureText = useLoadFailure();

  const [step, setStep] = useState<Step>('lot');
  const [finding, setFinding] = useState(false);
  const [lot, setLot] = useState<ReturnLot | null>(null);
  const [lotError, setLotError] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [padOpen, setPadOpen] = useState(false);
  const [location, setLocation] = useState<LocationState | null>(null);
  const [locationError, setLocationError] = useState<LocationError | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  /* 같은 틱에 두 번 보내지 않는다 — 멱등 키가 다른 두 건이 나가면 서버가 흡수하지 못한다. */
  const inFlight = useRef(false);
  /* 한 시도에 키 하나 — 응답을 못 받아 다시 보내면 같은 키 · 같은 본문이다. */
  const attempt = useRef<{ target: string; key: string; now: Date } | null>(null);

  const qty = parseQty(qtyInput);
  const busy = lookup.isPending || locationLookup.isPending || send.isPending;

  const startOver = (): void => {
    setStep('lot');
    setLot(null);
    setLotError(null);
    setQtyInput('');
    setPadOpen(false);
    setLocation(null);
    setLocationError(null);
    setSendError(null);
    setDone(null);
    attempt.current = null;
  };

  const toQty = (next: ReturnLot): void => {
    setLot(next);
    setLotError(null);
    setQtyInput('');
    setStep('qty');
    setPadOpen(true);
  };

  const backTo = (target: Step): void => {
    setLocation(null);
    setLocationError(null);
    setSendError(null);
    if (target === 'lot') {
      startOver();
      return;
    }
    setStep(target);
    if (target === 'qty') setPadOpen(true);
  };

  useBackStep(step === 'location', () => {
    backTo('qty');
  });
  useBackStep(step === 'qty', () => {
    backTo('lot');
  });

  const scanLot = (value: string): void => {
    const lotNo = value.trim();
    if (lotNo === '' || busy) return;
    setLotError(null);
    lookup.mutate(lotNo, {
      onSuccess: (found) => {
        signal('confirm');
        toQty(lotOf(found));
      },
      onError: (cause) => {
        signal('reject');
        const error = toApiError(cause);
        setLotError(
          lookupMessageOf(error) ??
            (error.kind !== 'network' && error.status === 404
              ? t.pop.notFound(lotNo)
              : t.pop.lookupFailed),
        );
      },
    });
  };

  const keyFor = (targetKey: string): { key: string; now: Date } => {
    if (attempt.current === null || attempt.current.target !== targetKey) {
      attempt.current = { target: targetKey, key: createIdempotencyKey(), now: new Date() };
    }
    return attempt.current;
  };

  const submit = async (target: ReturnTarget | null): Promise<void> => {
    if (lot === null || qty === null || worker === null || inFlight.current) return;

    inFlight.current = true;
    setSendError(null);
    const { key, now } = keyFor(
      JSON.stringify([lot.lotId, qty, target?.locationId ?? null, target?.confirmUndesignated]),
    );
    const body = toReceiveBody(lot, qty, target, now);

    try {
      if (!globalThis.navigator.onLine) {
        await enqueue(toReturnDraft(lot, body, key, worker.workerNo));
        attempt.current = null;
        setDone({ kind: 'queued', lot, qty });
        setStep('done');
        return;
      }

      const response = await send.mutateAsync({
        body,
        idempotencyKey: key,
        workerNo: worker.workerNo,
      });
      attempt.current = null;
      signal('confirm');
      setDone(doneOf(lot, qty, target, response));
      setStep('done');
    } catch (cause) {
      const failure = sendFailureOf(toApiError(cause), lot.uomCode);

      if (failure.kind === 'queue') {
        try {
          await enqueue(toReturnDraft(lot, body, key, worker.workerNo));
          attempt.current = null;
          setDone({ kind: 'queued', lot, qty });
          setStep('done');
        } catch {
          setSendError(t.pop.submitFailed);
        }
        return;
      }

      signal('reject');
      attempt.current = null;
      if (failure.kind === 'confirm' && target !== null) {
        setLocation({ kind: 'confirm', target: { ...target, confirmUndesignated: true } });
        return;
      }
      if (target !== null) {
        setLocation({
          kind: 'blocked',
          code: target.locationCode,
          message: failure.kind === 'rejected' ? (failure.message ?? t.pop.submitFailed) : '',
        });
        return;
      }
      setSendError(failure.kind === 'rejected' ? (failure.message ?? t.pop.submitFailed) : null);
    } finally {
      inFlight.current = false;
    }
  };

  const scanLocation = (value: string): void => {
    const code = value.trim();
    if (code === '' || busy || lot === null) return;
    setLocation({ kind: 'checking', code });
    setLocationError(null);
    setSendError(null);
    locationLookup.mutate(code, {
      onSuccess: (found) => {
        void submit({
          locationId: found.locationId,
          locationCode: found.locationCode,
          warehouseName: found.warehouse.warehouseName,
          confirmUndesignated: false,
        });
      },
      onError: (cause) => {
        signal('reject');
        setLocation(null);
        const failure = locationLookupFailureOf(toApiError(cause));
        setLocationError(
          failure.kind === 'failed'
            ? { kind: 'failed', cause }
            : failure.kind === 'rejected'
              ? failure
              : { kind: failure.kind, code },
        );
      },
    });
  };

  const lotField = useScanField({ onScan: scanLot });
  const locationField = useScanField({ onScan: scanLocation });

  const manualButton = (field: typeof lotField, label: string) => (
    <IconButton
      className="mreturn__zone-button"
      icon={field.manual ? 'keyboard_return' : 'keyboard'}
      size="lg"
      aria-label={label}
      onClick={field.manual ? field.submitManual : field.openManual}
    />
  );

  if (finding) {
    return (
      <div className="mreturn">
        <FindByWorkOrder
          onClose={() => {
            setFinding(false);
          }}
          onPick={(picked) => {
            setFinding(false);
            toQty(picked);
          }}
        />
      </div>
    );
  }

  const qtyProblem = lot === null ? null : qtyProblemOf(qtyInput, lot);
  /* 연결이 끊긴 때만 「연결을 확인」 — 서버가 답한 실패(단말 범위 밖 등)는 PDA 공통 문구다(#1187 · F-01). */
  const locationErrorText =
    locationError === null
      ? null
      : locationError.kind === 'notFound'
        ? t.pda.locationNotFound(locationError.code)
        : locationError.kind === 'notProduction'
          ? t.pda.locationNotProduction(locationError.code)
          : locationError.kind === 'rejected'
            ? locationError.message
            : failureText(locationError.cause, t.pda.locationLookupFailed, {
                caution: t.pda.locationLookupCaution,
              });
  const stepIndex = step === 'lot' ? 1 : step === 'qty' ? 2 : 3;

  return (
    <div className={padOpen && step === 'qty' ? 'mreturn docked-pad-open' : 'mreturn'}>
      <ol className="mreturn__bar" aria-label={t.pda.title}>
        {[t.pda.steps.lot, t.pda.steps.qty, t.pda.steps.location].map((name, index) => (
          <li
            key={name}
            className={
              index + 1 < stepIndex || step === 'done'
                ? 'mreturn__bar-cell is-done'
                : index + 1 === stepIndex
                  ? 'mreturn__bar-cell is-on'
                  : 'mreturn__bar-cell'
            }
            aria-current={index + 1 === stepIndex && step !== 'done' ? 'step' : undefined}
          >
            {name}
          </li>
        ))}
      </ol>

      {/* 지난 단계 — 카드로 접혀 남고, 누르면 그 단계로 돌아간다(완료 뒤에는 「다음 LOT」으로만). */}
      {lot !== null && step !== 'lot' && step !== 'done' ? (
        <button
          type="button"
          className="mreturn__card"
          aria-label={t.pda.stepCard(t.pda.steps.lot)}
          disabled={busy}
          onClick={() => {
            backTo('lot');
          }}
        >
          <span className="mreturn__card-head">
            <b className="mreturn__code">{lot.itemCode}</b>
            <span>{lot.itemName}</span>
          </span>
          <span className="mreturn__lotno">
            {t.pda.lotCard} {lot.lotNo}
          </span>
          <span className="mreturn__sub">
            {t.pda.returnableOf(qtyText(lot.returnableQty, lot.uomCode))}
          </span>
        </button>
      ) : null}
      {lot !== null && qty !== null && step === 'location' ? (
        <button
          type="button"
          className="mreturn__card"
          aria-label={t.pda.stepCard(t.pda.steps.qty)}
          disabled={busy}
          onClick={() => {
            backTo('qty');
          }}
        >
          <span className="mreturn__sub">{t.pda.qty}</span>
          <b className="mreturn__qty">{qtyText(qty, lot.uomCode)}</b>
        </button>
      ) : null}

      {step === 'lot' ? (
        <section className="mreturn__section">
          <h2 className="mreturn__title">{t.pda.scan}</h2>
          <p className="mreturn__note">{t.pda.scanSub}</p>
          <ScanZone
            field={lotField}
            label={t.pda.scan}
            prompt={t.pda.scanSub}
            error={lotError ?? undefined}
            tools={manualButton(lotField, t.pop.manualLabel)}
          />
          {lookup.isPending ? <p role="status">{t.pop.looking}</p> : null}
          <button
            type="button"
            className="mreturn__link"
            onClick={() => {
              setFinding(true);
            }}
          >
            {t.pop.byWorkOrder}
          </button>
        </section>
      ) : null}

      {step === 'qty' && lot !== null ? (
        <section className="mreturn__section">
          <TextField
            label={t.pda.qty}
            inputMode="none"
            size="xl"
            fullWidth
            value={qtyInput}
            onChange={(event) => {
              setQtyInput(event.target.value);
            }}
            onFocus={() => {
              setPadOpen(true);
            }}
            error={
              qtyProblem === null
                ? undefined
                : qtyProblem === 'integer'
                  ? t.pop.qtyInteger
                  : t.pop.qtyOver(qtyText(lot.returnableQty, lot.uomCode))
            }
          />
          <p className="mreturn__note">
            {t.pda.returnableOf(qtyText(lot.returnableQty, lot.uomCode))}
          </p>
        </section>
      ) : null}

      {step === 'location' && lot !== null ? (
        <section className="mreturn__section">
          {location?.kind === 'confirm' ? (
            <AlertBanner
              variant="warning"
              title={t.pda.undesignatedTitle(
                t.pda.locationAt(location.target.locationCode, location.target.warehouseName),
                lot.itemCode,
              )}
            >
              {t.pda.undesignatedBody(lot.itemCode)}
            </AlertBanner>
          ) : (
            <>
              <h2 className="mreturn__title">{t.pda.location}</h2>
              <p className="mreturn__note">{t.pda.locationSub}</p>
              {location?.kind === 'blocked' ? (
                <AlertBanner variant="error" title={t.pda.blockedTitle(location.code)}>
                  {location.message}
                </AlertBanner>
              ) : null}
              <ScanZone
                field={locationField}
                label={t.pda.location}
                prompt={t.pda.locationSub}
                error={locationErrorText ?? undefined}
                tools={manualButton(locationField, messages.putaway.location.manual)}
              />
              {location?.kind === 'checking' ? <p role="status">{t.pda.sending}</p> : null}
            </>
          )}
          {sendError === null ? null : (
            <AlertBanner variant="error" title={t.pda.sendFailedTitle}>
              {sendError}
            </AlertBanner>
          )}
        </section>
      ) : null}

      {step === 'done' && done !== null ? <DoneCard done={done} /> : null}

      {step === 'qty' && lot !== null ? (
        <BottomActionBar
          primary={{
            label: t.pda.next,
            disabled: !qtyReady(qtyInput, lot),
            onClick: () => {
              setPadOpen(false);
              setLocation(null);
              setLocationError(null);
              setSendError(null);
              setStep('location');
            },
          }}
        />
      ) : step === 'location' && location?.kind === 'confirm' ? (
        <BottomActionBar
          primary={{
            label: t.pda.confirm,
            busy: send.isPending,
            onClick: () => {
              void submit(location.target);
            },
          }}
          secondary={{
            label: t.pda.otherLocation,
            onClick: () => {
              setLocation(null);
            },
          }}
        />
      ) : step === 'location' ? (
        <BottomActionBar
          primary={{
            label: t.pda.skip,
            busy: send.isPending && location === null,
            disabled: busy,
            onClick: () => {
              void submit(null);
            },
          }}
        />
      ) : step === 'done' ? (
        <BottomActionBar primary={{ label: t.pda.nextLot, onClick: startOver }} />
      ) : null}

      {step === 'qty' && padOpen ? (
        <DockedNumberPad
          head={t.pda.qty}
          value={qtyInput}
          onChange={setQtyInput}
          onClose={() => {
            setPadOpen(false);
          }}
          allowDecimal={lot?.uomCode !== 'EA'}
        />
      ) : null}
    </div>
  );
};

const DoneCard = ({ done }: { done: Done }) => {
  const what = `${done.lot.itemCode} · ${done.lot.lotNo} · ${qtyText(done.qty, done.lot.uomCode)}`;

  switch (done.kind) {
    case 'located':
      return (
        <AlertBanner variant="success" title={t.pda.doneLocated}>
          <span className="mreturn__done-line">{`${what} → ${t.pda.locationAt(done.locationCode, done.warehouseName)}`}</span>
        </AlertBanner>
      );
    case 'staged':
      return (
        <AlertBanner variant="success" title={t.pda.doneStaged}>
          <span className="mreturn__done-line">
            {`${what} → ${t.pda.stagingOf(done.lot.issueWarehouseName)}`}
          </span>
          <span className="mreturn__done-line">{t.pda.doneStagedHint}</span>
        </AlertBanner>
      );
    case 'whole':
      return (
        <AlertBanner variant="success" title={t.pda.doneWhole}>
          <span className="mreturn__done-line">{`${what} → ${done.warehouseName}`}</span>
        </AlertBanner>
      );
    case 'queued':
      return (
        <AlertBanner variant="warning" title={t.pda.queued}>
          <span className="mreturn__done-line">{what}</span>
          <span className="mreturn__done-line">{t.pda.queuedHint}</span>
        </AlertBanner>
      );
  }
};
