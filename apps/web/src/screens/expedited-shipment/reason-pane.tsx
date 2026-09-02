import { TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
 * ⚠ **물러난 수준을 적는다**(A-11). 담을 «코드» 컬럼이 없어 자유 텍스트로 받는데, 이 기능이
 * 있는 이유가 「긴급 출하가 몇 건인가」를 보는 것이므로 **집계가 안 된다는 사실**이 사용자에게도
 * 사실이다. 조용히 자유 텍스트로 두면 나중에 「왜 사유별로 못 보나」가 된다.
 *
 * ⭐ 라벨·도움말·오류를 손으로 두르지 않고 디자인 시스템 `TextArea`에 맡긴다 — 접근성 배선이
 * 컴포넌트 안에 있다(`quality-approval`과 같은 형태). `maxLength`는 **무른 상한**이라 붙여넣기를
 * 자르지 않고, 실제로 막는 것은 `submission.ts`의 검증이다.
 */
export const ReasonPane = ({ value, error, showError, onChange }: ReasonPaneProps) => (
  <section className="pane" aria-label={messages.expeditedShipment.panes.reason}>
    <h2>{messages.expeditedShipment.panes.reason}</h2>
    <TextArea
      label={t.label}
      value={value}
      required
      fullWidth
      rows={3}
      maxLength={REASON_MAX}
      error={showError ? error : undefined}
      helperText={`${t.help} ${t.withdrawn}`}
      onChange={(event) => onChange(event.target.value)}
    />
  </section>
);
