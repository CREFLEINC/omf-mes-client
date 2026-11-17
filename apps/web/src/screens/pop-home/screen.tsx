import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { GROUP_ICONS, usePopNavigation } from '../../patterns/pop-screen-nav';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { useWorkerSession } from '../../patterns/worker-session';

const t = messages.popChrome.home;

/**
 * 바로가기 타일(#291 확정 시안). 이 단말이 갈 수 없는 화면은 빼고 보인다.
 *
 * ⛔ 편집(작업자가 고르기)은 두지 않는다 — 고른 것을 둘 자리(서버·단말 저장)가 아직 없다.
 */
const SHORTCUT_PATHS = [
  '/pop/production-result',
  '/pop/work-start',
  '/pop/packing',
  '/pop/pqc-inspection',
  '/pop/work-hold',
  '/pop/material-input',
] as const;

/**
 * **홈**(#291) — 사번 확인 뒤 처음 서는 화면. 남은 작업과 바로가기를 보여 주고, 누르면 그 화면으로
 * 간다. 이동 길은 공통 메뉴와 같은 것을 쓴다(`usePopNavigation`) — 남은 작업 수도 같은 값이다.
 *
 * ⛔ 「오늘 작업 현황」(진행·대기·완료 수)은 두지 않는다 — 서버가 그 수를 주지 않는다(화면 작업에서
 *    서버를 고치지 않는다).
 */
export const PopHomeScreen = () => {
  const titleId = useId();
  const { workerNo } = usePopIdentity();
  const session = useWorkerSession();
  const { access, pending, total, go } = usePopNavigation();
  const workerName =
    session !== null && session.worker.workerNo === workerNo ? session.worker.workerName : null;
  const shortcuts = SHORTCUT_PATHS.map((path) =>
    access.screens.find((screen) => screen.path === path),
  ).filter((screen) => screen !== undefined);

  return (
    <main className="pop-ui pop-home" aria-labelledby={titleId}>
      <h1 id={titleId} className="pop-visually-hidden">
        {t.title}
      </h1>
      <PopWorkerMissingBanner workerNo={workerNo} />
      <section className="pop-home__hello">
        <h2>{t.greeting(workerName ?? workerNo ?? '')}</h2>
        <p>{t.sub}</p>
      </section>

      <section className="pane pop-pane pop-home__remaining" aria-labelledby={`${titleId}-rem`}>
        <h2 id={`${titleId}-rem`} className="pop-home__heading">
          {t.remainingTitle}
          {total > 0 && <span className="pop-home__total">{total}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="field-note">{t.remainingNone}</p>
        ) : (
          <div className="pop-home__remaining-list">
            {pending.map(({ screen, count }) => (
              <button
                key={screen.path}
                type="button"
                className="pop-home__remaining-item"
                aria-label={messages.popChrome.remaining.count(screen.name, count)}
                onClick={() => {
                  go(screen);
                }}
              >
                <span>{screen.name}</span>
                <strong>{t.remainingCount(count)}</strong>
              </button>
            ))}
          </div>
        )}
      </section>

      {shortcuts.length > 0 && (
        <section className="pane pop-pane pop-home__shortcuts" aria-labelledby={`${titleId}-sc`}>
          <div className="pop-home__shortcuts-head">
            <h2 id={`${titleId}-sc`} className="pop-home__heading">
              {t.shortcutsTitle}
            </h2>
            <p className="field-note">{t.shortcutsHint}</p>
          </div>
          <div className="pop-home__tiles">
            {shortcuts.map((screen) => (
              <button
                key={screen.path}
                type="button"
                className="pop-home__tile"
                onClick={() => {
                  go(screen);
                }}
              >
                {GROUP_ICONS[screen.group]}
                <span>{screen.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};
