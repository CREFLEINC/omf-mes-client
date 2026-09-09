import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { addLine, findScannedLot, judgeQuantity, toPackingLine } from './contents';
import { usePackingEntry } from './entry-context';
import { PackErrorBanner } from './error-banner';
import { LotListPane } from './lot-list-pane';
import { useHandlingUnitCreate, useHandlingUnitDiscard, useHandlingUnitPack } from './mutations';
import { usePackingWorkOutbox } from './outbox';
import { samePackBody, toCreateBody, toPackBody } from './pack-request';
import { PackingPane } from './packing-pane';
import {
  packingWorkKeys,
  useCodeLabels,
  useHandlingUnitTypes,
  useParentHandlingUnits,
  useTargetLots,
} from './queries';
import { ScanPane } from './scan-pane';
import { emptyPackingDraft, type HandlingUnitPack, type Lot, type PackingLine } from './types';

const t = messages.packingWork;

/**
 * P-02-08 포장 작업(LOT 스캔·제품 포장).
 *
 * ⭐ **호출은 둘이다**(스펙 §5-6 · 요구서 §3-17). 첫 줄을 담을 때 포장 단위를 만들고
 * (`POST /inventory/handling-units`), 확정이 내용물과 함께 닫는다(`:pack`). 그래서 §3 도면대로
 * **담는 동안 포장 번호가 보인다.**
 *
 * ⭐ **담다가 그만두면 취소가 거둔다**(스펙 §5-7) — `DELETE …/{handlingUnitId}`. 호출이 갈리며
 * 「번호는 있고 내용물은 없는」 상태가 생겼고, 그대로 두면 빈 포장이 쌓인다.
 *
 * ⛔ **「잔여」와 초과 스캔 방어를 만들지 않았다** — 이미 포장된 수량을 뺀 잔여를 계약이 내려
 * 주지 않는다. 없는 값을 화면이 계산하면 실물과 갈린다.
 *
 * ⛔ **단말 게이팅을 걸지 않는다** — 8플래그에 포장이 없다(스펙 §5-1). 가까운 것을 임의로
 * 매핑하면 엉뚱한 권한이 걸린다. 집행은 서버의 403 이다.
 *
 * ⚠ **오프라인은 반쪽이다 — 그것이 설계다**(스펙 §6). 포장번호를 서버가 매기고 확정이 그
 * 번호를 경로 인자로 받으므로 **새 포장 시작은 끊긴 채로 성립하지 않는다.** 연결이 없으면
 * 담기 시작을 막고 사유를 보이며(C-5 온라인 전용 표준형 4항 준용), **담던 포장의 확정은**
 * **큐가 받는다.** ⛔ 화면 전체가 온라인 전용이 되는 것은 아니다.
 *
 * ⭐ **확정이 「언제 일어난 일인가」를 싣는다**(C-8) — `businessDate`·`occurredAt`. 큐에 밀린
 * 확정이 자정을 넘겨 전송돼도 원장이 두 건으로 적재되지 않는다.
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
   * 온라인으로 던진 확정의 «본문». 큐가 그 확정을 이어받을 때 **키와 한 벌로** 필요하다 —
   * 키만 물려주고 다른 본문을 보내면 서버가 앞 쓰기의 중복으로 보고 흡수한다(C-1 #6).
   *
   * ⛔ **상태로 두지 않는다.** 확정을 누른 «그때» 값을 다음 조작에서 그대로 읽어야 하고,
   * 이 값이 바뀐다고 화면이 다시 그려질 이유도 없다.
   */
  const attemptedBody = useRef<HandlingUnitPack | null>(null);
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

  /**
   * 담기 시작이 만든 포장 단위를 기다리는 줄.
   *
   * ⭐ **담기 한 번이 두 가지 일을 한다** — 포장 단위가 없으면 먼저 만들고, 응답이 오면 그때
   * 줄을 담는다. 서버를 기다리는 동안 사용자가 다시 누르지 못하도록 담기 버튼을 잠근다.
   */
  const pendingLine = useRef<PackingLine | null>(null);

  const create = useHandlingUnitCreate({
    workerNo: workerNo ?? '',
    onSuccess: (unit) => {
      /* 번호가 생겼다 — 스펙 §3 의 번호 자리가 여기서 채워진다. */
      const line = pendingLine.current;
      pendingLine.current = null;

      setDraft((current) => ({
        ...current,
        handlingUnit: unit,
        lines: line === null ? current.lines : addLine(current.lines, line),
      }));
      if (line !== null) {
        setQuantity('');
        setAddedCount((count) => count + 1);
      }
    },
  });

  const pack = useHandlingUnitPack({
    workerNo: workerNo ?? '',
    handlingUnitId: draft.handlingUnit?.handlingUnitId ?? null,
    onSuccess: () => {
      setPacked(true);
    },
  });

  const discard = useHandlingUnitDiscard({
    workerNo: workerNo ?? '',
    handlingUnitId: draft.handlingUnit?.handlingUnitId ?? null,
    onSuccess: () => {
      startNext();
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

  /**
   * 담기를 막는 사유.
   *
   * ⛔ **끊긴 동안에는 «새» 포장을 시작할 수 없다**(스펙 §6). 포장번호를 서버가 매기고 확정이
   * 그 번호를 경로 인자로 받으므로, 단말이 만들 수 없는 값을 기다리는 요청은 큐에 담을 수조차
   * 없다. C-5 온라인 전용 표준형 4항 준용 — **저장만 막고 화면 상태는 유지**한다.
   *
   * ⭐ **이미 시작한 포장에는 계속 담을 수 있다.** 담기는 화면 안에서만 일어나고, 그 확정은
   * 큐가 받는다 — 화면 «전체»가 온라인 전용이 되는 것은 아니다.
   */
  const addBlockedReason = ((): string | null => {
    if (entryBlockedReason !== null) return entryBlockedReason;
    if (draft.handlingUnit === null && !outbox.isOnline) return t.unit.offlineStartBlocked;

    return null;
  })();

  const add = (): void => {
    /* ⛔ 포장 단위를 만드는 동안 다시 누르지 않는다 — 빈 포장이 두 개 생긴다. */
    if (create.isSaving) return;
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
     * ⭐ **첫 줄이 포장 단위를 만든다**(스펙 §5-6 「담기 시작에 포장 단위를 만들고」).
     *
     * ⛔ **스캔하자마자 만들지 않는다** — 스캔이 헛돌거나 수량을 잘못 쳐서 되돌아가면 번호만
     * 있고 아무것도 담기지 않은 포장이 남는다. 유형은 생성 본문의 필수 칸이라 그 전에는 만들
     * 수도 없다.
     */
    if (draft.handlingUnit === null) {
      const createBody = toCreateBody(draft);
      if (createBody === null) return;

      /* 응답이 와야 줄을 담는다 — 그 사이 다시 누르지 못하도록 버튼이 잠긴다. */
      pendingLine.current = line;
      create.write(createBody);

      return;
    }

    /* ⭐ **둘째 줄부터는 화면 안에서만 일어난다** — 확정이 전량을 통째로 싣는다. */
    setDraft((current) => ({ ...current, lines: addLine(current.lines, line) }));
    setQuantity('');
    setAddedCount((count) => count + 1);
  };

  /** 스펙 §6 의 확정 차단 조건. **문장과 다른 축이다** — 말하지 않아도 막는다. */
  const canConfirm =
    !packed &&
    entryBlockedReason === null &&
    draft.handlingUnitTypeCode !== null &&
    /* 포장 단위가 있어야 확정할 경로가 있다 — 첫 줄을 담을 때 만들어진다(스펙 §5-6). */
    draft.handlingUnit !== null &&
    draft.lines.length > 0;

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

    /*
     * ⭐ **시각 두 칸을 «여기서» 박는다**(C-8). 보내는 시점의 값을 쓰면 자정을 넘긴 큐 항목의
     * 영업일이 바뀌어 원장이 두 건으로 적재된다.
     */
    const body = toPackBody(draft.lines, new Date());
    if (body === null || draft.handlingUnit === null) return;

    /*
     * ⭐ **끊겨 있으면 큐에 담고 그 자리에서 확정으로 본다**(C-1 #2 · 스펙 §6).
     *
     * ⛔ **확정한 때를 실을 자리가 없다** — 계약의 `HandlingUnitCreate` 에 시각 칸이 없고
     * 헤더에도 없어, 큐에 밀린 확정은 서버가 받은 때로 기록된다(C-1 #3 · C-8 을 이 화면에서는
     * 지킬 수 없다).
     *
     * ⛔ **연결돼 있을 때까지 큐로 보내지 않는다.** 서버가 그 자리에서 되돌리는 것 둘(내용물
     * 없음 400 · 이미 확정 409)은 사용자가 할 일이 갈리는 오류라, 큐에 넣으면 그 말이 한 박자
     * 늦게 배너로만 온다.
     */
    if (!outbox.isOnline) {
      /*
       * ⭐ **온라인으로 이미 던졌으나 적용 여부를 모르는 확정이 있으면 그것을 그대로 이어받는다.**
       * 통신이 끊기며 끝난 확정은 서버가 받았는지 알 수 없다 — 큐가 새 키로 보내면 서버가 둘을
       * 묶어 주지 못해 되돌릴 수 없는 확정이 두 번 설 수 있다(C-1 #5 · 스펙 §8-4).
       *
       * ⛔ **키만 이어받지 않는다.** 「같은 키 = 같은 값」이 성립해야 서버가 흡수해도 잃는 것이
       * 없다. 그래서 그 시도의 «본문»을 함께 보낸다 — 시각 두 칸도 그때 것이 나가야 한다
       * (같은 키에 영업일이 갈리면 서버가 두 건으로 적재한다 · C-8).
       *
       * ⚠ **담은 것이 달라졌으면 이어받지 않는다.** 그 키는 이미 다른 쓰기의 키이고, 그대로
       * 보내면 나중에 담은 줄이 서버에서 흡수돼 사라진다. 그때는 새 확정으로 간다.
       */
      const attemptedKey = pack.peekIdempotencyKey();
      const attempted = attemptedBody.current;
      const resumable =
        attemptedKey !== null && attempted !== null && samePackBody(attempted, body);

      /*
       * ⭐ **이제 「그때 보낸 것」이 실제로 다르다.** 본문에 시각 두 칸이 생겨(C-8) 다시 지으면
       * 값이 달라진다 — 같은 키에 다른 영업일이 나가면 서버가 두 건으로 적재하므로, 이어받을
       * 때는 반드시 그때의 본문을 그대로 보낸다.
       */
      outbox.enqueue({
        kind: 'pack',
        handlingUnitId: draft.handlingUnit.handlingUnitId,
        workerNo: workerNo ?? '',
        body: resumable ? attempted : body,
        idempotencyKey: resumable ? attemptedKey : null,
      });
      setPacked(true);

      return;
    }

    attemptedBody.current = body;
    pack.write(body);
  };

  /**
   * 확정 전 취소 — **담다가 그만둔 빈 포장을 거둔다**(스펙 §5-7).
   *
   * ⛔ **확정한 뒤에는 열지 않는다** — 서버가 409 로 막고, 확정 후 해체는 화면이 없다(§8-4).
   * ⛔ **끊긴 동안에는 열지 않는다** — 이 호출은 큐 대상이 아니다.
   */
  const canDiscard =
    !packed && draft.handlingUnit !== null && outbox.isOnline && entryBlockedReason === null;

  const discardUnit = (): void => {
    if (!canDiscard) return;

    discard.write({});
  };

  /** 확정이 끝나면 다음 포장을 새로 시작한다 — 같은 포장 단위를 다시 쓰지 않는다. */
  const startNext = (): void => {
    setDraft(emptyPackingDraft);
    setSelectedLot(null);
    setQuantity('');
    setScanError(null);
    setQuantityError(null);
    setPacked(false);
    setAddedCount(0);
    pendingLine.current = null;
    create.reset();
    pack.reset();
    discard.reset();
    /*
     * ⛔ **앞 포장의 멱등 키를 다음 포장으로 들고 가지 않는다.** `reset` 은 「적용됐는지 모르는
     * 쓰기가 있다」는 사실까지 지우지는 않으므로, 여기서 버리지 않으면 다음 포장의 오프라인
     * 확정이 «앞 포장의 키»로 큐에 담긴다 — 큐는 키로 항목을 지우기 때문에 앞 건이 성공하는
     * 순간 뒤엣것까지 함께 내려간다(실측).
     */
    create.discardIdempotencyKey();
    pack.discardIdempotencyKey();
    discard.discardIdempotencyKey();
    attemptedBody.current = null;
    /*
     * ⛔ **앞 포장의 거부를 새 포장 화면에 들고 가지 않는다.** 큐가 거부한 사실은 그 포장의
     * 것이라, 여기 남으면 아직 아무것도 담지 않은 화면이 「받지 않았습니다」를 띄운다.
     */
    outbox.clearRejection();
  };

  /*
   * 담기 시작하면 유형·상위를 바꿀 수 없다.
   *
   * ⭐ **포장 단위가 생긴 순간부터 잠근다** — 그 값은 생성 본문에 이미 실려 서버에 있다. 화면에서
   * 바꿔도 서버의 포장은 그대로라, 바꿀 수 있게 두면 화면과 기록이 갈린다.
   */
  const locked = draft.handlingUnit !== null || draft.lines.length > 0;

  /*
   * 쓰기 셋의 오류를 한 자리에서 낸다 — 사용자에게는 「방금 누른 것이 안 됐다」 하나다.
   * ⚠ 먼저 난 것부터 본다: 담기 시작이 실패했으면 확정·취소는 아예 시도되지 않았다.
   */
  const writeError = create.error ?? pack.error ?? discard.error;

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
          title={create.error !== null ? t.error.startTitle : t.error.confirmTitle}
          onRetry={create.error !== null ? add : confirm}
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
            {/*
              ⚠ **번호는 확정 뒤에야 생긴다.** 스펙 §3 은 담는 동안 보이라 했지만 등록을 확정
              시점으로 옮기면서 그 자리가 비었다 — 비워 두면 「번호가 사라졌다」로 읽히므로
              언제 생기는지 말한다.
            */}
            <span className="pack-work-unit-no">
              {draft.handlingUnit?.handlingUnitNo ?? t.unit.numberPending}
            </span>
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
            canDiscard={canDiscard}
            isDiscarding={discard.isSaving}
            onDiscard={discardUnit}
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
