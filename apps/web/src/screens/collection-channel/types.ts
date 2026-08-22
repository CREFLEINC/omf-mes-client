import type { components } from '@omf-mes/api-client';

/** W-05-07 화면 슬라이스의 계약. */
export type CollectionChannel = components['schemas']['CollectionChannel'];
export type Equipment = components['schemas']['Equipment'];
export type PageMeta = components['schemas']['PageMeta'];

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
