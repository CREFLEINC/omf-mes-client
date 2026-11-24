import { TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { InfoLabel } from '../../patterns/info-tip';
import { REASON_MAX } from './submission';

const t = messages.expeditedShipment.reason;

export interface ReasonPaneProps {
  value: string;
  error: string | undefined;
  showError: boolean;
  onChange: (value: string) => void;
}

/**
 * ④ 긴급 사유 — **필수다**(§5-5 · 공유계약 A-12). `expedited`가 참인데 사유가 없으면 서버가
 * 400으로 막는다.
 *
 * 담을 «코드» 컬럼이 없어 자유 텍스트로 받는다(A-11). 사유별 집계가 안 된다는 사정은 사용자가 할
 * 일이 아니라 적지 않고, 무엇을 남길지만 라벨 옆 ⓘ 로 둔다(관리웹 정리 시안 A). DS `TextArea` 라벨은
 * 글자만 받아 라벨을 비우고 같은 `id` 로 `InfoLabel` 에 잇는다.
 *
 * ⭐ 오류는 디자인 시스템 `TextArea`에 맡긴다 — 접근성 배선이 컴포넌트 안에 있다. `maxLength`는
 * **무른 상한**이라 붙여넣기를 자르지 않고, 실제로 막는 것은 `submission.ts`의 검증이다.
 */
export const ReasonPane = ({ value, error, showError, onChange }: ReasonPaneProps) => {
  const reasonId = useId();

  return (
    <section className="pane" aria-label={messages.expeditedShipment.panes.reason}>
      <h2>{messages.expeditedShipment.panes.reason}</h2>
      <InfoLabel htmlFor={reasonId} label={t.label} info={t.help} required />
      <TextArea
        id={reasonId}
        value={value}
        required
        fullWidth
        rows={3}
        maxLength={REASON_MAX}
        error={showError ? error : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
};
