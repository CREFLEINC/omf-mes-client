import { Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { NotificationView } from './types';

const t = messages.notificationCenter;

/**
 * 카드 제목의 `id`. **알림 번호로 격리한다.**
 *
 * 사본 체크리스트의 「줄 단위 `id` 격리」가 형태를 바꿔 걸리는 자리다 — 이 화면에는 표가 없고
 * 카드가 반복된다. 상수로 두면 카드가 둘 이상일 때 모든 카드가 **첫 카드의 제목**을 가리켜,
 * 보조 기술로 읽는 사람에게 목록 전체가 같은 이름으로 들린다.
 */
export const titleIdOf = (notificationId: number): string =>
  `notification-title-${String(notificationId)}`;

/**
 * 카드 본문에 그릴 글자.
 *
 * **빈 자리를 그리지 않는다.** 서버가 빈 문구를 주는 일이 실제로 있고(형제 화면들이 관측된
 * 사실로 적어 둔 자리다), 그대로 그리면 제목만 남은 카드가 서서 사용자는 화면이 덜 그려진
 * 것으로 읽는다.
 *
 * ⭐ **다듬은 뒤에 판정한다.** `message === ''`로만 보면 공백뿐인 문구가 빠져나가 결과가 같다.
 * 화면에 내는 것은 **원문 그대로**다 — 다듬은 값을 내면 서버가 보낸 것과 보이는 것이 갈린다.
 */
export const describeMessage = (message: string): string =>
  message.trim() === '' ? t.card.emptyMessage : message;

export interface NotificationCardProps {
  view: NotificationView;
  /**
   * 카드 제목으로 그릴 글자 — 푼 이벤트 이름이거나, 풀 수 없으면 **원본 코드**다.
   *
   * 푸는 일을 이 부품이 하지 않는 이유는 그것이 **조회 결과에 매인 판정**이기 때문이다
   * (`lookups.ts`). 부품이 목록을 받아 스스로 풀면 카드마다 같은 탐색을 되풀이하고,
   * 「풀 수 없을 때 무엇을 보이는가」가 화면과 부품 두 곳에 흩어진다.
   */
  title: string;
}

/**
 * 알림 카드 한 장 — 머리줄(이벤트 이름 · 읽음 표시 · 발생 시각)과 본문 두 줄이 전부다.
 *
 * ⭐ **제목은 푼 이름이되, 풀 수 없으면 원본 코드다**(`title` — 판정은 `lookups.ts`).
 * 「알 수 없음」으로 바꾸지 않는다 — 그러면 사용자가 담당자에게 전할 단서가 사라진다.
 *
 * ⚠ **본문은 서버가 준 그대로다.** 그 문장은 발송 시점의 언어로 저장돼 있고 다국어 처리는
 * 아직 정해지지 않았다(스펙 §8-2). 그 사실을 **화면에 상시 안내로 두지 않는다** — 늘 참인데
 * 사용자가 할 수 있는 조치가 없다. 안내가 필요해지는 시점은 수신자 언어를 볼 수 있게 된 뒤다.
 *
 * **이 회차의 카드는 누를 수 없다.** 읽음 처리(항목 클릭)는 뒤따르는 회차가 붙이며, 그때
 * `interactive`로 바꾼다 — 디자인 시스템이 그 형태 안에 다른 포커스 컨트롤을 두는 것을 금한다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const NotificationCard = ({ view, title }: NotificationCardProps) => {
  const titleId = titleIdOf(view.notificationId);

  return (
    <Card surface="default" bordered role="group" aria-labelledby={titleId}>
      <Card.Header>
        <div className="notification-card-meta">
          <span id={titleId} className="notification-card-code">
            {title}
          </span>
          <Chip size="sm" status={view.read ? 'idle' : 'info'}>
            {view.read ? t.card.read : t.card.unread}
          </Chip>
          {/* 원문을 `dateTime`에 그대로 둔다 — 표기는 조각이라 그것만으로는 언제인지 되짚을 수 없다. */}
          <time className="notification-card-time" dateTime={view.occurredAt}>
            {view.occurredAtText}
          </time>
        </div>
      </Card.Header>
      <Card.Body>{describeMessage(view.message)}</Card.Body>
    </Card>
  );
};
