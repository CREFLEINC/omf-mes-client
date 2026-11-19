import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import {
  PuButton,
  PuChip,
  PuEmpty,
  PuKv,
  PuNote,
  PuSection,
  type PuFold,
} from '../../patterns/pop-uniform';
import { elapsedMinutes, toDateTimeLabel, toDurationLabel } from './formatting';
import { sessionStatusName } from './hold-reasons';
import type { WorkSessionView } from './types';

const t = messages.workHoldRegister;

export interface SessionPanelProps {
  session: WorkSessionView | null;
  isPending: boolean;
  /** 세션을 읽지 못했다 — 「없다」가 아니라 「모른다」다. 구획에는 `error` 가 대신 선다. */
  error: ReactNode;
  now: Date;
  /** 세션을 닫을 수 있는가 — 진행 중일 때만 열린다(스펙 §5-4). */
  canEnd: boolean;
  /**
   * 지금 중단 상태인가.
   *
   * ⛔ **잠긴 이유를 하나로 뭉뚱그리지 않는다.** 종료는 「중단 중」·「사번 없음」·「보내는 중」
   * 셋 다에서 잠기는데, 언제나 「중단 중이면 먼저 재개하세요」로 말하면 **사번이 없어 잠긴
   * 사람에게 틀린 안내를 한다**.
   */
  isStopped: boolean;
  onEnd: () => void;
  fold: PuFold;
  /** 이벤트 이력 줄(구획 안 가는 선 아래). */
  history: ReactNode;
}

const statusChip = (statusCode: string) => {
  const tone = statusCode === 'RUNNING' ? 'info' : statusCode === 'STOPPED' ? 'warn' : 'idle';

  return <PuChip tone={tone}>{sessionStatusName(statusCode)}</PuChip>;
};

/**
 * 《현재 세션》 구획(스펙 §3 · POP 통일 시안 #295) — 위에 시작 · 경과, 가는 선 아래 이벤트 이력,
 * 맨 아래 [세션 종료]. 세션 번호와 상태는 제목 줄 오른쪽.
 *
 * ⭐ **경과 시간은 저장값이 아니다.** 화면이 지금과 시작의 차를 매번 다시 센다.
 *
 * ⛔ **[세션 종료]를 지우지 않는다.** 스펙 변경 이력 v0.6 이 「① 세션 종료 버튼을 이 화면에 둔다」로
 *    되살린 자리다(2:1 다수 · omf-mes#79 확정 기록). 중단·재개와 달리 **세션 자체를 닫는 일**이라
 *    아래 작업 줄에 섞지 않는다 — 섞으면 멈추려던 손이 닫는 버튼을 누른다.
 */
export const SessionPanel = ({
  session,
  isPending,
  error,
  now,
  canEnd,
  isStopped,
  onEnd,
  fold,
  history,
}: SessionPanelProps) => {
  const labelId = useId();
  const hasError = error !== null && error !== undefined && error !== false;

  const body = (() => {
    if (hasError) return error;
    if (isPending) return <p className="pu-help">{t.session.loading}</p>;
    /* 세션이 없으면 빈 구획 모양 — 막힌 사유는 「중단 등록」 구획 위 주의 줄이 말한다. */
    if (session === null) return <PuEmpty icon="clock" title={t.session.empty} />;

    const startedLabel = toDateTimeLabel(session.startedAt) ?? session.startedAt;
    const minutes = elapsedMinutes(session.startedAt, now);
    /* 시작 시각을 읽을 수 없으면 경과도 말하지 않는다 — 0분이라고 하면 방금 선 것으로 읽힌다. */
    const elapsedLabel = minutes === null ? null : toDurationLabel(minutes);

    return (
      <>
        <PuKv
          items={[
            { label: t.session.startedLabel, value: startedLabel },
            { label: t.session.elapsedLabel, value: elapsedLabel ?? t.session.unknownValue },
          ]}
        />
        <hr className="pu-sep" />
        {history}
        <div className="wh-end">
          {/*
           * ⛔ **중단 중에는 잠근다** — 스펙이 「세션이 열려 있고 지금 중단 상태가 아니다」로 좁혔다.
           * ⭐ **숨기지 않고 잠근다**: 숨기면 「이 화면에서 못 닫는다」로 읽힌다. 잠긴 이유는 옆 줄이 말한다.
           */}
          <PuButton disabled={!canEnd} onClick={onEnd}>
            {t.end.action}
          </PuButton>
          {!canEnd && isStopped && <PuNote tone="warn">{t.end.blocked}</PuNote>}
        </div>
      </>
    );
  })();

  return (
    <PuSection
      className="wh-session"
      labelId={labelId}
      bodyClassName="wh-session-body"
      title={t.session.sectionLabel}
      fold={fold}
      meta={
        session === null || hasError ? undefined : (
          <>
            <span>{t.session.sessionNo(session.sessionNo)}</span>
            {statusChip(session.statusCode)}
          </>
        )
      }
    >
      {body}
    </PuSection>
  );
};
