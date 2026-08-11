import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

const t = messages.stocktaking;

/**
 * 실물 수량 수정 이력 — **자리만 두고 비활성으로 시작한다**(착수 이슈 §4 · `omf-mes#68`).
 *
 * 범용 이력 테이블의 사용 규약이 없어 무엇을 어떻게 보일지 정해지지 않았다. 세 갈래를 견줬다.
 *
 * | 안 | 왜 아닌가 |
 * | --- | --- |
 * | 구획을 만들지 않는다 | 「이력이 없다」로 읽힌다 — 있는데 못 보는 것과 다른 사실이다 |
 * | 활성으로 두고 나중에 붙인다 | 눌러도 아무 일이 없다. 화면이 고장으로 읽힌다 |
 * | **자리 + 비활성 + 사유** | 지금 사실을 그대로 옮긴다 — 자리가 있고, 아직 못 보고, 왜 못 보는지 |
 *
 * **어떤 요청도 보내지 않는다**(완료 조건 C49). 조회를 붙여 두면 아무도 읽지 않는 응답이
 * 오가고, 그 경로가 나중에 「이미 되는 것」으로 읽힌다.
 *
 * **비활성 표현에 `Chip`을 쓰지 않는다**(계획 §5.2). 설치본의 `StatusChipProps`에 `disabled`가
 * 없어(실측) 비활성이 표현되지 않는다 — 걸릴 자리를 만들지 않는 것으로 피한다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const HistoryPane = () => {
  /* 잠긴 컨트롤은 포커스를 받지 못한다 — 사유를 이어 두어야 읽힌다(배치 규범 4). */
  const reasonId = `${useId()}-history-reason`;

  return (
    <div role="group" aria-label={t.history.label} className="field-cell">
      <Button variant="outlined" size="sm" disabled aria-describedby={reasonId}>
        {t.history.action}
      </Button>
      <span id={reasonId} className="field-note">
        {t.actionReasons.historyPending}
      </span>
    </div>
  );
};
