import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { ActionBar } from '../../patterns/action-bar';
import { LoadErrorBanner } from '../../patterns/load-error-banner';
import { OutboxStallBanner } from '../../patterns/outbox-stall-banner';
import { PopHeader } from '../../patterns/pop-header';
import { usePopIdentity } from '../../patterns/pop-identity';
import {
  popGateProcessId,
  usePopProcessGate,
  usePopWorkOrder,
  usePopWorkOrderProcess,
} from '../../patterns/pop-process-gate';
import { useWorkerSession } from '../../patterns/worker-session';
import { POP_TOUCH_SIZE } from '../work-start/touch-spec';

import { confirmBlockReason, remainingText } from './block-reason';
import { useFourMChangeTypeLabels, useLotStatusLabels } from './lot-status-labels';
import { MaterialList, toMaterialRows } from './material-list';
import { useReceiptLines } from './queries';
import { QtyEditor } from './qty-editor';
import { describeRecordError } from './record-error';
import { useReferenceLabels } from './reference-labels';
import { applyScan, EMPTY_SCAN_DRAFT, type ScanDraft, type ScanOutcome } from './scan';
import { ScanField, type ScanOutcomeView } from './scan-field';
import { useScanLookup } from './scan-queries';
import { dropQty, EMPTY_QTY_DRAFTS, writeQty, type QtyDrafts } from './input-qty';
import { toRecordedNote, type RecordedNote } from './mutations';
import { toMaterialConsumption } from './post-request';
import { readWorkOrderId } from './screen-params';
import { useOutbox } from './outbox';
import { useOpenWorkSession } from './session';
import { isEmergencyTypeCode } from './work-order-type';

const t = messages.materialInputScan;

/** 스캔 한 번의 결과를 사람의 말로 옮긴다. 실패도 성공과 **같은 자리**에 선다. */
/**
 * 스캔 한 번의 결과 — **무게까지 함께 정한다.**
 *
 * ⭐ **성공과 실패가 같은 모양이면 실패를 놓친다.** 이 화면 사용자는 손과 눈이 자재에 가 있고
 * 연달아 읽는다. 다섯 결과가 모두 같은 회색 한 줄이던 때는 「찾을 수 없습니다」가 「담았습니다」와
 * 구분되지 않아 **담긴 줄 알고 넘어갈** 수 있었다 — 이 슬라이스가 다른 자리에서 계속 경계해 온
 * 바로 그 형태다(`scan-field.tsx` 머리말 「읽었다고 믿고 넘어간다」).
 */
const describeOutcome = (
  outcome: ScanOutcome,
  /** 상태 코드를 사람이 읽는 말로 옮긴다. 화면이 그 말을 지어내지 않는다. */
  describeStatus: (code: string) => string,
): ScanOutcomeView => {
  switch (outcome.kind) {
    case 'material':
      return { tone: 'success', text: t.scan.outcomes.material(outcome.material.lotNo) };
    case 'mold':
      return { tone: 'success', text: t.scan.outcomes.mold(outcome.mold.moldCode) };
    /* 담기지 «않았다» — 실패는 아니지만 그냥 넘어가면 같은 것을 또 읽는다. */
    case 'duplicate':
      return { tone: 'warning', text: t.scan.outcomes.duplicate(outcome.lotNo) };
    /*
     * 담기 전에 막은 것이다(스펙 §6 R37). 다 담고 수량까지 넣은 뒤 서버에 거부당하는
     * 헛수고를 여기서 끊는다. 서버 거부는 그대로 둔다 — 최종 판정은 서버다.
     */
    case 'blocked-status': {
      const statusName = describeStatus(outcome.statusCode).trim();

      return {
        tone: 'error',
        text:
          statusName === ''
            ? t.scan.outcomes.blockedStatusUnknown(outcome.lotNo)
            : t.scan.outcomes.blockedStatus(outcome.lotNo, statusName),
      };
    }
    case 'ambiguous':
      return { tone: 'warning', text: t.scan.outcomes.ambiguous(outcome.count) };
    case 'not-found':
      /* 못 찾은 것만 코드를 담는다 — 오타 확인이 실제로 필요한 유일한 경우다. */
      return { tone: 'error', text: t.scan.outcomes.notFound(outcome.code) };
  }
};

/**
 * P-02-03 자재 투입 — **POP(현장 단말) 화면이라 관리웹 셸을 쓰지 않는다.**
 *
 * 유형: T-P-W 작업형의 투입 탭. 머리줄(현재 W/O와 공정), 본문 좌우 2단(왼쪽 투입 자재: 스캔 칸과
 *       자재 목록, 오른쪽 투입 수량: 고른 LOT의 편집 영역), 하단 동작 바(「남은 일」과 주 동작 하나).
 *       자재 목록은 수령한 LOT(계획 대비 수령)과 스캔해 담은 LOT을 한 줄씩 보인다(PI-04).
 * 이탈: T-P-W 왼쪽 세로 작업 탭을 두지 않는다(작업 탭은 POP 작업 화면 전체를 함께 바꾸는 셸 작업,
 *       PI-01). C-11 머리줄을 화면이 조립한다(공용 `patterns/pop-header`, 작업 시작과 같음).
 *       C-5 단계 표시를 두지 않는다(LOT마다 스캔, 수량, 기록을 반복하고 확정은 한 번, PI-03).
 *
 * 작업 순서: 자재 목록에서 받은 자재 확인 → LOT 라벨(필요하면 금형 코드) 스캔 → 담긴 LOT의 투입 수량과
 * [기록] → 하단 바 [투입 확정] → [생산 작업으로].
 *
 * ⛔ **판정을 화면이 대신하지 않는다.** 오투입(BOM 정합), 자재 상태(Hold, 불량), 단말 게이팅은
 * 서버 몫이다. 화면은 읽은 것을 보이고 서버가 거절하면 그 말을 옮긴다.
 *
 * ⭐ **단말 게이팅은 미리 판정한다**(스펙 §5-1). 진입 시 `canInputMaterial`을 읽어 [기록]과
 * [투입 확정]을 잠근다. 다만 그 잠금은 오조작을 줄이는 장치이지 집행이 아니다 — 집행은 서버의 403이고,
 * 오프라인 큐로 들어온 투입은 이 화면을 지나지 않는다.
 */
export const MaterialInputScanScreen = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const workOrderId = readWorkOrderId(searchParams);
  /* 단말, 공정, 사번은 셸이 아는 것이라 주소가 아니라 컨텍스트로 온다(`patterns/pop-identity`). */
  const { terminalId, processes, equipment, workerNo } = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerName =
    workerSession !== null && workerSession.worker.workerNo === workerNo
      ? (workerSession.worker.workerName ?? null)
      : null;

  const titleId = useId();
  const remainingId = useId();

  const receipt = useReceiptLines(workOrderId);
  /* 단말 판정과 같은 W/O 상세(같은 조회 키)에서 머리줄 W/O 번호, 공정, 긴급 여부를 읽는다. */
  const workOrder = usePopWorkOrder(workOrderId).data;
  const isEmergency = isEmergencyTypeCode(workOrder?.workOrderTypeCode ?? undefined);

  const [draft, setDraft] = useState<ScanDraft>(EMPTY_SCAN_DRAFT);
  const scan = useScanLookup();
  /* 표시용 이름 풀이. 어느 판정에도 쓰이지 않는다 — 읽을 수 있게 하는 데만 쓴다. */
  const statusLabels = useLotStatusLabels();
  const describeFourMType = useFourMChangeTypeLabels();
  /*
   * 단말 게이팅 — 스펙 §5-1. 화면의 잠금은 오조작을 줄이는 장치이지 집행이 아니다.
   * 단말에 공정이 여럿이어도 «이 W/O 의 공정»으로 판정한다(작업 시작과 같은 규칙).
   */
  const workOrderProcess = usePopWorkOrderProcess(workOrderId);
  const gate = usePopProcessGate({
    terminalId,
    processId: popGateProcessId(workOrderProcess.processId, processes),
    workOrder: workOrderProcess,
    flag: 'canInputMaterial',
  });
  /*
   * 열린 세션 — **투입을 매다는 값이지 여는 조건이 아니다**(스펙 §5-5). 계약이 nullable로
   * 두었으므로 없어도 투입은 선다. 화면에 세션 번호를 보이지 않는다(내부 번호, C-13).
   */
  const workSessionId = useOpenWorkSession(workOrderId);
  /*
   * 품목과 단위 이름 풀이(스펙 §3). **화면에 선 번호만큼만** 조회한다 — 표의 줄과 담은 자재가
   * 그 모집단이다.
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
   * 않고, 미전송 건수를 머리줄이 낸다(C-1 #2·#4).
   */
  const outbox = useOutbox();
  /* 화면에서 이미 치운 자재의 늦은 응답까지 되살리지 않는다. */
  const [recordedLotIdsSeen, setRecordedLotIdsSeen] = useState<readonly number[]>([]);
  /*
   * 편집 영역에 연 LOT(현재 LOT, PG-25). 새로 담은 LOT이 바로 골라진다. 목록에서 다른 행을 누르면
   * 바뀐다.
   */
  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  /* 기록한 뒤 스캔 칸으로 포커스를 되돌린다 — 다음 스캔이 칸으로 들어가야 한다. */
  const [scanFocusRequest, setScanFocusRequest] = useState(0);

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
          /* 새로 담은 LOT을 편집 영역에 연다(현재 LOT, PG-25). 이미 담긴 LOT을 다시 읽으면 그 LOT으로 옮긴다. */
          if (outcome.kind === 'material') setSelectedLotId(outcome.material.lotId);
          if (outcome.kind === 'duplicate') {
            const scanned = draft.materials.find((material) => material.lotNo === outcome.lotNo);
            if (scanned !== undefined) setSelectedLotId(scanned.lotId);
          }
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

  /* 수령한 LOT과 담은 LOT을 한 목록으로 맞춘다(표시만). */
  const rows = toMaterialRows(receipt.lines, draft.materials);

  /*
   * 편집 영역에 연 줄. 고른 것이 목록에서 빠졌으면(빼기, 서버 거부) 기록하지 않은 첫 LOT을 연다.
   * 그것도 없으면 비운다.
   */
  const editingRow =
    rows.find((row) => row.lotId === selectedLotId) ??
    rows.find((row) => row.lotId === pendingMaterials[0]?.lotId) ??
    null;

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
   * ⛔ **보내기 직전에 본문을 다시 만든다.** 버튼 잠금이 이미 막아 둔 길이지만, 그것이 뚫려도
   * 갖춰지지 않은 값이 원장에 실리지 않아야 한다.
   */
  const recordMaterial = (lotId: number): void => {
    if (workOrderId === null || workerNo === null) return;

    /*
     * ⭐ **게이트는 쓰기를 막아야 한다**(스펙 §5-1 · 조항 F-1). 원장에 남기는 것은 이 함수다 —
     * 확정은 목록만 닫는다. 잠금을 확정에만 두면 **닫힌 단말에서 자재가 그대로 기록된다.**
     */
    if (gate.verdict !== 'allowed') return;

    const material = draft.materials.find((candidate) => candidate.lotId === lotId);
    /* 이미 담긴 줄은 다시 담지 않는다 — 같은 자재가 두 번 투입된 것이 된다. */
    if (material === undefined || recordedLotIdsSeen.includes(lotId)) return;

    const body = toMaterialConsumption(workOrderId, material, qtyDrafts, new Date(), workSessionId);
    if (body === null) return;

    /*
     * ⭐ **큐에 담는 것이 곧 성공이다**(C-1 #2 「로컬 저장 후 즉시 성공 피드백 — 통신을
     * 기다리지 않는다」). 서버에 닿지 않은 사실은 **머리줄의 미전송 건수**가 말한다(C-1 #4).
     */
    outbox.enqueue(workerNo, body);
    setRecordedLotIdsSeen((prev) => [...prev, lotId]);
    /* 기록하지 않은 다음 LOT을 연다. 없으면 그대로 둔다. */
    const next = pendingMaterials.find((candidate) => candidate.lotId !== lotId);
    if (next !== undefined) setSelectedLotId(next.lotId);
    setScanFocusRequest((prev) => prev + 1);
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
   * ⛔ **서버를 부르지 않는다.** 기록은 이미 건별로 끝나 있다.
   */
  const closeList = (): void => {
    setClosedCount(recordedLotIdsSeen.length);
    setDraft(EMPTY_SCAN_DRAFT);
    setQtyDrafts(EMPTY_QTY_DRAFTS);
    setNotes([]);
    setRecordedLotIdsSeen([]);
    setSelectedLotId(null);
    /* 지난 스캔 결과 줄도 지운다. 「마쳤습니다」 옆에 「담았습니다」가 남으면 아직 담는 중으로 읽힌다. */
    scan.reset();
    /*
     * 지난 회차의 결과는 이 회차의 사실이 아니다 — 남겨 두면 같은 LOT을 다시 담았을 때
     * 지난 판정이 딸려온다. ⛔ 큐는 비우지 않는다 — 아직 서버에 닿지 않은 건이 사라지지 않는다.
     */
    outbox.clearResults();
  };

  /**
   * 투입을 마친 다음 작업 — **같은 작업지시의 생산 작업**(P-02-04, C-9).
   *
   * ⛔ **작업지시를 주소로 싣는다.** 실적 화면은 그 값을 주소에서만 읽는다.
   */
  const goToProductionResult = (): void => {
    if (workOrderId === null) return;

    void navigate(`/pop/production-result?workOrderId=${String(workOrderId)}`);
  };

  const outcome = scan.data;

  /*
   * 끊긴 것과 조회가 실패한 것은 **작업자가 할 일이 다르다**(G-3). 앞은 기다려야 풀리고 뒤는
   * 다시 읽으면 풀린다.
   */
  const outcomeView: ScanOutcomeView | null = scan.isError
    ? {
        tone: 'error',
        text: outbox.isOnline ? t.scan.outcomes.failed : t.scan.outcomes.offline,
      }
    : outcome === undefined
      ? null
      : describeOutcome(outcome, statusLabels.describe);

  /* 잠금 사유와 「남은 일」은 한 판정(`block-reason`)에서 읽는다. */
  const blockReason = confirmBlockReason({
    gate,
    processFailureReason: workOrderProcess.failureReason,
    hasWorker: workerNo !== null,
    hasPending: pendingMaterials.length > 0,
  });
  const isClosed = closedCount !== null;
  const remaining = remainingText({
    blockReason,
    hasWorkOrder: workOrderId !== null,
    /* 편집 영역에 연 LOT이 기록 전이면 그것부터 말한다. */
    pendingLotNos: [...pendingMaterials]
      .sort((a, b) => Number(b.lotId === editingRow?.lotId) - Number(a.lotId === editingRow?.lotId))
      .map((material) => material.lotNo),
    hasMaterials: draft.materials.length > 0,
    isClosed,
  });
  const isConfirmBlocked =
    workOrderId === null || blockReason !== undefined || recordedLotIdsSeen.length === 0;

  const rejection = outbox.rejections.at(-1)?.error ?? null;
  const hasShortReceipt = receipt.lines.some((line) => line.status !== 'matched');

  return (
    /* 셸이 없는 화면이라 표제가 본문의 이름이 된다. */
    <main className="pop-shell pop-ui material-input-screen" aria-labelledby={titleId}>
      <PopHeader
        titleId={titleId}
        title={t.title}
        equipmentCode={equipment?.equipmentCode ?? null}
        equipmentName={equipment?.equipmentName ?? null}
        workerNo={workerNo}
        workerName={workerName}
        workOrderNo={workOrder?.workOrderNo ?? null}
        processName={workOrder?.processName ?? workOrderProcess.processName}
        isEmergency={isEmergency}
        /*
         * 연결 상태와 미전송 건수(공유계약 C-1 #4). 「즉시 성공 표시」의 전제라 늘 보인다.
         * 미전송 칩은 남은 건이 있을 때만 선다(PG-24).
         */
        isConnected={outbox.isOnline}
        unsentCount={outbox.pendingCount}
      />

      {/* 「밀리는 중」과 「멈춤」은 다르다 — 건수만으로는 그 차이가 보이지 않는다. */}
      {outbox.isStalled && <OutboxStallBanner onRetry={outbox.retryNow} />}

      {/* 본문 좌우 2단. 왼쪽 자재 목록, 오른쪽 고른 LOT의 편집 영역. 고른 결과를 목록 아래에 쌓지 않는다(C-2). */}
      <div className="pop-panes material-input-panes">
        <section className="pane material-input-list" aria-label={t.panes.input}>
          <h2 className="pane-title">{t.panes.input}</h2>

          {/*
           * 결과와 오류는 구획 맨 위 전체 폭에 둔다(C-19 안내 상자, PG-07). 서버가 거부한 건은
           * 그 한 건에만 미친다 — 목록에서 빠지므로 그 자재를 다시 스캔해 기록한다(§6).
           */}
          {receipt.isError && <LoadErrorBanner error={receipt.error} onRetry={receipt.refetch} />}

          {rejection !== null && (
            <div className="banner-slot">
              <AlertBanner variant="error" title={t.confirm.failed}>
                {describeRecordError(rejection)}
              </AlertBanner>
            </div>
          )}

          {/* 몇 건으로 닫았는지 그 자리에서 말한다. 다음 작업은 하단 바 주 동작이다(C-9). */}
          {isClosed && (
            <div className="banner-slot">
              <AlertBanner variant="success" title={t.confirm.closed(closedCount)} />
            </div>
          )}

          {/*
           * 부족이나 미수령은 투입을 막지 않는다(스펙 §6). 그런 LOT이 있을 때만 안내 상자로 말한다
           * (C-7, C-19). 어느 LOT인지는 그 줄의 상태 칩이 말한다(C-4).
           */}
          {hasShortReceipt && !isClosed && (
            <div className="banner-slot">
              <AlertBanner variant="info" assertive={false} title={t.notes.shortAllowed} />
            </div>
          )}

          <ScanField
            isScanning={scan.isPending}
            onScan={handleScan}
            outcome={outcomeView}
            focusRequest={scanFocusRequest}
          />

          <MaterialList
            rows={receipt.isError ? rows.filter((row) => row.material !== undefined) : rows}
            isLoading={receipt.isPending && workOrderId !== null}
            hasWorkOrder={workOrderId !== null}
            isError={receipt.isError}
            draft={draft}
            describeItem={labels.describeItem}
            describeUom={labels.describeUom}
            qtyDrafts={qtyDrafts}
            notes={notes}
            recordedLotIds={recordedLotIdsSeen}
            selectedLotId={editingRow?.lotId ?? null}
            onSelect={(lotId) => {
              setSelectedLotId(lotId);
              /* 줄을 눌러도 다음 스캔은 스캔 칸으로 들어가야 한다(PG-21). */
              setScanFocusRequest((prev) => prev + 1);
            }}
          />
        </section>

        <QtyEditor
          row={editingRow}
          isRecorded={editingRow !== null && recordedLotIdsSeen.includes(editingRow.lotId)}
          qtyDrafts={qtyDrafts}
          statusLabels={statusLabels}
          describeItem={labels.describeItem}
          describeUom={labels.describeUom}
          describeFourMType={describeFourMType}
          canRecord={gate.verdict === 'allowed' && workerNo !== null && workOrderId !== null}
          remainingId={remainingId}
          onQtyChange={changeQty}
          onRecord={recordMaterial}
          onRemove={removeMaterial}
        />
      </div>

      <ActionBar
        remaining={remaining}
        remainingId={remainingId}
        leading={
          /* 다시 시도가 뜻이 있는 갈래는 하나뿐이다 — 권한 조회가 실패했을 때(G-3). */
          gate.verdict === 'unavailable' ? (
            <Button type="button" variant="outlined" size={POP_TOUCH_SIZE} onClick={gate.retry}>
              {t.confirm.retry}
            </Button>
          ) : undefined
        }
      >
        {isClosed ? (
          <Button
            type="button"
            variant="filled"
            size={POP_TOUCH_SIZE}
            disabled={workOrderId === null}
            aria-describedby={remainingId}
            onClick={goToProductionResult}
          >
            {t.confirm.goToProductionResult}
          </Button>
        ) : (
          <Button
            type="button"
            variant="filled"
            size={POP_TOUCH_SIZE}
            disabled={isConfirmBlocked}
            aria-describedby={remainingId}
            onClick={closeList}
          >
            {t.confirm.action}
          </Button>
        )}
      </ActionBar>
    </main>
  );
};
