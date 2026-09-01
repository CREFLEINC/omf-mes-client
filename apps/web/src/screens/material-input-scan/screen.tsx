import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';

import { ConfirmPanel } from './confirm-panel';
import { LoadErrorBanner } from './load-error-banner';
import { useLotStatusLabels } from './lot-status-labels';
import { useReceiptLines } from './queries';
import { ReceiptSummary } from './receipt-summary';
import { ReceiptTable } from './receipt-table';
import { applyScan, EMPTY_SCAN_DRAFT, type ScanDraft, type ScanOutcome } from './scan';
import { ScanField } from './scan-field';
import { useScanLookup } from './scan-queries';
import { ScannedList } from './scanned-list';
import { dropQty, EMPTY_QTY_DRAFTS, hasEveryQty, writeQty, type QtyDrafts } from './input-qty';
import { toRecordedNote, useConfirmInput, type RecordedNote } from './mutations';
import { toMaterialConsumptions } from './post-request';
import { readWorkOrderId } from './screen-params';
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

  const [qtyDrafts, setQtyDrafts] = useState<QtyDrafts>(EMPTY_QTY_DRAFTS);
  const [notes, setNotes] = useState<readonly RecordedNote[]>([]);
  const confirm = useConfirmInput();

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

  const changeQty = (lotId: number, value: string): void => {
    setQtyDrafts((prev) => writeQty(prev, lotId, value));
  };

  /**
   * 투입 확정 — **되돌릴 수 없는 쓰기**다.
   *
   * ⛔ **보내기 직전에 본문을 다시 만든다.** 버튼 잠금이 이미 닫아 둔 길이지만, 그것이
   * 뚫려도 갖춰지지 않은 값이 원장에 실리지 않아야 한다. 본문을 만들 수 없으면 보내지 않는다.
   */
  const sendConfirm = (): void => {
    if (workOrderId === null || workerNo === null || confirm.isPending) return;

    const bodies = toMaterialConsumptions(
      workOrderId,
      draft.materials,
      qtyDrafts,
      new Date(),
      workSessionId,
    );
    if (bodies === null) return;

    confirm.mutate(
      { workerNo, bodies },
      {
        onSuccess: (recorded) => {
          /*
           * 서버가 통과시키되 기록만 한 것을 표시한다(§5-3). **담은 목록은 지우지 않는다** —
           * 무엇이 들어갔는지 작업자가 확인할 수 있어야 하고, 되돌릴 수 없는 기록이라
           * 화면이 스스로 치우면 확인할 길이 사라진다.
           */
          setNotes(recorded.map(toRecordedNote));
        },
      },
    );
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
              />
              <ReceiptSummary lines={receipt.lines} />
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
              ? t.scan.outcomes.failed
              : outcome === undefined
                ? ''
                : describeOutcome(outcome)}
          </p>

          <ScannedList
            draft={draft}
            statusLabels={statusLabels}
            qtyDrafts={qtyDrafts}
            notes={notes}
            onQtyChange={changeQty}
            onRemoveMaterial={removeMaterial}
          />

          <ConfirmPanel
            hasMaterials={draft.materials.length > 0}
            hasEveryQty={hasEveryQty(
              qtyDrafts,
              draft.materials.map((material) => material.lotId),
            )}
            hasWorker={workerNo !== null}
            gate={gate}
            confirm={confirm}
            onConfirm={sendConfirm}
          />
        </section>
      </div>
    </main>
  );
};
