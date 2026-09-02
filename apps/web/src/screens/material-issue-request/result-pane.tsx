import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CreatedRequestView } from './types';

const t = messages.materialIssueRequest;

export interface ResultPaneProps {
  /** 발행이 막힌 사유. `null`이면 열려 있다 */
  publishBlockReason: string | null;
  /** 저장 실패 배너. 인라인으로 소화하지 못한 오류만 남는다(`patterns/master`) */
  banner: ReactNode;
  /** 방금 발행한 요청. `null`이면 아직 성공하지 않았다 */
  created: CreatedRequestView | null;
  onPublish: () => void;
}

/**
 * 구획 ④ — 발행 액션과 결과.
 *
 * **되돌릴 수 없는 쓰기를 두 겹으로 막는다** — ① 전송 중 잠금 ② 성공 뒤 잠금. 확인 창은 두지
 * 않는다: 재고를 움직이지 않는 요청 발행이고, 두 겹의 잠금이 연타를 막는다.
 *
 * **성공 뒤에도 결과를 지우지 않는다.** 이 화면에는 발행한 요청으로 돌아가는 진입점이 없어,
 * 요청번호를 화면에 남겨 두는 것이 사용자가 그 값을 잃지 않는 유일한 방법이다.
 *
 * **상태는 서버가 준 글자 그대로** 보인다(공유계약 G-2) — 값 목록이 확정되기 전에 「접수」·「완료」
 * 로 옮겨 적으면 화면이 뜻을 지어내는 것이 된다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ResultPane = ({ publishBlockReason, banner, created, onPublish }: ResultPaneProps) => {
  const reasonId = useId();

  return (
    <section className="pane" aria-label={t.panes.result}>
      {created !== null && (
        <div className="banner-slot">
          <AlertBanner variant="success" title={t.result.title}>
            {t.result.issueRequestNo(created.issueRequestNo)} ·{' '}
            {t.result.statusCode(created.statusCode)} · {t.result.lineCount(created.lineCount)}
          </AlertBanner>
        </div>
      )}

      {banner}

      {/*
       * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다
       * (배치 규범 4) — 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 닿을 수 없다.
       */}
      <div className="form-actions">
        <div className="field-cell">
          <Button
            disabled={publishBlockReason !== null}
            aria-describedby={publishBlockReason === null ? undefined : reasonId}
            onClick={onPublish}
          >
            {t.actions.publish}
          </Button>
          {publishBlockReason !== null && (
            <span id={reasonId} className="field-note">
              {publishBlockReason}
            </span>
          )}
        </div>
      </div>
    </section>
  );
};
