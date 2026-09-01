import { AppShell, Chip, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useOnlineStatus } from '../patterns/online-status';
import { ScreenTitleProvider, useCurrentScreenTitle } from '../patterns/screen-title';
import { useWorkerSession } from '../patterns/worker-session';

interface AppLayoutProps {
  children: ReactNode;
}

const t = messages.common.connection;

const ShellTopbar = () => {
  const online = useOnlineStatus();
  const title = useCurrentScreenTitle();
  // 귀속 정보는 상시 표시다 - 누구로 기록되는지 안 보이면 남의 사번으로 쌓인다(D-5).
  const { worker } = useWorkerSession();

  return (
    <Topbar
      brand={
        title === null ? (
          <strong>OMF-MES 모바일</strong>
        ) : (
          <h1 className="mobile-shell__title">{title}</h1>
        )
      }
      actions={
        <>
          {worker === null ? null : <Chip>{`${worker.workerName} · ${worker.workerNo}`}</Chip>}
          <Chip status={online ? 'success' : 'warning'}>{online ? t.online : t.offline}</Chip>
        </>
      }
    />
  );
};

export const AppLayout = ({ children }: AppLayoutProps) => (
  <ScreenTitleProvider>
    <AppShell className="mobile-shell" mainLabel="본문" topbar={<ShellTopbar />}>
      {children}
    </AppShell>
  </ScreenTitleProvider>
);
