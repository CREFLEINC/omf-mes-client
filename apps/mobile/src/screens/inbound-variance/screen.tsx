import {
  AlertBanner,
  Chip,
  Dialog,
  Icon,
  Radio,
  RadioGroup,
  Select,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import { useAdvanceTo } from '../../patterns/advance-to';
import { Button } from '../../patterns/button';
import { Card } from '../../patterns/card';
import { DockedNumberPad } from '../../patterns/docked-number-pad';
import { useBackStep } from '../../patterns/back-step';
import { BottomActionBar } from '../../patterns/bottom-action-bar';
import { useCodeValues } from '../../patterns/code-values';
import { uomLabelOf, useItem, useUomCodes } from '../../patterns/masters';
import { useOutbox } from '../../patterns/outbox';
import { QtyPanel } from '../../patterns/qty-panel';
import { ResultHead } from '../../patterns/result-head';
import { TaskHeader } from '../../patterns/task-header';
import { useScreenTitle } from '../../patterns/screen-title';
import { useWorkerSession } from '../../patterns/worker-session';
import { FailureBanner } from '../../patterns/failure-banner';
import { useLoadFailure } from '../../patterns/load-failure';
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
const required = messages.common.required;

type Outcome = 'queued' | 'sent' | 'rejected';

const emptyDraft: VarianceDraft = {
  line: null,
  varianceTypeCode: '',
  varianceQty: '',
  reasonCode: '',
};

export const InboundVarianceScreen = () => {
  useScreenTitle(t.title);
  const failureText = useLoadFailure();

  const { enqueue, flush, countPending, isRejected } = useOutbox();
  const { worker } = useWorkerSession();

  const [search, setSearch] = useState('');
  const [receipt, setReceipt] = useState<InboundReceipt | null>(null);
  const [draft, setDraft] = useState<VarianceDraft>(emptyDraft);
  /* 숫자판은 칸을 눌렀을 때만 선다. 늘 띄우면 사유 선택과 등록 단추를 덮는다. */
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  /*
   * 보내는 중인가. 상태로 두면 같은 틱에 두 번 누른 것을 막지 못한다 - 다시 그리기 전에
   * 두 번째가 들어와 멱등키가 다른 두 건이 담기고, 서버가 흡수하지 못해 두 건이 기록된다.
   */
  const inFlight = useRef(false);
  const formSection = useRef<HTMLDivElement | null>(null);

  const patch = (next: Partial<VarianceDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  /* 세로 화면이라 채운 구획이 자리를 차지한 채 남으면 다음에 할 일이 접힌 자리에 있다. */
  useAdvanceTo(draft.line !== null, formSection);

  /*
   * 뒤로가기는 고른 라인을 먼저 놓는다. 두지 않으면 수량을 적던 사람이 한 번에 작업 목록까지
   * 나가 입하를 다시 찾아야 한다.
   */
  useBackStep(draft.line !== null, () => {
    setDraft(emptyDraft);
  });

  const receipts = useInboundReceipts(search);
  const lines = useReceiptLines(receipt?.inboundReceiptId ?? null);
  const known = useKnownVariances(draft.line?.inboundReceiptLineId ?? null);
  const types = useCodeValues(INBOUND_VARIANCE_TYPE);
  const reasons = useCodeValues(INBOUND_VARIANCE_REASON);
  const item = useItem(draft.line?.itemId ?? null);
  const uoms = useUomCodes(true);
  const uomOf = (uomId: number | null | undefined) => uomLabelOf(uoms.data, uomId);

  const uom = uomOf(draft.line?.uomId);
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
          <ResultHead tone="success" title={t.sent.title} description={t.sent.description} />
        ) : null}
        {outcome === 'queued' ? (
          <ResultHead tone="pending" title={t.queued.title} description={t.queued.description} />
        ) : null}
        {outcome === 'rejected' ? (
          <AlertBanner variant="error" title={t.rejected.title}>
            {t.rejected.description}
            <Link to="/rejections">{t.rejected.action}</Link>
          </AlertBanner>
        ) : null}
        <BottomActionBar primary={{ label: t.another, onClick: restart }} />
      </div>
    );
  }

  /*
   * 「오류 등록」이 잠긴 이유(공유계약 G-1). 위에서부터 처음 비어 있는 것 하나 - 유형, 그다음 수량.
   * 사유는 비워도 된다.
   */
  const submitLock = ready
    ? undefined
    : draft.varianceTypeCode === ''
      ? t.form.typeRequired
      : qtyProblem(draft.varianceQty) !== null
        ? /* 무엇이 틀렸는지는 수량 판 아래가 말한다. 바에서 같은 말을 되풀이하지 않는다. */
          draft.varianceQty === ''
          ? t.form.empty
          : t.form.qtyFix
        : undefined;

  /*
   * 칸을 담은 구획이 사라지면 판도 함께 진다. 열린 채로 두면 다음 회차에 판이 계속 mount 라
   * 기기 자판 내리기와 칸 끌어올리기가 다시 돌지 않는다.
   */
  const padOpen = keypadOpen && draft.line !== null;

  return (
    <div
      className={
        padOpen
          ? 'variance with-bottom-action-bar docked-pad-open'
          : 'variance with-bottom-action-bar'
      }
    >
      {/*
       * 대상 라인을 고르면 입하 찾기를 걷고 계기판 작업 카드로 올린다. 오류를 적는 동안 어느 입하의
       * 어느 라인인지가 늘 같은 자리에 있고, 찾기 구획만큼 화면이 짧아진다. 다른 대상은 카드 아이콘.
       */}
      {draft.line === null ? null : (
        <TaskHeader
          fields={[]}
          action={{
            icon: 'swap_horiz',
            label: t.receipt.change,
            onClick: () => {
              setDraft(emptyDraft);
            },
          }}
          /* 적는 법과 이 화면이 못 하는 것. 등록을 막지 않는 설명이라 「자세히」에 둔다. */
          details={
            <>
              <p className="variance__note">{t.form.qtyNote}</p>
              {/* 예정 수량이 이 화면에 오지 않아 차이와 견주지 못한다. 감추지 않는다. */}
              <p className="variance__note">{t.form.noExpectedQty}</p>
              {/* 사유가 비어도 기록은 막히지 않는다. 모를 때 적지 못하면 오류가 남지 않는다. */}
              <p className="variance__note">{t.form.reasonOptional}</p>
            </>
          }
        >
          <div className="variance__card">
            <strong className="variance__item">
              {item.data === undefined
                ? String(draft.line.itemId)
                : `${item.data.itemCode} ${item.data.itemName}`}
            </strong>
            {item.isError ? <p className="variance__note">{t.receipt.itemLoadFailed}</p> : null}
            <p className="variance__chosen">
              {t.receipt.chosen(draft.line.lineNo, `${String(draft.line.receivedQty)} ${uom}`)}
            </p>
            {receipt === null ? null : (
              <p className="variance__receipt">{receipt.inboundReceiptNo}</p>
            )}
          </div>
        </TaskHeader>
      )}

      {draft.line !== null ? null : (
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
          {receipts.isError ? (
            <FailureBanner
              variant="error"
              title={failureText(receipts.error, t.receipt.loadFailed)}
            />
          ) : null}
          {receipts.isSuccess && receipts.data.length === 0 ? (
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
              {lines.isSuccess && lines.data.length === 0 ? (
                <AlertBanner variant="warning" title={t.receipt.linesNone} />
              ) : null}
              <ul className="variance__lines">
                {(lines.data ?? []).map((line: InboundReceiptLine) => (
                  <li key={line.inboundReceiptLineId}>
                    <Card
                      bordered
                      interactive
                      onClick={() => {
                        patch({ line });
                      }}
                    >
                      <Card.Body className="card-body variance__line">
                        <strong>{t.receipt.lineNo(line.lineNo)}</strong>
                        <p>
                          {t.receipt.lineQty(`${String(line.receivedQty)} ${uomOf(line.uomId)}`)}
                        </p>
                        {draft.line?.inboundReceiptLineId === line.inboundReceiptLineId ? (
                          <Chip status="success">{t.receipt.linePicked}</Chip>
                        ) : null}
                      </Card.Body>
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {draft.line === null ? null : (
        <>
          <section className="variance__section">
            <h2>{t.known.legend}</h2>
            {known.isPending ? <p role="status">{t.known.loading}</p> : null}
            {known.isError ? <AlertBanner variant="error" title={t.known.loadFailed} /> : null}
            {known.isSuccess && known.data.length === 0 ? (
              <p className="variance__note">{t.known.none}</p>
            ) : null}
            <ul className="variance__known">
              {(known.data ?? []).map((each) => (
                <li key={each.inboundVarianceId}>
                  {t.known.item(
                    types.data?.find((value) => value.code === each.varianceTypeCode)?.name ??
                      each.varianceTypeCode,
                    `${String(each.varianceQty)} ${uomOf(each.uomId)}`,
                  )}
                </li>
              ))}
            </ul>
            {/* 담아 둔 것은 서버 목록에 없다. 없는 것으로 읽지 않게 함께 적는다. */}
            {pending === 0 ? null : (
              <AlertBanner variant="warning" title={t.known.pending(pending)} />
            )}
          </section>

          <section className="variance__section" ref={formSection}>
            {/* 무엇에 대한 오류인지는 위 작업 카드가, 무엇을 적는지는 칸 이름이 말한다. */}
            <h2 className="variance__hidden">{t.form.legend}</h2>
            {/* 세 값 고정 그룹이다. 펼침 목록은 열고 고르고 닫는 세 동작이라 장갑에 불리하다. */}
            <div className="variance__choices">
              <p id="variance-type-label">{required(t.form.typeLabel)}</p>
              <RadioGroup
                name="variance-type"
                aria-labelledby="variance-type-label"
                value={draft.varianceTypeCode === '' ? undefined : draft.varianceTypeCode}
                onChange={(value) => {
                  patch({ varianceTypeCode: value });
                }}
              >
                {(types.data ?? []).map((each) => (
                  <Radio key={each.code} value={each.code}>
                    {each.name}
                  </Radio>
                ))}
              </RadioGroup>
            </div>
            {types.isError ? <p className="variance__note">{t.form.typeLoadFailed}</p> : null}

            {/* 방향은 유형이 말한다. 사람에게는 얼마인지만 묻는다(적는 법은 「자세히」). */}
            <QtyPanel
              id="variance-qty"
              label={required(t.form.qtyLabel)}
              value={draft.varianceQty}
              unit={uom}
              padLabel={t.form.pad}
              onChange={(value) => {
                patch({ varianceQty: value });
              }}
              onFocus={() => {
                setKeypadOpen(true);
              }}
              error={qtyMessage()}
            />

            <div className="variance__field">
              <label htmlFor="variance-reason">{t.form.reasonLabel}</label>
              <Select
                id="variance-reason"
                placeholder={t.form.reasonPlaceholder}
                size="lg"
                value={draft.reasonCode === '' ? null : draft.reasonCode}
                onChange={(value) => {
                  patch({ reasonCode: String(value) });
                }}
                options={(reasons.data ?? []).map((each) => ({
                  value: each.code,
                  label: each.name,
                }))}
              />
              {reasons.isError ? <p className="variance__note">{t.form.reasonLoadFailed}</p> : null}
            </div>

            {saveFailed ? (
              <AlertBanner variant="error" title={t.saveFailed.title}>
                {t.saveFailed.description}
              </AlertBanner>
            ) : null}
            {worker === null ? <p className="variance__note">{t.noWorker}</p> : null}
          </section>

          {/* 수정도 삭제도 없다. 단추 바로 위에 늘 적어 두고, 누르면 한 번 더 묻는다. */}
          <BottomActionBar
            prompt={
              <p className="variance__irreversible">
                <Icon name="info" size={16} />
                <span>{t.form.irreversible}</span>
              </p>
            }
            primary={{
              label: t.submit,
              disabled: !ready,
              lockReason: submitLock,
              onClick: () => {
                setAsking(true);
              },
            }}
          />
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
            {/*
             * 되돌릴 수 없는 등록의 마지막 단추라 핵심 액션 규격(72px)이다. 두 단추가 나란히 서므로
             * 높이를 맞춘다.
             */}
            <Button
              variant="outlined"
              size="2xl"
              onClick={() => {
                setAsking(false);
              }}
            >
              {t.confirm.cancel}
            </Button>
            <Button variant="filled" size="2xl" onClick={() => void submit()}>
              {t.confirm.proceed}
            </Button>
          </>
        }
      >
        {t.confirm.body}
      </Dialog>

      {!padOpen ? null : (
        <DockedNumberPad
          head={t.form.qtyLabel}
          fieldId="variance-qty"
          value={draft.varianceQty}
          onChange={(value) => {
            patch({ varianceQty: value });
          }}
          onClose={() => {
            setKeypadOpen(false);
          }}
          allowDecimal
        />
      )}
    </div>
  );
};
