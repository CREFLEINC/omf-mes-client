import { messages } from '@omf-mes/i18n';

import type { ChannelFilters, EquipmentFilters } from './types';

/** 선택칸 한 줄. 디자인 시스템 `Select` 가 받는 형태 그대로다. */
export interface CodeOption {
  value: string;
  label: string;
}

export const defaultEquipmentFilters: EquipmentFilters = { q: '', plantId: '' };

/**
 * 채널 조건의 기본값.
 *
 * ⭐ **미사용은 기본으로 빼고 미매핑은 기본으로 넣는다** — 앞은 「지금 쓰는 것」을 보려는
 * 것이고 뒤는 **이 화면에 온 이유**다. 미매핑을 기본으로 감추면 할 일이 보이지 않는다.
 */
export const defaultChannelFilters: ChannelFilters = {
  includeInactive: false,
  unmappedOnly: false,
};

/**
 * 코드에 이름을 붙인다. **모르는 코드는 코드 그대로 둔다**(공유계약 G-9) —
 * 이름을 지어내면 없는 값이 있는 것처럼 보인다.
 */
export const codeLabel = (code: string, options: readonly CodeOption[]): string =>
  options.find((option) => option.value === code)?.label ?? code;

/** 미사용 설비·채널의 이름에 붙는 표식. 칸을 하나 더 두지 않고 이름에 담는다. */
export const withInactiveSuffix = (name: string, isActive: boolean): string =>
  isActive ? name : `${name}${messages.collectionChannel.values.inactiveSuffix}`;
