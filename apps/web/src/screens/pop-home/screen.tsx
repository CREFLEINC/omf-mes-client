import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';
import { useNavigate } from 'react-router';

import { useAccessiblePopScreens } from '../../patterns/pop-access';
import { PopTaskBoard, usePopRecent, usePopShellActions } from '../../patterns/pop-console';
import { usePopIdentity } from '../../patterns/pop-identity';
import { popScreenAt } from '../../patterns/pop-screen-catalog';
import { destinationOf } from '../../patterns/pop-screen-nav';
import { useWorkerSession } from '../../patterns/worker-session';

const t = messages.popChrome.console;

/** 이어서 하기 단추의 이름 — 작업지시를 달고 있으면 함께 적는다. */
const recentLabel = (location: string): string | null => {
  const [path = '', query = ''] = location.split('?');
  const screen = popScreenAt(path);

  if (screen === null) return null;

  const raw = new URLSearchParams(query).get('workOrderId');
  const workOrderId = raw !== null && /^\d+$/u.test(raw) ? Number(raw) : null;

  return workOrderId === null ? screen.name : t.home.recentWithWorkOrder(screen.name, workOrderId);
};

/**
 * POP **홈** — 단말을 켜면 서는 첫 화면이자, 어느 화면에서든 [홈]이 데려가는 자리.
 *
 * ```
 * [작업자를 확인하세요 ............................ (작업자 확인)]   ← 사번이 없을 때만
 * 이어서 하기  (자재 투입 · W/O #92) (PQC 제품 검사)              ← 지나온 화면이 있을 때만
 * [ 생산 | 품질 | … ]                                              ← 부서가 둘 이상일 때만
 * ┌ 작업 진행 ─────┐ ┌ 포장 ─────────┐ ┌ 중단·교체 ────┐
 * │ (작업 시작)    │ │ 생산 포장      │ │ 작업 중단      │
 * │  긴급 W/O      │ │ 포장 라벨 재출력│ │ 러닝체인지 …   │
 * └───────────────┘ └───────────────┘ └───────────────┘
 * ```
 *
 * ⭐ **첫 화면이 사번 입력이 아니다**(현장 지적 2026-10-20). 상용 MES 단말은 켜면 작업장 홈이
 *    서고, 누구로 기록할지는 필요할 때 정한다. 단말 토큰이 이미 인증을 마쳤으므로 조회 화면까지
 *    사번으로 막을 까닭이 없다 — 기록하는 화면만 사번이 없으면 쓰기를 잠근다.
 *
 * ⭐ **부서마다 다른 홈이 된다.** 이 단말에 허용된 화면(`pop-access`)만 부서 → 업무 묶음으로
 *    접어 보이므로, 품질 단말에는 품질 카드가, 창고 단말에는 자재 카드가 선다.
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
      {/* 상태바가 「홈」을 이미 말한다 — 표제는 본문의 이름으로만 둔다. */}
      <h1 id={titleId} className="pop-home__title">
        {t.home.title}
      </h1>

      {workerNo === null && (
        /* `pop-fixed` — 내용만큼만 선다. 남는 높이는 아래 업무 카드가 가져간다. */
        <section className="pop-home-sign-in pop-fixed" aria-label={t.home.signInTitle}>
          <div>
            <h2>{t.home.signInTitle}</h2>
            <p>{t.home.signInBody}</p>
          </div>
          {openWorkerSignIn !== null && (
            <Button size="lg" onClick={openWorkerSignIn}>
              {t.statusBar.signIn}
            </Button>
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section className="pop-home-recent pop-fixed" aria-label={t.home.recent}>
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
          <PopTaskBoard
            screens={access.screens}
            pathname=""
            isHome
            onPick={(screen) => {
              void navigate(destinationOf(screen, ''));
            }}
          />
        )}
      </section>
    </main>
  );
};
