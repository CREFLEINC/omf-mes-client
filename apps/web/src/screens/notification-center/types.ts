import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 자료의 모양.
 *
 * 계약이 준 것을 **화면이 쓰는 모양으로 한 번만** 옮긴다(`toNotificationView`). 옮기는 자리를
 * 하나로 두는 이유는 「없을 수 있는 값」의 처리가 흩어지면 어떤 부품은 `undefined`를,
 * 어떤 부품은 `null`을 보게 되기 때문이다.
 *
 * ⚠ **알림 문장을 화면이 짓지 않는다.** `message`는 서버가 보낸 그대로 나른다 —
 * 그 문장은 **발송 시점의 언어**로 저장돼 있고, 다국어 처리는 아직 정해지지 않았다(스펙 §8-2).
 * 화면이 문장을 조립하기 시작하면 그 미결이 화면 코드에 눌러앉는다.
 */

export type Notification = components['schemas']['Notification'];

/** 목록 한 줄. 계약의 선택 필드는 **`null`로 눕혀** 나른다 — 갈래 판정을 한 모양으로 한다. */
export interface NotificationView {
  notificationId: number;
  eventCode: string;
  message: string;
  /** 계약 원문(date-time). 표기가 아니라 **원본이 필요한 자리**가 쓴다. */
  occurredAt: string;
  /** 표기 `MM-DD HH:mm`. 형식이 아니면 원문 그대로다 */
  occurredAtText: string;
  read: boolean;
  targetTypeCode: string | null;
  targetId: number | null;
}

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

/** 선택칸 하나가 받는 항목. 「전체」는 `value`가 빈 항목으로 둔다 */
export interface SelectOption {
  value: string;
  label: string;
}

export interface NotificationListResult {
  items: NotificationView[];
  page: PageMeta;
}

/** 계약의 date-time 문자열에서 표기용 조각을 뽑는다. */
const RFC3339_PATTERN = /^\d{4}-(\d{2}-\d{2})T(\d{2}:\d{2})/;

/**
 * 발생 시각 표기(`08-13 09:12`).
 *
 * **실행 환경 시간대로 옮기지 않는다.** 문자열에 실려 온 offset은 그 일이 실제로 일어난 곳의
 * 시각이고, 보는 사람의 시간대로 옮기면 같은 알림이 사람마다 다른 시각으로 보인다.
 * `new Date(value)`로 파싱해 다시 그리는 형태가 정확히 그 함정이다.
 *
 * **해를 적지 않는다.** 목록이 기간으로 좁혀져 있어 해가 갈리는 일이 드물고, 카드 머리줄에
 * 이벤트 코드·읽음 표시와 함께 서는 자리라 글자 수를 아낀다.
 *
 * **형식이 아니면 원문을 그대로 낸다.** 서버가 보낸 값을 화면이 삼키지 않는다 —
 * 「—」로 바꾸면 값이 없는 것과 못 알아본 것이 구분되지 않는다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 함수를 참조하지 않는다.
 */
export const formatOccurredAt = (value: string): string => {
  const matched = RFC3339_PATTERN.exec(value);

  if (matched === null) return value;

  return `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

/**
 * 계약의 알림 한 건을 화면이 쓰는 모양으로 옮긴다.
 *
 * **대상 두 칸은 각각 눕힌다.** 계약이 둘을 따로 선택으로 두어 한쪽만 오는 경우를 막지 않는다 —
 * 「둘 다 있어야 이동할 수 있다」는 판정은 그 갈래를 쓰는 회차가 하고, 여기서는 사실만 나른다.
 */
export const toNotificationView = (source: Notification): NotificationView => ({
  notificationId: source.notificationId,
  eventCode: source.eventCode,
  message: source.message,
  occurredAt: source.occurredAt,
  occurredAtText: formatOccurredAt(source.occurredAt),
  read: source.read,
  targetTypeCode: source.targetTypeCode ?? null,
  targetId: source.targetId ?? null,
});
