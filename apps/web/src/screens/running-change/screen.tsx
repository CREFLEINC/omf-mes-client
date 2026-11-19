import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import {
  popGateDeniedText,
  popGateProcessId,
  popGateUnidentifiedText,
  usePopProcessGate,
  usePopWorkOrderProcess,
} from '../../patterns/pop-process-gate';
import {
  PuActionBar,
  PuButton,
  PuCols,
  PuKeypad,
  PuNote,
  PuScreen,
  PuSection,
  applyKeypadKey,
  puToast,
} from '../../patterns/pop-uniform';

import { CurrentInputs, MoldInfo } from './current-inputs';
import { WorkOrderBand } from './current-lot';
import { LoadErrorBanner, describeLoadError } from './load-error-banner';
import { useCurrentMold } from './mold';
import { toReplacementConsumption } from './post-request';
import { useOutbox } from './outbox';
import { useChangeReasons, useCurrentInputs, useCurrentLot, useLotStatusNames } from './queries';
import { stripLeadingZeros } from './quantity-pad';
import { ReplacePanel, toBlockReason } from './replace-panel';
import { type ScanOutcome, type ScannedPart } from './scan';
import { ScanField, type ScanOutcomeView } from './scan-field';
import { useScanLookup } from './scan-queries';
import { readLotId, readWorkOrderId } from './screen-params';
import { useOpenWorkSession } from './session';
import { useReferenceLabels } from './reference-labels';
import { toApiError } from '../../patterns/request';
import { PopTopStatus } from '../../patterns/pop-top-status';

import './uniform.css';

const t = messages.runningChange;

/** 스캔 한 번의 결과를 사람의 말로 옮긴다. 실패도 성공과 **같은 자리**에 선다. */
const describeOutcome = (outcome: ScanOutcome): string | null => {
  switch (outcome.kind) {
    case 'part':
      /*
       * 담은 것은 칸의 초록 「스캔 완료」와 「신규 부품」 줄이 말한다(POP 통일 시안). 읽은 코드와 찾은 번호가
       * 다를 때만 둘을 함께 적는다 — 부분 검색으로 다른 번호가 걸렸는지 작업자가 판단한다.
       */
      return outcome.code === outcome.part.lotNo
        ? null
        : t.scan.outcomes.partResolved(outcome.code, outcome.part.lotNo);
    case 'ambiguous':
      return t.scan.outcomes.ambiguous(outcome.count);
    case 'not-found':
      return t.scan.outcomes.notFound;
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
 * ⭐ **《현재 생산LOT》은 주소가 정한다.** 세션에 LOT 이 없어 서버가 「지금 어느 슬롯인가」를
 * 판정하지 못한다 — 넘겨 주는 화면(`P-02-03`)이 작업지시와 함께 실어 준다(스펙 §3).
 */
export const RunningChangeScreen = () => {
  const [searchParams] = useSearchParams();
  const workOrderId = readWorkOrderId(searchParams);
  const lotId = readLotId(searchParams);
  /*
   * 단말·공정·사번은 **셸이 아는 것**이라 주소가 아니라 컨텍스트로 온다(`patterns/pop-identity`).
   * 개발 셸이 합성값으로 채우고(`app/pop-main.tsx`) 설치본에는 아직 채우는 자리가 없다 —
   * 없으면 전부 `null`이고, 화면은 그 상태를 사유와 함께 보인다. 모르는 것을 통과로 처리하지
   * 않는다(F-6).
   */
  const { terminalId, processes, workerNo } = usePopIdentity();

  const titleId = useId();

  const current = useCurrentInputs(workOrderId);
  const reasons = useChangeReasons();
  /* 보류 칩이 코드가 아니라 표시명으로 서게 한다(#1045). */
  const lotStatuses = useLotStatusNames();
  const currentLot = useCurrentLot(lotId);
  const session = useOpenWorkSession(workOrderId);
  const mold = useCurrentMold(session.moldId);
  /*
   * 교체도 자재 투입이므로 `P-02-03`과 같은 플래그를 쓴다(§5-1). 단말에 공정이 여럿이어도
   * «이 W/O 의 공정»으로 판정한다.
   */
  const workOrderProcess = usePopWorkOrderProcess(workOrderId);
  const gate = usePopProcessGate({
    terminalId,
    processId: popGateProcessId(workOrderProcess.processId, processes),
    workOrder: workOrderProcess,
    flag: 'canInputMaterial',
  });

  const [part, setPart] = useState<ScannedPart | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [qty, setQty] = useState('');
  /* 교체 사유는 고르지 않아도 등록이 선다(스펙 §6) — 고르지 않은 상태가 `null` 이다. */
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  /* 스캔 칸에 든 글자 — [입력 초기화]·등록 뒤에 비운다. */
  const [scanValue, setScanValue] = useState('');
  /* 왼쪽 「현재 투입 · 금형 정보」 접기(시안) — 접으면 오른쪽이 그만큼 넓어진다. */
  const [leftFolded, setLeftFolded] = useState(false);

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
        /* 못 찾았으면 칸을 비운다 — 칸 바로 아래 빨간 한 줄이 이유를 말한다(시안 규칙 6). */
        if (outcome.kind !== 'part') setScanValue('');
      },
      /* 조회가 실패한 것도 「집지 못한 것」이다 — 무엇을 담고 있는지 모르는 채로 두지 않는다. */
      onError: () => {
        setPart(null);
        setScanValue('');
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
      changeReasonCode: reasonCode,
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
    puToast(t.replace.done);
    /* 담은 뒤에는 이 회차의 입력을 비운다 — 남겨 두면 같은 교체가 두 번 담긴다. */
    resetInput();
  };

  /** [입력 초기화] — 스캔한 LOT · 교체 대상 · 수량 · 사유를 한 번에 지운다(시안). */
  function resetInput(): void {
    setPart(null);
    setScanValue('');
    setSelectedTargetId(null);
    setQty('');
    setReasonCode(null);
    scan.reset();
  }

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
  /*
   * 읽은 결과를 **무게와 함께** 든다(전례 `P-02-03`) — 못 찾은 것과 찾은 것이 같은 모양이면
   * 실패를 놓친다. 끊긴 것과 조회가 실패한 것도 갈라 말한다(G-3) — 앞은 기다려야 풀리고
   * 뒤는 다시 읽으면 풀린다.
   */
  const outcomeText = outcome === undefined ? null : describeOutcome(outcome);
  const outcomeView: ScanOutcomeView | null = scan.isError
    ? {
        tone: 'error',
        text: outbox.isOnline ? t.scan.outcomes.failed : t.scan.outcomes.offline,
      }
    : outcome === undefined || outcomeText === null
      ? null
      : {
          /*
           * 자매 화면 `P-02-03` 과 같은 가름이다 — 담긴 것은 ✓, 여러 건이 걸린 것은 ! (다시
           * 읽으면 풀린다), **못 찾은 것은 ✕** 다. 못 찾음을 주황으로 두면 「걸리긴 했다」로
           * 읽혀 작업자가 담긴 줄 알고 넘어간다.
           */
          tone:
            outcome.kind === 'part'
              ? 'success'
              : outcome.kind === 'ambiguous'
                ? 'warning'
                : 'error',
          text: outcomeText,
        };
  const blocked = toBlockReason({
    gate: gate.verdict,
    hasWorkOrder: workOrderId !== null,
    hasWorker: workerNo !== null,
    part,
    selectedTargetId,
    qty,
  });
  const allowDecimal = labels.allowsDecimal(part?.uomId ?? null);
  const uom = part === null ? '' : labels.describeUom(part.uomId);
  const hasInput =
    part !== null ||
    scanValue !== '' ||
    selectedTargetId !== null ||
    qty !== '' ||
    reasonCode !== null;
  const rejection = outbox.rejections.at(-1);

  return (
    <PuScreen
      className="rc-screen"
      labelledBy={titleId}
      band={workOrderId !== null}
      actionBar={
        <PuActionBar label={t.title}>
          <PuButton icon="reset" disabled={!hasInput} onClick={resetInput}>
            {t.replace.reset}
          </PuButton>
          {/*
           * ⭐ 수량 칸 옆 [투입]과 같은 일(같은 잠금 · 같은 `submit`)이라 하나로 합쳤다(시안). 막힌 사유는
           *    「부품 교체」 구획 위 주의 줄과 칸의 빨간 테두리가 말한다 — 이 줄에는 버튼만.
           */}
          <PuButton variant="primary" disabled={blocked !== null} onClick={submit}>
            {t.replace.submit}
          </PuButton>
        </PuActionBar>
      }
    >
      {/* 표제는 셸 탭이 보인다 — 본문 이름으로만 남긴다. */}
      <h1 id={titleId} className="visually-hidden">
        {t.title}
      </h1>
      <PopTopStatus>
        {/* 연결(온라인·오프라인)은 공통 메뉴 맨 위 줄이 모든 화면에 같게 보인다(#291) — 여기서는 미전송이 있을 때만 알린다. */}
        {outbox.pendingCount > 0 && (
          <Chip variant="status" size="md" status="warning">
            {t.header.unsynced(outbox.pendingCount)}
          </Chip>
        )}
      </PopTopStatus>

      {workOrderId !== null && (
        <WorkOrderBand
          workOrderId={workOrderId}
          processName={workOrderProcess.processName}
          lot={currentLot.isError ? null : currentLot.lot}
        />
      )}
      {lotId !== null && currentLot.isError && <PuNote tone="warn">{t.currentLot.failed}</PuNote>}

      <PuCols variant="lk">
        {leftFolded ? (
          <PuSection fold={{ label: t.panes.current, folded: true, onChange: setLeftFolded }} />
        ) : (
          <div className="rc-left">
            <CurrentInputs
              rows={current.rows}
              isPending={current.isPending}
              hasWorkOrder={workOrderId !== null}
              error={
                current.isError ? (
                  <LoadErrorBanner error={current.error} onRetry={current.refetch} />
                ) : null
              }
              labels={labels}
              fold={{ label: t.panes.current, folded: false, onChange: setLeftFolded }}
            />
            <MoldInfo
              mold={mold.mold}
              moldFailed={mold.isError}
              hasSession={session.workSessionId !== null}
            />
          </div>
        )}

        <ReplacePanel
          gate={gate.verdict}
          gateDeniedText={popGateDeniedText(gate, 'canInputMaterial')}
          gateUnidentifiedText={popGateUnidentifiedText(
            t.disabled.unidentified,
            workOrderProcess.failureReason,
          )}
          hasWorkOrder={workOrderId !== null}
          hasWorker={workerNo !== null}
          part={part}
          targets={current.rows}
          selectedTargetId={selectedTargetId}
          qty={qty}
          lotStatuses={lotStatuses}
          reasons={reasons.reasons}
          reasonsPending={reasons.isPending}
          reasonsFailed={reasons.isError}
          reasonCode={reasonCode}
          onReasonChange={setReasonCode}
          labels={labels}
          rejection={
            rejection === undefined ? null : describeLoadError(toApiError(rejection.error))
          }
          notes={
            <>
              {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 말로 알린다(사용자 지시 2026-09-17). */}
              {workerNo === null && <PuNote tone="warn">{messages.popChrome.workerMissing}</PuNote>}
              {/*
               * 작업지시가 없으면 **조회가 나가지 않는다.** 그 사실을 먼저 말한다 — 빈 목록만으로는 「투입이
               * 없다」와 「무엇을 볼지 정해지지 않았다」가 같은 모양이 된다.
               */}
              {workOrderId === null && <PuNote tone="warn">{t.header.workOrderMissing}</PuNote>}
              {/* ⭐ 「밀리는 중」과 「멈춤」은 다르다 — 건수만으로는 그 차이가 보이지 않는다. */}
              {outbox.isStalled && (
                <PuNote
                  tone="bad"
                  action={
                    <PuButton size="sm" onClick={outbox.retryNow}>
                      {messages.common.connection.stalledRetry}
                    </PuButton>
                  }
                >
                  <b>{messages.common.connection.stalledTitle}</b>{' '}
                  {messages.common.connection.stalledBody}
                </PuNote>
              )}
            </>
          }
          scan={
            <ScanField
              value={scanValue}
              onChange={setScanValue}
              isScanning={scan.isPending}
              onScan={handleScan}
              done={part !== null}
              outcome={outcomeView}
            />
          }
          onClearPart={() => {
            setPart(null);
            setScanValue('');
          }}
          onSelectTarget={setSelectedTargetId}
          onRetryGate={gate.retry}
        />

        {/* 「수량」 키패드 구획 — 생산 작업 화면과 같은 모양(단위 · 입력 칸 · [전체 삭제]). */}
        <PuSection title={t.pad.title} meta={t.pad.unit(uom === '' ? '—' : uom)}>
          <PuKeypad
            targetLabel={t.replace.qtyLabel}
            /* 소수점 키는 **읽은 부품의 단위**가 정한다 — 개수로 세는 자재에는 쓰지 않는다. */
            decimal={allowDecimal}
            onKey={(key) => {
              setQty((prev) =>
                stripLeadingZeros(applyKeypadKey(prev, key, { decimal: allowDecimal })),
              );
            }}
            onClearAll={() => {
              setQty('');
            }}
          />
        </PuSection>
      </PuCols>
    </PuScreen>
  );
};
