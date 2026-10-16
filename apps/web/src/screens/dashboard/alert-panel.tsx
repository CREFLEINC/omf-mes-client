import { Button, Icon, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link, useNavigate } from 'react-router';

import { toPlantDateTimeParts } from '../../patterns/plant-time';
import { describeEvent, type EventEntry } from '../notification-center/lookups';
import type { DashboardAlertView } from './types';
import { EmptyLine } from './viz';

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
 * 알림 이름 — 알림센터와 같은 유형 목록(`/app/notification-events`)으로 푼다(사용자 지시 2026-10-16 — 코드
 * 원문을 보이지 않는다). 목록에 없거나 아직 안 왔으면 「알림」.
 */
export const alertTitleOf = (eventCode: string, entries: readonly EventEntry[]): string => {
  const label = describeEvent(eventCode, entries);

  return label === eventCode ? t.alerts.unknownEvent : label;
};

/**
 * 발생 일시(공장 시각) — 모든 항목을 `YYYY.MM.DD HH:mm`(24시간제) 한 형식으로(⭐ 사용자 지시 2026-10-16 · 이 카드
 * 한정). 오늘 · 지난날을 가르지 않고 상대 시간도 쓰지 않는다. 읽을 수 없으면 받은 표기 그대로.
 */
export const alertTimeOf = (view: DashboardAlertView): string => {
  const parts = toPlantDateTimeParts(view.occurredAt);

  return parts === null ? view.occurredAtText : `${parts.date.replaceAll('-', '.')} ${parts.time}`;
};

export interface AlertPanelProps {
  views: DashboardAlertView[];
  /** 알림 유형 이름 목록(알림센터와 같은 조회 · `useNotificationEventOptions`). */
  events: readonly EventEntry[];
  isLoading: boolean;
}

/**
 * 미확인 알림 목록.
 *
 * ⭐ **알람 묶음은 집계와 같은 응답에 온다** — 이 구획을 그리려고 요청을 하나 더 보내지 않는다.
 *
 * ⭐ **0건은 오류가 아니라 정상 상태다.** 「없습니다」를 실패처럼 그리면 사용자가 조건을 의심한다.
 *
 * 항목을 누르면 알림센터로 간다 — 이 화면은 알람의 상세를 그리지 않는다(소유 화면이 따로 있다).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const AlertPanel = ({ views, events, isLoading }: AlertPanelProps) => {
  if (isLoading) return <Skeleton variant="rect" height="10rem" />;

  if (views.length === 0) {
    return <EmptyLine live text={t.alerts.empty} />;
  }

  /*
   * ⭐ 한 항목 = 1줄 알림 이름(굵게) + 오른쪽 시각 / 2줄 메시지(최대 2줄 · 넘치면 말줄임, 전체는 `title`) ·
   * 위치는 있을 때만(사용자 지시 2026-10-16). 항목마다 상자 · 그림자를 두지 않고 얇은 선으로만 가른다 —
   * 멈춘 설비 · 출하 목록과 같은 밀도. 이 카드는 전부 미확인이라 「미확인」 배지를 두지 않는다.
   */
  return (
    <ul className="dash-alert-list">
      {views.map((view) => {
        const message = describeMessage(view.message);
        const location = view.locationPath?.trim() ?? '';

        return (
          <li key={view.notificationId}>
            {/*
             * ⛔ **링크에 `aria-label`을 두지 않는다.** 두면 그것이 링크의 이름을 **대체**해
             * 모든 알람이 같은 문구 하나로 읽히고, 어느 알람으로 가는 링크인지 사라진다.
             * 이름은 항목 내용(이름 · 시각 · 문구)에서 나오게 둔다.
             */}
            <Link className="dash-alert-link" to={alertPathOf(view.eventCode)}>
              <span className="dash-alert-head">
                <span className="dash-alert-title">{alertTitleOf(view.eventCode, events)}</span>
                {/* 원문을 `dateTime`에 그대로 둔다 — 표기는 조각이라 그것만으로는 되짚을 수 없다. */}
                <time className="dash-alert-time" dateTime={view.occurredAt}>
                  {alertTimeOf(view)}
                </time>
              </span>
              <span className="dash-alert-message" title={message}>
                {message}
              </span>
              {location !== '' && <span className="dash-alert-location">{location}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};

/**
 * 미확인 알림 카드 머리의 「알림센터 보기 →」(사용자 지시 2026-10-16) — 카드 아래 파란 밑줄 링크를 대신한다.
 * 가장 약한 강조(DS `text` 단추)에 기본 글자색. 목록이 비어 있어도 둔다 — 「지금 없다」를 확인한 사람이
 * 지난 알림을 보러 갈 자리다. 이동 경로는 그대로(`NOTIFICATION_CENTER_PATH`).
 */
export const AlertCenterButton = () => {
  const navigate = useNavigate();

  return (
    <Button
      variant="text"
      size="sm"
      className="dash-panel-action"
      trailingIcon={<Icon name="arrow_forward" size={16} />}
      onClick={() => {
        void navigate(NOTIFICATION_CENTER_PATH);
      }}
    >
      {t.alerts.openCenter}
    </Button>
  );
};
