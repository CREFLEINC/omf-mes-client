import { AlertBanner, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';

import { ConfirmPanel } from './confirm-panel';
import { LoadErrorBanner } from './load-error-banner';
import { useLotStatusLabels } from './lot-status-labels';
import { useReceiptLines } from './queries';
import { ReceiptSummary } from './receipt-summary';
import { useReferenceLabels } from './reference-labels';
import { ReceiptTable } from './receipt-table';
import { applyScan, EMPTY_SCAN_DRAFT, type ScanDraft, type ScanOutcome } from './scan';
import { ScanField } from './scan-field';
import { useScanLookup } from './scan-queries';
import { ScannedList } from './scanned-list';
import { dropQty, EMPTY_QTY_DRAFTS, writeQty, type QtyDrafts } from './input-qty';
import { toRecordedNote, type RecordedNote } from './mutations';
import { toMaterialConsumption } from './post-request';
import { readWorkOrderId } from './screen-params';
import { useOutbox } from './outbox';
import { useOpenWorkSession } from './session';
import { useTerminalGate } from './terminal-gating';

const t = messages.materialInputScan;

/** 스캔 한 번의 결과를 사람의 말로 옮긴다. 실패도 성공과 **같은 자리**에 선다. */
const describeOutcome = (outcome: ScanOutcome): string => {
  switch (outcome.kind) {
    case 'material':
      return t.scan.outcomes.material(outcome.code, outcome.material.lotNo);
    case 'mold':
      return t.scan.outcomes.mold(outcome.code, outcome.mold.moldCode);
    case 'duplicate':
      return t.scan.outcomes.duplicate(outcome.code, outcome.lotNo);
    case 'ambiguous':
      return t.scan.outcomes.ambiguous(outcome.count);
    case 'not-found':
      return t.scan.outcomes.notFound(outcome.code);
  }
};

/**
 * P-02-03 컨테이너 — **POP(현장 단말) 화면이라 관리웹 셸을 쓰지 않는다.**
 *
 * 사이드바·상단 바는 마우스로 메뉴를 오가는 사람을 위한 것이고, 이 화면 앞에 선 사람은
 * 장갑을 낀 채 스캐너를 든다. 그래서 `AppLayout` 밖에 서서 자기 `<main>`을 직접 렌더한다 —
 * `W-CO-01`(로그인)이 셸 밖에 선 것과 같은 형태이고, 근거는 다르다: 그쪽은 **메뉴가
 * 성립하지 않는 것**이고 이쪽은 **메뉴를 쓸 손이 없는 것**이다.
 *
 * ## 이 화면이 하는 것과 하지 않는 것
 *
 * | | |
 * | --- | --- |
 * | 한다 | 계획 대비 수령 대조 · 자재LOT·금형 스캔 · 담은 것 표시 · 타발수 경고 |
 * | **하지 않는다** | **투입 확정 쓰기** — 계약 필수 본문 셋을 채울 근거가 없다(`ConfirmPanel`) |
 *
 * ⛔ **판정을 화면이 대신하지 않는다.** 셋 다 서버 몫이다 —
 * 오투입(BOM 정합)·자재 상태(Hold·불량)·단말 게이팅. 화면은 읽은 것을 보이고 서버가 거절하면
 * 그 말을 옮긴다. 스캔한 LOT의 상태 코드를 색으로 갈래 지우지 않는 것도 같은 이유다(스펙 §5-2).
 *
 * ⭐ **단말 게이팅은 미리 판정한다**(스펙 §5-1). 계약이 `canInputMaterial`을 갖게 되어
 * (검토 요청 omf-mes#246 — A안) 진입 시 읽어 「투입 확정」을 선제 비활성한다. 다만 그 잠금은
 * **오조작을 줄이는 장치이지 집행이 아니다** — 집행은 서버의 403이고, 오프라인 큐로 들어온
 * 투입은 이 화면을 지나지 않는다.
 */
export const MaterialInputScanScreen = () => {
  const [searchParams] = useSearchParams();
  const workOrderId = readWorkOrderId(searchParams);
  /*
   * 단말·공정·사번은 **셸이 아는 것**이라 주소가 아니라 컨텍스트로 온다(`patterns/pop-identity`).
   * 채우는 자리가 아직 없어 지금은 전부 `null`이고, 화면은 그 상태를 사유와 함께 보인다 —
   * 모르는 것을 통과로 처리하지 않는다(F-6).
   */
  const { terminalId, processId, workerNo } = usePopIdentity();

  const titleId = useId();

  const receipt = useReceiptLines(workOrderId);

  const [draft, setDraft] = useState<ScanDraft>(EMPTY_SCAN_DRAFT);
  const scan = useScanLookup();
  /* 표시용 이름 풀이. 어느 판정에도 쓰이지 않는다 — 읽을 수 있게 하는 데만 쓴다. */
  const statusLabels = useLotStatusLabels();
  /* 단말 게이팅 — 스펙 §5-1. 화면의 잠금은 오조작을 줄이는 장치이지 집행이 아니다. */
  const gate = useTerminalGate(terminalId, processId);
  /*
   * 열린 세션 — **투입을 매다는 값이지 여는 조건이 아니다**(스펙 §5-5). 계약이 nullable로
   * 두었으므로 없어도 투입은 선다.
   */
  const workSessionId = useOpenWorkSession(workOrderId);
  /*
   * 품목·단위 이름 풀이(스펙 §3). **화면에 선 번호만큼만** 조회한다 — 표의 줄과 담은 자재가
   * 그 모집단이다. 어느 판정에도 쓰이지 않고 읽을 수 있게 하는 데만 쓴다.
   */
  const labels = useReferenceLabels([
    ...receipt.lines.map((line) => line.itemId),
    ...draft.materials.map((material) => material.itemId),
  ]);

  const [qtyDrafts, setQtyDrafts] = useState<QtyDrafts>(EMPTY_QTY_DRAFTS);
  /* 기록된 줄. **되돌릴 수 없다** — 빼거나 고칠 수 없고 닫을 때까지 남는다(§5-8 · B-3). */
  const [notes, setNotes] = useState<readonly RecordedNote[]>([]);
  /* 「투입 확정」으로 닫은 뒤 남길 건수. 닫기 전에는 `null`이다. */
  const [closedCount, setClosedCount] = useState<number | null>(null);
  /*
   * 오프라인 폴백(스펙 §5-7 · 공유계약 C-1). **담는 것이 곧 성공이다** — 통신을 기다리지
   * 않고, 미전송 건수를 헤더가 상시 낸다(C-1 #2·#4).
   */
  const outbox = useOutbox();
  /* 화면에서 이미 치운 자재의 늦은 응답까지 되살리지 않는다. */
  const [recordedLotIdsSeen, setRecordedLotIdsSeen] = useState<readonly number[]>([]);

  const handleScan = (code: string): void => {
    /*
     * **후보 목록을 그 순간의 값으로 넘긴다.** 중복 판정이 조회 쪽에서 일어나는데, 훅이
     * 목록을 따로 들고 있으면 화면과 훅에 정본이 둘 생긴다.
     */
    scan.mutate(
      { draft, code },
      {
        onSuccess: (outcome) => {
          /*
           * 함수형 갱신으로 담는다 — 연달아 읽힌 스캔 둘이 같은 `draft`를 각자 읽고 덮으면
           * **먼저 담긴 자재가 사라진다.** 현장에서는 이 연타가 기본 사용법이다.
           */
          setDraft((prev) => applyScan(prev, outcome));
          /* 새로 담기 시작하면 앞 회차의 「마쳤습니다」는 사실이 아니게 된다. */
          setClosedCount(null);
        },
      },
    );
  };

  const removeMaterial = (lotId: number): void => {
    setDraft((prev) => ({
      ...prev,
      materials: prev.materials.filter((material) => material.lotId !== lotId),
    }));
    /* 뺀 줄의 수량도 함께 버린다 — 남겨 두면 같은 LOT을 다시 담을 때 되살아난다. */
    setQtyDrafts((prev) => dropQty(prev, lotId));
  };

  const pendingMaterials = draft.materials.filter(
    (material) => !recordedLotIdsSeen.includes(material.lotId),
  );

  const changeQty = (lotId: number, value: string): void => {
    setQtyDrafts((prev) => writeQty(prev, lotId, value));
  };

  /**
   * 자재 한 건을 기록한다 — **스캔 한 건이 곧 한 호출이다**(스펙 §5-8 · C-3).
   *
   * ⭐ **여기서 보내야 BOM 불일치가 스캔 자리에서 드러난다.** 담아 두었다가 확정에서
   * 한꺼번에 보내면 그 판정을 버튼을 누른 뒤에야 받고, 그때는 앞 자재가 이미 원장에 남아
   * 되돌릴 수 없다(B-3 · 정정 경로 부재 §8 미결 9).
   *
   * ⛔ **보내기 직전에 본문을 다시 만든다.** 키패드가 이미 막아 둔 길이지만, 그것이 뚫려도
   * 갖춰지지 않은 값이 원장에 실리지 않아야 한다.
   */
  const recordMaterial = (lotId: number): void => {
    if (workOrderId === null || workerNo === null) return;

    /*
     * ⭐ **게이트는 쓰기를 막아야 한다**(스펙 §5-1 · 조항 F-1). 스펙이 「「투입 확정」을
     * 비활성」이라 적은 것은 **확정이 곧 쓰기이던 시점**의 문장이고, §5-8 건별 저장을 채택한
     * 뒤로 원장에 남기는 것은 이 함수다 — 확정은 목록만 닫는다. 잠금을 확정에만 두면
     * **닫힌 단말에서 자재가 그대로 기록된다.**
     *
     * ⛔ 이것이 방어는 아니다(F-1 — 집행은 서버의 403). 오조작을 줄이는 장치이고, 줄이려면
     * 실제로 조작이 일어나는 자리에 있어야 한다.
     */
    if (gate.verdict !== 'allowed') return;

    const material = draft.materials.find((candidate) => candidate.lotId === lotId);
    /* 이미 담긴 줄은 다시 담지 않는다 — 같은 자재가 두 번 투입된 것이 된다. */
    if (material === undefined || recordedLotIdsSeen.includes(lotId)) return;

    const body = toMaterialConsumption(workOrderId, material, qtyDrafts, new Date(), workSessionId);
    if (body === null) return;

    /*
     * ⭐ **큐에 담는 것이 곧 성공이다**(C-1 #2 「로컬 저장 후 즉시 성공 피드백 — 통신을
     * 기다리지 않는다」). 작업자는 다음 자재로 넘어가고, 보내는 일은 outbox가 뒤에서 한다.
     * 서버에 닿지 않은 사실은 **헤더의 미전송 건수**가 상시 말한다(C-1 #4 — 이 표시가 위
     * 결정의 전제다).
     */
    outbox.enqueue(workerNo, body);
    setRecordedLotIdsSeen((prev) => [...prev, lotId]);
  };

  /*
   * 서버가 받아 준 건의 「기록만 된 것」을 표시한다(§5-3) — 늦게 오지만 계보 추적에 필요하다.
   * 이미 화면에서 치운 자재는 되살리지 않는다.
   */
  useEffect(() => {
    setNotes(
      outbox.accepted.map(toRecordedNote).filter((note) => recordedLotIdsSeen.includes(note.lotId)),
    );
  }, [outbox.accepted, recordedLotIdsSeen]);

  /*
   * ⭐ **서버가 거부한 건만 되돌린다**(C-2 — 전체 롤백 금지). 그 자재는 원장에 없으므로
   * 목록에서 내려야 §6의 「자재LOT 스캔부터 루프백」이 성립한다.
   */
  useEffect(() => {
    const rejected = outbox.rejections.map((one) => one.entry.body.lotId);
    if (rejected.length === 0) return;

    setDraft((prev) => ({
      ...prev,
      materials: prev.materials.filter((material) => !rejected.includes(material.lotId)),
    }));
    setRecordedLotIdsSeen((prev) => prev.filter((lotId) => !rejected.includes(lotId)));
  }, [outbox.rejections]);

  /**
   * 「투입 확정」 — **그날 목록을 닫는 완료 동작**이지 저장을 모아 보내는 버튼이 아니다(§5-8).
   *
   * ⛔ **서버를 부르지 않는다.** 기록은 이미 건별로 끝나 있고, 계약에 이 동작에 대응하는
   * 오퍼레이션이 없는 것도 그래서다 — 서버가 할 일이 없다.
   */
  const closeList = (): void => {
    setClosedCount(recordedLotIdsSeen.length);
    setDraft(EMPTY_SCAN_DRAFT);
    setQtyDrafts(EMPTY_QTY_DRAFTS);
    setNotes([]);
    setRecordedLotIdsSeen([]);
    /*
     * 지난 회차의 결과는 이 회차의 사실이 아니다 — 남겨 두면 같은 LOT을 다시 담았을 때
     * **지난 판정이 딸려와 표시가 겹치고**, 거부 배너도 새로 담은 것이 거부된 것처럼 읽힌다.
     *
     * ⛔ 큐는 비우지 않는다 — 아직 서버에 닿지 않은 건이 목록을 닫는다고 사라지지 않는다.
     */
    outbox.clearResults();
  };

  const outcome = scan.data;

  return (
    /*
     * **표제가 본문의 이름이 된다.** 셸이 있는 화면은 `AppShell`이 본문 이름을 주지만
     * 이 화면에는 줄 사람이 없다 — 이름 없는 랜드마크로 남으면 무엇인지 알 수 없다.
     */
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrderId !== null && <p className="pop-context">{t.header.workOrder(workOrderId)}</p>}

        {/*
         * 스펙 §3의 헤더 오른쪽 — **지금 어느 구간에서 어느 단말로 찍고 있는가.** 단말은
         * 여러 대가 같은 화면을 띄우므로, 무엇으로 찍었는지가 보이지 않으면 나중에 기록을
         * 보고도 그 자리를 되짚을 수 없다.
         *
         * ⚠ **없을 때도 말한다.** 「세션 없음」은 정상 상태이고(§5-5), 「단말 미확인」은
         * 게이팅이 닫혀 있는 이유다 — 비워 두면 작업자가 확정이 왜 잠겼는지 알 수 없다.
         */}
        <p className="pop-context pop-context-right">
          <span>
            {workSessionId === null ? t.header.sessionNone : t.header.session(workSessionId)}
          </span>
          <span>
            {terminalId === null ? t.header.terminalUnknown : t.header.terminal(terminalId)}
          </span>

          {/*
           * ⭐ **미전송 건수는 필수 요건이다**(공유계약 C-1 #4). 「즉시 성공 표시」를 택한
           * 결정의 전제가 이것이라, 없으면 서버에 도달하지 않은 사실을 알 방법이 사라진다.
           * 연결 상태도 함께 낸다 — 끊긴 것과 밀리는 것은 다르다.
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
       * 작업지시가 없으면 **조회가 나가지 않는다.** 그 사실을 배너로 먼저 말한다 — 표의 빈
       * 상태만으로는 「받은 자재가 없다」와 「무엇을 볼지 정해지지 않았다」가 같은 모양이 된다.
       */}
      {workOrderId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.title}>
            {t.header.workOrderMissing}
          </AlertBanner>
        </div>
      )}

      {receipt.isError && <LoadErrorBanner error={receipt.error} onRetry={receipt.refetch} />}

      <div className="pop-panes">
        <section className="pane" aria-label={t.panes.receipt}>
          <h2 className="pane-title">{t.panes.receipt}</h2>
          {!receipt.isError && (
            <>
              <ReceiptTable
                lines={receipt.lines}
                isLoading={receipt.isPending && workOrderId !== null}
                hasWorkOrder={workOrderId !== null}
                describeItem={labels.describeItem}
              />
              <ReceiptSummary lines={receipt.lines} describeItem={labels.describeItem} />
            </>
          )}
        </section>

        <section className="pane" aria-label={t.panes.scan}>
          <h2 className="pane-title">{t.panes.scan}</h2>

          <ScanField isScanning={scan.isPending} onScan={handleScan} />

          {/*
           * 스캔 결과는 **한 자리에서만** 말한다. `role="status"`라 화면을 보지 않는 작업자도
           * 읽힌 결과를 듣는다 — 이 화면의 사용자는 손과 눈이 자재에 가 있다.
           */}
          <p className="scan-outcome" role="status">
            {scan.isError
              ? /*
                 * 끊긴 것과 조회가 실패한 것은 **작업자가 할 일이 다르다**(G-3). 앞은 기다려야
                 * 풀리고 뒤는 다시 읽으면 풀린다 — 합치면 끊긴 단말에서 되읽기를 반복한다.
                 */
                outbox.isOnline
                ? t.scan.outcomes.failed
                : t.scan.outcomes.offline
              : outcome === undefined
                ? ''
                : describeOutcome(outcome)}
          </p>

          <ScannedList
            draft={draft}
            statusLabels={statusLabels}
            describeItem={labels.describeItem}
            describeUom={labels.describeUom}
            qtyDrafts={qtyDrafts}
            notes={notes}
            recordedLotIds={recordedLotIdsSeen}
            canRecord={gate.verdict === 'allowed'}
            onQtyChange={changeQty}
            onRemoveMaterial={removeMaterial}
            onRecord={recordMaterial}
          />

          <ConfirmPanel
            hasRecorded={recordedLotIdsSeen.length > 0}
            hasPending={pendingMaterials.length > 0}
            hasWorker={workerNo !== null}
            gate={gate}
            rejection={outbox.rejections.at(-1)?.error ?? null}
            closedCount={closedCount}
            onConfirm={closeList}
          />
        </section>
      </div>
    </main>
  );
};
