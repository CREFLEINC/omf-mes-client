import { Button, Card, Skeleton } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { reasonName } from './downtime-reasons';
import { elapsedMinutes, toClockLabel, toDurationLabel } from './formatting';
import type { DowntimeView } from './types';

const t = messages.downtimeRegister;

export interface OngoingPanelProps {
  downtime: DowntimeView | null;
  isPending: boolean;
  now: Date;
  canClose: boolean;
  onClose: () => void;
}

/**
 * ① 진행 중 비가동.
 *
 * ⚠ **진행 중이 없으면 이 구획은 아예 서지 않는다**(스펙 §3 — 조건부 구획). 「진행 중 없음」을
 * 빈 카드로 그리면 1024×768에서 세로 예산을 그만큼 잡아먹고, 정작 입력 칸이 접힌 아래로 내려간다.
 *
 * ⭐ **경과 시간은 저장값이 아니다.** 화면이 지금과 시작의 차를 매번 다시 센다(스펙 §5-3).
 */
export const OngoingPanel = ({
  downtime,
  isPending,
  now,
  canClose,
  onClose,
}: OngoingPanelProps) => {
  if (isPending) {
    return (
      <Card>
        <Skeleton height="64px" aria-label={t.ongoing.title} />
      </Card>
    );
  }

  if (downtime === null) return null;

  const startedLabel = toClockLabel(downtime.startedAt) ?? downtime.startedAt;
  const minutes = elapsedMinutes(downtime.startedAt, now);
  /* 시작 시각을 읽을 수 없으면 경과도 말하지 않는다 — 0분이라고 하면 방금 선 것으로 읽힌다. */
  const elapsedLabel = minutes === null ? null : toDurationLabel(minutes);
  const name = downtime.reasonName ?? reasonName(downtime.reasonCode) ?? downtime.reasonCode;

  return (
    <Card>
      <section className="downtime-ongoing" aria-label={t.ongoing.title}>
        <div>
          <p className="downtime-ongoing-line">
            {elapsedLabel === null ? startedLabel : t.ongoing.elapsed(startedLabel, elapsedLabel)}
          </p>
          <p className="downtime-ongoing-reason">{t.ongoing.reason(name)}</p>
        </div>

        {/* 장갑 낀 손으로 누른다 — 72픽셀은 디자인 시스템의 `2xl`이 낸다. */}
        {/*
          ⭐ 「종료하는 중」이라는 대기 상태를 두지 않는다 — 큐에 담는 것이 곧 성공이라
          기다릴 것이 없다. 아직 서버에 닿지 않은 사실은 헤더의 미전송 건수가 말한다.
        */}
        <Button variant="filled" size="2xl" disabled={!canClose} onClick={onClose}>
          {t.ongoing.close}
        </Button>
      </section>
    </Card>
  );
};
