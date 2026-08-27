import { AppShell, Chip, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useOnlineStatus } from '../patterns/online-status';

interface AppLayoutProps {
  children: ReactNode;
}

const t = messages.common.connection;

export const AppLayout = ({ children }: AppLayoutProps) => {
  const online = useOnlineStatus();

  return (
    <AppShell
      className="mobile-shell"
      mainLabel="본문"
      topbar={
        <Topbar
          brand={<strong>OMF-MES 모바일</strong>}
          actions={
            <Chip status={online ? 'success' : 'warning'}>{online ? t.online : t.offline}</Chip>
          }
        />
      }
    >
      {children}
    </AppShell>
  );
};
