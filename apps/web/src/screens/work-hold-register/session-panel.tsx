import { AlertBanner, Card, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { elapsedMinutes, toDateTimeLabel, toDurationLabel } from './formatting';
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
          <dt>{t.session.sessionNo(session.sessionNo)}</dt>
          <dd />

          <dt>{t.session.startedLabel}</dt>
          <dd>{startedLabel}</dd>

          <dt>{t.session.elapsedLabel}</dt>
          <dd>{elapsedLabel ?? t.session.unknownValue}</dd>

          {/*
           * ⚠ 상태 코드의 «문자열»은 계약이 아직 확정하지 않았다 — 화면은 받은 값을 그대로
           * 보이고, 그 값으로 분기하지 않는다(`types.ts` 의 열림 판정).
           */}
          <dt>{t.session.statusLabel}</dt>
          <dd>{session.statusCode}</dd>
        </dl>
      </section>
    </Card>
  );
};
