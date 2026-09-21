import { AppShell, Chip, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';

import { listenBackButton } from '../patterns/back-step';
import { keepListboxesInSafeArea } from '../patterns/listbox-safe-area';
import { useServerReachable } from '../patterns/online-status';
import {
  ScreenTitleProvider,
  useCompactTopbar,
  useCurrentScreenTitle,
} from '../patterns/screen-title';
import { useOutbox } from '../patterns/outbox';
import { useWorkerSession } from '../patterns/worker-session';

interface AppLayoutProps {
  children: ReactNode;
}

const t = messages.common.connection;
const shell = messages.common.shell;

const ShellTopbar = () => {
  const online = useServerReachable();
  const title = useCurrentScreenTitle();
  const compact = useCompactTopbar();
  // 귀속 정보는 상시 표시다 - 누구로 기록되는지 안 보이면 남의 사번으로 쌓인다(D-5).
  const { worker } = useWorkerSession();
  /*
   * 담긴 순간 성공으로 보이는 것이 이 앱의 저장 방식이라, 아직 서버에 닿지 않은 건수를
   * 보이지 않으면 도달하지 못한 사실을 알 방법이 사라진다. 0 이면 감춘다.
   */
  const { pending, rejected } = useOutbox();

  return (
    <Topbar
      className={
        compact ? 'mobile-shell__topbar mobile-shell__topbar--compact' : 'mobile-shell__topbar'
      }
      brand={
        /*
         * ⭐ 연결·전송 상태는 제목과 «같은 줄»에 둔다(사용자 지시 2026-09-21). 화면 이름과 지금
         * 보낼 수 있는지는 함께 읽는 값이고, 사번은 「누구로 기록되는가」라 성격이 다르다.
         */
        <div className="mobile-shell__titlebar">
          {title === null ? (
            <strong>{shell.brand}</strong>
          ) : (
            <h1 className="mobile-shell__title">{title}</h1>
          )}
          <span className="mobile-shell__status">
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
          </span>
        </div>
      }
      actions={
        /*
         * ⭐ 사번은 «아래 줄»에 혼자 선다(사용자 지시 2026-09-21).
         *
         * ⭐ 사번 확인 화면은 사번 칩을 싣지 않는다 - 확인한 사번은 본문의 확인 박스가 보여
         * 준다(사용자 지시 2026-09-14). 그 화면을 떠나면 다시 싣는다.
         */
        worker === null || compact ? null : (
          <Chip>{`${worker.workerName} · ${worker.workerNo}`}</Chip>
        )
      }
    />
  );
};

export const AppLayout = ({ children }: AppLayoutProps) => {
  /* 단말의 뒤로가기를 화면 안 단계가 먼저 받는다. 없으면 이력으로 넘어간다. */
  useEffect(() => listenBackButton(), []);
  /* 드롭다운 목록은 셸 밖에 그려져 시스템 바 여백을 못 받는다. 바 안쪽으로 다시 놓는다. */
  useEffect(() => keepListboxesInSafeArea(), []);

  return (
    <ScreenTitleProvider>
      <AppShell
        className="mobile-shell"
        mainLabel={shell.main}
        skipLinkLabel={shell.skipToMain}
        topbar={<ShellTopbar />}
      >
        {children}
      </AppShell>
    </ScreenTitleProvider>
  );
};
