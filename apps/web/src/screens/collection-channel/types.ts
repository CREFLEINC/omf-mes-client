import type { components } from '@omf-mes/api-client';

/** W-05-07 화면 슬라이스의 계약. */
export type CollectionChannel = components['schemas']['CollectionChannel'];
export type Equipment = components['schemas']['Equipment'];
export type PageMeta = components['schemas']['PageMeta'];
export type InspectionPlan = components['schemas']['InspectionPlan'];
export type InspectionPlanVersion = components['schemas']['InspectionPlanVersion'];
export type InspectionItemSpec = components['schemas']['InspectionItemSpec'];

/** 왼쪽 설비 목록을 좁히는 조건. 「조회」를 눌러야 나간다. */
export interface EquipmentFilters {
  q: string;
  plantId: string;
}

/**
 * 오른쪽 채널 목록의 조건.
 *
 * ⭐ **두 조건은 서로 다른 데서 걸린다.** `includeInactive` 는 서버가 거르고
 * (`isActive` 질의), `unmappedOnly` 는 화면이 **받아 온 것만** 거른다 — 계약에 그런 질의가
 * 없기 때문이다. 그래서 목록이 잘리면 뒤엣것만 반쪽이 된다(`channel-notes.ts`).
 */
export interface ChannelFilters {
  includeInactive: boolean;
  unmappedOnly: boolean;
}

/**
 * 채널 창이 들고 있는 값.
 *
 * ⛔ **설비가 여기 없다.** 등록은 «왼쪽에서 고른 설비»에 매이고 수정은 옮길 수 없다 —
 * 계약의 수정 본문에 `equipmentId` 가 없다. 폼 값에 두면 언젠가 입력칸이 붙고, 그 순간
 * 「저장은 되는데 설비는 안 바뀌는 칸」이 생긴다.
 *
 * ⛔ **대상 검사 항목도 아직 여기 없다** — 잇는 일은 다음 슬라이스가 맡는다.
 */
export interface ChannelFormValues {
  /** 설비가 정한 이름. **등록에서만 정한다** — 수정 본문에 없다 */
  channelKey: string;
  signalName: string;
  unitCode: string;
  /**
   * 이 채널이 값을 실어 보낼 검사 항목. **`null` 이면 미매핑이고 그때 값은 버려진다.**
   *
   * ⭐ **수는 문자열로 들지 않는다** — 이 값은 사람이 치는 것이 아니라 «고르는» 것이라
   * 중간 상태가 없다. 고르지 않음과 0을 가를 일도 없다.
   */
  inspectionItemId: number | null;
}

/**
 * 검사 항목을 찾아가는 길. **폼 값이 아니다** — 저장되지 않고, 어느 항목을 고를지
 * 좁히는 데만 쓴다.
 *
 * ⚠ 계약에 검사 항목의 «전체» 목록이 없다. 항목은 검사기준의 버전에 속하고, 버전은
 * 기준에 속한다 — 그래서 세 칸을 차례로 좁혀야 항목에 닿는다.
 */
export interface ItemPickerPath {
  inspectionPlanId: number | null;
  inspectionPlanVersionId: number | null;
}
