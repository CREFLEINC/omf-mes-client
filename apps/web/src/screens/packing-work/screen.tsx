import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { addLine, findScannedLot, judgeQuantity, toPackingLine } from './contents';
import { usePackingEntry } from './entry-context';
import { PackErrorBanner } from './error-banner';
import { LotListPane } from './lot-list-pane';
import { useHandlingUnitCreate, useHandlingUnitPack } from './mutations';
import { usePackingWorkOutbox } from './outbox';
import { toPackBody } from './pack-request';
import { PackingPane } from './packing-pane';
import {
  packingWorkKeys,
  useCodeLabels,
  useHandlingUnitTypes,
  useParentHandlingUnits,
  useTargetLots,
} from './queries';
import { ScanPane } from './scan-pane';
import { emptyPackingDraft, type Lot, type PackingLine } from './types';

const t = messages.packingWork;

/**
 * P-02-08 포장 작업(LOT 스캔·제품 포장).
 *
 * ⭐ **서버 호출이 둘이고 시점이 갈린다**(스펙 §3 · §5-6). ① 첫 내용물을 담을 때 포장 단위를
 * 만들어 **번호를 받고**, ② 확정에서 내용물 전량을 한 트랜잭션으로 싣는다. 스펙 §3 이 담는
 * 동안 번호를 보이라 하기 때문에 ①이 앞선다.
 *
 * ⚠ **중단하면 빈 포장이 남는다** — 포장 해체 경로가 인벤토리에 없다(스펙 §8-4). 화면이
 * 취소 조작을 임의로 만들지 않았다. 설계 회신(`omf-mes#392` ②)이 오면 ①의 시점이 바뀔 수 있다.
 *
 * ⛔ **「잔여」와 초과 스캔 방어를 만들지 않았다** — 이미 포장된 수량을 뺀 잔여를 계약이 내려
 * 주지 않는다. 없는 값을 화면이 계산하면 실물과 갈린다.
 *
 * ⛔ **단말 게이팅을 걸지 않는다** — 8플래그에 포장이 없다(스펙 §5-1). 가까운 것을 임의로
 * 매핑하면 엉뚱한 권한이 걸린다. 집행은 서버의 403 이다.
 *
 * ⭐ **오프라인은 절반만 선다**(스펙 §6 · 공유계약 C-1). 확정은 큐에 담기지만 ①은 서버가
 * 번호를 매겨 돌려주는 쓰기라 끊긴 채로 부를 수 없다 — 계약도 `:pack` 만 오프라인 대상으로
 * 표시했다. 그래서 **오프라인에서 새 포장을 시작하는 자리만 막고 이유를 말한다.**
 */
export const PackingWorkScreen = () => {
  const titleId = useId();
  const entry = usePackingEntry();
  const identity = usePopIdentity();

  const queryClient = useQueryClient();
  const outbox = usePackingWorkOutbox();

  const [draft, setDraft] = useState(emptyPackingDraft);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [quantity, setQuantity] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  /** 「담기」를 눌렀는데 유형이 비어 있을 때 그 칸에 붙는 사유. 고르면 사라진다. */
  const [typeError, setTypeError] = useState<string | null>(null);
  /** 사유를 붙이면서 그 칸으로 데려간다 — 고칠 곳이 오른쪽이라 눈으로만 알려선 부족하다. */
  const typeRef = useRef<HTMLButtonElement>(null);
  /*
   * 담기가 ①을 기다리는 동안 들고 있는 줄. 포장 단위가 서면 이 줄이 들어간다.
   *
   * ⛔ **상태로 두지 않는다.** ①의 성공 콜백은 `write` 를 부른 «그때의» 렌더를 붙들고 있어,
   * 같은 조작에서 방금 넣은 상태가 아직 비어 있는 것으로 읽힌다 — 포장 단위는 생기고 담은
   * 줄만 조용히 사라진다(실측). 참조는 그 자리에서 갱신되므로 콜백이 최신 값을 본다.
   */
  const pendingLine = useRef<PackingLine | null>(null);
  const [packed, setPacked] = useState(false);
  /* 담은 횟수 — 스캔 칸이 이 값으로 포커스를 되돌린다(`scan-pane.tsx`). */
  const [addedCount, setAddedCount] = useState(0);

  const lots = useTargetLots(entry.workOrderId);
  const unitTypes = useHandlingUnitTypes();
  const parents = useParentHandlingUnits();
  /*
   * 담은 줄에 붙일 품목코드·단위.
   *
   * ⚠ **담은 줄에서만 뽑는다** — 대상 목록 전체로 물으면 아직 담지도 않은 LOT 의 품목까지
   * 화면을 열자마자 건마다 조회한다. 이름이 보이는 자리는 내용물 표 하나뿐이다.
   */
  const labels = useCodeLabels(
    draft.lines.map((line) => line.itemId),
    /*
     * ⚠ **단위는 대상 목록 것도 함께 묻는다.** 스펙 §3 이 좌단 목록에도 「잔여 380 EA」로
     * 단위를 그린다. 품목과 달리 단위는 **한 번의 조회로 전부** 받으므로(`GET /mdm/uoms`)
     * 목록이 길어도 요청이 늘지 않는다 — 품목만 담은 줄로 좁히는 이유가 여기엔 없다.
     */
    [...draft.lines.map((line) => line.uomId), ...(lots.data ?? []).map((lot) => lot.uomId)],
  );

  const workerNo = entry.workerNo;

  const create = useHandlingUnitCreate({
    workerNo: workerNo ?? '',
    onSuccess: (unit) => {
      /*
       * ①이 끝나면 기다리던 줄을 담는다. **여기서만 담는다** — ① 전에 담아 두면 등록이
       * 실패했을 때 화면에는 담긴 것이 보이고 서버에는 포장이 없다.
       */
      const line = pendingLine.current;

      setDraft((current) => ({
        ...current,
        handlingUnit: unit,
        lines: line === null ? current.lines : addLine(current.lines, line),
      }));
      pendingLine.current = null;
      setQuantity('');
      setAddedCount((count) => count + 1);
    },
  });

  const pack = useHandlingUnitPack({
    handlingUnitId: draft.handlingUnit?.handlingUnitId ?? null,
    workerNo: workerNo ?? '',
    onSuccess: () => {
      setPacked(true);
    },
  });

  /*
   * 큐에 담긴 확정이 뒤늦게 서버에 닿았다 — 그 포장이 상위 포장 후보로 올라온다. 화면이 옛
   * 목록을 들고 있으면 방금 확정한 팔레트를 다음 포장에서 고를 수 없다.
   */
  useEffect(() => {
    if (outbox.sentCount === 0) return;

    void queryClient.invalidateQueries({ queryKey: packingWorkKeys.parents });
  }, [outbox.sentCount, queryClient]);

  const entryBlockedReason = ((): string | null => {
    if (entry.workOrderId === null) return t.entry.missingWorkOrder;
    if (workerNo === null) return t.entry.missingWorker;

    return null;
  })();

  /** 목록에서 골랐거나 스캔으로 잡힌 대상. 담기는 이 값이 있어야 열린다. */
  const selectLot = (lot: Lot): void => {
    setSelectedLot(lot);
    setScanError(null);
  };

  const scan = (code: string): void => {
    const found = findScannedLot(lots.data ?? [], code);

    if (found === null) {
      setSelectedLot(null);
      setScanError(t.scan.unknownLot);

      return;
    }

    selectLot(found);
  };

  /*
   * ⭐ **유형 미선택은 「막는 사유」가 아니다**(사용자 결정 2026-09-07 · UI/UX).
   *
   * 앞선 판은 담기를 잠그고 그 아래에 「오른쪽에서 포장 유형을 먼저 고르십시오」를 **늘**
   * 띄웠다. 아직 아무것도 안 한 사람에게 먼저 말을 거는 자리이고, 고칠 곳(오른쪽 유형 칸)과
   * 말하는 곳(왼쪽 담기 아래)이 갈려 있었다.
   *
   * 이제 **담기를 누를 수 있게 두고, 누르면 고칠 칸으로 데려간다** — 사유는 그 칸에 붙는다.
   * ⚠ 스펙은 어느 쪽도 정하지 않았다(§6 은 「확정」만 유형으로 막는다).
   */
  const addNeedsType = draft.handlingUnitTypeCode === null;

  const addBlockedReason = ((): string | null => {
    if (entryBlockedReason !== null) return entryBlockedReason;
    /*
     * ⛔ **첫 줄만 막는다.** 포장 단위가 이미 서 있으면 담기는 화면 안에서만 일어나고
     * (확정 한 번이 전량을 싣는다) 그 확정은 큐가 받는다 — 여기서 함께 막으면 오프라인에서
     * 담던 포장을 마저 담지 못한다.
     */
    if (!outbox.isOnline && draft.handlingUnit === null) return t.scan.blockedOfflineNoUnit;

    return null;
  })();

  const add = (): void => {
    if (addBlockedReason !== null || selectedLot === null || workerNo === null) return;

    /*
     * ⭐ **가까운 것부터 말한다.** 담기는 대상만 고르면 열리므로 누른 사람에게 빠진 것이 둘일
     * 수 있다 — 수량과 유형이다. 유형을 먼저 말하면 **바로 옆 수량 칸을 비워 둔 채 오른쪽으로
     * 보내고**, 고쳐서 돌아와 다시 누르면 그제서야 수량을 말한다(두 번 눌러야 둘을 안다).
     *
     * 수량은 버튼 «옆»이라 인라인 한 줄이면 눈이 닿고, 유형은 «건너편»이라 데려가야 한다 —
     * 그래서 순서도 거리 순이다.
     */
    const verdict = judgeQuantity(quantity);

    if (!verdict.ok) {
      setQuantityError(
        t.scan[
          verdict.reason === 'empty'
            ? 'quantityRequired'
            : verdict.reason === 'notNumber'
              ? 'quantityNumber'
              : 'quantityPositive'
        ],
      );

      return;
    }

    setQuantityError(null);

    /* 수량이 채워진 다음에야 건너편으로 데려간다. */
    if (addNeedsType) {
      setTypeError(t.unit.typeRequired);
      typeRef.current?.focus();

      return;
    }

    const line = toPackingLine(selectedLot, verdict.qty);

    /*
     * ⭐ **첫 줄에서만 포장 단위를 만든다.** 스펙 §3 이 담는 동안 번호를 보이라 하므로 이
     * 시점이고, 이미 만들어져 있으면 화면 안에서만 합산한다 — 확정 한 번이 전량을 싣는다.
     */
    if (draft.handlingUnit === null) {
      if (draft.handlingUnitTypeCode === null) return;

      pendingLine.current = line;
      create.write({
        handlingUnitTypeCode: draft.handlingUnitTypeCode,
        parentHandlingUnitId: draft.parentHandlingUnitId,
      });

      return;
    }

    setDraft((current) => ({ ...current, lines: addLine(current.lines, line) }));
    setQuantity('');
    setAddedCount((count) => count + 1);
  };

  /** 스펙 §6 의 확정 차단 조건. **문장과 다른 축이다** — 말하지 않아도 막는다. */
  const canConfirm =
    !packed &&
    entryBlockedReason === null &&
    draft.handlingUnitTypeCode !== null &&
    draft.lines.length > 0 &&
    draft.handlingUnit !== null;

  const confirmBlockedReason = ((): string | null => {
    /*
     * ⛔ **확정을 마친 포장에 다시 손대지 않는다.** 확정해도 담은 것은 화면에 그대로 남아
     * 있어, 이 줄이 없으면 버튼이 계속 눌린다 — 두 번째 요청은 «새» 멱등 키로 나가므로
     * 서버가 앞 쓰기와 묶어 주지도 못한다. 되돌릴 화면이 없는 쓰기다(스펙 §8-4).
     */
    if (packed) return t.confirm.blockedPacked;
    if (entryBlockedReason !== null) return entryBlockedReason;
    /*
     * ⛔ **유형 미선택·내용물 없음은 말로 적지 않는다.** 둘 다 **바로 위 화면이 이미 말하고
     * 있다** — 유형 칸이 비어 있고(누르면 그 칸이 사유를 낸다) 내용물 표가 「내용물이 비어
     * 있습니다」라고 적혀 있다. 액션바에서 되풀이하면 늘 떠 있는 문장이 되고, 정작 읽어야
     * 할 사유(확정 마침·진입 인자)의 무게를 깎는다(사용자 지적 2026-09-07).
     *
     * ⚠ **막는 것은 그대로다** — 스펙 §6 이 「포장 유형 미선택 · 내용물 0 → 확정 비활성」로
     * 정했다. 걷은 것은 «문장»이지 «차단»이 아니다.
     */
    return null;
  })();

  const confirm = (): void => {
    if (confirmBlockedReason !== null || !canConfirm) return;

    const body = toPackBody(draft.lines, new Date());

    /*
     * ⭐ **끊겨 있으면 큐에 담고 그 자리에서 확정으로 본다**(C-1 #2 · 스펙 §6). 시각 두 칸은
     * 담는 «지금»을 박는다 — 서버가 받은 때가 아니라 작업자가 확정한 때다(C-1 #3 · C-8).
     *
     * ⛔ **연결돼 있을 때까지 큐로 보내지 않는다.** 서버가 그 자리에서 되돌리는 것 둘(내용물
     * 없음 400 · 이미 확정 409)은 사용자가 할 일이 갈리는 오류라, 큐에 넣으면 그 말이 한 박자
     * 늦게 배너로만 온다.
     */
    if (!outbox.isOnline) {
      const handlingUnitId = draft.handlingUnit?.handlingUnitId;
      if (handlingUnitId === undefined) return;

      outbox.enqueue({ handlingUnitId, workerNo: workerNo ?? '', body });
      setPacked(true);

      return;
    }

    pack.write(body);
  };

  /** 확정이 끝나면 다음 포장을 새로 시작한다 — 같은 포장 단위를 다시 쓰지 않는다. */
  const startNext = (): void => {
    setDraft(emptyPackingDraft);
    pendingLine.current = null;
    setSelectedLot(null);
    setQuantity('');
    setScanError(null);
    setQuantityError(null);
    setPacked(false);
    setAddedCount(0);
    pack.reset();
    create.reset();
  };

  const locked = draft.handlingUnit !== null;
  const writeError = create.error ?? pack.error;

  return (
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {/*
         * ⛔ **작업지시를 상태 칩으로 그리지 않는다.** 칩은 「지금 어떤 상태인가」를 색으로 말하는
         * 자리이고, 작업지시는 색이 붙을 상태가 아니라 **무엇을 보고 있는가**다. 스펙 §3 머리줄이
         * 그것을 화면명 옆 평문으로 그린다 — 오른쪽 끝은 단말·연결 같은 상태만 선다.
         */}
        <p className="pop-context">
          {`${t.device.workOrderLabel} ${
            entry.workOrderId === null ? t.device.workOrderUnknown : String(entry.workOrderId)
          }`}
        </p>
        <div className="pop-context-right">
          <Chip status={identity.terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${
              identity.terminalId === null ? t.device.terminalUnknown : String(identity.terminalId)
            }`}
          </Chip>
        </div>
      </header>

      {entryBlockedReason !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{entryBlockedReason}</AlertBanner>
        </div>
      )}

      {lots.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.lotList.loadFailed}>
            {messages.httpError.description}
          </AlertBanner>
        </div>
      )}

      {writeError !== null && !packed && (
        <PackErrorBanner
          error={writeError}
          title={create.error === null ? t.error.confirmTitle : t.unit.createFailed}
          onRetry={create.error === null ? confirm : add}
        />
      )}

      {(outbox.pendingCount > 0 || !outbox.isOnline) && (
        <div className="banner-slot">
          {/*
            ⛔ **보낼 것이 없는데 건수를 제목으로 내지 않는다.** 끊긴 것과 밀리는 것은 다른
            사정이라 배너가 둘 다에 뜨는데, 그때 「미전송 0건」이 제목이면 작업자는 무엇이
            0건이라는 것인지 읽을 수 없다 — 끊겼을 뿐이면 끊겼다고 말한다(실측).
          */}
          <AlertBanner
            variant="warning"
            title={
              outbox.pendingCount > 0
                ? t.outbox.pending(outbox.pendingCount)
                : messages.common.connection.offline
            }
          >
            {outbox.isOnline ? t.outbox.queued : t.outbox.offline}
          </AlertBanner>
        </div>
      )}

      {outbox.isStalled && (
        <div className="banner-slot">
          <AlertBanner
            variant="error"
            title={t.outbox.stalled}
            action={
              /* POP 터치 등급 — 장갑 낀 손이 누른다. */
              <Button variant="outlined" size="2xl" onClick={outbox.retryNow}>
                {t.outbox.retryNow}
              </Button>
            }
          >
            {t.outbox.pending(outbox.pendingCount)}
          </AlertBanner>
        </div>
      )}

      {outbox.rejection !== null && (
        <PackErrorBanner
          error={outbox.rejection}
          title={t.outbox.rejected}
          onRetry={outbox.clearRejection}
        />
      )}

      {packed && (
        <div className="banner-slot">
          <AlertBanner
            variant="success"
            title={t.confirm.done}
            action={
              <Button variant="outlined" size="sm" onClick={startNext}>
                {t.confirm.startNext}
              </Button>
            }
          />
        </div>
      )}

      <div className="pop-panes">
        <Card bordered className="pop-section pack-work-scan" aria-label={t.scan.sectionLabel}>
          <h2 className="pane-title">{t.scan.sectionLabel}</h2>
          <ScanPane
            selectedLotNo={selectedLot?.lotNo ?? null}
            quantity={quantity}
            onQuantityChange={setQuantity}
            onScan={scan}
            onAdd={add}
            blockedReason={addBlockedReason}
            scanError={scanError}
            quantityError={quantityError}
            addedCount={addedCount}
            isAdding={create.isSaving}
          />

          <h2 className="pane-title">{t.lotList.sectionLabel}</h2>
          <LotListPane
            lots={lots.data ?? []}
            selectedLotId={selectedLot?.lotId ?? null}
            uomCodeOf={labels.uomCodeOf}
            onSelect={selectLot}
          />
        </Card>

        <Card bordered className="pop-section" aria-label={t.unit.sectionLabel}>
          {/*
            ⭐ **번호는 구획 제목 옆에 선다**(스펙 §3 — 「《포장 단위》 HU-…」). 별도 줄로
            크게 세우면 그 아래 「유형」이 오른쪽 「상위 포장」과 어긋나 보인다.
          */}
          <h2 className="pane-title pack-work-unit-heading">
            {t.unit.sectionLabel}
            {draft.handlingUnit !== null && (
              <span className="pack-work-unit-no">{draft.handlingUnit.handlingUnitNo}</span>
            )}
          </h2>
          <PackingPane
            draft={draft}
            unitTypes={unitTypes.data ?? []}
            unitTypesFailed={unitTypes.isError}
            parents={parents.data ?? []}
            parentsFailed={parents.isError}
            locked={locked}
            typeError={typeError}
            typeRef={typeRef}
            onTypeChange={(code) => {
              setTypeError(null);
              setDraft((current) => ({ ...current, handlingUnitTypeCode: code }));
            }}
            onParentChange={(parentId) => {
              setDraft((current) => ({ ...current, parentHandlingUnitId: parentId }));
            }}
            onConfirm={confirm}
            labels={labels}
            blockedReason={confirmBlockedReason}
            canConfirm={canConfirm}
            isConfirming={pack.isSaving}
          />
        </Card>
      </div>
    </main>
  );
};
