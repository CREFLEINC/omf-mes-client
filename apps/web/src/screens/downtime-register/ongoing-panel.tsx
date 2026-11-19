import { messages } from '@omf-mes/i18n';

import { PuButton, PuChip, PuNote } from '../../patterns/pop-uniform';

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
 * 진행 중 비가동 줄 — 「오늘 이 설비」 구획 위쪽(#295 시안).
 *
 * ⚠ **진행 중이 없으면 이 줄은 아예 서지 않는다**(스펙 §3 — 조건부). 서면 아래 목록의 한 쪽 건수가
 * 그만큼 저절로 줄어든다.
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
  if (isPending) return <PuNote>{t.ongoing.loading}</PuNote>;

  if (downtime === null) return null;

  const startedLabel = toClockLabel(downtime.startedAt) ?? downtime.startedAt;
  const minutes = elapsedMinutes(downtime.startedAt, now);
  /* 시작 시각을 읽을 수 없으면 경과도 말하지 않는다 — 0분이라고 하면 방금 선 것으로 읽힌다. */
  const elapsedLabel = minutes === null ? null : toDurationLabel(minutes);
  /*
   * ⛔ **코드를 이름으로 바꾸는 표를 화면이 갖지 않는다.** 이름은 서버가 준다(계약 `reasonName`)
   * — 고객이 사유를 늘리는 목록이라(`G-31`) 화면이 표를 들면 늘어난 값만 이름이 없다.
   * 서버가 이름을 비웠으면 코드를 그대로 보인다: 지어내지 않는다.
   */
  const name = downtime.reasonName ?? downtime.reasonCode;

  return (
    <section className="dt-ongo" aria-label={t.ongoing.title}>
      <b className="dt-ongo-t">{t.ongoing.title}</b>
      <PuChip tone="info">{t.today.ongoingRow}</PuChip>
      <div className="dt-ongo-line">
        <b>
          {elapsedLabel === null ? startedLabel : t.ongoing.elapsed(startedLabel, elapsedLabel)}
        </b>
        <span>{t.ongoing.reason(name)}</span>
      </div>
      {/*
        ⭐ 「종료하는 중」이라는 대기 상태를 두지 않는다 — 큐에 담는 것이 곧 성공이라
        기다릴 것이 없다. 아직 서버에 닿지 않은 사실은 맨 위 줄의 미전송 건수가 말한다.
      */}
      <PuButton size="sm" disabled={!canClose} onClick={onClose}>
        {t.ongoing.close}
      </PuButton>
    </section>
  );
};
