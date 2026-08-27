import type { components } from '@omf-mes/api-client';

import { type IssueFormValue, isIssueInputComplete } from './issue-form';
import type { SelectedItem } from './types';
import { isEmergencyTypeCodeKnown } from './work-order-type';

/**
 * 보낼 본문은 **계약에서 파생한다.** 손으로 옮겨 적으면 계약에 필수 필드가 늘어도 컴파일이
 * 잡지 못한다 — 되돌릴 수 없는 쓰기의 본문이라 특히 그렇다.
 *
 * ⚠ **계획 참조 한 칸만 손으로 고쳐 둔다.** 이 저장소의 생성 타입이 정본보다 낡아서 그 칸이
 * 아직 「필수·널 불가」인데, 정본은 이 화면을 열어 주려고 **널 허용**으로 바꿔 두었다. 낡은
 * 타입을 그대로 쓰면 이 화면이 성립하지 않는다.
 *
 * ⛔ **통째로 걷어 내지 않고 이 칸만 갈아 끼운 것이 요점이다.** 나머지 필드는 그대로 계약에
 * 매여 있어, 계약에 필수 필드가 늘면 여전히 컴파일이 잡는다. 생성물이 갱신되면 `Omit` 을
 * 지우기만 하면 된다. 생성물이 낡은 사실은 따로 올려 두었다(client#543).
 */
export type WorkOrderCreateBody = Omit<
  components['schemas']['WorkOrderCreate'],
  'productionPlanId'
> & {
  productionPlanId: number | null;
};
export type WorkOrderReleaseBody = components['schemas']['WorkOrderRelease'];

export interface IssueCommand {
  form: IssueFormValue;
  item: SelectedItem;
  /** 전개가 정한 시작 공정. 정해지지 않았으면 `null`. */
  routingOperationId: number | null;
  /** 긴급을 뜻하는 유형 코드. 비어 있으면 아직 정해지지 않은 것이다. */
  typeCode: string;
  /** 제출 순간. 시간대 표기를 여기서 얻는다. */
  at: Date;
}

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC 와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * **제출 순간의 값을 쓴다.** 납기를 파싱해 그 시점의 값을 쓰면 서머타임 경계에서 더
 * 정확해지지만 파싱이 실패할 수 있는 가지가 생긴다 — 이 제품이 도는 지역에는 서머타임이 없어
 * 두 값이 갈리지 않으므로 가지를 만들지 않는 쪽을 택했다.
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * 분까지 받은 값에 초와 시간대를 붙인다.
 *
 * 납기 칸은 분까지만 주는데(`HH:mm`) 계약은 초까지 있는 형식을 요구한다. 시간대가 없는
 * 문자열을 그대로 보내면 **같은 글자가 지역마다 다른 순간을 가리킨다.**
 */
const toOffsetDateTime = (local: string, at: Date): string => `${local}:00${offsetText(at)}`;

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

  const due = command.form.plannedEndAtLocal.trim();

  return {
    productionPlanId: null,
    routingOperationId: command.routingOperationId,
    itemId: Number(command.form.itemId.trim()),
    orderQty: Number(command.form.orderQty.trim()),
    uomId: command.item.baseUomId,
    workOrderTypeCode: command.typeCode.trim(),
    remarks: command.form.remarks.trim(),
    ...(due === '' ? {} : { plannedEndAt: toOffsetDateTime(due, command.at) }),
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
