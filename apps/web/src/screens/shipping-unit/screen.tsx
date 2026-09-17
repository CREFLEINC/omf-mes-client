import { AlertBanner, Button, Chip, EmptyState, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
/*
 * ⛔ **DS 드롭다운을 직접 쓰지 않는다**(공유계약 G-34 · `routes/pop-common-rules.test.ts` 가
 *    지킨다). 장갑 낀 손에는 좁은 목록보다 큰 버튼이 선 팝업이 낫다.
 */
import { PopSelect as Select } from '../../patterns/pop-select';
import { ScanField } from '../packing-result/scan-field';
import { useOnline } from '../packing-result/use-online';
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
import { useComposableShipments, useShippingUnitDetail, useShippingUnitTypes } from './queries';
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
  const isOnline = useOnline();
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  const [typeCode, setTypeCode] = useState<string | null>(null);
  const [shippingUnitId, setShippingUnitId] = useState<number | null>(null);
  const [busy, setBusy] = useState<ComposeBusy>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  /**
   * 포장 라벨 스캔 결과 — 맨 위 띠가 아니라 **스캔 칸 바로 아래**에 선다(사용자 지시 2026-09-17).
   * 등록은 초록 체크, 거절은 붉은 띠다. 어느 스캔의 답인지 칸에서 떨어지면 흐려진다.
   */
  const [scanResult, setScanResult] = useState<{ ok: boolean; text: string } | null>(null);
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
  /*
   * ⭐ **미리보기는 인쇄될 라벨 그림 그대로다**(사용자 지시 2026-09-17). 전에는 품목별 합을 글자
   *    목록으로 적어 라벨처럼 보이지 않았다. 마감 때 인쇄에 넘기는 같은 그리기(`renderDeliveryLabel`)를
   *    쓴다 — 다른 그림을 보여 주면 담당이 본 것과 종이가 달라진다.
   *
   * ⚠ 발행 회차는 마감·발행 전에는 없다 — 첫 발행인 1 로 그린다. 재발행이면 종이의 회차만 다르다.
   */
  const previewSrc = useMemo((): string | null => {
    if (unit === null || unit.boxCount === 0) return null;

    const bytes = renderDeliveryLabel(toDeliveryLabelFields(unit, 1));

    return URL.createObjectURL(
      new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
        type: 'image/png',
      }),
    );
  }, [unit]);

  useEffect(() => {
    if (previewSrc === null) return;

    return () => {
      URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);
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
      setScanResult(null);
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
      setScanResult(null);
      const result = await writes.addBox(shippingUnitId, handlingUnitNo);

      if (result.kind === 'rejected') {
        setScanResult({ ok: false, text: rejectionText(result.rejection) });

        return;
      }

      setEtag(result.snapshot.etag);
      await detail.refetch();
      setScanResult({ ok: true, text: t.scan.added(handlingUnitNo.trim()) });
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

  /*
   * ⭐ 머리글·값 모두 가운데 정렬, 상자 번호 열은 넓게·내용물 열은 좁게(사용자 지시 2026-09-17).
   */
  const boxColumns: Column<ShippingUnitBox>[] = [
    {
      key: 'seq',
      header: t.boxes.columnSeq,
      align: 'center',
      width: '10%',
      render: (row) => String(row.seq),
    },
    {
      key: 'no',
      header: t.boxes.columnNo,
      align: 'center',
      width: '35%',
      render: (row) => row.handlingUnitNo,
    },
    {
      key: 'contents',
      header: t.boxes.columnContents,
      align: 'center',
      width: '35%',
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
      width: '20%',
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
          /* ⭐ 번호만 적는다 — 「구성 중/마감」 상태 표시는 두지 않는다(사용자 지시 2026-09-17). */
          <p className="pop-context">{unit.shippingUnitNo}</p>
        )}
        {/*
         * ⭐ **POP 공통 헤더를 따른다**(사용자 지시 2026-09-17 · 공유계약 D-5·G-34) — 현재 작업자
         *    사번과 온라인/오프라인. [화면 이동]·[사용자 전환]은 셸이 모든 POP 화면 머리줄에
         *    세운다. 전용 화면 스펙이 설계 고정 커밋에 없어 형제 화면 P-04-01 머리줄과 같게 둔다.
         */}
        <div className="pop-context-right">
          <PopWorkerTag workerNo={identity.workerNo} />
          <Chip variant="status" size="md" status={isOnline ? 'success' : 'error'}>
            {isOnline ? t.header.online : t.header.offline}
          </Chip>
        </div>
      </header>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={identity.workerNo} />

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
      {/*
       * ⭐ **본문은 상자 다섯이다**(사용자 지시 2026-09-17) — 출하 · 유형 · 포장 라벨 · 등록된 상자 ·
       *    납품 라벨 미리보기. 각 상자가 테두리를 갖고 위에서 아래로 작업 순서대로 선다.
       */}
      <section
        className="pop-section pop-fixed shipping-unit-box shipping-unit-entry"
        aria-label={t.entry.label}
      >
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
            setScanResult(null);
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
        ) : /* ⛔ 「구성할 상자가 남은 출하가 없습니다」는 두지 않는다(사용자 지시 2026-09-17). */ null}
      </section>

      {/* ② 유형 — 유형을 고르고 새 출하 단위를 만든다. */}
      <section
        className="pop-section pop-fixed shipping-unit-box shipping-unit-unit"
        aria-label={t.unit.label}
      >
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
        {/* ⛔ 「아직 만들지 않았습니다…」 안내는 두지 않는다(사용자 지시 2026-09-17). */}
      </section>

      {/* ③ 포장 라벨 스캔 */}
      {/* ⛔ 구획에 칸과 «같은 이름»을 달지 않는다 — 이름이 겹치면 무엇을 가리키는지 흐려진다. */}
      <section className="pop-section pop-fixed shipping-unit-box shipping-unit-scan">
        <ScanField
          label={t.scan.label}
          isScanning={busy === 'adding'}
          /* ⭐ 스캐너가 Enter 를 붙이지 않아도 읽는다(사용자 지시 2026-09-17 · P-04-01 생산LOT 과 같다). */
          autoSubmit
          lockReason={canScanBox(state) ? undefined : t.scan.locked}
          onScan={onScan}
        />
        {scanResult !== null && (
          <div className="shipping-unit-verdict" role="status">
            <AlertBanner variant={scanResult.ok ? 'success' : 'error'}>
              {scanResult.text}
            </AlertBanner>
          </div>
        )}
      </section>

      {/*
       * ⭐ **등록된 상자와 미리보기는 한 줄에 나란히 선다**(사용자 지적 2026-09-17 · 잘림). 위아래로
       *    쌓았더니 창 높이가 모자라 목록이 표 머리줄만 남기고 잘리고 마감 단추가 화면 밖으로 밀렸다.
       *    이 줄이 남는 높이를 갖고, 두 상자는 넘치면 제 안에서 굴린다.
       */}
      <div className="shipping-unit-lower">
        {/* ④ 등록된 상자 — **스크롤은 여기 하나**다. */}
        <section
          className="pop-section shipping-unit-box shipping-unit-boxes"
          aria-label={t.boxes.sectionLabel}
        >
          <h2 className="pane-title">{t.boxes.sectionLabel}</h2>
          {(unit?.boxes.length ?? 0) === 0 ? (
            /* ⭐ 가운데에 선다 — P-04-01 포장 구성의 빈 목록과 같은 부품(사용자 지시 2026-09-17). */
            <EmptyState size="sm" className="shipping-unit-empty" title={t.boxes.empty} />
          ) : (
            <Table
              density="compact"
              getRowId={(row: ShippingUnitBox) => String(row.handlingUnitId)}
              columns={boxColumns}
              rows={unit?.boxes ?? []}
            />
          )}
        </section>

        {/* ⑤ 납품 라벨 미리보기 — 인쇄될 그림 그대로. */}
        <section
          className="pop-section shipping-unit-box shipping-unit-preview"
          aria-label={t.preview.sectionLabel}
        >
          <h2 className="pane-title">{t.preview.sectionLabel}</h2>
          {previewSrc === null ? (
            <EmptyState size="sm" className="shipping-unit-empty" title={t.preview.empty} />
          ) : (
            <img
              className="shipping-unit-preview-image"
              src={previewSrc}
              alt={t.preview.sectionLabel}
            />
          )}
        </section>
      </div>

      <div className="pop-action-bar shipping-unit-actions">
        <Button
          variant="filled"
          size="xl"
          className="pop-touch-target"
          disabled={!canClose(state) || identity.workerNo === null}
          /* ⭐ 누르면 바로 마감하고 납품 라벨을 출력한다 — 되묻는 단계는 두지 않는다(사용자 지시 2026-09-17). */
          onClick={onClose}
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
              setScanResult(null);
              setOutcome(null);
            }}
          >
            {t.next}
          </Button>
        )}
        {/* ⛔ 「상자를 하나 이상 등록해야…」 같은 하단 안내는 두지 않는다(사용자 지시 2026-09-17). */}
      </div>
    </main>
  );
};
