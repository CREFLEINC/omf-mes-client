import { AlertBanner, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { useAccessiblePopScreens } from '../../patterns/pop-access';
import { boardOf, PopAreaGroups, screenCountOf } from '../../patterns/pop-console';
import {
  POP_AREA_ICONS,
  POP_AREAS,
  POP_HOME_PATH,
  type PopArea,
} from '../../patterns/pop-screen-catalog';
import { destinationOf } from '../../patterns/pop-screen-nav';

const t = messages.popChrome.console;

const areaOf = (slug: string | undefined): PopArea | null =>
  POP_AREAS.find((area) => area === slug) ?? null;

/**
 * POP **부서 화면** — 한 부서의 업무 묶음과 화면 타일(1920 기준으로 직접 그린다).
 *
 * ```
 * [🏭] 생산
 *      작업 진행 · 포장 · 중단·교체 · 화면 6개
 * 작업 진행 2 ─────────────────────────────────────────────
 * ┌ ▶ 작업 시작 ──────────────────┐ ┌ ⚡ 긴급 W/O ───┐
 * 포장 2 ──────────────────────────────────────────────────
 * ┌ 📦 생산 포장 ┐ ┌ 🖨 포장 라벨 재출력 ┐
 * ```
 *
 * ⭐ **왼쪽 부서 레일과 홈의 부서 카드가 데려온다.** 화면을 고르는 곳이 여기 하나라, 어느 부서
 *    담당이든 같은 순서(부서 → 묶음 → 화면)로 찾는다.
 *
 * ⛔ **권한으로 막지 않는다.** 셸의 자리다 — 이 단말이 열 수 있는 화면만 타일로 서고, 하나도 없거나
 *    판정하지 못했으면 감추지 않고 사유를 적는다(G-2).
 */
export const PopAreaScreen = () => {
  const titleId = useId();
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const area = areaOf(useParams().area);

  /* 모르는 부서 주소 — 키오스크에는 주소창이 없어 손으로 고칠 수 없으니 홈으로 돌린다. */
  if (area === null) return <Navigate to={POP_HOME_PATH} replace />;

  const board = boardOf(access.screens).find((entry) => entry.area === area);

  const reason =
    access.state === 'loading'
      ? t.access.loading
      : access.state === 'unknown'
        ? t.access.unknown
        : board === undefined
          ? t.area.empty
          : null;

  return (
    <main className="pop-shell pop-ui pop-area" aria-labelledby={titleId}>
      <header className="pop-area__head pop-fixed">
        <span className="pop-area__icon">
          <Icon name={POP_AREA_ICONS[area]} size={44} />
        </span>
        <div>
          <h1 id={titleId}>{t.areas[area]}</h1>
          {board !== undefined && (
            <p>
              {t.area.summary(
                board.groups.map(({ group }) => t.groups[group]).join(' · '),
                screenCountOf(board),
              )}
            </p>
          )}
        </div>
      </header>

      <div className="pop-area__body">
        {reason !== null || board === undefined ? (
          <div className="banner-slot">
            <AlertBanner variant={access.state === 'loading' ? 'info' : 'warning'}>
              {reason}
            </AlertBanner>
          </div>
        ) : (
          <PopAreaGroups
            board={board}
            onPick={(screen) => {
              void navigate(destinationOf(screen, ''));
            }}
          />
        )}
      </div>
    </main>
  );
};
