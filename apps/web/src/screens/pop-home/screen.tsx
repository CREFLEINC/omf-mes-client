import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';
import { useNavigate } from 'react-router';

import { useAccessiblePopScreens } from '../../patterns/pop-access';
import { PopScreenTiles, usePopRecent } from '../../patterns/pop-console';
import { usePopIdentity } from '../../patterns/pop-identity';
import { popScreenAt } from '../../patterns/pop-screen-catalog';
import { destinationOf } from '../../patterns/pop-screen-nav';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { useWorkerSession } from '../../patterns/worker-session';

const t = messages.popChrome.console;

/** 최근 화면 단추의 이름 — 작업지시를 달고 있으면 함께 적는다. */
const recentLabel = (location: string): string | null => {
  const [path = '', query = ''] = location.split('?');
  const screen = popScreenAt(path);

  if (screen === null) return null;

  const raw = new URLSearchParams(query).get('workOrderId');
  const workOrderId = raw !== null && /^\d+$/u.test(raw) ? Number(raw) : null;

  return workOrderId === null ? screen.name : t.home.recentWithWorkOrder(screen.name, workOrderId);
};

/**
 * POP **홈** — 사번을 확인한 뒤 서는 자리이자, 어느 화면에서든 [홈]이 데려가는 자리.
 *
 * ⭐ **부서마다 다른 홈이 된다.** 생산·구매/자재·품질 단말은 쓰는 화면이 서로 다르다. 홈은 이
 *    단말에 허용된 화면(`pop-access`)만 업무 영역별로 보이므로, 품질 단말에는 품질 화면이, 창고
 *    단말에는 자재 화면이 선다 — 화면을 따로 만들지 않고 같은 판정이 부서별 홈을 만든다.
 *
 * ⭐ **「최근 화면」으로 하던 일에 되돌아간다.** 검사하다 자재 불량을 등록하러 갔다 와도, 지나온
 *    화면이 작업지시째 남아 있어 한 번에 돌아간다(`nav-trail`).
 *
 * ⛔ **권한으로 막지 않는다.** 화면 코드가 없는 셸의 자리다 — 홈이 막히면 돌아갈 곳이 사라진다.
 *    판정하지 못했을 때는 감추지 않고 사유를 적는다(G-2). 상태바의 [사용자 전환]은 그대로 선다.
 */
export const PopHomeScreen = () => {
  const titleId = useId();
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerNo = identity.workerNo ?? workerSession?.worker.workerNo ?? null;
  const recent = usePopRecent().flatMap((location) => {
    const label = recentLabel(location);

    return label === null ? [] : [{ location, label }];
  });

  const reason =
    access.state === 'loading'
      ? t.menu.loading
      : access.state === 'unknown'
        ? t.menu.unknown
        : access.state === 'empty'
          ? t.menu.empty
          : null;

  return (
    <main className="pop-shell pop-ui pop-home" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.home.title}
        </h1>
      </header>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={workerNo} />

      {recent.length > 0 && (
        <section className="pop-home-recent" aria-label={t.home.recent}>
          <h2>{t.home.recent}</h2>
          <div className="pop-home-recent__list">
            {recent.map(({ location, label }) => (
              <Button
                key={location}
                variant="tonal"
                onClick={() => {
                  void navigate(location);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="pop-home-screens" aria-label={t.home.screens}>
        {reason !== null ? (
          <div className="banner-slot">
            <AlertBanner variant={access.state === 'loading' ? 'info' : 'warning'}>
              {reason}
            </AlertBanner>
          </div>
        ) : (
          <PopScreenTiles
            screens={access.screens}
            pathname=""
            onPick={(screen) => {
              void navigate(destinationOf(screen, ''));
            }}
          />
        )}
      </section>
    </main>
  );
};
