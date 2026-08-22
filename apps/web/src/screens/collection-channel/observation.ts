import { messages } from '@omf-mes/i18n';

import type { CollectionChannelObservation } from './types';

const t = messages.collectionChannel.importLog;

/**
 * 수신 로그에서 고른 것을 채널로 만들 때 화면이 스스로 도출하는 것들.
 *
 * ⭐ **계약에 일괄 등록이 없다** — 한 건씩 보낸다. 그래서 **일부만 성공하는 사태가 정상**이고,
 * 화면은 그것을 「다 됐다」로 뭉개지 않는다.
 */

/** 이미 채널로 만들어 둔 신호인가. 값이 오지 않으면 아직 아닌 것으로 본다. */
export const isAlreadyMapped = (observation: CollectionChannelObservation): boolean =>
  observation.alreadyMapped === true;

/**
 * 고를 수 있는 신호인가.
 *
 * ⛔ **이미 등록된 것을 감추지 않는다**(공유계약 G-2) — 보이되 고르지 못하게 하고 사유를
 * 붙인다. 감추면 「내가 찾던 그 신호가 왜 없지」가 되고, 그 답이 화면에 없다.
 */
export const isSelectable = (observation: CollectionChannelObservation): boolean =>
  !isAlreadyMapped(observation);

/** 고른 것을 하나 뒤집는다. 고를 수 없는 것은 넣지 않는다. */
export const toggleSelected = (
  selected: readonly string[],
  observation: CollectionChannelObservation,
): string[] => {
  if (!isSelectable(observation)) return [...selected];

  return selected.includes(observation.channelKey)
    ? selected.filter((key) => key !== observation.channelKey)
    : [...selected, observation.channelKey];
};

/**
 * 목록이 바뀌어도 고른 것이 살아 있게 한다 — 다만 **고를 수 없게 된 것은 거둔다.**
 *
 * ⛔ 조건을 껐다 켜는 사이에 사라진 신호를 그대로 들고 있으면, 화면에는 보이지 않는 것이
 * 저장 대상에 남는다 — 사용자는 무엇이 만들어질지 알 수 없다.
 */
export const retainSelectable = (
  selected: readonly string[],
  observations: readonly CollectionChannelObservation[],
): string[] => {
  const selectable = new Set(observations.filter(isSelectable).map((item) => item.channelKey));

  return selected.filter((key) => selectable.has(key));
};

/** 한 건을 보낸 결과. 실패는 사유를 함께 든다 — 뭉개면 무엇을 고칠지 알 수 없다. */
export interface ImportOutcome {
  channelKey: string;
  reason: string | null;
}

export interface ImportSummary {
  createdCount: number;
  failed: ImportOutcome[];
}

/**
 * 보낸 결과를 요약한다.
 *
 * ⛔ **성공 건수만 말하지 않는다.** 실패한 줄을 이름과 사유째로 남겨야 다시 시도하거나
 * 손으로 등록할 수 있다.
 */
export const summarize = (outcomes: readonly ImportOutcome[]): ImportSummary => ({
  createdCount: outcomes.filter((outcome) => outcome.reason === null).length,
  failed: outcomes.filter((outcome) => outcome.reason !== null),
});

/** 실패한 줄 하나를 사람이 읽는 한 줄로. 사유가 없으면 그 사실을 밝힌다. */
export const failedLine = (outcome: ImportOutcome): string =>
  t.failedRow(outcome.channelKey, outcome.reason ?? t.unknownReason);

/** 값이 오지 않은 칸을 빈 칸으로 두지 않는다 — 없는 것인지 못 받은 것인지 구별이 안 된다. */
export const orNotRecorded = (value: string | undefined): string =>
  value === undefined || value === '' ? t.notRecorded : value;

const RFC3339_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 받은 시각 표기(`2026-08-22 09:40`).
 *
 * ⛔ **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 **그 설비가 있는 곳의
 * 시각**이고, 보는 사람의 시간대로 옮기면 같은 신호가 사람마다 다른 시각으로 보인다.
 *
 * ⛔ **형식이 아니면 원문을 그대로 낸다** — 「—」로 바꾸면 값이 없는 것과 못 알아본 것이
 * 구분되지 않는다(공유계약 G-9).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatObservedAt = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};
