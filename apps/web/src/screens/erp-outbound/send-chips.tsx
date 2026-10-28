import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { useQueryClient } from '@tanstack/react-query';
import { sessionKeys, type Session } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { MESSAGE_STATUS } from './outbound-items';
import { useOutboundCounts, useSendEnabled } from './queries';

const t = messages.erpOutbound;

/** ERP 송신 탭의 주소 — 다른 탭의 칩이 이리로 온다. */
export const ERP_OUTBOUND_PATH = '/master-data/erp-outbound';

/**
 * 탭 막대 오른쪽의 **송신 상태 칩** — 「송신 대기 N · 송신 실패 N」(입고 관리의 단계 칩 자리와 같다). 송신 항목 전체의
 * 합이다. 실패가 있으면 붉게, 대기가 있으면 파랗게 칠한다.
 *
 * 맨 앞은 이 서버의 **송신 켜짐 · 꺼짐**(사용자 지시 2026-10-28) — 꺼져 있으면 대기가 쌓여도 보내지 않는다.
 *
 * `linkToTab` 이면 칩 묶음이 ERP 송신 탭으로 가는 링크다(연동 현황·이력). 건수를 아직 받지 못했거나 권한이 없으면
 * 건수 칩을 세우지 않는다 — 0 으로 보이면 보낼 것이 없는 줄 안다. 켜짐을 모르면(옛 서버) 켜짐 칩을 세우지 않는다.
 */
export const ErpSendChips = ({ linkToTab = false }: { linkToTab?: boolean }) => {
  const target = useHubActionsTarget();
  /*
   * ERP 송신 탭(W-06-12)을 볼 수 없는 사람에게는 링크로 세우지 않는다 — 누르면 막힌 탭으로 간다. 세션은 로그인 때
   * 조회 캐시에 들어 있다 — 여러 탭이 나눠 쓰는 칩이라 세션 공급자에 기대지 않고 캐시에서 읽는다(없으면 판정하지 않음).
   */
  const session = useQueryClient().getQueryData<Session | null>(sessionKeys.current);
  const canOpenTab = toWebAccess(session?.permissions).allows(ERP_OUTBOUND_PATH);
  /* 꽂을 자리가 없으면 세지도 않는다 — 보이지 않을 건수를 부르지 않는다. */
  const counts = useOutboundCounts(target !== null);
  const sendEnabled = useSendEnabled(target !== null);
  const pending = counts.total(MESSAGE_STATUS.pending);
  const failed = counts.total(MESSAGE_STATUS.failed);
  const hasCounts = pending !== undefined && failed !== undefined;

  if (target === null || (!hasCounts && sendEnabled === null)) return null;

  const chips = (
    <>
      {sendEnabled !== null && (
        <Chip variant="status" size="sm" status={sendEnabled ? 'success' : 'warning'}>
          {sendEnabled ? t.chips.sendOn : t.chips.sendOff}
        </Chip>
      )}
      {hasCounts && (
        <>
          <Chip variant="status" size="sm" status={pending > 0 ? 'info' : 'idle'}>
            {t.chips.pending(pending)}
          </Chip>
          <Chip variant="status" size="sm" status={failed > 0 ? 'error' : 'idle'}>
            {t.chips.failed(failed)}
          </Chip>
        </>
      )}
    </>
  );

  return (
    <HubActions target={target}>
      {linkToTab && canOpenTab ? (
        /* 접근 이름을 따로 주지 않는다 — 주면 칩 글자(켜짐 · 대기 N · 실패 N)를 덮어 건수가 읽히지 않는다. */
        <Link to={ERP_OUTBOUND_PATH} className="erp-send-chips">
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
