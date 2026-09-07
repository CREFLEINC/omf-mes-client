import {
  AlertBanner,
  Button,
  Card,
  Progress,
  Select,
  Table,
  TextField,
} from '@crefle/web-ui';
import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useEffect, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { usePopIdentity } from '../../patterns/pop-identity';
import { popTouchClass } from '../../patterns/pop-touch';
import { drainReworkResults, enqueueReworkResult, pendingReworkResultCount } from './outbox';
import {
  useDispositionDecisions,
  useResultGate,
  useReworkSource,
  useReworkWorkOrders,
} from './queries';
import {
  EMPTY_QUANTITIES,
  quantityTotal,
  quantityVerdict,
  reworkDispositionProgress,
  toProductionResult,
  type QuantityDrafts,
  type QuantityKey,
} from './result';
import { useUomLookup } from './uom-lookup';

const quantityKeys: QuantityKey[] = ['goodQty', 'defectQty', 'holdQty', 'scrapQty'];

export const ReworkResultRegisterScreen = () => {
  const t = messages.reworkResultRegister;
  const { client } = useApiClient();
  const identity = usePopIdentity();
  const workOrders = useReworkWorkOrders();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeKey, setActiveKey] = useState<QuantityKey>('goodQty');
  const [drafts, setDrafts] = useState<QuantityDrafts>(EMPTY_QUANTITIES);
  const [queued, setQueued] = useState(false);
  const [queueError, setQueueError] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [pendingCount, setPendingCount] = useState(pendingReworkResultCount);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator.onLine);

  const selected = workOrders.data?.items.find((row) => row.workOrderId === selectedId) ?? null;
  const nonconformanceId = selected?.reworkSourceNonconformanceId ?? null;
  const source = useReworkSource(nonconformanceId);
  const dispositions = useDispositionDecisions(nonconformanceId);
  const gate = useResultGate(identity.terminalId, identity.processId);
  const uom = useUomLookup();
  const progress = reworkDispositionProgress(dispositions.data?.items ?? []);
  const total = quantityTotal(drafts);
  const verdict = quantityVerdict(total, progress.remaining);
  const remaining = Math.max(0, progress.remaining - total);
  useEffect(() => {
    setDrafts(EMPTY_QUANTITIES);
    setQueued(false);
    setQueueError(false);
    setRejected(false);
  }, [selectedId]);
  useEffect(() => {
    const drain = () => {
      setIsOnline(true);
      void drainReworkResults(client)
        .then((result) => {
          setPendingCount(pendingReworkResultCount());
          setRejected(result.rejected > 0);
          if (result.rejected > 0) setQueued(false);
        })
        .catch(() => setPendingCount(pendingReworkResultCount()));
    };
    const offline = () => setIsOnline(false);
    if (globalThis.navigator.onLine) drain();
    globalThis.addEventListener('online', drain);
    globalThis.addEventListener('offline', offline);
    return () => {
      globalThis.removeEventListener('online', drain);
      globalThis.removeEventListener('offline', offline);
    };
  }, [client]);
  const gateReason = gate.unidentified
    ? t.gateUnidentified
    : gate.checking
      ? t.gateChecking
      : gate.unavailable
        ? t.gateUnavailable
        : !gate.allowed
          ? t.gateDenied
          : identity.workerNo === null
            ? t.workerMissing
            : null;
  const canSave =
    selected !== null &&
    source.isSuccess &&
    dispositions.isSuccess &&
    progress.remaining > 0 &&
    (verdict === 'partial' || verdict === 'complete') &&
    gateReason === null &&
    !queued;
  const save = () => {
    if (!canSave || selected === null || identity.workerNo === null) return;
    try {
      enqueueReworkResult(identity.workerNo, toProductionResult(selected, drafts, new Date()));
    } catch {
      setQueueError(true);
      return;
    }
    setQueueError(false);
    setPendingCount(pendingReworkResultCount());
    setQueued(true);
    if (globalThis.navigator.onLine) {
      void drainReworkResults(client)
        .then((result) => {
          setPendingCount(pendingReworkResultCount());
          setRejected(result.rejected > 0);
          if (result.rejected > 0) setQueued(false);
        })
        .catch(() => setPendingCount(pendingReworkResultCount()));
    }
  };
  const reset = () => {
    setDrafts(EMPTY_QUANTITIES);
    setQueued(false);
    setQueueError(false);
    setRejected(false);
  };
  return (
    <main className="pop-shell pop-ui rework-result-screen" aria-labelledby="rework-result-title">
      <header className="pop-header">
        <h1 className="pop-title" id="rework-result-title">
          {t.title}
        </h1>
        {/*
         * 머리줄 왼쪽은 **맥락 값**이다 — 스펙 §3 의 `W/O-2026-R012 · FG-1001`.
         * ⛔ 「고르세요」 같은 안내문을 여기 두지 않는다 — 본문 목록이 이미 말한다.
         */}
        <p className="pop-context">
          {selected === null
            ? t.workOrderUnknown
            : t.headerContext(selected.workOrderNo, selected.itemCode ?? `#${selected.itemId}`)}
        </p>
        <p className="pop-context pop-context-right">
          <span>
            {identity.workerNo === null ? t.workerUnknown : t.workerLabel(identity.workerNo)}
          </span>
          <Chip variant="status" size="md" status={isOnline ? 'success' : 'warning'}>
            {isOnline ? messages.common.connection.online : messages.common.connection.offline}
          </Chip>
          <span>{t.pending(pendingCount)}</span>
        </p>
      </header>

      {/*
       * ⭐ **본문은 세로 네 구획이다** — 스펙 §3 이 ① 재작업 대상 120 · ② 실적 입력 280 ·
       *    ③ 결과 LOT 96 · ④ 진행 88 로 그렸고 그 합이 본문 예산 616 을 정확히 채운다(§3-1
       *    슬랙 0). 앞선 판은 좌우 2단이라 **왼쪽 절반을 목록이 상시 차지**했고, 남은 절반에
       *    네 구획을 넣느라 스펙의 세로 검산이 성립하지 않았다.
       *
       * ⭐ **목록은 고르기 «전»에만 선다.** §5-6 이 W/O 선택을 「**진입 시** — 내 재작업 W/O
       *    목록」으로 적었고, §3 도면에는 목록 구획이 없다 — 고른 뒤에는 본문이 온전히
       *    실적 입력의 것이다. 다른 W/O 로 옮기려면 ① 구획의 [ 변경 ] 으로 목록을 다시 편다
       *    (전례 `P-02-04` 의 대상 LOT 「변경」).
       */}
      {selected === null ? (
        <section className="pane" aria-label={t.workOrders}>
          <h2 className="pane-title">{t.workOrders}</h2>
          {workOrders.isError && <AlertBanner variant="error">{t.loadError}</AlertBanner>}
          {workOrders.isSuccess && workOrders.data.items.length === 0 && (
            <AlertBanner variant="info">{t.empty}</AlertBanner>
          )}
          {(workOrders.data?.items ?? []).length > 0 && (
            /*
             * 줄의 어느 칸을 눌러도 그 줄의 버튼을 대신 누른다 — POP 목록 정본이다
             * (표 · 선택 칸 없음 · 줄 전체가 누르는 자리 · `913a82c`).
             */
            <div
              role="presentation"
              className="pop-row-target"
              onClick={(event) => {
                const from = event.target as HTMLElement;
                if (from.closest('.pop-row-select') !== null) return;
                from.closest('tr')?.querySelector<HTMLButtonElement>('.pop-row-select')?.click();
              }}
            >
              <Table
                aria-label={t.workOrderCaption}
                density="comfortable"
                getRowId={(row) => String(row.workOrderId)}
                rows={workOrders.data?.items ?? []}
                columns={[
                  {
                    key: 'workOrder',
                    header: t.columns.workOrder,
                    align: 'center',
                    render: (row) => (
                      <button
                        type="button"
                        className={`pop-row-select ${popTouchClass('normal')}`}
                        aria-label={t.selectRow(row.workOrderNo)}
                        onClick={() => setSelectedId(row.workOrderId)}
                      >
                        <span>{row.workOrderNo}</span>
                      </button>
                    ),
                  },
                  {
                    key: 'item',
                    header: t.columns.item,
                    align: 'center',
                    render: (row) => row.itemCode ?? `#${row.itemId}`,
                  },
                  {
                    key: 'quantity',
                    header: t.columns.quantity,
                    align: 'center',
                    width: '140px',
                    render: (row) => row.orderQty,
                  },
                ]}
              />
            </div>
          )}
        </section>
      ) : (
        /*
         * ⭐ **본문 한 겹이 스크롤한다.** 스펙 §3-1 의 세로 예산은 1024×768 에서 정확히
         *    맞지만(① 120 + ② 280 + ③ 96 + ④ 88 = 584), 그보다 낮은 창에서는 넷을 다
         *    세울 수 없다. 구획마다 스크롤시키면 한 구획이 90px 로 눌려 «그 안에서» 또
         *    잘린다(실측 — 실적 입력이 라벨 줄만 남았다. 사용자 지적).
         *
         *    머리줄과 액션바는 제자리에 두고 **본문만** 한 겹으로 스크롤한다 — 대상 해상도
         *    에서는 예산이 맞아 스크롤이 서지 않는다.
         *
         * ⚠ `pop-fixed` 는 「내용만큼만」이 아니라 **「POP 규격의 높이 배분에서 빠진다」**는
         *    뜻으로 쓴다 — 그 규칙이 이 겹에 걸리면 `overflow: hidden` 이 스크롤을 죽인다.
         *    실제 높이는 바로 아래 `pop.css` 규칙이 정한다.
         */
        <div className="pop-fixed rework-result-body">
              {/*
               * ⭐ **`pop-section` 을 함께 붙인다.** DS `Card` 는 여백을 «본문 상자»에만 주고
               *    그 위쪽이 0 이라, 카드에 직접 놓인 제목이 모서리에 붙어 선다(사용자 지적).
               *    POP 규격이 그 자리를 고치는 규칙을 이미 갖고 있다 — 여백을 카드가 갖게 하고
               *    본문 상자의 것은 턴다.
               */}
              <Card bordered className="pop-section rework-target-card">
                <Card.Body>
                  <h2 className="pane-title">{t.target}</h2>
                  {(source.isError || dispositions.isError) && (
                    <AlertBanner variant="error">{t.loadError}</AlertBanner>
                  )}
                  <dl className="pop-figures">
                    <div>
                      <dt>{t.sourceLot}</dt>
                      <dd>{selected.reworkSourceLotId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t.sourceWorkOrder}</dt>
                      <dd>{selected.reworkSourceWorkOrderId ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>{t.nonconformance}</dt>
                      <dd>
                        {source.data
                          ? `${source.data.nonconformanceNo} · ${source.data.description}`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt>{t.disposition}</dt>
                      <dd>{progress.target}</dd>
                    </div>
                  </dl>

                  {/*
                   * ⚠ **스펙에 없는 조작이다.** §3 의 ① 은 읽기 전용 세 줄이고 §5-6 액션표에도
                   *    「변경」이 없다 — 스펙은 W/O 고르기가 「진입 시」 한 번으로 끝난다고 본다.
                   *    목록을 고른 뒤 접게 되면서 잘못 고른 것을 되돌릴 길이 없어져 우리가
                   *    더했다.
                   *
                   * ⭐ **자리는 구획의 오른쪽 «아래»다**(사용자 결정). 오른쪽 위에 두면 세 줄이
                   *    왼쪽으로 몰리고 그 옆이 통째로 비어 보인다 — 120px 짜리 구획에서 72px
                   *    버튼이 머리줄과 같은 높이를 차지하기 때문이다.
                   */}
                  <div className="rework-target-foot">
                    <Button variant="outlined" size="2xl" onClick={() => setSelectedId(null)}>
                      {t.changeWorkOrder}
                    </Button>
                  </div>
                </Card.Body>
              </Card>

              {/*
               * ⭐ **네 구획이 모두 상자다** — 스펙 §3 이 ①②③④를 전부 `┌ … ┐` 로 그렸다.
               *    §7 이 `Card` 를 ① 에만 적은 것은 «어떤 DS 부품을 쓰는가»의 표이기 때문이고,
               *    구획 상자는 화면 골격이라 그 표에 나오지 않는다 — 자매 화면(`P-02-01`)도
               *    같은 도면을 세 구획의 실제 테두리로 구현했다.
               */}
              <Card bordered className="pop-section rework-input-card">
                <Card.Body>
                  {/*
                   * ⭐ **제목은 카드 본문 바로 아래다** — ①③④와 같은 자리다. 앞선 판은 이
                   *    제목만 «입력 칸 묶음 안»에 있어, 좌우 2단(칸 · 키패드)의 왼쪽 칸 폭에
                   *    갇히고 칸들과 같은 줄에서 시작했다 — 네 구획 중 이것만 제목이 안쪽으로
                   *    들어가 보였다(사용자 지적).
                   */}
                  <h2 className="pane-title">{t.quantities.title}</h2>

                  <div className="rework-result-input">
                    <div className="rework-result-fields">

                  {/*
                   * ⭐ **네 칸을 2×2 로 세운다** — 스펙 §3 ②의 「양품 [ ] 불량 [ ] / 보류 [ ]
                   *    폐기 [ ]」 배치다. 세로로 넷을 쌓으면 ② 구획이 280px 예산을 넘어 아래의
                   *    ③·④가 밀린다(§3-1 슬랙 0).
                   */}
                  <div className="rework-qty-grid">
                    {quantityKeys.map((key) => (
                      <TextField
                        key={key}
                        /*
                         * ⚠ **크기를 넘겨야 한다** — 안 넘기면 DS 기본 40px 으로 그려져 POP 터치
                         *    하한 56 에도 미달한다(입력류는 `xl`=60 이 최대다 · 전례 `P-02-04`).
                         */
                        size="xl"
                        label={t.quantities[key]}
                        value={drafts[key]}
                        inputMode="decimal"
                        readOnly
                        fullWidth
                        /*
                         * 단위를 칸 «안» 오른쪽에 붙인다 — 전례 `P-02-04` 의 「양품수량 [ 120 ] EA」.
                         * ⛔ 이름을 못 받으면 아무것도 붙이지 않는다(숫자 식별자를 내지 않는다).
                         */
                        trailingIcon={uom.labelOf(selected.uomId) ?? undefined}
                        onFocus={() => setActiveKey(key)}
                      />
                    ))}
                  </div>

                  {/*
                   * ⭐ **합계는 ② 안이다** — 스펙 §3 ②의 「합계 160 / 160」. 이번 입력의 몫이고,
                   *    ④의 진행은 이 W/O 의 누계다. 둘을 한 자리에 두면 어느 숫자가 방금 친
                   *    것인지 알 수 없다.
                   */}
                  {/*
                   * §7 이 합계를 **`Chip`** 으로 적었다(「합계 표시 | Chip + AlertBanner」).
                   * 넘침·부족을 «말하는» 것은 아래 배너이므로 칩은 숫자만 들고 색으로만 거든다.
                   */}
                  <p className="rework-qty-total">
                    <Chip
                      variant="status"
                      size="md"
                      status={
                        verdict === 'exceeded'
                          ? 'error'
                          : verdict === 'complete'
                            ? 'success'
                            : 'info'
                      }
                    >
                      {`${t.total} ${String(total)} / ${String(progress.remaining)}`}
                    </Chip>
                  </p>
                  {/*
                   * ⭐ **스펙 §3 ②가 이 안내를 구획 «안»에 둔다** — 「재작업 후 다시 불량이면
                   *    「불량」입니다」. §7 이 안내를 `AlertBanner`(info)로 지정하므로 보조
                   *    문구(`field-note`)가 아니라 배너로 세운다. ⛔ 결과 LOT 이야기는 여기서
                   *    빼고 ③ 구획이 맡는다 — 스펙이 그 둘을 다른 구획으로 갈랐다.
                   */}
                  <AlertBanner variant="info">{t.reworkHint}</AlertBanner>

                  <label>{t.defectCode}</label>
                  {/* ⚠ 크기를 넘긴다 — 안 넘기면 DS 기본(40)에 POP 규칙이 트리거만 늘려 칸이 넘친다. */}
                  <Select
                    aria-label={t.defectCode}
                    size="xl"
                    options={[]}
                    placeholder={t.defectCodePlaceholder}
                    disabled
                  />
                  <p className="field-note">{t.defectCodeReason}</p>
                </div>
                {/*
                  * ⭐ **POP 이 공유하는 키패드를 쓴다**(`@omf-mes/ui`). DS `NumberPad` 는 키가
                  *    작고(60px — 현장 터치 하한 72 에 못 미친다) «전체 잠금»만 있어 키마다
                  *    조건을 걸 수 없다 — 칸이 비었는데도 [ C ]·[ ⌫ ]가 눌렸다(사용자 지적).
                  *
                  * ⚠ 마지막 줄은 [ C ] · [ 0 ] · [ ⌫ ] 그대로다 — 부품이 «지움»을 끝에 그리므로
                  *   자리는 `pop.css` 가 되돌린다(전례 `P-05-01`·`P-02-04`).
                  */}
                <NumericKeypad
                  className="rework-result-pad"
                  label={t.quantities.keypadLabel}
                  value={drafts[activeKey]}
                  /* 수량은 `numeric(20,6)` 이라 소수를 받는다(스펙 §4-B). */
                  allowDecimal
                  decimalLabel={t.quantities.decimalKey}
                  max={progress.remaining}
                  /* 스펙 §7 이 「큰 터치 타겟」을 지정한다 — 64와 72 사이에 단이 없어 `2xl` 이다. */
                  keySize="2xl"
                  backspaceLabel={t.quantities.backspace}
                  backspaceGlyph="⌫"
                  clearLabel={t.quantities.clearGlyph}
                  onChange={(value) => setDrafts((current) => ({ ...current, [activeKey]: value }))}
                />
                  </div>
                </Card.Body>
              </Card>

              {/*
               * ③ 결과 LOT — **스펙 §3 이 독립 구획으로 둔 자리다.** 재작업은 같은 물건을
               * 고치는 것이라 LOT 이 갈리지 않는데(§5-4), 그 사실을 넣은 수량으로 즉시 보인다.
               * ⛔ 접지 않는다 — 수량을 넣으면 바로 바뀌어야 한다(§3 ⚠ E-4).
               */}
              <Card bordered className="pop-section rework-lot-card">
                <Card.Body>
                  <section className="rework-result-lot" aria-label={t.resultLot.title}>
                <h2 className="pane-title">{t.resultLot.title}</h2>
                <p>
                  {t.resultLot.good(drafts.goodQty === '' ? '0' : drafts.goodQty)} ·{' '}
                  {t.resultLot.keep}
                </p>
                <p>
                  {t.resultLot.rest(
                    drafts.defectQty === '' ? '0' : drafts.defectQty,
                    drafts.holdQty === '' ? '0' : drafts.holdQty,
                  )}
                </p>
                  </section>
                </Card.Body>
              </Card>

              {/* ④ 진행 — 이 W/O 의 누계다. ②의 합계가 이번 입력이라면 이쪽은 지금까지의 몫이다. */}
              <Card bordered className="pop-section rework-progress-card">
                <Card.Body>
                  <section className="rework-result-summary" aria-label={t.progress.title}>
                <h2 className="pane-title">{t.progress.title}</h2>
                <Progress
                  max={Math.max(progress.target, 1)}
                  tone={
                    verdict === 'exceeded'
                      ? 'error'
                      : verdict === 'complete'
                        ? 'success'
                        : 'warning'
                  }
                  value={progress.completed + total}
                  valueText={`${t.progress.line(
                    String(progress.completed + total),
                    String(progress.target),
                  )} · ${t.remaining} ${String(remaining)}`}
                  showValue
                />
                {verdict === 'empty' && (
                  <AlertBanner variant="error">{t.emptyQuantity}</AlertBanner>
                )}
                {verdict === 'exceeded' && (
                  <AlertBanner variant="error">{t.exceeded(progress.remaining)}</AlertBanner>
                )}
                {verdict === 'partial' && (
                  <AlertBanner variant="warning">{t.partial(remaining)}</AlertBanner>
                )}
                {queued && <AlertBanner variant="success">{t.queued}</AlertBanner>}
                {queueError && <AlertBanner variant="error">{t.queueError}</AlertBanner>}
                {rejected && <AlertBanner variant="error">{t.rejected}</AlertBanner>}
                  </section>
                </Card.Body>
              </Card>
        </div>
      )}

      {/*
       * ⭐ **액션바는 화면 바닥에 붙는 띠다**(스펙 §3 — 헤더 64 + 본문 616 + 액션바 88 = 768).
       *
       * ⛔ 구획 «안»에 두면 그 띠가 서지 않는다 — POP 규격의 액션바 규칙은 화면의 **최상위
       *    자식**만 겨냥한다(`.pop-ui > [class*='action']`). 앞선 판은 오른쪽 구획 안에 있어
       *    본문의 일부로 흘렀고, 고르기 전에는 아예 없었다.
       *
       * ⭐ **고르기 전에도 자리를 지킨다** — 조작이 사라졌다 나타나면 본문이 그만큼 움직인다.
       */}
      <div className="pop-action-bar">
        <div className="pop-action-note">{gateReason && <p>{gateReason}</p>}</div>
        <Button size="2xl" variant="outlined" disabled={selected === null} onClick={reset}>
          {t.reset}
        </Button>
        <Button size="2xl" disabled={!canSave} onClick={save}>
          {t.save}
        </Button>
      </div>
    </main>
  );
};
