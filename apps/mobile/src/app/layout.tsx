import { AppShell, Chip, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useOnlineStatus } from '../patterns/online-status';
import { ScreenTitleProvider, useCurrentScreenTitle } from '../patterns/screen-title';

interface AppLayoutProps {
  children: ReactNode;
}

const t = messages.common.connection;

const ShellTopbar = () => {
  const online = useOnlineStatus();
  const title = useCurrentScreenTitle();

  return (
    <Topbar
      brand={
        title === null ? (
          <strong>OMF-MES 모바일</strong>
        ) : (
          <h1 className="mobile-shell__title">{title}</h1>
        )
      }
      actions={<Chip status={online ? 'success' : 'warning'}>{online ? t.online : t.offline}</Chip>}
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
