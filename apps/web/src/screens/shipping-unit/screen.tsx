import { AlertBanner, Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useMemo, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
/*
 * ⛔ **DS 드롭다운을 직접 쓰지 않는다**(공유계약 G-34 · `routes/pop-common-rules.test.ts` 가
 *    지킨다). 장갑 낀 손에는 좁은 목록보다 큰 버튼이 선 팝업이 낫다.
 */
import { PopSelect as Select } from '../../patterns/pop-select';
import { ScanField } from '../packing-result/scan-field';
import { DELIVERY_LABEL } from '../shipping-packing-label/codes';
import { usePrinters } from '../shipping-packing-label/queries';
import { toDefaultPrinterName } from '../shipping-packing-label/types';

import {
  INITIAL_STATE,
  canClose,
  canCreateUnit,
  canScanBox,
  isClosed,
  previewRows,
  type ComposeBusy,
  type ComposeState,
} from './compose-state';
import { useDeliveryIssue, type DeliveryIssueOutcome } from './delivery-issue';
import { useShippingUnitWrites } from './mutations';
import {
  SHIPMENT_WINDOW_DAYS,
  useComposableShipments,
  useShippingUnitDetail,
  useShippingUnitTypes,
} from './queries';
import type { AddBoxRejection, ShippingUnitBox } from './types';

const t = messages.shippingUnit;

/**
 * 거절을 사람이 읽는 말로.
 *
 * ⛔ **모르는 사유를 다섯 중 하나로 접지 않는다.** 엉뚱한 안내는 담당에게 **할 수 없는 조치**를
 *    되풀이하게 만든다 — 서버가 말했으면 그 말을 그대로 보인다.
 */
const rejectionText = (rejection: AddBoxRejection): string => {
  switch (rejection.kind) {
    case 'unitClosed':
      return t.rejection.unitClosed;
    case 'notPacked':
      return t.rejection.notPacked;
    case 'noAllocation':
      return t.rejection.noAllocation;
    case 'otherShipment':
      return t.rejection.otherShipment;
    case 'alreadyAssigned':
      return t.rejection.alreadyAssigned;
    case 'shipmentCancelled':
      return t.rejection.shipmentCancelled;
    case 'notFound':
      return t.rejection.notFound;
    default:
      return rejection.message === null
        ? t.rejection.unknown
        : t.rejection.spoken(rejection.message);
  }
};

const issueText = (outcome: DeliveryIssueOutcome): string => {
  if (outcome.kind === 'issueFailed') return t.close.failed;

  const issued = t.close.issued(outcome.issueSeq);

  if (outcome.kind === 'printed') return `${issued} · ${t.close.printed}`;
  if (outcome.kind === 'noBridge') return `${issued} · ${t.close.noBridge}`;

  return `${issued} · ${t.close.printFailed(outcome.reason)}`;
};

/**
 * **P-04-05 출하 단위 구성** — 포장이 끝난 상자를 스캔해 묶고, 마감하면 납품 라벨이 나간다
 * (SHIP-UNIT-01 · 설계 §6).
 *
 * ⚠ **세로 예산이 슬랙 0 이다**(헤더 64 + 본문 616 + 액션바 88 = 768). ① 72 · ② 72 ·
 *   ③ 남는 것 · ④ 88 이고 **스크롤은 ③ 하나**다. ①②④ 는 `pop-fixed` 로 높이 배분에서
 *   빠진다 — 그러지 않으면 넷이 남는 높이를 나눠 갖고 목록이 세 줄로 눌린다(#1092 전례).
 *
 * ⛔ **마감은 되돌릴 수 없다**(설계 §4-6). 확인창이 그 사실을 먼저 말하고, 「지금 마감할 수
 *    있는가」는 `compose-state` 가 판정한다 — 렌더 코드에 흩어 두면 시험이 못 붙든다.
 */
export const ShippingUnitScreen = () => {
  const identity = usePopIdentity();
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [shippingUnitId, setShippingUnitId] = useState<number | null>(null);
  const [busy, setBusy] = useState<ComposeBusy>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [outcome, setOutcome] = useState<DeliveryIssueOutcome | null>(null);
  /**
   * 마지막 쓰기가 준 판 번호.
   *
   * ⛔ **상세가 준 것만 믿지 않는다.** `:add-box`·`DELETE` 도 판을 올리므로 **쓰기 응답의 값이
   *    가장 새것**이다 — 낡은 값으로 마감을 걸면 409 다.
   */
  const [etag, setEtag] = useState<string | null>(null);

  const shipments = useComposableShipments();
  const types = useShippingUnitTypes();
  const detail = useShippingUnitDetail(shippingUnitId);
  const printers = usePrinters(DELIVERY_LABEL);
  const writes = useShippingUnitWrites(identity.workerNo);
  const issueDeliveryLabel = useDeliveryIssue(identity.workerNo);

  const unit = detail.data?.unit ?? null;
  const state: ComposeState = useMemo(
    () => ({ ...INITIAL_STATE, shipmentId, typeCode, busy, unit }),
    [busy, shipmentId, typeCode, unit],
  );
  const preview = previewRows(unit);
  const currentEtag = etag ?? detail.data?.etag ?? null;

  /* ⛔ 한 번에 하나만 나간다 — 장갑 낀 손이 빠르게 두 번 누르면 같은 렌더에서 두 번 들어온다. */
  const run = useCallback(
    async (kind: ComposeBusy, work: () => Promise<void>): Promise<void> => {
      if (busy !== 'idle') return;

      setBusy(kind);
      try {
        await work();
      } finally {
        setBusy('idle');
      }
    },
    [busy],
  );

  const onCreate = (): void => {
    if (shipmentId === null || typeCode === null) return;

    void run('creating', async () => {
      setNotice(null);
      setOutcome(null);
      try {
        const created = await writes.createUnit(shipmentId, typeCode);
        setShippingUnitId(created.unit.shippingUnitId);
        setEtag(created.etag);
      } catch {
        setNotice(t.unit.failed);
      }
    });
  };

  const onScan = (handlingUnitNo: string): void => {
    if (shippingUnitId === null) return;

    void run('adding', async () => {
      setNotice(null);
      const result = await writes.addBox(shippingUnitId, handlingUnitNo);

      if (result.kind === 'rejected') {
        setNotice(rejectionText(result.rejection));

        return;
      }

      setEtag(result.snapshot.etag);
      await detail.refetch();
      setNotice(t.scan.added(handlingUnitNo.trim()));
    });
  };

  const onRemove = (handlingUnitId: number): void => {
    if (shippingUnitId === null) return;

    void run('removing', async () => {
      setNotice(null);
      try {
        const snapshot = await writes.removeBox(shippingUnitId, handlingUnitId);
        setEtag(snapshot.etag);
        await detail.refetch();
      } catch {
        setNotice(t.boxes.removeFailed);
      }
    });
  };

  const onClose = (): void => {
    if (shippingUnitId === null || currentEtag === null) return;

    setConfirmOpen(false);
    void run('closing', async () => {
      setNotice(null);
      try {
        const snapshot = await writes.closeUnit(shippingUnitId, currentEtag);
        setEtag(snapshot.etag);
        await detail.refetch();
        /*
         * ⭐ **마감과 발행을 갈라 둔다.** 마감은 되돌릴 수 없으므로 라벨이 안 나왔다고 마감을
         *    없던 일로 만들 수 없다 — 갈라 두어야 「마감은 됐고 라벨만 다시 뽑으면 된다」를
         *    말할 수 있다.
         */
        setOutcome(
          await issueDeliveryLabel(snapshot.unit, toDefaultPrinterName(printers.data ?? [])),
        );
        /* 방금 묶은 상자가 미구성에서 빠진다 — 목록을 다시 받는다. */
        await shipments.refetch();
      } catch {
        setNotice(t.close.failed);
      }
    });
  };

  const boxColumns: Column<ShippingUnitBox>[] = [
    { key: 'seq', header: t.boxes.columnSeq, align: 'center', render: (row) => String(row.seq) },
    { key: 'no', header: t.boxes.columnNo, render: (row) => row.handlingUnitNo },
    {
      key: 'contents',
      header: t.boxes.columnContents,
      render: (row) =>
        row.contents
          .map((content) =>
            t.boxes.content(
              content.itemCode,
              content.lotNo,
              `${content.qty.toLocaleString('ko-KR')} ${content.uomCode}`,
            ),
          )
          .join(' / '),
    },
    {
      key: 'remove',
      header: t.boxes.columnAction,
      align: 'center',
      render: (row) => (
        <Button
          variant="outlined"
          size="md"
          className="pop-touch-target"
          disabled={!canScanBox(state)}
          onClick={() => {
            onRemove(row.handlingUnitId);
          }}
        >
          {busy === 'removing' ? t.boxes.removing : t.boxes.remove}
        </Button>
      ),
    },
  ];

  return (
    <main className="pop-shell pop-ui shipping-unit-shell" aria-labelledby="shipping-unit-title">
      <header className="pop-header">
        <h1 id="shipping-unit-title" className="pop-title">
          {t.title}
        </h1>
        {unit !== null && (
          <p className="pop-context">{`${unit.shippingUnitNo} · ${t.unit.status[unit.statusCode]}`}</p>
        )}
      </header>

      {notice !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{notice}</AlertBanner>
        </div>
      )}
      {outcome !== null && (
        <div className="banner-slot">
          {/* ⚠ 기록은 남고 종이만 안 나온 상태가 있다 — 그때는 재발행으로 가는 길을 함께 말한다. */}
          <AlertBanner variant={outcome.kind === 'printed' ? 'success' : 'warning'}>
            {outcome.kind === 'printed'
              ? issueText(outcome)
              : `${issueText(outcome)} ${t.close.reissueHint}`}
          </AlertBanner>
        </div>
      )}

      {/* ① 출하 선택 — 서버가 「미구성 PACKED 상자가 있는 출하」만 걸러 준다(설계 §5-1). */}
      <section className="pop-section pop-fixed shipping-unit-entry" aria-label={t.entry.label}>
        <span className="field-label" id="shipping-unit-entry-label">
          {t.entry.label}
        </span>
        <Select
          size="xl"
          aria-labelledby="shipping-unit-entry-label"
          placeholder={t.entry.placeholder}
          value={shipmentId === null ? null : String(shipmentId)}
          onChange={(value) => {
            setNotice(null);
            setOutcome(null);
            /* 출하를 바꾸면 만들던 단위는 그 출하의 것이 아니다 — 함께 비운다. */
            setShipmentId(value === null ? null : Number(value));
            setShippingUnitId(null);
            setEtag(null);
          }}
          options={(shipments.data ?? []).map((shipment) => ({
            value: String(shipment.shipmentId),
            label: `${shipment.shipmentNo} · ${t.entry.boxes(shipment.unassignedPackedBoxCount)}`,
          }))}
        />
        {shipments.isError ? (
          <p className="field-note">{t.entry.failed}</p>
        ) : shipments.isPending ? (
          <p className="field-note">{t.entry.loading}</p>
        ) : (shipments.data ?? []).length === 0 ? (
          <p className="field-note">{t.entry.empty}</p>
        ) : null}
        {/*
         * ⚠ **창을 늘 적는다.** 계약이 기간을 필수로 두어(「기간 필수(L-3)」) 창 밖에서 아직
         *   구성되지 않은 출하는 이 목록에 서지 않는다 — 적지 않으면 담당은 남은 것이 없다고
         *   읽는다. 서버가 기간을 선택으로 열면 이 줄이 사라진다.
         */}
        <p className="field-note">{t.entry.window(SHIPMENT_WINDOW_DAYS)}</p>
      </section>

      {/* ② 출하 단위 — 유형을 고르고 새로 만든다. */}
      <section className="pop-section pop-fixed shipping-unit-unit" aria-label={t.unit.label}>
        <span className="field-label" id="shipping-unit-type-label">
          {t.unit.typeLabel}
        </span>
        <Select
          size="xl"
          aria-labelledby="shipping-unit-type-label"
          placeholder={t.unit.typePlaceholder}
          value={typeCode}
          onChange={setTypeCode}
          options={(types.data ?? []).map((type) => ({ value: type.code, label: type.codeName }))}
        />
        <Button
          variant="filled"
          size="xl"
          className="pop-touch-target"
          disabled={!canCreateUnit(state)}
          onClick={onCreate}
        >
          {busy === 'creating' ? t.unit.creating : t.unit.create}
        </Button>
        {unit === null && <p className="field-note">{t.unit.none}</p>}
      </section>

      {/* ③ 상자 스캔과 등록된 목록 — **스크롤은 여기 하나**다. */}
      <section className="pop-section shipping-unit-boxes" aria-label={t.boxes.sectionLabel}>
        <ScanField
          label={t.scan.label}
          isScanning={busy === 'adding'}
          lockReason={canScanBox(state) ? undefined : t.scan.locked}
          onScan={onScan}
        />
        <h2 className="pane-title">{t.boxes.sectionLabel}</h2>
        {(unit?.boxes.length ?? 0) === 0 ? (
          <p className="field-note">{t.boxes.empty}</p>
        ) : (
          <Table
            density="compact"
            getRowId={(row: ShippingUnitBox) => String(row.handlingUnitId)}
            columns={boxColumns}
            rows={unit?.boxes ?? []}
          />
        )}
      </section>

      {/* ④ 납품 라벨 미리보기 — 품목별 합. **라벨 본문과 같은 값·같은 접기**다. */}
      <section
        className="pop-section pop-fixed shipping-unit-preview"
        aria-label={t.preview.sectionLabel}
      >
        <h2 className="pane-title">{t.preview.sectionLabel}</h2>
        {preview.shown.length === 0 ? (
          <p className="field-note">{t.preview.empty}</p>
        ) : (
          <ul className="shipping-unit-totals">
            {/* ⚠ 묶음 키가 (품목, 단위)다 — 같은 품목이라도 단위가 다르면 두 줄이다. */}
            {preview.shown.map((total) => (
              <li key={`${String(total.itemId)}-${String(total.uomId)}`}>
                {t.preview.item(
                  total.itemCode,
                  total.itemName,
                  `${total.qty.toLocaleString('ko-KR')} ${total.uomCode}`,
                )}
              </li>
            ))}
            {preview.hidden > 0 && <li>{t.preview.more(preview.hidden)}</li>}
          </ul>
        )}
        {unit !== null && <p className="field-note">{t.preview.boxCount(unit.boxCount)}</p>}
      </section>

      <div className="pop-action-bar shipping-unit-actions">
        <Button
          variant="filled"
          size="xl"
          className="pop-touch-target"
          disabled={!canClose(state) || identity.workerNo === null}
          onClick={() => {
            setConfirmOpen(true);
          }}
        >
          {busy === 'closing' ? t.close.closing : t.close.action}
        </Button>
        {isClosed(state) && (
          <Button
            variant="outlined"
            size="xl"
            className="pop-touch-target"
            onClick={() => {
              /* 같은 출하에 이어서 구성한다(설계 §5-5) — 출하만 남기고 나머지를 비운다. */
              setShippingUnitId(null);
              setEtag(null);
              setNotice(null);
              setOutcome(null);
            }}
          >
            {t.next}
          </Button>
        )}
        {!canClose(state) && !isClosed(state) && <p className="field-note">{t.close.needsBox}</p>}
      </div>

      {/* ⛔ 되돌릴 수 없다 — 확인창이 그 사실을 먼저 말한다(설계 §5-4). */}
      {isConfirmOpen && (
        <div className="banner-slot" role="alertdialog" aria-label={t.close.confirmTitle}>
          <AlertBanner variant="warning">{t.close.confirmBody}</AlertBanner>
          <Button variant="filled" size="xl" className="pop-touch-target" onClick={onClose}>
            {t.close.confirmAction}
          </Button>
          <Button
            variant="outlined"
            size="xl"
            className="pop-touch-target"
            onClick={() => {
              setConfirmOpen(false);
            }}
          >
            {t.close.cancel}
          </Button>
        </div>
      )}
    </main>
  );
};
