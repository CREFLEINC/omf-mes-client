import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useOaAccess } from './oa-access';

export interface OaOnlyGateProps {
  title: string;
  breadcrumbRoot: string;
  children: ReactNode;
}

/**
 * OA 공장 전용 화면의 덮개(omf-all-around#89 · 담당자 결정 2026-10-21). 계정 범위에 OA 공장이 없다고 확인되면 안내만
 * 보이고 화면을 그리지 않는다 — 화면의 조회가 나가지 않는다. 판단 중에는 기다리고, 판단할 근거를 못 받으면 화면을 그려
 * 서버의 403 에 맡긴다.
 */
export const OaOnlyGate = ({ title, breadcrumbRoot, children }: OaOnlyGateProps) => {
  const access = useOaAccess();
  if (access === 'oa' || access === 'unknown') return <>{children}</>;
  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: breadcrumbRoot }, { label: title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      {access === 'checking' ? (
        <p className="field-note">{messages.common.oaOnly.checking}</p>
      ) : (
        <AlertBanner variant="info">{messages.common.oaOnly.notice}</AlertBanner>
      )}
    </>
  );
};
