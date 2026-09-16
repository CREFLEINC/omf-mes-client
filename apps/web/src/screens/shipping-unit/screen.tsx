import { AlertBanner, Button, Table, type Column } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
/*
 * ⛔ **DS 드롭다운을 직접 쓰지 않는다**(공유계약 G-34 · `routes/pop-common-rules.test.ts` 가
 *    지킨다). 장갑 낀 손에는 좁은 목록보다 큰 버튼이 선 팝업이 낫다.
 */
import { PopSelect as Select } from '../../patterns/pop-select';
import { ScanField } from '../packing-result/scan-field';

import type { ShippingUnitApi } from './api';
import {
  INITIAL_STATE,
  canClose,
  canCreateUnit,
  canScanBox,
  isClosed,
  previewRows,
  type ComposeState,
} from './compose-state';
import type { ShippingUnitBox } from './types';

const t = messages.shippingUnit;

export interface ShippingUnitScreenProps {
  /**
   * 서버에 묻는 자리. **아직 `null` 이다** — 경로가 전달본에 없다(P4c 에서 잇는다).
   *
   * ⛔ 가짜 값을 돌려주는 구현을 두지 않는다 — 「되는 것처럼」 보이면 안 붙었다는 사실이
   *    실기에서야 드러난다.
   */
  api?: ShippingUnitApi | null;
}

/**
 * **P-04-05 출하 단위 구성** — 포장이 끝난 상자를 스캔해 묶고, 마감하면 납품 라벨이 나간다
 * (SHIP-UNIT-01 · 설계 §6).
 *
 * ⚠ **세로 예산이 슬랙 0 이다**(POP 규격 — 헤더 64 + 본문 616 + 액션바 88 = 768).
 *   ① 72 · ② 72 · ③ 남는 것 · ④ 88 로 나누고 **스크롤은 ③ 하나**다(통합 담당 확정
 *   2026-09-16). ①②④ 는 `pop-fixed` 로 높이 배분에서 빠진다 — 그러지 않으면 넷이 남는 높이를
 *   나눠 갖고, 목록이 세 줄로 눌린다(전례 P-04-02 는 그러다 표가 0 으로 깔렸다 · #1092).
 *
 * ⛔ **마감은 되돌릴 수 없다**(설계 §4-6). 확인창이 그 사실을 먼저 말하고, 「지금 마감할 수
 *    있는가」는 `compose-state` 가 판정한다 — 렌더 코드에 흩어 두면 시험이 못 붙든다.
 */
export const ShippingUnitScreen = ({ api = null }: ShippingUnitScreenProps) => {
  const identity = usePopIdentity();
  const [state, setState] = useState<ComposeState>(INITIAL_STATE);
  const [notice, setNotice] = useState<string | null>(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  const shipments = api?.shipments.items ?? [];
  const types = api?.types.items ?? [];
  const preview = previewRows(state.unit);

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
  ];

  return (
    <main className="pop-shell pop-ui shipping-unit-shell" aria-labelledby="shipping-unit-title">
      <header className="pop-header">
        <h1 id="shipping-unit-title" className="pop-title">
          {t.title}
        </h1>
        {state.unit !== null && (
          <p className="pop-context">
            {`${state.unit.shippingUnitNo} · ${t.unit.status[state.unit.statusCode]}`}
          </p>
        )}
      </header>

      {notice !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{notice}</AlertBanner>
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
          value={state.shipmentId === null ? null : String(state.shipmentId)}
          onChange={(value) => {
            setNotice(null);
            /* 출하를 바꾸면 만들던 단위는 그 출하의 것이 아니다 — 함께 비운다. */
            setState((current) => ({
              ...current,
              shipmentId: value === null ? null : Number(value),
              unit: null,
            }));
          }}
          options={shipments.map((shipment) => ({
            value: String(shipment.shipmentId),
            label: `${shipment.shipmentNo} · ${t.entry.boxes(shipment.unassignedPackedBoxCount)}`,
          }))}
        />
        {shipments.length === 0 && <p className="field-note">{t.entry.empty}</p>}
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
          value={state.typeCode}
          onChange={(value) => {
            setState((current) => ({ ...current, typeCode: value }));
          }}
          options={types.map((type) => ({ value: type.code, label: type.codeName }))}
        />
        <Button
          variant="filled"
          size="xl"
          className="pop-touch-target"
          disabled={!canCreateUnit(state) || api === null}
          onClick={() => {
            setNotice(null);
          }}
        >
          {state.busy === 'creating' ? t.unit.creating : t.unit.create}
        </Button>
        {state.unit === null && <p className="field-note">{t.unit.none}</p>}
      </section>

      {/* ③ 상자 스캔과 등록된 목록 — **스크롤은 여기 하나**다. */}
      <section className="pop-section shipping-unit-boxes" aria-label={t.boxes.sectionLabel}>
        <ScanField
          label={t.scan.label}
          isScanning={state.busy === 'adding'}
          lockReason={canScanBox(state) ? undefined : t.scan.locked}
          onScan={() => {
            setNotice(null);
          }}
        />
        <h2 className="pane-title">{t.boxes.sectionLabel}</h2>
        {(state.unit?.boxes.length ?? 0) === 0 ? (
          <p className="field-note">{t.boxes.empty}</p>
        ) : (
          <Table
            density="compact"
            getRowId={(row: ShippingUnitBox) => String(row.handlingUnitId)}
            columns={boxColumns}
            rows={state.unit?.boxes ?? []}
          />
        )}
      </section>

      {/* ④ 납품 라벨 미리보기 — 품목별 합. **라벨 본문과 같은 값·같은 접기**다. */}
      <section className="pop-section pop-fixed shipping-unit-preview" aria-label={t.preview.sectionLabel}>
        <h2 className="pane-title">{t.preview.sectionLabel}</h2>
        {preview.shown.length === 0 ? (
          <p className="field-note">{t.preview.empty}</p>
        ) : (
          <ul className="shipping-unit-totals">
            {preview.shown.map((total) => (
              <li key={total.itemId}>
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
        {state.unit !== null && (
          <p className="field-note">{t.preview.boxCount(state.unit.boxCount)}</p>
        )}
      </section>

      <div className="pop-action-bar shipping-unit-actions">
        <Button
          variant="filled"
          size="xl"
          className="pop-touch-target"
          disabled={!canClose(state) || api === null || identity.workerNo === null}
          onClick={() => {
            setConfirmOpen(true);
          }}
        >
          {state.busy === 'closing' ? t.close.closing : t.close.action}
        </Button>
        {isClosed(state) && (
          <Button
            variant="outlined"
            size="xl"
            className="pop-touch-target"
            onClick={() => {
              setState((current) => ({ ...INITIAL_STATE, shipmentId: current.shipmentId }));
              setNotice(null);
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
          <Button
            variant="filled"
            size="xl"
            className="pop-touch-target"
            onClick={() => {
              setConfirmOpen(false);
            }}
          >
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
