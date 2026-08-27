import { AppShell, Topbar } from '@crefle/web-ui';
import type { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <AppShell
      className="mobile-shell"
      mainLabel="본문"
      topbar={<Topbar brand={<strong>OMF-MES 모바일</strong>} />}
    >
      {children}
    </AppShell>
  );
};
