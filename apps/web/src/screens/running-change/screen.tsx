import { AlertBanner, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';

import { CurrentInputs } from './current-inputs';
import { LoadErrorBanner, describeLoadError } from './load-error-banner';
import { useCurrentMold } from './mold';
import { toReplacementConsumption } from './post-request';
import { useOutbox } from './outbox';
import { useCurrentInputs } from './queries';
import { ReplacePanel } from './replace-panel';
import { type ScanOutcome, type ScannedPart } from './scan';
import { ScanField } from './scan-field';
import { useScanLookup } from './scan-queries';
import { readWorkOrderId } from './screen-params';
import { useOpenWorkSession } from './session';
import { useTerminalGate } from './terminal-gating';
import { useReferenceLabels } from './reference-labels';
import { toApiError } from '../../patterns/request';

const t = messages.runningChange;

/** 스캔 한 번의 결과를 사람의 말로 옮긴다. 실패도 성공과 **같은 자리**에 선다. */
const describeOutcome = (outcome: ScanOutcome): string => {
  switch (outcome.kind) {
    case 'part':
      return t.scan.outcomes.part(outcome.code, outcome.part.lotNo);
    case 'ambiguous':
      return t.scan.outcomes.ambiguous(outcome.count);
    case 'not-found':
      return t.scan.outcomes.notFound(outcome.code);
  }
};

/**
 * P-02-11 컨테이너 — **POP(현장 단말) 화면이라 관리웹 셸을 쓰지 않는다.**
 *
 * 사이드바·상단 바는 마우스로 메뉴를 오가는 사람을 위한 것이고, 이 화면 앞에 선 사람은
 * 설비를 돌린 채 장갑을 낀 손으로 부품을 간다. 그래서 `AppLayout` 밖에 서서 자기 `<main>`을
 * 직접 렌더한다.
 *
 * ## 이 화면이 하는 것과 하지 않는 것
 *
 * | | |
 * | --- | --- |
 * | 한다 | 현재 투입 표시 · 현재 금형 표시 · 신규 부품 LOT 스캔 · 교체 대상·수량 입력 · **교체 등록** |
 * | 하지 않는다 | 계획 분할 지정(§5-5 — 관리웹·시스템 자동) · 생산LOT 분할 · 교체 이력 화면(§8 미결 4) |
 *
 * ⛔ **교체는 지우지 않고 잇는다**(§5-2). 이전 투입은 실제로 쓰였고 그 시점까지의 제품에
 * 들어갔으므로 **남긴 채** 새 투입을 잇는다 — 정정(`correctsConsumptionId`)과 다른 개념이고,
 * 둘을 섞으면 이력이 왜곡된다.
 *
 * ⛔ **설비를 멈추지 않는다.** 화면이 세션을 닫거나 열지 않는다 — 같은 세션 안에서 일어나는
 * 일이다(§5-4).
 *
 * ⚠ **《현재 생산LOT》 구획이 아직 없다.** 「지금 이 생산LOT」을 고를 축이 계약에 없어 설계팀에
 * 물었다(omf-mes#397 ①). 모르는 것을 지어내 채우지 않는다.
 */
export const RunningChangeScreen = () => {
  const [searchParams] = useSearchParams();
  const workOrderId = readWorkOrderId(searchParams);
  /*
   * 단말·공정·사번은 **셸이 아는 것**이라 주소가 아니라 컨텍스트로 온다(`patterns/pop-identity`).
   * 채우는 자리가 아직 없어 지금은 전부 `null`이고, 화면은 그 상태를 사유와 함께 보인다 —
   * 모르는 것을 통과로 처리하지 않는다(F-6).
   */
  const { terminalId, processId, workerNo } = usePopIdentity();

  const titleId = useId();

  const current = useCurrentInputs(workOrderId);
  const session = useOpenWorkSession(workOrderId);
  const mold = useCurrentMold(session.moldId);
  /* 교체도 자재 투입이므로 `P-02-03`과 같은 플래그를 쓴다(§5-1). */
  const gate = useTerminalGate(terminalId, processId);

  const [part, setPart] = useState<ScannedPart | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [qty, setQty] = useState('');
  const [recorded, setRecorded] = useState(false);

  const scan = useScanLookup();
  /*
   * 오프라인 폴백(공유계약 C-1). **담는 것이 곧 성공이다** — 통신을 기다리지 않고, 미전송
   * 건수를 헤더가 상시 낸다(C-1 #2·#4).
   */
  const outbox = useOutbox();

  /*
   * 이름 풀이. **화면에 선 번호만큼만** 조회한다 — 현재 투입 줄과 읽어 담은 부품이 그
   * 모집단이다. 어느 판정에도 쓰이지 않고 읽을 수 있게 하는 데만 쓴다.
   */
  const labels = useReferenceLabels(
    [...current.rows.map((row) => row.itemId), ...(part === null ? [] : [part.itemId])],
    [...current.rows.map((row) => row.lotId), ...(part === null ? [] : [part.lotId])],
  );

  const handleScan = (code: string): void => {
    /*
     * ⭐ **읽는 순간 앞 회차는 끝난다.** 「담았습니다」도 거부 배너도 지난 회차의 사실이라,
     * 남겨 두면 방금 읽은 것이 담긴 것으로 · 방금 담은 것이 거부된 것으로 읽힌다.
     *
     * ⛔ **큐를 비우는 것이 아니다**(`clearResults`) — 아직 서버에 닿지 않은 건은 그대로
     * 남아 계속 나가고, 미전송 건수도 그대로 선다.
     */
    outbox.clearResults();
    setRecorded(false);

    scan.mutate(code, {
      onSuccess: (outcome) => {
        /*
         * 담긴 것이 하나뿐이라 **덮어쓴다** — 다시 읽는 것이 곧 고쳐 읽는 것이다.
         *
         * ⛔ **집지 못했으면 앞 부품을 지운다.** 남겨 두면 「여러 건이 걸렸습니다」가 뜬 채로
         * **앞서 읽은 부품이 등록 가능한 상태로 남는다** — 화면이 고르지 않기로 한 것을
         * 앞 회차의 선택을 유지하는 방식으로 사실상 골라 버리는 셈이고, 교체는 지우지 않고
         * 잇는 것이라 그 잘못이 그대로 계보에 남는다(§5-2).
         */
        setPart(outcome.kind === 'part' ? outcome.part : null);
      },
      /* 조회가 실패한 것도 「집지 못한 것」이다 — 무엇을 담고 있는지 모르는 채로 두지 않는다. */
      onError: () => {
        setPart(null);
      },
    });
  };

  /**
   * 교체 한 건을 담는다.
   *
   * ⛔ **보내기 직전에 본문을 다시 만든다.** 버튼 잠금이 이미 막아 둔 길이지만, 그것이 뚫려도
   * 갖춰지지 않은 값이 원장에 실리지 않아야 한다 — 교체는 지우지 않고 잇는 것이라 잘못
   * 실리면 되돌릴 방법이 없다(§5-2 · B-3).
   *
   * ⭐ **게이트를 여기서 한 번 더 본다.** 잠금을 버튼에만 두면 버튼을 지나지 않는 경로가
   * 생겼을 때 **닫힌 단말에서 교체가 그대로 기록된다**. 이것이 방어는 아니다(F-1 — 집행은
   * 서버의 403). 오조작을 줄이는 장치이고, 줄이려면 실제로 조작이 일어나는 자리에 있어야 한다.
   */
  const submit = (): void => {
    if (workerNo === null || gate.verdict !== 'allowed') return;

    const body = toReplacementConsumption({
      workOrderId,
      part,
      replacedConsumptionId: selectedTargetId,
      qty,
      workSessionId: session.workSessionId,
      occurredAt: new Date(),
    });
    if (body === null) return;

    /*
     * ⭐ **큐에 담는 것이 곧 성공이다**(C-1 #2). 작업자는 설비를 돌린 채 다음 일로 넘어가고,
     * 보내는 일은 outbox 가 뒤에서 한다. 서버에 닿지 않은 사실은 **헤더의 미전송 건수**가
     * 상시 말한다(C-1 #4 — 이 표시가 위 결정의 전제다).
     */
    outbox.enqueue(workerNo, body);
    setRecorded(true);
    /* 담은 뒤에는 이 회차의 입력을 비운다 — 남겨 두면 같은 교체가 두 번 담긴다. */
    setPart(null);
    setSelectedTargetId(null);
    setQty('');
  };

  /*
   * 서버가 받아 준 건이 있으면 《현재 투입》을 다시 읽는다 — 새 줄이 목록에 서야 이전 투입에
   * 「교체됨」이 붙고, 같은 부품을 또 갈 때 그 줄을 고를 수 있다.
   */
  const acceptedCount = outbox.accepted.length;
  const refetchCurrent = current.refetch;

  useEffect(() => {
    if (acceptedCount === 0) return;

    refetchCurrent();
    /*
     * ⚠ **건수만 본다.** `accepted` 배열을 그대로 의존성에 두면 매 렌더 새 참조라 효과가
     * 끝없이 돌고, 그때마다 조회가 나가 단말이 요청을 쏟아 낸다. 이 효과가 봐야 하는 것은
     * 「받아 준 건이 늘었는가」 하나다.
     */
  }, [acceptedCount, refetchCurrent]);

  const outcome = scan.data;
  const rejection = outbox.rejections.at(-1);

  return (
    /*
     * **표제가 본문의 이름이 된다.** 셸이 있는 화면은 셸이 본문 이름을 주지만 이 화면에는
     * 줄 사람이 없다 — 이름 없는 랜드마크로 남으면 무엇인지 알 수 없다.
     */
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrderId !== null && <p className="pop-context">{t.header.workOrder(workOrderId)}</p>}

        {/*
         * ⚠ **없을 때도 말한다.** 「세션 없음」은 정상 상태이고(§6), 「단말 미확인」은 게이팅이
         * 닫혀 있는 이유다 — 비워 두면 작업자가 등록이 왜 잠겼는지 알 수 없다.
         */}
        <p className="pop-context pop-context-right">
          <span>
            {session.workSessionId === null
              ? t.header.sessionNone
              : t.header.session(session.workSessionId)}
          </span>
          <span>
            {terminalId === null ? t.header.terminalUnknown : t.header.terminal(terminalId)}
          </span>

          {/*
           * ⭐ **미전송 건수는 필수 요건이다**(공유계약 C-1 #4). 「즉시 성공 표시」를 택한
           * 결정의 전제가 이것이라, 없으면 서버에 도달하지 않은 사실을 알 방법이 사라진다.
           */}
          <Chip variant="status" size="sm" status={outbox.pendingCount > 0 ? 'warning' : 'success'}>
            {outbox.pendingCount > 0 ? t.header.unsynced(outbox.pendingCount) : t.header.synced}
          </Chip>
          {!outbox.isOnline && (
            <Chip variant="status" size="sm" status="error">
              {t.header.offline}
            </Chip>
          )}
        </p>
      </header>

      {/*
       * 작업지시가 없으면 **조회가 나가지 않는다.** 그 사실을 배너로 먼저 말한다 — 빈 목록만
       * 으로는 「투입이 없다」와 「무엇을 볼지 정해지지 않았다」가 같은 모양이 된다.
       */}
      {workOrderId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.title}>
            {t.header.workOrderMissing}
          </AlertBanner>
        </div>
      )}

      {current.isError && <LoadErrorBanner error={current.error} onRetry={current.refetch} />}

      <div className="pop-panes">
        <section className="pane" aria-label={t.panes.current}>
          <h2 className="pane-title">{t.panes.current}</h2>
          {!current.isError && (
            <CurrentInputs
              rows={current.rows}
              isPending={current.isPending}
              hasWorkOrder={workOrderId !== null}
              mold={mold.mold}
              moldFailed={mold.isError}
              hasSession={session.workSessionId !== null}
              labels={labels}
            />
          )}
        </section>

        <section className="pane" aria-label={t.panes.replace}>
          <h2 className="pane-title">{t.panes.replace}</h2>

          <ScanField isScanning={scan.isPending} onScan={handleScan} />

          {/*
           * 스캔 결과는 **한 자리에서만** 말한다. `role="status"`라 화면을 보지 않는 작업자도
           * 읽힌 결과를 듣는다 — 이 화면의 사용자는 손과 눈이 설비에 가 있다.
           */}
          <p className="scan-outcome" role="status">
            {scan.isError
              ? /*
                 * 끊긴 것과 조회가 실패한 것은 **작업자가 할 일이 다르다**(G-3). 앞은 기다려야
                 * 풀리고 뒤는 다시 읽으면 풀린다.
                 */
                outbox.isOnline
                ? t.scan.outcomes.failed
                : t.scan.outcomes.offline
              : outcome === undefined
                ? ''
                : describeOutcome(outcome)}
          </p>

          <ReplacePanel
            gate={gate.verdict}
            hasWorkOrder={workOrderId !== null}
            hasWorker={workerNo !== null}
            part={part}
            targets={current.rows}
            selectedTargetId={selectedTargetId}
            qty={qty}
            labels={labels}
            recorded={recorded}
            rejection={
              rejection === undefined ? null : describeLoadError(toApiError(rejection.error))
            }
            onClearPart={() => {
              setPart(null);
            }}
            onSelectTarget={setSelectedTargetId}
            onQtyChange={setQty}
            onSubmit={submit}
            onRetryGate={gate.retry}
          />
        </section>
      </div>
    </main>
  );
};
