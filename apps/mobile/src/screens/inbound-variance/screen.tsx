import { AlertBanner, Button, Card, Dialog, NumberPad, Select, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useCodeValues } from '../../patterns/code-values';
import { useItem, useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import {
  INBOUND_VARIANCE_REASON,
  INBOUND_VARIANCE_TYPE,
  useInboundReceipts,
  useKnownVariances,
  useReceiptLines,
} from './queries';
import {
  canSubmit,
  qtyProblem,
  toOutboxDraft,
  type InboundReceipt,
  type InboundReceiptLine,
  type VarianceDraft,
} from './variance';
import './screen.css';

const t = messages.inboundVariance;

type Outcome = 'queued' | 'sent' | 'rejected';

const emptyDraft: VarianceDraft = {
  line: null,
  varianceTypeCode: '',
  varianceQty: '',
  reasonCode: '',
};

export const InboundVarianceScreen = () => {
  useScreenTitle(t.title);

  const { enqueue, flush, countPending, isRejected } = useOutbox();
  const { worker } = useWorkerSession();

  const [search, setSearch] = useState('');
  const [receipt, setReceipt] = useState<InboundReceipt | null>(null);
  const [draft, setDraft] = useState<VarianceDraft>(emptyDraft);
  const [asking, setAsking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 두 건이 기록된다.
   */
  const inFlight = useRef(false);

  const patch = (next: Partial<VarianceDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const receipts = useInboundReceipts(search);
  const lines = useReceiptLines(receipt?.inboundReceiptId ?? null);
  const known = useKnownVariances(draft.line?.inboundReceiptLineId ?? null);
  const types = useCodeValues(INBOUND_VARIANCE_TYPE);
  const reasons = useCodeValues(INBOUND_VARIANCE_REASON);
  const item = useItem(draft.line?.itemId ?? null);
  const uoms = useUomCodes(true);

  const uom = uoms.data?.get(draft.line?.uomId ?? -1) ?? '';
  const ready = canSubmit(draft, worker !== null);
  const pending = countPending(t.record);

  const qtyMessage = (): string | undefined => {
    const problem = qtyProblem(draft.varianceQty);

    return problem === null || draft.varianceQty === '' ? undefined : t.form[problem];
  };

  const restart = () => {
    setReceipt(null);
    setDraft(emptyDraft);
    setAsking(false);
    setOutcome(null);
    setSaveFailed(false);
  };

  const submit = async () => {
    const line = draft.line;

    setAsking(false);

    if (worker === null || line === null || inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSaveFailed(false);

    try {
      const entry = toOutboxDraft(draft, line, new Date(), worker.workerNo);

      /* 담기지 못하면 적은 것이 어디에도 없다. 말하지 않으면 사람은 등록된 줄 안다. */
      try {
        await enqueue(entry);
      } catch {
        setSaveFailed(true);
        return;
      }

      const result = await flush().catch(() => null);
      const mine = (each: { idempotencyKey: string }) =>
        each.idempotencyKey === entry.idempotencyKey;

      /*
       * 자기가 부른 보내기의 결과만 보면 딸려 되돌아간 건을 놓친다 - 그 판정은 셸이 도는 다른
       * 회차에서 내려질 수 있고, 화면은 빈 결과를 받아 담아 두었다고 잘못 말한다.
       */
      if (
        (result !== null && result.rejected.some((each) => mine(each.entry))) ||
        isRejected(entry.idempotencyKey)
      ) {
        setOutcome('rejected');
        return;
      }

      setOutcome(result === null || result.remaining.some(mine) ? 'queued' : 'sent');
    } finally {
      inFlight.current = false;
    }
  };

  if (outcome !== null) {
    return (
      <div className="variance">
        {outcome === 'sent' ? (
          <AlertBanner variant="success" title={t.sent.title}>
            {t.sent.description}
          </AlertBanner>
        ) : null}
        {outcome === 'queued' ? (
          <AlertBanner variant="warning" title={t.queued.title}>
            {t.queued.description}
          </AlertBanner>
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <Button className="variance__wide" variant="filled" size="2xl" onClick={restart}>
          {t.another}
        </Button>
      </div>
    );
  }

  return (
    <div className="variance">
      <section className="variance__section">
        <h2>{t.receipt.legend}</h2>
        <TextField
          label={t.receipt.searchLabel}
          placeholder={t.receipt.searchPlaceholder}
          size="xl"
          fullWidth
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setReceipt(null);
            setDraft(emptyDraft);
          }}
        />
        {receipts.isPending ? <p role="status">{t.receipt.loading}</p> : null}
        {/* 확인하지 못한 것을 입하가 없는 것으로 말하지 않는다. */}
        {receipts.isError ? <AlertBanner variant="error" title={t.receipt.loadFailed} /> : null}
        {receipts.data !== undefined && receipts.data.length === 0 ? (
          <p className="variance__note">{t.receipt.none}</p>
        ) : null}
        {receipts.data === undefined ? null : (
          <div className="variance__field">
            <label htmlFor="variance-receipt">{t.receipt.pickLabel}</label>
            <Select
              id="variance-receipt"
              placeholder={t.receipt.pickPlaceholder}
              size="xl"
              value={receipt === null ? null : String(receipt.inboundReceiptId)}
              onChange={(value) => {
                setReceipt(
                  receipts.data.find((each) => each.inboundReceiptId === Number(value)) ?? null,
                );
                setDraft(emptyDraft);
              }}
              options={receipts.data.map((each) => ({
                value: String(each.inboundReceiptId),
                label: each.inboundReceiptNo,
              }))}
            />
          </div>
        )}

        {receipt === null ? null : (
          <>
            {lines.isPending ? <p role="status">{t.receipt.linesLoading}</p> : null}
            {lines.isError ? (
              <AlertBanner variant="error" title={t.receipt.linesLoadFailed} />
            ) : null}
            {lines.data !== undefined && lines.data.length === 0 ? (
              <AlertBanner variant="warning" title={t.receipt.linesNone} />
            ) : null}
            <ul className="variance__lines">
              {(lines.data ?? []).map((line: InboundReceiptLine) => (
                <li key={line.inboundReceiptLineId}>
                  <Button
                    className="variance__wide"
                    variant={
                      draft.line?.inboundReceiptLineId === line.inboundReceiptLineId
                        ? 'filled'
                        : 'outlined'
                    }
                    size="xl"
                    onClick={() => {
                      patch({ line });
                    }}
                  >
                    {t.receipt.lineLabel(
                      line.lineNo,
                      `${String(line.receivedQty)} ${uoms.data?.get(line.uomId) ?? ''}`,
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {draft.line === null ? null : (
        <>
          <section className="variance__section">
            <Card bordered>
              <Card.Body className="card-body variance__card">
                <strong>
                  {item.data === undefined
                    ? String(draft.line.itemId)
                    : `${item.data.itemCode} ${item.data.itemName}`}
                </strong>
                {item.isError ? (
                  <p className="variance__note">{t.receipt.itemLoadFailed}</p>
                ) : null}
                <p>{t.receipt.chosen(draft.line.lineNo, `${String(draft.line.receivedQty)} ${uom}`)}</p>
              </Card.Body>
            </Card>
            <Button
              variant="text"
              size="lg"
              onClick={() => {
                setDraft(emptyDraft);
              }}
            >
              {t.receipt.change}
            </Button>
          </section>

          <section className="variance__section">
            <h2>{t.known.legend}</h2>
            {known.isPending ? <p role="status">{t.known.loading}</p> : null}
            {known.isError ? <AlertBanner variant="error" title={t.known.loadFailed} /> : null}
            {known.data !== undefined && known.data.length === 0 ? (
              <p className="variance__note">{t.known.none}</p>
            ) : null}
            <ul className="variance__known">
              {(known.data ?? []).map((each) => (
                <li key={each.inboundVarianceId}>
                  {t.known.item(
                    types.data?.find((value) => value.code === each.varianceTypeCode)?.name ??
                      each.varianceTypeCode,
                    `${String(each.varianceQty)} ${uoms.data?.get(each.uomId) ?? ''}`,
                  )}
                </li>
              ))}
            </ul>
            {/* 담아 둔 것은 서버 목록에 없다. 없는 것으로 읽지 않게 함께 적는다. */}
            {pending === 0 ? null : (
              <AlertBanner variant="warning" title={t.known.pending(pending)} />
            )}
          </section>

          <section className="variance__section">
            <h2>{t.form.legend}</h2>
            <div className="variance__field">
              <label htmlFor="variance-type">{t.form.typeLabel}</label>
              <Select
                id="variance-type"
                placeholder={t.form.typePlaceholder}
                size="xl"
                value={draft.varianceTypeCode === '' ? null : draft.varianceTypeCode}
                onChange={(value) => {
                  patch({ varianceTypeCode: String(value) });
                }}
                options={(types.data ?? []).map((each) => ({
                  value: each.code,
                  label: each.name,
                }))}
              />
              {types.isError ? <p className="variance__note">{t.form.typeLoadFailed}</p> : null}
            </div>

            <TextField
              label={t.form.qtyLabel}
              inputMode="decimal"
              size="xl"
              fullWidth
              value={draft.varianceQty}
              onChange={(event) => {
                patch({ varianceQty: event.target.value });
              }}
              error={qtyMessage()}
            />
            {/* 방향은 유형이 말한다. 사람에게는 얼마인지만 묻는다. */}
            <p className="variance__note">{t.form.qtyNote}</p>
            {/* 예정 수량이 이 화면에 오지 않아 차이와 견주지 못한다. 감추지 않는다. */}
            <p className="variance__note">{t.form.noExpectedQty}</p>
            <NumberPad
              value={draft.varianceQty}
              onChange={(value) => {
                patch({ varianceQty: value });
              }}
              allowDecimal
            />

            <div className="variance__field">
              <label htmlFor="variance-reason">{t.form.reasonLabel}</label>
              <Select
                id="variance-reason"
                placeholder={t.form.reasonPlaceholder}
                size="xl"
                value={draft.reasonCode === '' ? null : draft.reasonCode}
                onChange={(value) => {
                  patch({ reasonCode: String(value) });
                }}
                options={(reasons.data ?? []).map((each) => ({
                  value: each.code,
                  label: each.name,
                }))}
              />
              {/* 사유를 모를 때 기록 자체가 막히면 안 된다. */}
              <p className="variance__note">{t.form.reasonOptional}</p>
              {reasons.isError ? (
                <p className="variance__note">{t.form.reasonLoadFailed}</p>
              ) : null}
            </div>

            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="variance__note">{t.noWorker}</p> : null}
            <Button
              className="variance__wide"
              variant="filled"
              size="2xl"
              disabled={!ready}
              onClick={() => {
                setAsking(true);
              }}
            >
              {t.submit}
            </Button>
          </section>
        </>
      )}

      {/* 수정도 삭제도 없다. 누르기 전에 그 사실을 묻는다. */}
      <Dialog
        open={asking}
        onClose={() => {
          setAsking(false);
        }}
        title={t.confirm.title}
        closeOnBackdropClick={false}
        footer={
          <>
            <Button
              variant="outlined"
              size="xl"
              onClick={() => {
                setAsking(false);
              }}
            >
              {t.confirm.cancel}
            </Button>
            <Button variant="filled" size="xl" onClick={() => void submit()}>
              {t.confirm.proceed}
            </Button>
          </>
        }
      >
        {t.confirm.body}
      </Dialog>
    </div>
  );
};
