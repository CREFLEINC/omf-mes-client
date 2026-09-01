import type { components } from '@omf-mes/api-client';

import { type IssueFormValue, isIssueInputComplete } from './issue-form';
import type { SelectedItem } from './types';
import { isEmergencyTypeCodeKnown } from './work-order-type';

/**
 * 보낼 본문은 **계약에서 파생한다.** 손으로 옮겨 적으면 계약에 필수 필드가 늘어도 컴파일이
 * 잡지 못한다 — 되돌릴 수 없는 쓰기의 본문이라 특히 그렇다.
 *
 * ⚠ 생성 타입이 낡아 계획 참조 한 칸을 손으로 갈아 끼워 두었는데(client#543), 생성물을
 * 정본과 맞추면서 그 자리가 널 허용이 되어 **덧댄 것을 걷어냈다.** 이제 전 필드가 계약에
 * 그대로 매여 있다.
 */
export type WorkOrderCreateBody = components['schemas']['WorkOrderCreate'];
export type WorkOrderReleaseBody = components['schemas']['WorkOrderRelease'];

export interface IssueCommand {
  form: IssueFormValue;
  item: SelectedItem;
  /** 전개가 정한 시작 공정. 정해지지 않았으면 `null`. */
  routingOperationId: number | null;
  /** 긴급을 뜻하는 유형 코드. 비어 있으면 아직 정해지지 않은 것이다. */
  typeCode: string;
}

/**
 * 발행 본문.
 *
 * ⛔ **`productionPlanId` 를 «명시적 `null`» 로 보낸다.** 키를 빼는 것과 뜻이 다르다 — 이
 * 화면은 계획 없이 발행하고, 서버가 그것을 보고 내부 P/O·계획·W/O 를 한 트랜잭션으로 만든다.
 * 계획 참조를 채워 보내면 그 자동 생성이 일어나지 않는다.
 *
 * ⛔ **계획 자원 다섯(설비·금형·교대·라인·담당자)은 애초에 이 본문에 자리가 없다.** 무배정
 * 배포라 그게 맞고, 자리가 없다는 사실 자체가 확정을 지킨다.
 *
 * ⛔ **우선순위·계획 시작을 싣지 않는다.** 계약에 자리는 있지만 스펙이 이 화면에서 받으라고
 * 한 적이 없다. 「긴급이니 우선순위를 높게」는 화면이 지어내는 값이다.
 *
 * 갖춰지지 않은 입력에는 `undefined` 를 돌려준다 — **잠금이 뚫려도 본문이 만들어지지 않는다.**
 * 막는 자리가 둘인 것은 중복이 아니라, 하나가 무너져도 나머지가 남게 하려는 것이다.
 */
export const toWorkOrderCreateBody = (command: IssueCommand): WorkOrderCreateBody | undefined => {
  if (!isIssueInputComplete(command.form)) return undefined;
  if (command.routingOperationId === null) return undefined;
  if (!isEmergencyTypeCodeKnown(command.typeCode)) return undefined;

  const due = command.form.dueDate.trim();

  return {
    productionPlanId: null,
    routingOperationId: command.routingOperationId,
    itemId: Number(command.form.itemId.trim()),
    orderQty: Number(command.form.orderQty.trim()),
    uomId: command.item.baseUomId,
    workOrderTypeCode: command.typeCode.trim(),
    remarks: command.form.remarks.trim(),
    ...(due === '' ? {} : { dueDate: due }),
  };
};

/**
 * 배포 본문.
 *
 * ⚠ **`lotSize` 를 지시수량으로 둔다 — 화면이 정한 값이다.** 계약은 이 값을 필수로 받는데
 * 이 화면 스펙에는 입력 칸이 없고, 레이아웃이 수량 전량에 대해 LOT 수를 **1** 로 그려 두었다.
 * 슬롯 수가 `올림(지시수량 ÷ LOT 크기)` 이므로 그 그림이 나오는 값은 **지시수량**뿐이다.
 *
 * ⛔ **조용히 정하지 않는다** — 화면이 「LOT 1개로 배포됩니다」를 함께 보인다. LOT 을 어떻게
 * 나눌지는 현장의 결정이라, 화면이 대신 정했으면 정했다는 사실이 보여야 한다. 이 자리가
 * 맞는지는 설계 저장소에 물어 두었다.
 */
export const toWorkOrderReleaseBody = (orderQty: string): WorkOrderReleaseBody | undefined => {
  const qty = Number(orderQty.trim());

  return Number.isFinite(qty) && qty > 0 ? { lotSize: qty } : undefined;
};
