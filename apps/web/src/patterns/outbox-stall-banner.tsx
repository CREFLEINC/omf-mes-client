import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

/**
 * 오프라인 큐가 **자동 재전송을 멈췄다는 말** — 공유계약 C-1.
 *
 * ⭐ **미전송 건수만으로는 부족하다.** 건수는 「밀리는 중」과 「멈춤」을 같은 모양으로 보여 준다.
 * 담는 순간을 성공으로 본 작업자는 그 차이를 알 방법이 없고, 담긴 것은 아무도 모르게 남는다.
 *
 * ⛔ **「사라졌다」로 읽히게 쓰지 않는다.** 항목은 큐에 그대로 있고 보내기만 멈춘 것이다 —
 * 본문이 그 사실을 먼저 말한다.
 *
 * 네 화면(`P-02-03`·`P-02-04`·`P-02-13`·`P-05-02`)이 같은 것을 쓴다. 문구가 화면마다 갈리면
 * 같은 장애에서 작업자가 다른 말을 듣는다.
 */
export const OutboxStallBanner = ({ onRetry }: { onRetry: () => void }) => (
  <div className="banner-slot">
    <AlertBanner variant="error" title={messages.common.connection.stalledTitle}>
      <p>{messages.common.connection.stalledBody}</p>
      {/* POP 터치 등급 — 장갑 낀 손이 누른다. */}
      <Button variant="outlined" size="2xl" onClick={onRetry}>
        {messages.common.connection.stalledRetry}
      </Button>
    </AlertBanner>
  </div>
);
