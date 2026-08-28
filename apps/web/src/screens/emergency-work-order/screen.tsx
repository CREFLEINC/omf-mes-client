import { PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { ExpansionPane } from './expansion-pane';
import { issueRoutingOperationId, type LoadState, resolveExpansion } from './expansion';
import { FixedTermsPane } from './fixed-terms';
import { useHandoverRelease } from './handover';
import { HandoverPane } from './handover-pane';
import { EMPTY_ISSUE_FORM, isIssueInputComplete, validateIssueForm } from './issue-form';
import { IssueFormPane } from './issue-form-pane';
import { IssueAction } from './issue-action';
import { toIssueLock } from './issue-lock';
import { ItemPicker } from './item-picker';
import { useIssueEmergencyWorkOrder } from './mutations';
import { useItemBoms, useItemRoutings, useRoutingOperations } from './queries';
import type { Bom, Routing, RoutingOperation, SelectedItem } from './types';
import { useUnreleasedEmergencyWorkOrders } from './unreleased';
import { useUomLookup } from './uom-lookup';
import { EMERGENCY_WORK_ORDER_TYPE_CODE } from './work-order-type';

/**
 * 조회 훅을 판정이 쓰는 모양으로 옮긴다.
 *
 * ⛔ **`isLoading` 을 그대로 넘기지 않는다.** 그 값은 «꺼 둔» 조회에 대해 거짓이라, 아직 묻지도
 * 않은 것이 「받는 중」에서 빠지고 값 없음이 「없다」로 읽힌다. 이 저장소의 다른 조회들이 쓰는
 * 모양 — **`<조회를 열었는가> && isPending`** — 을 따른다.
 */
const toLoadState = <TItem,>(
  query: { isPending: boolean; isError: boolean; data?: { items: TItem[] } },
  enabled: boolean,
): LoadState<TItem[]> => ({
  isLoading: enabled && query.isPending,
  isError: query.isError,
  value: query.data?.items,
});

export interface EmergencyWorkOrderScreenProps {
  /** 제출 순간. 시간대 표기를 여기서 얻는다 — 검사에서 고정할 수 있게 밖에서 받는다. */
  now?: Date;
  /**
   * 긴급을 뜻하는 유형 코드. 화면은 기본값으로 상수를 쓴다.
   *
   * ⚠ **값이 정해진 뒤에도 밖에서 받는 자리를 남겨 둔다** — 빈 값이 흘러들었을 때 발행이
   * 잠기는지를 감지기가 확인할 수 있어야 한다. 상수만 읽으면 그 닫힌 쪽 경로를 확인할 길이 없다.
   */
  typeCode?: string;
}

/**
 * `W-02-07` 긴급 W/O 발행.
 *
 * ⛔ **막힌 사유를 한 곳에서만 말한다** — 발행 버튼 옆이다. 구획마다 되풀이하면 한쪽만
 * 고쳐질 때 화면이 스스로와 어긋난다.
 */
export const EmergencyWorkOrderScreen = ({
  now,
  typeCode = EMERGENCY_WORK_ORDER_TYPE_CODE,
}: EmergencyWorkOrderScreenProps) => {
  const t = messages.emergencyWorkOrder;
  const [item, setItem] = useState<SelectedItem | null>(null);
  const [form, setForm] = useState(EMPTY_ISSUE_FORM);
  const [routingId, setRoutingId] = useState<number | null>(null);

  const itemId = item?.itemId ?? null;
  const boms = useItemBoms(itemId);
  const routings = useItemRoutings(itemId);
  const operations = useRoutingOperations(routingId);
  const uoms = useUomLookup();
  const issue = useIssueEmergencyWorkOrder();
  const unreleased = useUnreleasedEmergencyWorkOrders();
  const handover = useHandoverRelease();

  /*
   * ⛔ **지금 이 화면이 들고 있는 것은 목록에서 뺀다.** 방금 발행했는데 배포가 멈춘 W/O 는
   * 되찾기 목록에도 들어온다 — 그대로 두면 **같은 지시에 [배포 재시도] 버튼이 둘**이 되고,
   * 두 버튼은 서로 다른 멱등 키를 쓴다. 서버는 그것을 다른 쓰기로 보므로 **이중 배포**가
   * 열린다. 위쪽 발행 구획이 이미 그 W/O 를 맡고 있으므로 여기서는 뺀다.
   */
  const handoverRows = (unreleased.data?.items ?? []).filter(
    (workOrder) => workOrder.workOrderId !== issue.pending?.workOrderId,
  );

  const expansion = resolveExpansion({
    itemId,
    boms: toLoadState<Bom>(boms, itemId !== null),
    routings: toLoadState<Routing>(routings, itemId !== null),
    selectedRoutingId: routingId,
    operations: toLoadState<RoutingOperation>(operations, routingId !== null),
  });

  /**
   * 개정이 **하나뿐이면 화면이 골라 준다** — 고를 것이 없는데 고르라고 하지 않는다.
   *
   * ⛔ **판정은 여전히 「골랐는가」만 본다.** 자동으로 채우는 쪽이 나중에 바뀌거나 사라져도
   * **고르지 않은 채 발행되는 길이 열리지 않는다** — 편의와 안전을 갈라 둔 것이다.
   */
  const soleRoutingId =
    expansion.kind === 'needsRevision' && expansion.routings.length === 1
      ? (expansion.routings[0]?.routingId ?? null)
      : null;

  useEffect(() => {
    if (soleRoutingId !== null) setRoutingId(soleRoutingId);
  }, [soleRoutingId]);

  const lock = toIssueLock({
    isIssuing: issue.isIssuing,
    pending: issue.pending,
    issueError: issue.error,
    isCreateUncertain: issue.isCreateUncertain,
    expansion,
    isInputComplete: isIssueInputComplete(form),
    typeCode,
  });

  /* 품목을 바꾸면 고른 개정을 지운다 — 앞 품목의 개정으로 발행되지 않게. */
  const selectItem = (next: SelectedItem | null): void => {
    setItem(next);
    setRoutingId(null);
    setForm({ ...form, itemId: next === null ? '' : String(next.itemId) });
  };

  return (
    <>
      <PageHeader title={t.title} />

      <FixedTermsPane />

      {/*
       * ⭐ **밀린 것을 먼저 보인다.** 새로 발행하기 «전에» 이미 만들어진 지시가 있다는 사실을
       * 알아야 한다 — 모르고 발행하면 같은 지시가 둘이 된다. 밀린 것이 없으면 서지 않는다.
       */}
      <HandoverPane
        workOrders={handoverRows}
        total={unreleased.data?.page.total}
        isError={unreleased.isError}
        releasingId={handover.releasingId}
        releasedNo={handover.releasedNo}
        failure={handover.failure}
        uomLabel={(uomId) => uoms.labelOf(uomId)}
        onRelease={handover.release}
      />

      <ItemPicker selected={item} onSelect={selectItem} />

      <IssueFormPane
        value={form}
        errors={validateIssueForm(form)}
        item={item}
        uomLabel={uoms.labelOf(item?.baseUomId)}
        onChange={setForm}
      />

      <ExpansionPane
        state={expansion}
        orderQtyText={form.orderQty}
        selectedRoutingId={routingId}
        onSelectRouting={setRoutingId}
      />

      <IssueAction
        lock={lock}
        releasedNo={issue.releasedNo}
        pending={issue.pending}
        onRetryRelease={issue.retryRelease}
        onIssue={() => {
          issue.issue({
            form,
            item: item ?? { itemId: 0, itemCode: '', itemName: '', baseUomId: 0 },
            routingOperationId: issueRoutingOperationId(expansion),
            typeCode,
            at: now ?? new Date(),
          });
        }}
      />
    </>
  );
};
