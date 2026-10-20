import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link, Navigate, useParams } from 'react-router';

import { useOutbox } from '../patterns/outbox';
import { useScreenTitle } from '../patterns/screen-title';
import { useResumableTasks } from '../patterns/task-draft';
import { useFrequentScreens } from './frequent-screens';
import { areaOf, homeAreas, screenOf, type HomeScreen } from './home-menu';
import './shell-home.css';

const t = messages.shellHome;

/** 「자주 쓰는 작업」에 세우는 수. 두 줄 두 칸 — 스크롤 없이 업무 묶음까지 보인다. */
const FREQUENT_LIMIT = 4;

const ScreenTiles = ({ screens }: { screens: HomeScreen[] }) => (
  <ul className="shell-home__tiles">
    {screens.map((screen) => (
      <li key={screen.to}>
        <Link to={screen.to} className="shell-home__tile">
          <Icon name={screen.icon} size={28} className="shell-home__icon" />
          <strong>{screen.label}</strong>
        </Link>
      </li>
    ))}
  </ul>
);

/**
 * 작업 목록의 첫 화면.
 *
 * 관리웹은 좌측 레일로 옮겨 다니지만 이 셸은 그 자리를 두지 않는다 - 폭이 좁고 한 손으로
 * 장갑을 낀 채 쓰므로, 설계가 세 셸의 IA 를 각각 다르게 정했다. 관리웹은 메뉴 트리, POP 은
 * 태스크 모드, 모바일은 스캔 퍼스트 홈 타일이다.
 *
 * 첫 화면에서 고를 것을 줄인다(사용자 지시 2026-10-20). 스물한 타일을 늘어놓는 대신
 * - 지금 이 사람에게 걸린 것(이어서 하기 · 전송 현황) — 있을 때만
 * - 이 사번이 많이 쓰는 작업 넷 — 쓴 적이 있을 때만
 * - 네 업무 — 누르면 그 업무의 작업들
 * 만 둔다. 대부분의 날은 「자주 쓰는 작업」에서 한 번에 들어간다.
 *
 * 글자 링크로 두지 않는다 - 기본 링크는 글자 높이만큼만 눌리고 그 높이는 손가락보다 작다.
 */
export const ShellHome = () => {
  const resumable = useResumableTasks();
  const { pending, rejected } = useOutbox();
  const frequent = useFrequentScreens(FREQUENT_LIMIT)
    .map(screenOf)
    .filter((screen): screen is HomeScreen => screen !== undefined);

  return (
    <nav aria-label={t.label} className="shell-home">
      {resumable.length === 0 ? null : (
        <section className="shell-home__group">
          <h2>{t.resume.label}</h2>
          <ul className="shell-home__resume">
            {resumable.map((task) => (
              <li key={task.to}>
                <Link
                  to={task.to}
                  className="shell-home__resume-card"
                  aria-label={t.resume.open(task.title)}
                >
                  <strong>{task.title}</strong>
                  <span>{task.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending === 0 && rejected.length === 0 ? null : (
        <section className="shell-home__group">
          <h2>{t.status.label}</h2>
          <ul className="shell-home__status">
            <li>
              <Link to="/outbox" className="shell-home__stat">
                <span>{t.status.pending}</span>
                <strong>{t.status.count(pending)}</strong>
              </Link>
            </li>
            <li>
              {/* 0 건을 경고색으로 그리면 문제가 없는데도 눈이 그리로 간다. */}
              <Link
                to="/rejections"
                className={
                  rejected.length === 0
                    ? 'shell-home__stat'
                    : 'shell-home__stat shell-home__stat--rejected'
                }
              >
                <span>{t.status.rejected}</span>
                <strong>{t.status.count(rejected.length)}</strong>
              </Link>
            </li>
          </ul>
        </section>
      )}

      {frequent.length === 0 ? null : (
        <section className="shell-home__group">
          <h2>{t.frequent}</h2>
          <ScreenTiles screens={frequent} />
        </section>
      )}

      <section className="shell-home__group">
        <h2>{t.areas.label}</h2>
        <ul className="shell-home__areas">
          {homeAreas.map((area) => (
            <li key={area.id}>
              <Link to={`/screens/${area.id}`} className="shell-home__area">
                <Icon name={area.icon} size={32} className="shell-home__icon" />
                <strong>{area.label}</strong>
                <span className="shell-home__area-summary">{area.summary}</span>
                <span className="shell-home__area-count">{t.areas.count(area.screens.length)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </nav>
  );
};

/**
 * 업무 하나의 작업들. 홈의 업무 타일을 누르면 온다.
 *
 * 돌아가는 길은 앱바의 홈 단추와 단말의 뒤로가기다 - 이 화면은 작업 목록의 둘째 층일 뿐이다.
 */
export const HomeAreaScreen = () => {
  const area = areaOf(useParams().area);
  useScreenTitle(area?.label ?? t.label);

  /* 없는 업무 주소는 첫 화면으로 돌린다. 빈 목록을 세우면 어디로 가야 할지 모른다. */
  if (area === undefined) {
    return <Navigate to="/screens" replace />;
  }

  return (
    <nav aria-label={area.label} className="shell-home">
      <ScreenTiles screens={area.screens} />
    </nav>
  );
};
