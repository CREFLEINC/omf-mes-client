import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { PopSelect } from '../../patterns/pop-select';
import {
  PuActionBar,
  PuBand,
  PuButton,
  PuChip,
  PuCols,
  PuCount,
  PuEmpty,
  PuField,
  PuFlow,
  PuIcon,
  PuNote,
  PuPager,
  PuRemoveButton,
  PuScanField,
  PuScreen,
  PuSection,
  PuSeg,
  PuTiles,
  puCx,
  puToast,
  useClientPage,
  useFitCount,
  type PuIconName,
} from '../../patterns/pop-uniform';
import { DELIVERY_LABEL } from '../shipping-packing-label/codes';
import { usePrinters } from '../shipping-packing-label/queries';
import { toDefaultPrinterName } from '../shipping-packing-label/types';

import {
  INITIAL_STATE,
  canClose,
  canCreateUnit,
  canScanBox,
  isClosed,
  type ComposeBusy,
  type ComposeState,
} from './compose-state';
import { useDeliveryIssue, type DeliveryIssueOutcome } from './delivery-issue';
import { toDeliveryLabelFields } from './delivery-label-fields';
import { renderDeliveryLabel } from './delivery-label-image';
import { useShippingUnitWrites } from './mutations';
import {
  useClosedShippingUnits,
  useComposableShipments,
  useShippingUnitDetail,
  useShippingUnitTypes,
} from './queries';
import type { AddBoxRejection, ShippingUnitBox, ShippingUnitDetail } from './types';
import './uniform.css';

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

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 마감 시각 `YYYY-MM-DD HH:mm`(단말 시각대). */
const formatAt = (iso: string | null | undefined): string => {
  if (iso === null || iso === undefined) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';

  return `${String(at.getFullYear())}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
};

/** 띠 이름 앞 빨간 아이콘. */
const bandLabel = (icon: PuIconName, text: string): ReactNode => (
  <>
    <PuIcon name={icon} />
    {text}
  </>
);

/** 한 상자의 수량 — 내용물 단위가 하나일 때만 더한다(다른 단위의 합은 뜻이 없다). */
const boxQty = (box: ShippingUnitBox): string | null => {
  const uoms = new Set(box.contents.map((content) => content.uomCode));
  if (uoms.size !== 1) return null;

  return box.contents.reduce((sum, content) => sum + content.qty, 0).toLocaleString('ko-KR');
};

const BoxRow = ({
  box,
  editable,
  isLatest,
  removeDisabled,
  onRemove,
}: {
  box: ShippingUnitBox;
  editable: boolean;
  isLatest: boolean;
  removeDisabled: boolean;
  onRemove: (handlingUnitId: number) => void;
}) => {
  const contents = box.contents
    .map((content) =>
      t.boxes.content(
        content.itemCode,
        content.lotNo,
        `${content.qty.toLocaleString('ko-KR')} ${content.uomCode}`,
      ),
    )
    .join(' / ');
  const qty = boxQty(box);

  return (
    <div className={puCx('su-row', editable && 'edit', editable && isLatest && 'is-on')}>
      {!editable && (
        <span className="mk">
          <PuIcon name="check" />
        </span>
      )}
      <span className="nm" title={box.handlingUnitNo}>
        {box.handlingUnitNo}
      </span>
      <span className="sub" title={contents}>
        {contents}
      </span>
      <span className="q">
        {qty !== null && (
          <>
            {qty}
            <small>{box.contents[0]?.uomCode}</small>
          </>
        )}
      </span>
      {editable && (
        <PuRemoveButton
          label={t.boxes.remove(box.handlingUnitNo)}
          disabled={removeDisabled}
          onClick={() => {
            onRemove(box.handlingUnitId);
          }}
        />
      )}
    </div>
  );
};

/** 목록 아래 합계 — 품목별 합은 서버가 준 `itemTotals` 그대로다(화면이 세지 않는다). */
const SumText = ({ unit }: { unit: ShippingUnitDetail }) =>
  unit.boxes.length === 0 ? null : (
    <div className="sum">
      {t.boxes.sum(unit.boxes.length)}{' '}
      {unit.itemTotals.map((total, index) => (
        <span key={`${total.itemCode}-${total.uomCode}`} className="tot">
          {index > 0 && ' · '}
          {`${total.qty.toLocaleString('ko-KR')} ${total.uomCode}`}
          <span>{total.itemCode}</span>
        </span>
      ))}
    </div>
  );

/** 납품 라벨 그림 — 마감 때 인쇄에 넘기는 같은 그리기. 실패하면 비운다. */
const usePreviewSrc = (unit: ShippingUnitDetail | null): string | null => {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  /*
   * ⚠ **그림 주소는 effect 안에서 만들고 같은 effect 가 해제한다**(리뷰 M2). 렌더 중에 만들면
   *    StrictMode 의 «실행→정리→재실행»에서 쓰던 주소가 해제돼 빈 그림이 선다.
   * ⚠ 발행 회차는 마감·발행 전에는 없다 — 첫 발행인 1 로 그린다.
   */
  useEffect(() => {
    if (unit === null || unit.boxCount === 0) {
      setPreviewSrc(null);
      return;
    }

    let src: string;
    try {
      const bytes = renderDeliveryLabel(toDeliveryLabelFields(unit, 1));
      src = URL.createObjectURL(
        new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
          type: 'image/png',
        }),
      );
    } catch {
      setPreviewSrc(null);
      return;
    }
    setPreviewSrc(src);

    return () => {
      URL.revokeObjectURL(src);
    };
  }, [unit]);

  return previewSrc;
};

type Tab = 'wait' | 'done';
type Step = 1 | 2;

/**
 * 유형 고르기 모양 — 이만큼까지는 한 줄 단추, 넘으면 칸 하나(PopSelect)로 접는다.
 * 유형은 고객사가 늘릴 수 있는 코드(SHIPPING_UNIT_TYPE)라, 늘어도 아래 상자 자리를 지킨다.
 */
const TYPE_TILE_MAX = 5;

/**
 * **P-04-05 출하 단위 구성** — 포장이 끝난 상자를 스캔해 묶고, 마감하면 납품 라벨이 나간다
 * (SHIP-UNIT-01 · 설계 §6). 본문은 #295 통일 시안: 왼쪽 「구성 대기 / 구성 완료」 탭 목록,
 * 가운데 두 단계(① 유형·상자 등록 → ② 마감 납품 라벨 발행), 오른쪽 납품 라벨 미리보기.
 * ① 은 위에 유형, 바로 아래 스캔 칸·상자 줄이다 — 유형을 고르면 스캔 칸이 열리고, 첫 상자가 단위를 만든다.
 *
 * ⛔ **마감은 되돌릴 수 없다**(설계 §4-6). 「지금 마감할 수 있는가」는 `compose-state` 가 판정한다.
 */
export const ShippingUnitScreen = () => {
  const identity = usePopIdentity();
  const [tab, setTab] = useState<Tab>('wait');
  const [folded, setFolded] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [shipment, setShipment] = useState<{ shipmentId: number; shipmentNo: string } | null>(null);
  const shipmentId = shipment?.shipmentId ?? null;
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [shippingUnitId, setShippingUnitId] = useState<number | null>(null);
  const [busy, setBusy] = useState<ComposeBusy>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  /** 포장 라벨 스캔 칸 — 거절은 칸 바로 아래 빨간 한 줄, 등록은 「스캔 완료」와 파란 테두리 줄. */
  const [scanValue, setScanValue] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastBoxNo, setLastBoxNo] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DeliveryIssueOutcome | null>(null);
  /**
   * 마지막 쓰기가 준 판 번호.
   *
   * ⛔ **상세가 준 것만 믿지 않는다.** `:add-box`·`DELETE` 도 판을 올리므로 **쓰기 응답의 값이
   *    가장 새것**이다 — 낡은 값으로 마감을 걸면 409 다.
   */
  const [etag, setEtag] = useState<string | null>(null);
  /** 「구성 완료」 탭에서 고른 마감 단위. */
  const [doneUnitId, setDoneUnitId] = useState<number | null>(null);
  const [donePage, setDonePage] = useState(1);

  const leftRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const leftSize = useFitCount(leftRef, { fallback: 5 });
  const rowSize = useFitCount(rowsRef, { fallback: 4 });

  const shipments = useComposableShipments();
  const closedUnits = useClosedShippingUnits(donePage, leftSize);
  const types = useShippingUnitTypes();
  const detail = useShippingUnitDetail(shippingUnitId);
  const doneDetail = useShippingUnitDetail(doneUnitId);
  const printers = usePrinters(DELIVERY_LABEL);
  const writes = useShippingUnitWrites(identity.workerNo);
  const issueDeliveryLabel = useDeliveryIssue(identity.workerNo);

  const unit = detail.data?.unit ?? null;
  const doneUnit = doneDetail.data?.unit ?? null;
  const state: ComposeState = useMemo(
    () => ({ ...INITIAL_STATE, shipmentId, typeCode, busy, unit }),
    [busy, shipmentId, typeCode, unit],
  );
  const closed = isClosed(state);
  const unitOpen = unit !== null && !closed;
  /*
   * 스캔 칸이 열리는가 — 단위가 없으면 출하·유형만 골랐으면 열린다(첫 상자가 단위를 만든다),
   * 단위가 있으면 지금처럼 열린 단위일 때만.
   */
  const scanOpen = shippingUnitId === null ? canCreateUnit(state) : canScanBox(state);
  const currentEtag = etag ?? detail.data?.etag ?? null;

  const isDone = tab === 'done';
  const viewUnit = isDone ? doneUnit : unit;
  const previewSrc = usePreviewSrc(viewUnit);

  /* 상자 등록이 끝나 칸이 다시 열리면 다음 스캔을 받도록 칸을 잡는다. */
  useEffect(() => {
    if (scanOpen && step === 1) scanRef.current?.focus();
  }, [scanOpen, step]);

  /* ⛔ 한 번에 하나만 나간다 — 같은 렌더 안의 연타도 ref 로 막는다(리뷰). */
  const runningRef = useRef(false);
  const run = useCallback(async (kind: ComposeBusy, work: () => Promise<void>): Promise<void> => {
    if (runningRef.current) return;

    runningRef.current = true;
    setBusy(kind);
    try {
      await work();
    } finally {
      runningRef.current = false;
      setBusy('idle');
    }
  }, []);

  const resetScan = (): void => {
    setScanValue('');
    setScanError(null);
    setLastBoxNo(null);
  };

  const onPickShipment = (next: { shipmentId: number; shipmentNo: string }): void => {
    setNotice(null);
    resetScan();
    setOutcome(null);
    /* 출하를 바꾸면 만들던 단위는 그 출하의 것이 아니다 — 함께 비운다. */
    setShipment(next);
    setShippingUnitId(null);
    setEtag(null);
    setStep(1);
  };

  /**
   * 상자 한 개를 읽는다.
   *
   * ⭐ **단위가 없으면 첫 상자가 단위를 만든다**(사용자 지시 2026-11-19 — [새 출하 단위] 단추 없음).
   *    부르는 순서·값은 예전과 같다: `POST /logistics/shipping-units`(출하·유형) → `:add-box`.
   *    그다음 상자부터는 `:add-box` 만 나간다.
   * ⛔ 만들기는 됐는데 상자가 거절되면 단위는 이미 있다 — 그 단위를 잡아 두어 다음 스캔에서
   *    다시 만들지 않는다. 연타는 `run` 이 한 번에 하나로 막는다.
   */
  const onScan = (handlingUnitNo: string): void => {
    if (shippingUnitId === null && (shipmentId === null || typeCode === null)) return;

    void run('adding', async () => {
      setNotice(null);
      setScanError(null);

      let unitId = shippingUnitId;
      const creating = unitId === null;
      if (unitId === null) {
        if (shipmentId === null || typeCode === null) return;
        setOutcome(null);
        try {
          const created = await writes.createUnit(shipmentId, typeCode);
          unitId = created.unit.shippingUnitId;
          setEtag(created.etag);
        } catch {
          setNotice(t.unit.failed);
          return;
        }
      }

      try {
        const result = await writes.addBox(unitId, handlingUnitNo);

        if (result.kind === 'rejected') {
          setScanValue('');
          setLastBoxNo(null);
          setScanError(rejectionText(result.rejection));

          return;
        }

        setEtag(result.snapshot.etag);
        /* 방금 만든 단위는 아래에서 단위 번호를 잡을 때 상세를 새로 받는다(상자가 든 뒤라 함께 온다). */
        if (!creating) await detail.refetch();
        setLastBoxNo(handlingUnitNo.trim());
      } finally {
        /* ⚠ 상자 결과와 상관없이 만든 단위를 잡는다 — 상자를 넣은 «뒤»에 잡아야 상세가 상자까지 담아 온다. */
        if (creating) setShippingUnitId(unitId);
      }
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
        const issued = await issueDeliveryLabel(
          snapshot.unit,
          toDefaultPrinterName(printers.data ?? []),
        );
        setOutcome(issued);
        puToast(
          issued.kind === 'printed' ? t.close.done : issueText(issued),
          issued.kind === 'printed' ? 'ok' : 'warn',
        );
        /* 방금 묶은 상자가 미구성에서 빠진다 — 목록을 다시 받는다. */
        await shipments.refetch();
        void closedUnits.refetch();
      } catch {
        setNotice(t.close.failed);
      }
    });
  };

  const onNextUnit = (): void => {
    /* 같은 출하에 이어서 구성한다(설계 §5-5) — 출하만 남기고 나머지를 비운다. */
    setShippingUnitId(null);
    setEtag(null);
    setNotice(null);
    resetScan();
    setOutcome(null);
    setStep(1);
  };

  /* ── 왼쪽 목록 ── */
  const shipmentList = shipments.data ?? [];
  const waitPage = useClientPage(shipmentList, leftSize);
  const closedTotal = closedUnits.data?.total ?? 0;
  const closedPages = Math.max(1, Math.ceil(closedTotal / Math.max(1, leftSize)));

  const typeName = (code: string | null | undefined): string =>
    code === null || code === undefined
      ? '—'
      : (types.data?.find((type) => type.code === code)?.codeName ?? code);

  const leftList = (): ReactNode => {
    if (!isDone) {
      if (shipments.isError) return <PuNote tone="bad">{t.entry.failed}</PuNote>;
      if (shipments.isPending) return <PuEmpty title={t.entry.loading} />;
      if (shipmentList.length === 0) return <PuEmpty title={t.entry.empty} />;

      return (
        <div ref={leftRef} className="pu-list pu-fit su-left-list">
          {waitPage.items.map((item) => (
            <button
              key={item.shipmentId}
              type="button"
              className={puCx('pu-item', item.shipmentId === shipmentId && 'is-selected')}
              aria-pressed={item.shipmentId === shipmentId}
              onClick={() => {
                onPickShipment({ shipmentId: item.shipmentId, shipmentNo: item.shipmentNo });
              }}
            >
              <div className="pu-item-top">
                <span className="no">{item.shipmentNo}</span>
                <span className="chips">
                  <PuChip tone={item.unassignedPackedBoxCount > 0 ? 'warn' : 'idle'}>
                    {t.entry.boxes(item.unassignedPackedBoxCount)}
                  </PuChip>
                </span>
              </div>
            </button>
          ))}
        </div>
      );
    }

    if (closedUnits.isError) return <PuNote tone="bad">{t.closed.failed}</PuNote>;
    if (closedUnits.isPending) return <PuEmpty title={t.closed.loading} />;
    if (closedTotal === 0) return <PuEmpty title={t.closed.empty} />;

    return (
      <div ref={leftRef} className="pu-list pu-fit su-left-list">
        {(closedUnits.data?.items ?? []).map((item) => (
          <button
            key={item.shippingUnitId}
            type="button"
            className={puCx('pu-item', item.shippingUnitId === doneUnitId && 'is-selected')}
            aria-pressed={item.shippingUnitId === doneUnitId}
            onClick={() => {
              setDoneUnitId(item.shippingUnitId);
            }}
          >
            <div className="pu-item-top">
              <span className="no">{item.shippingUnitNo}</span>
              <span className="chips">
                <PuChip tone="ok">{t.closed.chip}</PuChip>
              </span>
            </div>
            <div className="pu-item-sub">
              <span>
                {t.closed.shipment} <b>{item.shipmentNo}</b>
              </span>
              <span>
                {typeName(item.shippingUnitTypeCode)} · <b>{t.closed.boxes(item.boxCount)}</b>
              </span>
            </div>
            <div className="pu-item-sub">
              <span>
                {t.closed.closedAt} <b>{formatAt(item.closedAt)}</b>
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const leftPager = isDone ? (
    <PuPager
      total={closedTotal}
      page={Math.min(donePage, closedPages)}
      pages={closedPages}
      onPage={setDonePage}
      label={t.tabs.done}
    />
  ) : (
    <PuPager
      total={waitPage.total}
      page={waitPage.page}
      pages={waitPage.pages}
      onPage={waitPage.setPage}
      label={t.tabs.wait}
    />
  );

  /* ── 가운데 상자 줄 ── */
  const rowBoxes: ShippingUnitBox[] = isDone ? (doneUnit?.boxes ?? []) : (unit?.boxes ?? []);
  const rowPage = useClientPage(rowBoxes, rowSize);
  const { showIndex } = rowPage;
  /* 방금 넣은 상자가 든 쪽으로 넘긴다. */
  useEffect(() => {
    if (lastBoxNo === null) return;
    const index = (unit?.boxes ?? []).findIndex((box) => box.handlingUnitNo === lastBoxNo);
    if (index >= 0) showIndex(index);
  }, [lastBoxNo, unit, showIndex]);

  const editable = !isDone && step === 1 && scanOpen;
  const rowsBlock = (sumUnit: ShippingUnitDetail | null, emptyHint?: string): ReactNode => (
    <>
      {rowBoxes.length === 0 ? (
        <PuEmpty icon="box" title={t.boxes.empty} hint={emptyHint} />
      ) : (
        <div ref={rowsRef} className="pu-fit su-rows">
          {rowPage.items.map((box) => (
            <BoxRow
              key={box.handlingUnitId}
              box={box}
              editable={editable}
              isLatest={box.handlingUnitNo === lastBoxNo}
              removeDisabled={!scanOpen}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
      <div className="su-foot">
        {sumUnit !== null && <SumText unit={sumUnit} />}
        <PuPager
          total={rowPage.total}
          page={rowPage.page}
          pages={rowPage.pages}
          onPage={rowPage.setPage}
          label={t.steps.boxes}
        />
      </div>
    </>
  );

  const boxCount = unit?.boxes.length ?? 0;
  const doneTo = closed ? 2 : unitOpen && boxCount > 0 ? 1 : 0;
  const canGo = (target: Step): boolean => target === 1 || (unitOpen && boxCount > 0);
  const flowSteps = ([1, 2] as const).map((target) => ({
    label: target === 1 ? t.steps.compose : t.steps.close,
    done: target <= doneTo || target < step,
    onGo:
      !closed && target !== step && canGo(target)
        ? () => {
            setStep(target);
          }
        : undefined,
  }));

  const unassigned = shipments.isSuccess
    ? (shipmentList.find((item) => item.shipmentId === shipmentId)?.unassignedPackedBoxCount ?? 0)
    : null;

  const center = (): ReactNode => {
    if (isDone) {
      if (doneUnit === null) {
        return <PuEmpty icon="file" title={t.closed.pick} hint={t.closed.pickHint} />;
      }

      return (
        <>
          <PuBand
            label={t.band.unit}
            items={[
              {
                label: bandLabel('file', t.band.unit),
                value: (
                  <>
                    {doneUnit.shippingUnitNo} <PuChip tone="ok">{t.closed.chip}</PuChip>
                  </>
                ),
              },
              { label: bandLabel('list', t.band.shipment), value: doneUnit.shipmentNo },
              {
                label: bandLabel('box', t.band.type),
                value: typeName(doneUnit.shippingUnitTypeCode),
              },
              { label: bandLabel('clock', t.band.closedAt), value: formatAt(doneUnit.closedAt) },
            ]}
          />
          {rowsBlock(doneUnit)}
        </>
      );
    }

    if (shipment === null) {
      return <PuEmpty icon="list" title={t.entry.pick} hint={t.entry.pickHint} />;
    }

    const typeOptions = (types.data ?? []).map((type) => ({
      value: type.code,
      label: type.codeName,
    }));

    return (
      <>
        <PuFlow steps={flowSteps} current={step - 1} label={t.steps.label} />
        <PuBand
          label={t.band.shipment}
          items={[
            { label: bandLabel('list', t.band.shipment), value: shipment.shipmentNo },
            ...(step === 1
              ? []
              : [
                  {
                    label: bandLabel('box', t.band.type),
                    value: typeName(unit?.shippingUnitTypeCode ?? typeCode),
                  },
                ]),
            {
              label: bandLabel('file', t.band.unit),
              value:
                unit === null ? (
                  '—'
                ) : (
                  <>
                    {unit.shippingUnitNo}
                    {closed && (
                      <>
                        {' '}
                        <PuChip tone="ok">{t.closed.chip}</PuChip>
                      </>
                    )}
                  </>
                ),
            },
            {
              label: bandLabel('clock', t.band.unassigned),
              value: unassigned === null ? '—' : t.band.count(unassigned),
            },
          ]}
        />
        {notice !== null && <PuNote tone="bad">{notice}</PuNote>}
        {outcome !== null && outcome.kind !== 'printed' && (
          /* ⚠ 기록은 남고 종이만 안 나온 상태 — 재발행으로 가는 길을 함께 말한다. */
          <PuNote tone="warn">{`${issueText(outcome)} ${t.close.reissueHint}`}</PuNote>
        )}
        {step === 1 && (
          <>
            {/* ⛔ 첫 상자로 단위가 서면 유형은 그 단위의 것이다(생성 때 보냄) — 그 뒤로는 바꿀 수 없게 잠근다. */}
            <PuField label={t.unit.typeLabel} required labelId="shipping-unit-type-label">
              {typeOptions.length > TYPE_TILE_MAX ? (
                <PopSelect
                  aria-labelledby="shipping-unit-type-label"
                  value={unit?.shippingUnitTypeCode ?? typeCode}
                  onChange={setTypeCode}
                  options={typeOptions}
                  disabled={shippingUnitId !== null || busy !== 'idle'}
                />
              ) : (
                <div className="su-types">
                  <PuTiles
                    label={t.unit.typeLabel}
                    options={typeOptions}
                    value={unit?.shippingUnitTypeCode ?? typeCode}
                    onChange={setTypeCode}
                    disabled={shippingUnitId !== null || busy !== 'idle'}
                  />
                </div>
              )}
            </PuField>
            <PuScanField
              label={t.scan.label}
              inputRef={scanRef}
              value={scanValue}
              onChange={(value) => {
                setScanValue(value);
                setScanError(null);
              }}
              onSubmit={(value) => {
                setScanValue(value);
                onScan(value);
              }}
              placeholder={t.scan.placeholder}
              disabled={!scanOpen}
              done={lastBoxNo !== null && lastBoxNo === scanValue.trim()}
              error={scanError}
            />
            {rowsBlock(unit, scanOpen ? t.boxes.emptyHint : undefined)}
          </>
        )}
        {step === 2 && rowsBlock(unit)}
      </>
    );
  };

  /* ── 작업 줄 ── */
  const actions = (): ReactNode => {
    if (isDone || shipment === null) return null;

    if (step === 1) {
      /* 단위는 첫 상자가 만든다 — 상자를 담은 뒤 [다음]. */
      return (
        <PuButton
          variant="primary"
          disabled={!unitOpen || boxCount === 0}
          onClick={() => {
            setStep(2);
          }}
        >
          {t.actions.next}
        </PuButton>
      );
    }

    if (closed) {
      return (
        <PuButton variant="primary" onClick={onNextUnit}>
          {t.next}
        </PuButton>
      );
    }

    return (
      <>
        <PuButton
          onClick={() => {
            setStep(1);
          }}
        >
          {t.actions.prev}
        </PuButton>
        <PuButton
          variant="primary"
          disabled={!canClose(state) || identity.workerNo === null}
          /* ⭐ 누르면 바로 마감하고 납품 라벨을 출력한다 — 되묻지 않는다(사용자 지시 2026-09-17). */
          onClick={onClose}
        >
          {busy === 'closing' ? t.close.closing : t.close.action}
        </PuButton>
      </>
    );
  };

  const showPreview = isDone ? doneUnit !== null : shipment !== null;
  const workerMissing = identity.workerNo === null || identity.workerNo.trim() === '';

  return (
    /* ⚠ POP 라우트는 관리웹 셸을 지나지 않는다 — 이 화면이 최상위 랜드마크다. */
    <main className="pop-ui" aria-label={t.title}>
      <PuScreen className="su-screen" actionBar={<PuActionBar>{actions()}</PuActionBar>}>
        <div className="su-body">
          {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 말로 맨 위에 알린다(사용자 지시 2026-09-17). */}
          {workerMissing && <PuNote tone="warn">{messages.popChrome.workerMissing}</PuNote>}
          <PuCols variant={showPreview ? 'lk' : 'list'} className="su-cols">
            <PuSection
              className="su-left"
              bodyClassName="su-left-body"
              head={
                <PuSeg
                  label={t.tabs.label}
                  value={tab}
                  onChange={setTab}
                  options={[
                    {
                      value: 'wait',
                      label: (
                        <>
                          {t.tabs.wait} <PuCount>{shipmentList.length}</PuCount>
                        </>
                      ),
                    },
                    {
                      value: 'done',
                      label: (
                        <>
                          {t.tabs.done} <PuCount>{closedTotal}</PuCount>
                        </>
                      ),
                    },
                  ]}
                />
              }
              fold={{ label: t.tabs.label, folded, onChange: setFolded }}
            >
              {leftList()}
              {leftPager}
            </PuSection>
            <PuSection className="su-center" bodyClassName="su-center-body">
              {center()}
            </PuSection>
            {showPreview && (
              <PuSection title={t.preview.sectionLabel} className="su-preview-card">
                {previewSrc === null ? (
                  <PuEmpty icon="file" title={t.preview.empty} />
                ) : (
                  <img className="su-preview-image" src={previewSrc} alt={t.preview.sectionLabel} />
                )}
              </PuSection>
            )}
          </PuCols>
        </div>
      </PuScreen>
    </main>
  );
};
