import { PageHeader } from '@crefle/web-ui';
import type { ComponentProps } from 'react';

import { HubActions, useHubActionsTarget } from './hub-actions';
import { usePageHub } from './page-hub';

/**
 * 화면 머리 — 탭 묶음 안이면 **그리지 않는다.** `PageHeader` 를 그대로 바꿔 끼우는 자리다.
 *
 * 탭 막대가 이미 화면 이름을 말하는데 그 아래에 탐색 경로와 큰 제목이 또 서면, 같은 위치를 세 번 말하는 머리가
 * 표 위를 두세 줄 차지한다(관리웹 화면 정리 시안 A · 2026-11-20). 재고 현황 등이 화면마다 손으로 하던 갈래
 * (`usePageHub` · 사용자 지시 2026-11-18)를 한 곳에 모았다.
 *
 * - 묶음 안: 머리를 세우지 않고, 머리의 단추(`actions`)만 탭 막대 오른쪽 일 단추 자리로 보낸다. 그 자리가 아직
 *   없으면(첫 그리기) 화면 맨 위에 그대로 둔다.
 * - 묶음 밖(탭 막대가 없는 계정 · 화면만 그린 시험): 지금처럼 경로와 제목을 세운다.
 */
export const ScreenHeader = (props: ComponentProps<typeof PageHeader>) => {
  const hub = usePageHub();
  const hubActionsTarget = useHubActionsTarget();

  if (hub === null) return <PageHeader {...props} />;
  if (props.actions === undefined || props.actions === null) return null;

  return hubActionsTarget === null ? (
    <div className="filter-actions">{props.actions}</div>
  ) : (
    <HubActions target={hubActionsTarget}>{props.actions}</HubActions>
  );
};
