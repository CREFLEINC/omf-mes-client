import { AlertBanner, Breadcrumb, Button, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { LoadingInfoPane } from './loading-info-pane';
import {
  resolveWarehouse,
  resolvedWarehouseId,
  toWarehouseOptions,
  useActiveWarehouses,
  useItemLookup,
  useUomLookup,
} from './lookups';
import { LotPane } from './lot-pane';
import { lotReleaseState } from './lot-release';
import { useExpeditedShipmentMutation } from './mutations';
import { OutcomePane } from './outcome-pane';
import { defaultPeriod, isUsablePeriod, type Period } from './period';
import {
  targetsForItem,
  useProductionLotCandidates,
  useShipmentRequestTarget,
  useShipmentRequestTargets,
} from './queries';
import { formatQty, quantityError } from './quantity';
import { ReasonPane } from './reason-pane';
import {
  EMPTY_DRAFT,
  quantityLimitsOf,
  reasonError,
  submitLockReason,
  targetLineOf,
  toShipmentCreateBody,
  type ExpeditedShipmentDraft,
  type ShipmentCreateBody,
  type SubmissionInput,
} from './submission';
import { SubmitConfirmDialog } from './submit-confirm-dialog';
import { TargetPane } from './target-pane';

const t = messages.expeditedShipment;

export interface ExpeditedShipmentScreenProps {
  /** 기본 기간을 정하는 기준 날. 감지기가 실행하는 날에 결과가 좌우되지 않게 밖에서 받는다. */
  today?: Date;
  /** 검사 대기 코드. 값이 바뀌면 이 한 자리만 고친다(`lot-release.ts`). */
  inspectionPendingCode?: string;
}

/**
 * W-04-05 긴급 직행 출하 처리.
 *
 * ⭐ **한 버튼이 전표 두 건을 만든다.** 제품 입고와 출하가 같은 트랜잭션에서 일어나는 04의
 * 유일한 자리이며, 원자성이 이 화면의 전부다(공유계약 B-8 · §5-1).
 *
 * ⛔ **부분 성공을 보이지 않는다**(C-2를 쓰지 않는다 · §5-1). 「①은 됐고 ②는 실패했습니다」는
 * 사용자가 무엇을 해야 하는지 알 수 없는 말이고, 이 화면은 애초에 그 상태를 만들지 않는다.
 */
export const ExpeditedShipmentScreen = ({
  today,
  inspectionPendingCode,
}: ExpeditedShipmentScreenProps = {}) => {
  const toast = useToast();
  const baseDate = useMemo(() => today ?? new Date(), [today]);

  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>(() => defaultPeriod(baseDate));
  const [draft, setDraft] = useState<ExpeditedShipmentDraft>(EMPTY_DRAFT);
  const [chosenWarehouseId, setChosenWarehouseId] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirming, setConfirming] = useState<ShipmentCreateBody | null>(null);

  const items = useItemLookup();
  const uoms = useUomLookup();
  const lotQuery = useProductionLotCandidates();
  const lots = lotQuery.data?.items ?? [];
  const selectedLot = lots.find((lot) => lot.lotId === selectedLotId) ?? null;
  const release = lotReleaseState(selectedLot, inspectionPendingCode);

  const targetQuery = useShipmentRequestTargets(period);
  const visibleTargets = targetsForItem(targetQuery.data?.items ?? [], selectedLot?.itemId ?? null);
  const targetDetail = useShipmentRequestTarget(selectedTargetId);

  const warehouseQuery = useActiveWarehouses();
  const warehouse = resolveWarehouse(
    warehouseQuery.data === undefined ? undefined : toWarehouseOptions(warehouseQuery.data.items),
    warehouseQuery.isPending,
    warehouseQuery.isError,
  );
  const warehouseId = resolvedWarehouseId(warehouse, chosenWarehouseId);

  /*
   * LOT을 바꾸면 앞서 고른 지시와 수량을 들고 있지 않는다 — 품목이 달라지면 그 지시로는 낼 수
   * 없고, 되돌릴 수 없는 쓰기라 잘못 섞이면 안 된다.
   */
  useEffect(() => {
    setSelectedTargetId(null);
    setDraft((current) => ({ ...current, qty: '' }));
    setShowErrors(false);
  }, [selectedLotId]);

  const input: SubmissionInput = {
    lot: selectedLot,
    release,
    /* 상세가 도착해야 라인·단위의 정본이 생긴다 — 목록의 라인은 참고용이다. */
    target: targetDetail.data ?? null,
    warehouseId,
    draft,
    isSaving: false,
  };
  const line = targetLineOf(input);
  const limits = quantityLimitsOf(input);

  const write = useExpeditedShipmentMutation({
    onSuccess: () => {
      setConfirming(null);
      setSelectedLotId(null);
      setSelectedTargetId(null);
      setDraft(EMPTY_DRAFT);
      setShowErrors(false);
      toast.show({ variant: 'success', description: t.success });
      void lotQuery.refetch();
    },
  });

  const liveInput: SubmissionInput = { ...input, isSaving: write.isSaving };
  const lockReason = submitLockReason(liveInput);
  /* 확인 창이 보이는 조건은 «본문의 라인이 실제로 있는 것»이다 — 첨자로 집어 단언하지 않는다. */
  const confirmedLine = confirming?.lines[0];

  const closeConfirm = (): void => {
    setConfirming(null);
    write.reset();
  };

  /*
   * 충돌(409)만 재조회로 풀린다(`SaveErrorBanner`의 규칙) — 다른 사용자·워커가 먼저 처리해
   * 이 초안이 낡았다는 뜻이므로 선택을 비우고 후보를 다시 받는다. 낡은 상세로 이어가면 이미
   * 나간 LOT에 다시 쓰기를 시도하게 된다.
   */
  const reloadAfterConflict = (): void => {
    closeConfirm();
    setSelectedLotId(null);
    setSelectedTargetId(null);
    void lotQuery.refetch();
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      {/* ⚠ 화면의 «성격»을 머리에 상시 붙인다 — 오류가 아니라 이 화면이 무엇인지에 대한 말이다. */}
      <div className="banner-slot">
        <AlertBanner variant="warning">{t.headerNotice}</AlertBanner>
      </div>

      <LotPane
        lots={lots}
        truncated={lotQuery.data?.truncated ?? false}
        isLoading={lotQuery.isPending}
        isError={lotQuery.isError}
        selected={selectedLot}
        release={release}
        items={items}
        uoms={uoms}
        onSelect={setSelectedLotId}
      />

      <TargetPane
        hasLot={selectedLot !== null}
        period={period}
        isPeriodUsable={isUsablePeriod(period)}
        targets={visibleTargets}
        truncated={targetQuery.data?.truncated ?? false}
        isLoading={targetQuery.isPending && isUsablePeriod(period)}
        isError={targetQuery.isError}
        selected={targetDetail.data ?? null}
        line={line}
        limits={limits}
        qty={draft.qty}
        qtyError={quantityError(draft.qty, limits)}
        showQtyError={showErrors}
        uoms={uoms}
        onChangePeriod={setPeriod}
        onSelect={setSelectedTargetId}
        onChangeQty={(qty) => setDraft((current) => ({ ...current, qty }))}
      />

      <LoadingInfoPane
        draft={draft.loading}
        warehouse={warehouse}
        chosenWarehouseId={chosenWarehouseId}
        onChange={(patch) =>
          setDraft((current) => ({ ...current, loading: { ...current.loading, ...patch } }))
        }
        onChangeWarehouse={setChosenWarehouseId}
      />

      <ReasonPane
        value={draft.reason}
        error={reasonError(draft.reason)}
        showError={showErrors}
        onChange={(reason) => setDraft((current) => ({ ...current, reason }))}
      />

      <OutcomePane />

      <section className="pane" aria-label={t.submit}>
        {/* ⭐ 잠긴 이유를 «하나» 낸다(G-3) — 늘어놓으면 무엇부터 고칠지가 흐려진다. */}
        {lockReason !== undefined && (
          <div className="banner-slot">
            <AlertBanner variant="info">{lockReason}</AlertBanner>
          </div>
        )}
        <div className="form-actions">
          <Button
            disabled={lockReason !== undefined}
            onClick={() => {
              setShowErrors(true);
              const body = toShipmentCreateBody(liveInput);
              /* 게이트가 열려 있는데 본문이 없으면 그대로 멈춘다 — 절반짜리 요청을 만들지 않는다. */
              if (body === null) return;
              write.reset();
              setConfirming(body);
            }}
          >
            {t.submit}
          </Button>
        </div>
      </section>

      {confirming !== null &&
        confirmedLine !== undefined &&
        selectedLot !== null &&
        targetDetail.data !== undefined && (
          <SubmitConfirmDialog
            lotNo={selectedLot.lotNo}
            shipmentRequestNo={targetDetail.data.shipmentRequestNo}
            qty={formatQty(confirmedLine.shippedQty)}
            banner={<SaveErrorBanner error={write.error} onReload={reloadAfterConflict} />}
            isSubmitting={write.isSaving}
            onClose={closeConfirm}
            onConfirm={() => {
              /* ⛔ 진행 중에는 다시 보내지 않는다 — 새 멱등 키가 나가면 전표가 두 벌 생긴다. */
              if (write.isSaving) return;
              write.write(confirming);
            }}
          />
        )}
    </>
  );
};
