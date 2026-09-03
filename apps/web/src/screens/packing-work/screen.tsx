import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { addLine, findScannedLot, judgeQuantity, toPackingLine } from './contents';
import { usePackingEntry } from './entry-context';
import { PackErrorBanner } from './error-banner';
import { LotListPane } from './lot-list-pane';
import { useHandlingUnitCreate, useHandlingUnitPack } from './mutations';
import { toPackBody } from './pack-request';
import { PackingPane } from './packing-pane';
import { useHandlingUnitTypes, useParentHandlingUnits, useTargetLots } from './queries';
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
 */
export const PackingWorkScreen = () => {
  const titleId = useId();
  const entry = usePackingEntry();
  const identity = usePopIdentity();

  const [draft, setDraft] = useState(emptyPackingDraft);
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [quantity, setQuantity] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  /*
   * 담기가 ①을 기다리는 동안 들고 있는 줄. 포장 단위가 서면 이 줄이 들어간다.
   *
   * ⛔ **상태로 두지 않는다.** ①의 성공 콜백은 `write` 를 부른 «그때의» 렌더를 붙들고 있어,
   * 같은 조작에서 방금 넣은 상태가 아직 비어 있는 것으로 읽힌다 — 포장 단위는 생기고 담은
   * 줄만 조용히 사라진다(실측). 참조는 그 자리에서 갱신되므로 콜백이 최신 값을 본다.
   */
  const pendingLine = useRef<PackingLine | null>(null);
  const [packed, setPacked] = useState(false);

  const lots = useTargetLots(entry.workOrderId);
  const unitTypes = useHandlingUnitTypes();
  const parents = useParentHandlingUnits();

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
    },
  });

  const pack = useHandlingUnitPack({
    handlingUnitId: draft.handlingUnit?.handlingUnitId ?? null,
    workerNo: workerNo ?? '',
    onSuccess: () => {
      setPacked(true);
    },
  });

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

  const addBlockedReason = ((): string | null => {
    if (entryBlockedReason !== null) return entryBlockedReason;
    if (draft.handlingUnitTypeCode === null) return t.scan.blockedNoType;

    return null;
  })();

  const add = (): void => {
    if (addBlockedReason !== null || selectedLot === null || workerNo === null) return;

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
  };

  const confirmBlockedReason = ((): string | null => {
    if (entryBlockedReason !== null) return entryBlockedReason;
    if (draft.handlingUnitTypeCode === null) return t.confirm.blockedNoType;
    if (draft.lines.length === 0) return t.confirm.blockedNoContents;
    if (draft.handlingUnit === null) return t.confirm.blockedNoUnit;

    return null;
  })();

  const confirm = (): void => {
    if (confirmBlockedReason !== null) return;

    pack.write(toPackBody(draft.lines, new Date()));
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
    pack.reset();
    create.reset();
  };

  const locked = draft.handlingUnit !== null;
  const writeError = create.error ?? pack.error;

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          <Chip status={entry.workOrderId === null ? 'warning' : 'info'}>
            {`${t.device.workOrderLabel} ${
              entry.workOrderId === null ? t.device.workOrderUnknown : String(entry.workOrderId)
            }`}
          </Chip>
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
          >
            {t.confirm.doneBody}
          </AlertBanner>
        </div>
      )}

      <div className="pop-panes">
        <Card bordered className="pop-section" aria-label={t.scan.sectionLabel}>
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
            isAdding={create.isSaving}
          />

          <h2 className="pane-title">{t.lotList.sectionLabel}</h2>
          <LotListPane
            lots={lots.data ?? []}
            selectedLotId={selectedLot?.lotId ?? null}
            onSelect={selectLot}
          />
        </Card>

        <Card bordered className="pop-section" aria-label={t.unit.sectionLabel}>
          <h2 className="pane-title">{t.unit.sectionLabel}</h2>
          <PackingPane
            draft={draft}
            unitTypes={unitTypes.data ?? []}
            unitTypesFailed={unitTypes.isError}
            parents={parents.data ?? []}
            parentsFailed={parents.isError}
            locked={locked}
            onTypeChange={(code) => {
              setDraft((current) => ({ ...current, handlingUnitTypeCode: code }));
            }}
            onParentChange={(parentId) => {
              setDraft((current) => ({ ...current, parentHandlingUnitId: parentId }));
            }}
            onConfirm={confirm}
            blockedReason={confirmBlockedReason}
            isConfirming={pack.isSaving}
          />
        </Card>
      </div>
    </main>
  );
};
