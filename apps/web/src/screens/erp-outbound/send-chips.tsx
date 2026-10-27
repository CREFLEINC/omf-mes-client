import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { MESSAGE_STATUS } from './outbound-items';
import { useOutboundCounts } from './queries';

const t = messages.erpOutbound;

/** ERP 송신 탭의 주소 — 다른 탭의 칩이 이리로 온다. */
export const ERP_OUTBOUND_PATH = '/master-data/erp-outbound';

/**
 * 탭 막대 오른쪽의 **송신 상태 칩** — 「송신 대기 N · 송신 실패 N」(입고 관리의 단계 칩 자리와 같다). 송신 항목 전체의
 * 합이다. 실패가 있으면 붉게, 대기가 있으면 파랗게 칠한다.
 *
 * `linkToTab` 이면 칩 묶음이 ERP 송신 탭으로 가는 링크다(연동 현황·이력). 건수를 아직 받지 못했거나 권한이 없으면
 * 칩을 세우지 않는다 — 0 으로 보이면 보낼 것이 없는 줄 안다.
 */
export const ErpSendChips = ({ linkToTab = false }: { linkToTab?: boolean }) => {
  const target = useHubActionsTarget();
  /* 꽂을 자리가 없으면 세지도 않는다 — 보이지 않을 건수를 부르지 않는다. */
  const counts = useOutboundCounts(target !== null);
  const pending = counts.total(MESSAGE_STATUS.pending);
  const failed = counts.total(MESSAGE_STATUS.failed);

  if (target === null || pending === undefined || failed === undefined) return null;

  const chips = (
    <>
      <Chip variant="status" size="sm" status={pending > 0 ? 'info' : 'idle'}>
        {t.chips.pending(pending)}
      </Chip>
      <Chip variant="status" size="sm" status={failed > 0 ? 'error' : 'idle'}>
        {t.chips.failed(failed)}
      </Chip>
    </>
  );

  return (
    <HubActions target={target}>
      {linkToTab ? (
        <Link to={ERP_OUTBOUND_PATH} className="erp-send-chips" aria-label={t.chips.label}>
          {chips}
        </Link>
      ) : (
        <div className="erp-send-chips" role="group" aria-label={t.chips.label}>
          {chips}
        </div>
      )}
    </HubActions>
  );
};
