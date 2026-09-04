import { AlertBanner, Card, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { elapsedMinutes, toDateTimeLabel, toDurationLabel } from './formatting';
import { sessionStatusName } from './hold-reasons';
import type { WorkSessionView } from './types';

const t = messages.workHoldRegister;

export interface SessionPanelProps {
  session: WorkSessionView | null;
  isPending: boolean;
  now: Date;
}

/**
 * 《현재 세션》 구획(스펙 §3).
 *
 * ⛔ **세션이 없는 것을 빈 카드로 그리지 않는다.** 이 화면은 세션이 열려 있어야만 성립하므로
 * (스펙 §5-2 — `work_session_event.work_session_id` 가 NOT NULL) 그 사실을 **차단 안내로**
 * 말한다. 빈 칸으로 두면 작업자가 사유만 고르고 눌러 본 뒤에야 막힌 것을 안다.
 *
 * ⭐ **경과 시간은 저장값이 아니다.** 화면이 지금과 시작의 차를 매번 다시 센다.
 */
export const SessionPanel = ({ session, isPending, now }: SessionPanelProps) => {
  if (isPending) {
    return (
      <Card>
        <Skeleton height="96px" aria-label={t.session.loading} />
      </Card>
    );
  }

  if (session === null) {
    return (
      <div className="banner-slot">
        <AlertBanner variant="warning" title={t.session.sectionLabel}>
          {t.session.none}
        </AlertBanner>
      </div>
    );
  }

  const startedLabel = toDateTimeLabel(session.startedAt) ?? session.startedAt;
  const minutes = elapsedMinutes(session.startedAt, now);
  /* 시작 시각을 읽을 수 없으면 경과도 말하지 않는다 — 0분이라고 하면 방금 선 것으로 읽힌다. */
  const elapsedLabel = minutes === null ? null : toDurationLabel(minutes);

  return (
    <Card>
      <section aria-label={t.session.sectionLabel}>
        <h2 className="pane-title">{t.session.sectionLabel}</h2>

        <dl className="pop-hold-facts">
          {/* 세션 번호는 이름 없는 값이라 한 칸으로 둔다 — 빈 `dd` 를 읽히지 않는다. */}
          <dt className="pop-hold-facts-lead" />
          <dd>{t.session.sessionNo(session.sessionNo)}</dd>

          <dt>{t.session.startedLabel}</dt>
          <dd>{startedLabel}</dd>

          <dt>{t.session.elapsedLabel}</dt>
          <dd>{elapsedLabel ?? t.session.unknownValue}</dd>

          {/*
           * 상태 문자열은 계약이 셋으로 확정했다 — 사람 말로 옮겨 보이고, **모르는 값이면
           * 코드를 그대로 보인다**(임의로 「진행」으로 접으면 화면이 없는 사실을 말한다).
           */}
          <dt>{t.session.statusLabel}</dt>
          <dd>{sessionStatusName(session.statusCode)}</dd>
        </dl>
      </section>
    </Card>
  );
};
