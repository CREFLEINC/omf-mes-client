import { AppShell, Icon, IconButton, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { listenBackButton, runBackStep, useHasBackStep } from '../patterns/back-step';
import { keepListboxesInSafeArea } from '../patterns/listbox-safe-area';
import { useServerReachable } from '../patterns/online-status';
import { ScanFlashHost } from '../patterns/scan-feedback';
import { ScreenNoticeSlotProvider } from '../patterns/screen-notice';
import {
  ScreenTitleProvider,
  useCompactTopbar,
  useCurrentScreenTitle,
} from '../patterns/screen-title';
import { useOutbox } from '../patterns/outbox';
import { useWorkerSession } from '../patterns/worker-session';
import { useRecordScreenVisit } from './frequent-screens';
import { areaOfScreen, screenOf } from './home-menu';

interface AppLayoutProps {
  children: ReactNode;
}

const t = messages.common.connection;
const shell = messages.common.shell;

/** 작업 목록. 사번 확인(`/`) 다음에 서는 첫 화면이다. */
const HOME_PATH = '/screens';

const ShellTopbar = () => {
  const online = useServerReachable();
  const title = useCurrentScreenTitle();
  const compact = useCompactTopbar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  /*
   * 작업 화면에서 작업 목록으로 돌아가는 길. 전에는 단말의 뒤로가기 키뿐이라, 단계가 깊은 화면은
   * 그 키를 여러 번 눌러야 했다. 작업 목록 자신과 사번 확인(한 줄 앱바)에는 갈 곳이 없어 두지 않는다.
   */
  const showHome = !compact && pathname !== HOME_PATH && pathname !== '/';
  /*
   * 한 층 위로 돌아가는 길. 화면 안에 지나온 단계가 있으면 그 단계로 하나 돌아간다 - 단말의
   * 뒤로가기 키와 같은 일이지만, 키는 눈에 보이지 않아 수량 단계에서 라인을 다시 고르려는 사람이
   * 찾지 못했다(사용자 지시 2026-10-21). 되돌릴 단계가 없는 작업 화면에서는 그 작업이 걸린 업무의
   * 작업 목록으로 간다 - 홈 단추만 있으면 입하 등록에서 입고 목록으로 못 돌아가고 홈을 거쳐야
   * 했다(사용자 지적 2026-10-21).
   */
  const hasBackStep = useHasBackStep();
  const parentArea = areaOfScreen(pathname);
  const showBack = !compact && (hasBackStep || parentArea !== undefined);
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
      /*
       * 앱바는 어두운 계기판이다(사용자 결정 2026-10-21, 개편 제안 v2 ①). 지금 무엇을 처리 중인가
       * 와 입력 칸이 같은 밝은 평면에 놓이면 어디까지가 맥락이고 어디부터가 할 일인지 갈리지 않는다.
       * 디자인 시스템의 다크 토큰을 이 상자에만 건다 - 본문은 밝은 그대로다.
       */
      data-theme="dark"
      brand={
        /*
         * 첫 줄은 화면 이름과 지금 서버에 닿는가. 둘은 함께 읽는 값이다(사용자 지시 2026-09-21).
         */
        <div className="mobile-shell__titlebar">
          {showBack ? (
            <IconButton
              className="mobile-shell__back"
              icon="arrow_back"
              size="lg"
              aria-label={
                hasBackStep || parentArea === undefined
                  ? shell.back
                  : shell.backToArea(parentArea.label)
              }
              onClick={() => {
                if (runBackStep() || parentArea === undefined) {
                  return;
                }

                void navigate(`/screens/${parentArea.id}`);
              }}
            />
          ) : null}
          {showHome ? (
            <IconButton
              className="mobile-shell__home"
              icon="home"
              size="lg"
              aria-label={shell.home}
              onClick={() => {
                void navigate(HOME_PATH);
              }}
            />
          ) : null}
          {title === null ? (
            <strong>{shell.brand}</strong>
          ) : (
            <h1 className="mobile-shell__title">{title}</h1>
          )}
          {/* 글자만으로는 멀리서 안 읽힌다. 점의 색이 먼저, 글자가 확인이다. */}
          <span
            className={
              online ? 'mobile-shell__net' : 'mobile-shell__net mobile-shell__net--offline'
            }
          >
            <span className="mobile-shell__net-dot" aria-hidden="true" />
            {online ? t.online : t.offline}
          </span>
          {/* 한 줄 앱바에는 아래 줄이 없다. 보내지 못한 건수는 제목 줄 끝에 붙인다. */}
          {compact ? <QueueLinks pending={pending} rejected={rejected.length} /> : null}
        </div>
      }
      actions={
        /*
         * ⭐ 앱바는 두 줄이다(사용자 지시 2026-09-14 · 2026-09-21). 아래 줄은 「누구로, 무엇이
         * 아직 안 갔나」 - 사번과 보내지 못한 건수다(사용자 결정 2026-10-21, 개편 제안 v2 ③).
         * 둘 다 이 단말에 쌓이는 기록의 귀속과 도달이라 한 줄에서 함께 읽는다.
         *
         * ⭐ 사번 확인 화면은 사번을 싣지 않는다 - 확인한 사번은 본문이 보여 준다(사용자 지시
         * 2026-09-14). 그 화면을 떠나면 다시 싣는다.
         */
        compact || (worker === null && pending === 0 && rejected.length === 0) ? null : (
          <div className="mobile-shell__statusbar">
            {worker === null ? (
              <span />
            ) : (
              /*
               * 사번 칩을 누르면 사번 확인 화면으로 간다 - 교대 · 바꾸기 · 기기 등록 풀기가 거기 있다.
               * 전에는 그 화면으로 가는 길이 없었다(사용자 지적 2026-10-21).
               */
              <Link to="/" className="mobile-shell__worker" aria-label={shell.changeWorker}>
                <Icon name="person" size={16} />
                <b>{worker.workerName}</b>
                {` · ${worker.workerNo}`}
              </Link>
            )}
            <QueueLinks pending={pending} rejected={rejected.length} />
          </div>
        )
      }
    />
  );
};

/**
 * 보내지 못한 건수. 0 이면 감춘다.
 *
 * 건수만으로는 무엇이 묶여 있는지 모른다. 눌러서 목록과 「지금 보내기」로 간다. 되돌아온 건은
 * 화면을 떠난 뒤에 생긴다 - 셸이 이고 다니지 않으면 그것을 적은 사람은 되돌아왔다는 사실 자체를
 * 만날 자리가 없다.
 */
const QueueLinks = ({ pending, rejected }: { pending: number; rejected: number }) =>
  pending === 0 && rejected === 0 ? null : (
    <span className="mobile-shell__queue">
      {pending === 0 ? null : (
        <Link to="/outbox" className="mobile-shell__queue-link">
          <Icon name="cloud_upload" size={16} />
          <span>{t.unsent(pending)}</span>
        </Link>
      )}
      {rejected === 0 ? null : (
        <Link
          to="/rejections"
          className="mobile-shell__queue-link mobile-shell__queue-link--failed"
        >
          <Icon name="error" size={16} />
          <span>{t.returned(rejected)}</span>
        </Link>
      )}
    </span>
  );

export const AppLayout = ({ children }: AppLayoutProps) => {
  /* 단말의 뒤로가기를 화면 안 단계가 먼저 받는다. 없으면 이력으로 넘어간다. */
  useEffect(() => listenBackButton(), []);

  /* 작업 화면에 들어갈 때마다 센다. 홈의 「자주 쓰는 작업」이 이것으로 선다. */
  const { pathname } = useLocation();
  const recordVisit = useRecordScreenVisit();
  useEffect(() => {
    if (screenOf(pathname) !== undefined) {
      recordVisit(pathname);
    }
  }, [pathname, recordVisit]);
  /* 드롭다운 목록은 셸 밖에 그려져 시스템 바 여백을 못 받는다. 바 안쪽으로 다시 놓는다. */
  useEffect(() => keepListboxesInSafeArea(), []);
  /* 앱바 바로 아래 알림 자리. 화면이 띄운 알림(`ScreenNotice`)이 여기로 온다. */
  const [noticeSlot, setNoticeSlot] = useState<HTMLDivElement | null>(null);
  /*
   * 사번 없이 작업 화면에 들어오면 들어서자마자 알린다(사용자 지시 2026-10-21) - 화면마다 등록
   * 직전에 띄우던 것을 셸이 한 번에 한다. 사번 확인 화면으로 가는 단추를 함께 둔다.
   */
  const { worker } = useWorkerSession();
  const needsWorker = worker === null && screenOf(pathname) !== undefined;

  return (
    <ScreenTitleProvider>
      <AppShell
        className="mobile-shell"
        mainLabel={shell.main}
        skipLinkLabel={shell.skipToMain}
        topbar={<ShellTopbar />}
      >
        <div ref={setNoticeSlot} className="screen-notices">
          {needsWorker ? (
            /* 한 줄 알림 - 아이콘 · 말 · 사번 확인 단추. 본문을 밀어내지 않게 낮게 둔다. */
            <div className="shell-notice" role="alert">
              <Icon name="warning" size={20} />
              <span className="shell-notice__text">{shell.noWorker}</span>
              <Link to="/" className="screen-notice__action">
                {shell.signIn}
              </Link>
            </div>
          ) : null}
        </div>
        <ScreenNoticeSlotProvider value={noticeSlot}>{children}</ScreenNoticeSlotProvider>
      </AppShell>
      {/* 스캔·저장 결과를 화면 가장자리로 알린다. 화면들이 부르는 `signal` 이 여기로 온다. */}
      <ScanFlashHost />
    </ScreenTitleProvider>
  );
};
