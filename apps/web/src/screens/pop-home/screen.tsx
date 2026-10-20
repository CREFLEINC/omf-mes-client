import { AlertBanner, Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';
import { useNavigate } from 'react-router';

import { useAccessiblePopScreens } from '../../patterns/pop-access';
import {
  boardOf,
  FLOW_ENTRY_PATH,
  PopAreaCard,
  PopAreaGroups,
  PopScreenTile,
  usePopRecent,
  usePopShellActions,
  usePopTerminalFacts,
} from '../../patterns/pop-console';
import { usePopIdentity } from '../../patterns/pop-identity';
import { popAreaPath, popScreenAt, type PopScreen } from '../../patterns/pop-screen-catalog';
import { destinationOf } from '../../patterns/pop-screen-nav';
import { useWorkerSession } from '../../patterns/worker-session';

const t = messages.popChrome.console;

/** 이어서 하기 한 줄 — 화면과, 주소가 작업지시를 달고 있으면 그 번호. */
const recentEntryOf = (
  location: string,
): { location: string; screen: PopScreen; label: string } | null => {
  const [path = '', query = ''] = location.split('?');
  const screen = popScreenAt(path);

  if (screen === null) return null;

  const raw = new URLSearchParams(query).get('workOrderId');
  const workOrderId = raw !== null && /^\d+$/u.test(raw) ? Number(raw) : null;

  return {
    location,
    screen,
    label:
      workOrderId === null ? screen.name : t.home.recentWithWorkOrder(screen.name, workOrderId),
  };
};

/**
 * POP **홈** — 단말을 켜면 서는 첫 화면이자, 부서 레일의 [홈]이 데려가는 자리(1920 기준으로 직접 그린다).
 *
 * ```
 * ┌ ▶ 작업 시작 ─────────────────────────────── (→) ┐ ┌ 작업자 ──────────────┐
 * └─────────────────────────────────────────────────┘ │ 사번 901463 [변경]    │
 * 업무 영역                                            ├ 이 단말 ─────────────┤
 * ┌ 생산 ┐ ┌ 구매·자재 ┐ ┌ 품질 ┐ ┌ 출하 ┐ ┌ 설비 ┐        │ 단말 코드 · 설비 · 공정 │
 * └──────┘ └──────────┘ └──────┘ └──────┘ └──────┘        └──────────────────────┘
 * 이어서 하기
 * [▸ 자재 투입 · W/O #92] [▸ PQC 제품 검사] …
 * ```
 *
 * ⭐ **홈에는 화면이 아니라 부서가 선다**(현장 지적 2026-10-20 — 「초기 메뉴가 너무 많다」). 부서 카드를
 *    누르면 그 부서의 업무 묶음과 화면 타일이 선다(`screens/pop-area`). 부서가 하나뿐인 단말은 카드를
 *    거치지 않고 그 부서의 타일을 바로 보인다.
 *
 * ⭐ **생산 흐름의 입구는 맨 위에 크게.** 현장 단말 대다수가 생산이고, 그 단말에서 가장 자주 하는 일이
 *    작업 시작이다 — 이 단말에 허용돼 있을 때만 선다.
 *
 * ⭐ **첫 화면이 사번 입력이 아니다.** 단말 토큰이 이미 인증을 마쳤으므로 조회 화면까지 사번으로 막을
 *    까닭이 없다 — 기록하는 화면만 사번이 없으면 쓰기를 잠근다. 오른쪽 작업자 카드가 그 길을 연다.
 *
 * ⛔ **권한으로 막지 않는다.** 화면 코드가 없는 셸의 자리다 — 홈이 막히면 돌아갈 곳이 사라진다.
 *    판정하지 못했을 때는 감추지 않고 사유를 적는다(G-2).
 */
export const PopHomeScreen = () => {
  const titleId = useId();
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const { openWorkerSignIn } = usePopShellActions();
  const workerNo = identity.workerNo ?? workerSession?.worker.workerNo ?? null;

  const boards = boardOf(access.screens);
  const soleBoard = boards.length === 1 ? boards[0] : undefined;
  const flowEntry = access.screens.find((screen) => screen.path === FLOW_ENTRY_PATH);
  const terminalFacts = usePopTerminalFacts();
  const recent = usePopRecent(4).flatMap((location) => {
    const entry = recentEntryOf(location);

    return entry === null ? [] : [entry];
  });

  const reason =
    access.state === 'loading'
      ? t.access.loading
      : access.state === 'unknown'
        ? t.access.unknown
        : access.state === 'empty'
          ? t.access.empty
          : null;

  const open = (screen: PopScreen): void => {
    void navigate(destinationOf(screen, ''));
  };

  return (
    <main className="pop-shell pop-ui pop-home" aria-labelledby={titleId}>
      {/* 상단 바가 「홈」을 이미 말한다 — 표제는 화면 읽기 프로그램에만 남긴다. */}
      <h1 id={titleId} className="pop-home__title">
        {t.home.title}
      </h1>

      <div className="pop-home__layout">
        <div className="pop-home__main">
          {reason !== null ? (
            <div className="banner-slot">
              <AlertBanner variant={access.state === 'loading' ? 'info' : 'warning'}>
                {reason}
              </AlertBanner>
            </div>
          ) : soleBoard !== undefined ? (
            <PopAreaGroups board={soleBoard} onPick={open} />
          ) : (
            <>
              {flowEntry !== undefined && (
                <div className="pop-home__lead">
                  <PopScreenTile screen={flowEntry} lead onPick={open} />
                </div>
              )}
              <section className="pop-home__areas" aria-labelledby={`${titleId}-areas`}>
                <h2 id={`${titleId}-areas`} className="pop-home__heading">
                  {t.home.areas}
                </h2>
                <div className="pop-home__area-cards">
                  {boards.map((board) => (
                    <PopAreaCard
                      key={board.area}
                      board={board}
                      onOpen={(area) => {
                        void navigate(popAreaPath(area));
                      }}
                    />
                  ))}
                </div>
              </section>
            </>
          )}

          <section className="pop-home__recent" aria-labelledby={`${titleId}-recent`}>
            <h2 id={`${titleId}-recent`} className="pop-home__heading">
              {t.home.recent}
            </h2>
            {recent.length === 0 ? (
              <p className="pop-home__recent-empty">{t.home.recentEmpty}</p>
            ) : (
              <ul className="pop-home__recent-list">
                {recent.map(({ location, screen, label }) => (
                  <li key={location}>
                    <button
                      type="button"
                      onClick={() => {
                        void navigate(location);
                      }}
                    >
                      <Icon name={screen.icon} size={32} />
                      <span className="pop-home-recent__label">{label}</span>
                      <Icon name="chevron_right" size={28} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="pop-home__side">
          {workerNo === null ? (
            <section
              className="pop-home-card pop-home-worker"
              data-missing="true"
              aria-label={t.home.signInTitle}
            >
              <Icon className="pop-home-worker__icon" name="badge" size={40} />
              <h2>{t.home.signInTitle}</h2>
              <p>{t.home.signInBody}</p>
              {openWorkerSignIn !== null && (
                <Button size="lg" onClick={openWorkerSignIn}>
                  {t.statusBar.signIn}
                </Button>
              )}
            </section>
          ) : (
            <section className="pop-home-card pop-home-worker" aria-label={t.home.worker}>
              <Icon className="pop-home-worker__icon" name="person" size={40} />
              <h2>{t.home.worker}</h2>
              <p className="pop-home-worker__no">{t.statusBar.worker(workerNo)}</p>
              <p>{t.home.workerNote}</p>
              {openWorkerSignIn !== null && (
                <Button variant="outlined" size="lg" onClick={openWorkerSignIn}>
                  {t.home.workerChange}
                </Button>
              )}
            </section>
          )}

          <section
            className="pop-home-card pop-home-terminal"
            aria-labelledby={`${titleId}-terminal`}
          >
            <h2 id={`${titleId}-terminal`}>{t.home.terminal}</h2>
            <dl>
              {terminalFacts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
};
