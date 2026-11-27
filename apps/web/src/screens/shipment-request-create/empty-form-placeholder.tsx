import { EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.shipmentRequestCreate;

/**
 * 우측 폼이 아직 아무 대상도 겨누지 않았을 때의 자리 — 지시서를 아직 고르지 않았고 단독 생성도
 * 시작하지 않은 상태다. [ERP S/O 없이 생성]은 조회 조건 줄의 [조회] 오른쪽에 있다(#360).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const EmptyFormPlaceholder = () => (
  <EmptyState size="sm" title={t.empty.noTargetTitle} description={t.empty.noTargetDescription} />
);
