import type { components } from '@omf-mes/api-client';

import type { Notification, PageMeta } from './types';

type NotificationEvent = components['schemas']['NotificationEvent'];

/**
 * 테스트 전용 예시 데이터. 런타임 코드는 이 모듈을 참조하지 않는다 —
 * 참조하면 예시 값이 배포 번들에 들어간다.
 *
 * **실 운영 값을 쓰지 않는다.** 계약의 `@example` 값도 쓰지 않는다 — 그것은 예시이지 확정이
 * 아니고, 시험 자료에 심으면 화면 코드보다 오래 남아 나중에 「이 값이 정본이었다」로 읽힌다.
 * 이 파일에서 특히 조심할 것은 계약의 `Notification.message` 예시 문장이다 — 그것을 그대로
 * 쓰면 **「서버가 준 문구」와 「화면이 지어낸 문구」를 시험이 가리지 못한다.**
 *
 * 번호는 7100대 합성 대역(알림), 7200대(대상)로 나눈다. 코드는 `SYN-` 접두, 문구는 「합성…」이다.
 *
 * **놓치기 쉬운 입력을 처음부터 담는다** — 읽은 것과 안 읽은 것이 섞여 있고, 대상 두 칸이 없는
 * 알림이 있으며, 본문이 공백뿐인 알림이 있다.
 */

/** 발생 시각의 기준 형태. **`+09:00`이 붙어 있다** — 시간대를 옮기지 않는 것이 규율이다. */
const BASE_NOTIFICATION: Notification = {
  notificationId: 7101,
  eventCode: 'SYN-EVENT-01',
  message: '합성 알림 문구 가입니다.',
  occurredAt: '2026-08-17T14:05:00+09:00',
  read: false,
};

export const notificationFixture = (overrides: Partial<Notification> = {}): Notification => ({
  ...BASE_NOTIFICATION,
  ...overrides,
});

/**
 * 목록 세 건. **순서가 뜻을 갖는다** — 앞 건이 빠졌을 때 뒤 건의 DOM이 살아남는지를 재는
 * 시험이 이 순서를 그대로 쓴다.
 */
export const notificationFixtures: Notification[] = [
  notificationFixture(),
  notificationFixture({
    notificationId: 7102,
    eventCode: 'SYN-EVENT-02',
    message: '합성 알림 문구 나입니다.',
    occurredAt: '2026-08-16T09:30:00+09:00',
    read: true,
    targetTypeCode: 'SYN-TARGET-TYPE',
    targetId: 7201,
  }),
  notificationFixture({
    notificationId: 7103,
    eventCode: 'SYN-EVENT-03',
    /* 본문이 공백뿐인 건 — 카드가 빈 자리를 그리지 않는지 재는 자리다. */
    message: '   ',
    occurredAt: '2026-08-15T23:45:00+09:00',
    read: false,
  }),
];

/** 목록 응답 한 벌. `page`는 서버가 정본이므로 시험도 응답에서만 읽는다. */
export const notificationListBody = (
  items: Notification[] = notificationFixtures,
  page: Partial<PageMeta> = {},
): { items: Notification[]; page: PageMeta } => ({
  items,
  page: { page: 1, size: 50, total: items.length, ...page },
});

/**
 * 알림 유형 목록.
 *
 * ⭐ **셋째 알림(`SYN-EVENT-03`)의 유형을 일부러 빼 두었다** — 「목록에 없는 코드는 원문을
 * 그대로 보인다」가 이 화면의 규율인데, 픽스처가 전부 풀리면 그 갈래를 잴 수 없다.
 *
 * ⚠ **이름이 코드와 뚜렷이 다르다.** 이름이 코드를 닮으면 「풀렸다」와 「원문으로 낙하했다」를
 * 시험이 가리지 못한다.
 */
export const notificationEventFixtures: NotificationEvent[] = [
  { eventCode: 'SYN-EVENT-01', eventName: '합성 이벤트 가' },
  { eventCode: 'SYN-EVENT-02', eventName: '합성 이벤트 나' },
  /* 이름이 빈 항목 — 빈 제목을 그리지 않고 코드로 낙하하는지 재는 자리다. */
  { eventCode: 'SYN-EVENT-04', eventName: '   ' },
];

export const notificationEventListBody = (
  items: NotificationEvent[] = notificationEventFixtures,
): { items: NotificationEvent[] } => ({ items });
