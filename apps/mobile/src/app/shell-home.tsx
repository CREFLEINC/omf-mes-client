import { Badge, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link, Navigate, useParams } from 'react-router';

import { useOutbox } from '../patterns/outbox';
import { useScreenTitle } from '../patterns/screen-title';
import { useResumableTasks } from '../patterns/task-draft';
import { areaOf, homeAreas, type HomeScreen } from './home-menu';
import { countOf, sumOf, useCountBasis, useWorkCounts } from './work-counts';
import './shell-home.css';

const t = messages.shellHome;

/**
 * 남은 작업 배지(피처 002). 1~9 그대로, 10 이상 「9+」, 0 이면 그리지 않는다(DS `Badge`). 색은 중립이다 —
 * 빨강은 「이어서 하기」 전용이다. 수는 낭독기용 이름이 따로 들므로 배지 자체는 숨긴다.
 */
const CountBadge = ({ count }: { count: number | undefined }) =>
  count === undefined || count <= 0 ? null : (
    <Badge count={count} max={9} tone="neutral" className="shell-home__badge" aria-hidden="true" />
  );

/** 남은 일이 있을 때만 이름에 실제 수를 싣는다. 없으면 보이는 글자가 이름이다. */
const countLabel = (label: string, count: number | undefined): string | undefined =>
  count === undefined || count <= 0 ? undefined : t.workCount.label(label, count);

/**
 * 업무 화면의 작업 한 행. 이름은 작업 이름뿐이고, 무엇을 하는 화면인지는 설명으로 붙인다 - 설명까지
 * 이름에 섞이면 낭독기가 행마다 긴 문장을 이름으로 읽는다.
 */
/* 이름 한 줄 - 이름 아래 설명은 두지 않는다(사용자 지시 2026-10-21). */
const ScreenRow = ({ screen, count }: { screen: HomeScreen; count: number | undefined }) => (
  <Link to={screen.to} className="shell-home__row" aria-label={countLabel(screen.label, count)}>
    <span className="shell-home__tile-icon">
      <Icon name={screen.icon} size={24} />
    </span>
    <span className="shell-home__text">
      <strong>{screen.label}</strong>
    </span>
    <CountBadge count={count} />
    <Icon name="chevron_right" size={24} className="shell-home__chevron" />
  </Link>
);

/**
 * 수의 기준 한 줄 — 창고 아이콘과 이 기기의 창고 이름만(「이 기기: … 기준」 글자는 뺐다, 사용자 지시
 * 2026-11-23). 창고가 없는 기기는 「공장 전체」. 수를 모르면 나타나지 않는다.
 */
const CountBasis = ({ counts }: { counts: ReturnType<typeof useWorkCounts> }) => {
  const basis = useCountBasis(counts !== undefined);
  if (counts === undefined || basis === undefined) return null;

  return (
    <p className="shell-home__basis">
      <Icon name="warehouse" size={20} />
      <span>{basis ?? t.workCount.basisPlant}</span>
    </p>
  );
};

/**
 * 작업 목록의 첫 화면.
 *
 * 관리웹은 좌측 레일로 옮겨 다니지만 이 셸은 그 자리를 두지 않는다 - 폭이 좁고 한 손으로
 * 장갑을 낀 채 쓰므로, 설계가 세 셸의 IA 를 각각 다르게 정했다. 관리웹은 메뉴 트리, POP 은
 * 태스크 모드, 모바일은 스캔 퍼스트 홈 타일이다.
 *
 * 첫 화면에서 고를 것을 줄인다(사용자 지시 2026-10-20). 스물한 타일을 늘어놓는 대신
 * - 지금 이 사람에게 걸린 것(이어서 하기 · 전송 현황) — 있을 때만
 * - 네 업무 — 누르면 그 업무의 작업들
 * 만 둔다. 차례는 개편 제안 v2 의 홈을 따른다(사용자 결정 2026-10-21) - 업무 타일이 화면 위쪽에
 * 고정된다. 업무 아래 「자주 쓰는 작업」은 걷었다(사용자 지시 2026-11-23).
 *
 * 글자 링크로 두지 않는다 - 기본 링크는 글자 높이만큼만 눌리고 그 높이는 손가락보다 작다.
 */
export const ShellHome = () => {
  const resumable = useResumableTasks();
  const { pending, rejected } = useOutbox();
  const counts = useWorkCounts();

  return (
    <nav aria-label={t.label} className="shell-home">
      {/*
       * 「이어서 하기」는 이 화면에서 유일하게 빨강을 쓰는 자리다(사용자 결정 2026-10-21). 적다 만
       * 것이 있다는 것이 첫 화면에서 가장 먼저 걸려야 할 사실이다.
       */}
      {resumable.length === 0 ? null : (
        <section className="shell-home__group">
          <h2 className="shell-home__hidden">{t.resume.label}</h2>
          <ul className="shell-home__resume">
            {resumable.map((task) => (
              <li key={task.to}>
                <Link
                  to={task.to}
                  className="shell-home__resume-card"
                  aria-label={t.resume.open(task.title)}
                >
                  <span className="shell-home__resume-icon">
                    <Icon name="pending_actions" size={24} />
                  </span>
                  <span className="shell-home__text">
                    <small>{t.resume.label}</small>
                    <strong>{task.title}</strong>
                    <span>{task.summary}</span>
                  </span>
                  <Icon name="chevron_right" size={24} className="shell-home__chevron" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending === 0 && rejected.length === 0 ? null : (
        <section className="shell-home__group">
          <h2 className="shell-home__hidden">{t.status.label}</h2>
          <ul className="shell-home__status">
            <li>
              <Link to="/outbox" className="shell-home__stat">
                <Icon name="cloud_upload" size={24} />
                <span className="shell-home__stat-text">
                  <span>{t.status.pending}</span>
                  <strong>{t.status.count(pending)}</strong>
                </span>
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
                <Icon name="report" size={24} />
                <span className="shell-home__stat-text">
                  <span>{t.status.rejected}</span>
                  <strong>{t.status.count(rejected.length)}</strong>
                </span>
              </Link>
            </li>
          </ul>
        </section>
      )}

      {/* 수의 기준(이 기기의 창고)은 업무 바로 위다 - 업무 행의 남은 작업 수를 읽기 전에 본다(사용자 지시 2026-11-23). */}
      <CountBasis counts={counts} />

      <section className="shell-home__group">
        <h2>{t.areas.label}</h2>
        <ul className="shell-home__areas">
          {homeAreas.map((area) => {
            /* 남은 일이 있으면 「작업 N개」 자리에 「남은 작업 [합]」(확정 2026-10-28). 0·실패면 지금처럼. */
            const left = sumOf(area.screens, counts);
            const hasLeft = left !== undefined && left > 0;

            return (
              <li key={area.id}>
                {/* 업무는 한 줄 목록이다(사용자 지시 2026-10-21) - 아이콘 · 이름 · 작업 수 · 화살표. */}
                <Link
                  to={`/screens/${area.id}`}
                  className="shell-home__area"
                  aria-label={countLabel(area.label, left)}
                >
                  <span className="shell-home__tile-icon">
                    <Icon name={area.icon} size={24} />
                  </span>
                  <strong>{area.label}</strong>
                  {hasLeft ? (
                    <span className="shell-home__area-count shell-home__area-left">
                      {t.workCount.left}
                      <CountBadge count={left} />
                    </span>
                  ) : (
                    <span className="shell-home__area-count">
                      {t.areas.count(area.screens.length)}
                    </span>
                  )}
                  <Icon name="chevron_right" size={24} className="shell-home__chevron" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/*
       * 맨 아래 「사용자 전환」 · 「설정」 단추는 걷었다(사용자 지시 2026-11-23). 사용자 전환은 앱바의
       * 사번 칩이, 설정은 그 오른쪽 아이콘이 한다.
       */}
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
  const counts = useWorkCounts();
  useScreenTitle(area?.label ?? t.label);

  /* 없는 업무 주소는 첫 화면으로 돌린다. 빈 목록을 세우면 어디로 가야 할지 모른다. */
  if (area === undefined) {
    return <Navigate to="/screens" replace />;
  }

  /*
   * 타일 대신 행이다. 한 업무의 작업은 서너 개에서 여섯 개라 두 칸 타일은 위 절반만 채웠고,
   * 이름만으로는 「입하 · 입고 · 적치」처럼 비슷한 작업이 갈리지 않았다. 행은 무엇을 하는
   * 화면인지 한 줄을 이름 아래에 둔다.
   */
  return (
    <nav aria-label={area.label} className="shell-home">
      <ul className="shell-home__rows">
        {area.screens.map((screen) => (
          <li key={screen.to}>
            <ScreenRow screen={screen} count={countOf(screen, counts)} />
          </li>
        ))}
      </ul>
    </nav>
  );
};
