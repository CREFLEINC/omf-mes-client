import { Card, Chip, EmptyState, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import type { DashboardAlertView } from './types';

const t = messages.dashboard;

/** 알림센터의 「유형」 조건 주소 키. 그 화면과 한 계약이라 여기서 이름을 지어내지 않는다. */
const NOTIFICATION_EVENT_KEY = 'ev';

export const NOTIFICATION_CENTER_PATH = '/notification/center';

/** 알람 하나를 눌렀을 때 갈 곳 — 알림센터를 **그 유형으로 좁혀** 연다. */
export const alertPathOf = (eventCode: string): string => {
  if (eventCode === '') return NOTIFICATION_CENTER_PATH;

  const query = new URLSearchParams({ [NOTIFICATION_EVENT_KEY]: eventCode });

  return `${NOTIFICATION_CENTER_PATH}?${query.toString()}`;
};

/**
 * 카드 본문에 그릴 글자. **빈 자리를 그리지 않는다** — 서버가 빈 문구를 주는 일이 실제로 있고,
 * 그대로 그리면 제목만 남은 카드가 서서 사용자는 화면이 덜 그려진 것으로 읽는다.
 */
export const describeMessage = (message: string): string =>
  message.trim() === '' ? t.alerts.emptyMessage : message;

/**
 * 알람 위치. ⭐ **계층 텍스트다** — 「공장 > 라인 > 설비」 꼴로 서버가 만들어 준다.
 * ⛔ 평면 배치·도면 구획을 쓰지 않는다(설계 확정). 오지 않으면 없다고 적는다.
 */
export const describeLocation = (locationPath: string | null): string =>
  locationPath === null || locationPath.trim() === '' ? t.alerts.locationUnknown : locationPath;

export interface AlertPanelProps {
  views: DashboardAlertView[];
  isLoading: boolean;
}

/**
 * 미처리 알람 목록.
 *
 * ⭐ **알람 묶음은 집계와 같은 응답에 온다** — 이 구획을 그리려고 요청을 하나 더 보내지 않는다.
 *
 * ⭐ **0건은 오류가 아니라 정상 상태다.** 「없습니다」를 실패처럼 그리면 사용자가 조건을 의심한다.
 *
 * 항목을 누르면 알림센터로 간다 — 이 화면은 알람의 상세를 그리지 않는다(소유 화면이 따로 있다).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const AlertPanel = ({ views, isLoading }: AlertPanelProps) => {
  if (isLoading) return <Skeleton variant="rect" height="10rem" />;

  if (views.length === 0) {
    return <EmptyState size="sm" live title={t.alerts.emptyTitle} description={t.alerts.empty} />;
  }

  return (
    <ul className="alert-list">
      {views.map((view) => {
        const titleId = `dashboard-alert-${String(view.notificationId)}`;

        return (
          <li key={view.notificationId}>
            {/*
             * ⛔ **링크에 `aria-label`을 두지 않는다.** 두면 그것이 링크의 이름을 **대체**해
             * 모든 알람이 같은 문구 하나로 읽히고, 어느 알람으로 가는 링크인지 사라진다.
             * 이름은 카드 내용(유형 · 문구 · 시각)에서 나오게 둔다.
             */}
            <Link className="alert-link" to={alertPathOf(view.eventCode)}>
              <Card surface="default" bordered aria-labelledby={titleId}>
                <Card.Header>
                  <div className="alert-meta">
                    <span id={titleId} className="alert-code">
                      {view.eventCode}
                    </span>
                    <Chip size="sm" status={view.read ? 'idle' : 'error'}>
                      {view.read ? t.alerts.read : t.alerts.unread}
                    </Chip>
                    {/* 원문을 `dateTime`에 그대로 둔다 — 표기는 조각이라 그것만으로는 되짚을 수 없다. */}
                    <time className="alert-time" dateTime={view.occurredAt}>
                      {view.occurredAtText}
                    </time>
                  </div>
                </Card.Header>
                <Card.Body>
                  {describeMessage(view.message)}
                  {/*
                   * 위치는 둘째 줄이다. ⛔ `.stacked-cell`을 쓰지 않는다 — 그 클래스는 줄마다
                   * 줄바꿈을 막아 문장을 잘라 내며, 배치 규범이 문장에 쓰지 말라고 못 박았다.
                   */}
                  <span className="field-note">{describeLocation(view.locationPath)}</span>
                </Card.Body>
              </Card>
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
