import { AlertBanner, Button, Card, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { elapsedMinutes, toDateTimeLabel, toDurationLabel } from './formatting';
import { sessionStatusName } from './hold-reasons';
import type { WorkSessionView } from './types';

const t = messages.workHoldRegister;

export interface SessionPanelProps {
  session: WorkSessionView | null;
  isPending: boolean;
  now: Date;
  /** 세션을 닫을 수 있는가 — 진행 중일 때만 열린다(스펙 §5-4). */
  canEnd: boolean;
  /**
   * 지금 중단 상태인가.
   *
   * ⛔ **잠긴 이유를 하나로 뭉뚱그리지 않는다.** 종료는 「중단 중」·「사번 없음」·「보내는 중」
   * 셋 다에서 잠기는데, 언제나 「중단 중이면 먼저 재개하세요」로 말하면 **사번이 없어 잠긴
   * 사람에게 틀린 안내를 한다**(그 사유는 액션바가 따로 말한다).
   */
  isStopped: boolean;
  onEnd: () => void;
}

/**
 * 《현재 세션》 구획(스펙 §3).
 *
 * ⛔ **세션이 없는 것을 빈 카드로 그리지 않는다.** 이 화면은 세션이 열려 있어야만 성립하므로
 * (스펙 §5-2 — `work_session_event.work_session_id` 가 NOT NULL) 그 사실을 **차단 안내로**
 * 말한다. 빈 칸으로 두면 작업자가 사유만 고르고 눌러 본 뒤에야 막힌 것을 안다.
 *
 * ⭐ **경과 시간은 저장값이 아니다.** 화면이 지금과 시작의 차를 매번 다시 센다.
 *
 * ⭐ **[세션 종료]가 이 구획에 선다**(스펙 §3 도면 좌단 · 2026-09-06 게이트 승인). 중단·재개와
 * 달리 **세션 자체를 닫는 일**이라 《중단 등록》 구획이나 액션바에 섞지 않는다 — 섞으면 멈추려던
 * 손이 닫는 버튼을 누른다.
 */
export const SessionPanel = ({
  session,
  isPending,
  now,
  canEnd,
  isStopped,
  onEnd,
}: SessionPanelProps) => {
  if (isPending) {
    return (
      /*
       * ⚠ **기다리는 카드에 구획 이름을 붙이지 않는다.** 붙이면 이름으로 구획을 찾는 검사가
       * «내용이 오기 전» 이 카드에 먼저 걸려 빈 상자 안에서 값을 찾는다(실측). 기다리는
       * 중이라는 것은 안쪽 `Skeleton` 이 이미 말한다.
       */
      <Card bordered className="pop-section">
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
    <Card bordered className="pop-section" aria-label={t.session.sectionLabel}>
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

      {/*
       * ⛔ **중단 중에는 잠근다** — 스펙이 「세션이 열려 있고 지금 중단 상태가 아니다」로 좁혔다.
       * ⭐ **숨기지 않고 잠근다**: 숨기면 「이 화면에서 못 닫는다」로 읽혀 작업자가 닫을 자리를
       * 찾아 헤맨다. 잠긴 이유는 아래 문장이 말한다.
       */}
      <Button
        className="pop-session-end"
        variant="outlined"
        disabled={!canEnd}
        onClick={onEnd}
      >
        {t.end.action}
      </Button>
      {!canEnd && isStopped && <p className="field-note">{t.end.blocked}</p>}
    </Card>
  );
};
