import { messages } from '@omf-mes/i18n';

import type { CollectionChannel } from './types';

const t = messages.collectionChannel;

/**
 * 이어 둔 «뒤에» 어긋난 것들.
 *
 * ⭐ **미매핑과 성격이 다르다.** 미매핑은 값이 **버려지는** 것이고, 여기 둘은 값이 저장되긴
 * 하되 **조용히 어긋나는** 것이다.
 *
 * ⛔ **둘 다 화면이 고쳐 주지 않는다** — 새 Rev 의 어느 항목에 대응하는지 기계가 모르고
 * (스펙 §6·§8-2), 단위 변환 규칙은 어디에도 저장돼 있지 않다(§5-5 · 공유계약 A-8).
 */
export type MappingWarning = 'staleRevision' | 'unitMismatch';

/**
 * 이어 둔 검사 항목을 이름으로.
 *
 * ⛔ **오지 않은 이름을 지어내지 않는다**(G-9). 코드·이름이 둘 다 없으면 「연결됨」까지만
 * 말한다 — 그것이 이 화면이 아는 전부다.
 *
 * ⚠ **한쪽만 오는 것도 사태다.** 코드만 오면 코드를, 이름만 오면 이름을 쓴다 — 없는 쪽을
 * 빈칸으로 두면 「· 」 같은 부스러기가 남는다.
 */
export const inspectionItemText = (channel: CollectionChannel): string => {
  const code = channel.inspectionItemCode ?? '';
  const name = channel.inspectionItemName ?? '';

  if (code !== '' && name !== '') return t.mapping.itemLabel(code, name);

  return code !== '' ? code : name !== '' ? name : t.mapping.mapped;
};

/**
 * 이어 둔 줄인데 이름도 코드도 오지 않았는가.
 *
 * ⚠ 표 위의 「이름이 오지 않았습니다」는 **그런 줄이 있을 때만** 선다. 늘 세우면, 이름이
 * 멀쩡히 보이는 표 위에서 이름이 오지 않는다고 말하게 된다.
 */
export const lacksItemName = (channel: CollectionChannel): boolean =>
  (channel.inspectionItemId ?? null) !== null &&
  (channel.inspectionItemCode ?? '') === '' &&
  (channel.inspectionItemName ?? '') === '';

/**
 * 옛 개정판을 가리키고 있는가.
 *
 * ⛔ **서버가 판정한 것만 믿는다**(계약 주석). 화면이 버전을 따로 불러 상태를 해석하면
 * 판정 규칙을 화면이 소유하게 되고, 서버가 규칙을 바꿔도 화면은 옛 규칙으로 답한다.
 *
 * ⛔ **판정이 오지 않으면 경고하지 않는다.** `null`·미도달은 「옛 판이다」가 아니라
 * 「모른다」이고, 모르는 것을 경고로 세우면 멀쩡한 줄에까지 늑대가 온다.
 */
export const isStaleRevision = (channel: CollectionChannel): boolean =>
  channel.inspectionItemIsCurrentRevision === false;

/**
 * 수신값의 단위와 검사 항목의 단위가 어긋나는가.
 *
 * ⛔ **한쪽이 없으면 견주지 않는다** — 「없다」는 「다르다」가 아니다. 둘 다 있고 서로 다를
 * 때만 어긋난 것이다.
 */
export const hasUnitMismatch = (channel: CollectionChannel): boolean => {
  const channelUnit = channel.unitCode ?? '';
  const itemUnit = channel.inspectionItemUnitCode ?? '';

  return channelUnit !== '' && itemUnit !== '' && channelUnit !== itemUnit;
};

/** 이 줄에 붙는 경고들. 순서는 고정한다 — 줄마다 순서가 바뀌면 표가 어지럽다. */
export const mappingWarnings = (channel: CollectionChannel): MappingWarning[] => {
  const warnings: MappingWarning[] = [];

  if (isStaleRevision(channel)) warnings.push('staleRevision');
  if (hasUnitMismatch(channel)) warnings.push('unitMismatch');

  return warnings;
};

/** 이 줄의 경고를 사람이 읽는 한 줄로. */
export const warningRowText = (channel: CollectionChannel, warning: MappingWarning): string =>
  warning === 'staleRevision'
    ? t.warnings.staleRevisionRow(channel.inspectionPlanVersion ?? null)
    : t.warnings.unitMismatchRow(channel.unitCode ?? '', channel.inspectionItemUnitCode ?? '');

export interface WarningCounts {
  staleRevision: number;
  unitMismatch: number;
}

/**
 * 표 위 요약이 셀 것.
 *
 * ⭐ **거르기 «전»의 목록으로 센다** — 미매핑 요약과 같은 규칙이다. 조건에 따라 수가
 * 달라지는 요약은 서버가 준 것을 말하지 않는다.
 */
export const countWarnings = (channels: readonly CollectionChannel[]): WarningCounts => ({
  staleRevision: channels.filter(isStaleRevision).length,
  unitMismatch: channels.filter(hasUnitMismatch).length,
});

/** 요약에 세울 줄들. 셀 것이 없으면 빈 배열이고 그때는 요약 자체가 서지 않는다. */
export const warningSummaryLines = (counts: WarningCounts): string[] => {
  const lines: string[] = [];

  if (counts.staleRevision > 0) lines.push(t.warnings.staleRevision(counts.staleRevision));
  if (counts.unitMismatch > 0) lines.push(t.warnings.unitMismatch(counts.unitMismatch));

  return lines;
};
