import { AppShell, Chip, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { useOnlineStatus } from '../patterns/online-status';
import { ScreenTitleProvider, useCurrentScreenTitle } from '../patterns/screen-title';
import { useOutbox } from '../patterns/outbox';
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
  /*
   * 담긴 순간 성공으로 보이는 것이 이 앱의 저장 방식이라, 아직 서버에 닿지 않은 건수를
   * 보이지 않으면 도달하지 못한 사실을 알 방법이 사라진다. 0 이면 감춘다.
   */
  const { pending, rejected } = useOutbox();

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
          {pending === 0 ? null : <Chip status="warning">{t.unsent(pending)}</Chip>}
          {/*
           * 되돌아온 건은 화면을 떠난 뒤에 생긴다. 셸이 이고 다니지 않으면 그것을 적은 사람은
           * 되돌아왔다는 사실 자체를 만날 자리가 없다.
           */}
          {rejected.length === 0 ? null : (
            <Link to="/rejections">
              <Chip status="error">{t.returned(rejected.length)}</Chip>
            </Link>
          )}
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
