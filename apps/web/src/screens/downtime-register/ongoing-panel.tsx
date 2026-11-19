import { messages } from '@omf-mes/i18n';

import { PuButton, PuChip, PuNote } from '../../patterns/pop-uniform';

import { toClockLabel } from './formatting';
import type { DowntimeView } from './types';

const t = messages.downtimeRegister;

export interface OngoingPanelProps {
  downtime: DowntimeView | null;
  isPending: boolean;
  canClose: boolean;
  onClose: () => void;
}

/**
 * 진행 중 비가동 줄 — 「오늘 이 설비」 구획 위쪽(#295 시안).
 *
 * ⚠ **진행 중이 없으면 이 줄은 아예 서지 않는다**(스펙 §3 — 조건부). 서면 아래 목록의 한 쪽 건수가
 * 그만큼 저절로 줄어든다.
 *
 * 줄 모양: 「진행 중 비가동 [진행 중]」 / 「14:18부터 진행 중」 / 「사유: …」, 오른쪽 [비가동 종료](사용자 지시 2026-11-19).
 */
export const OngoingPanel = ({ downtime, isPending, canClose, onClose }: OngoingPanelProps) => {
  if (isPending) return <PuNote>{t.ongoing.loading}</PuNote>;

  if (downtime === null) return null;

  const startedLabel = toClockLabel(downtime.startedAt) ?? downtime.startedAt;
  /*
   * ⛔ **코드를 이름으로 바꾸는 표를 화면이 갖지 않는다.** 이름은 서버가 준다(계약 `reasonName`)
   * — 고객이 사유를 늘리는 목록이라(`G-31`) 화면이 표를 들면 늘어난 값만 이름이 없다.
   * 서버가 이름을 비웠으면 코드를 그대로 보인다: 지어내지 않는다.
   */
  const name = downtime.reasonName ?? downtime.reasonCode;

  return (
    <section className="dt-ongo" aria-label={t.ongoing.title}>
      <div className="dt-ongo-line">
        <span className="dt-ongo-head">
          <b className="dt-ongo-t">{t.ongoing.title}</b>
          <PuChip tone="info">{t.today.ongoingRow}</PuChip>
        </span>
        <b>{t.ongoing.since(startedLabel)}</b>
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
