import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { PuButton, PuChip, PuKv, PuNote } from '../../patterns/pop-uniform';
import type { WorkerResponse } from './verify';

/**
 * 우측 《현재 작업자》 구획(#295 로그인 시안).
 *
 * ⭐ **현재 작업자를 크게 상시 표시한다.** 이 화면은 도용 위험을 수용한 설계이고, 「지금
 * 누구로 기록되는가」를 늘 보이는 것이 **화면이 할 수 있는 유일한 방어**다(§5-4 · §9-1).
 *
 * ⛔ **자격을 표시하지 않는다**(§5-5). 자격 자료가 아직 채워지지 않아 보이면 「자격 없음」이
 * 전원에게 뜬다. ⚠ 재개되면 이 카드 아래가 그 자리다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.workerAssignment.current;

export interface WorkerCardProps {
  /** 지정된 작업자. 아직 없으면 `null` */
  worker: WorkerResponse | null;
  /** 지정한 시각(표시용 문자열). 작업자가 없으면 `null` */
  assignedAt: string | null;
  /** ⚠ 다른 공장 소속인가 — **막지 않고 표시만 한다**(§6) */
  isOtherPlant: boolean;
  /**
   * 아직 보내지 못한 기록 수. 0이면 알릴 것이 없다.
   *
   * ⛔ **큐의 사번을 바꾸지 않는다**(§6 · B-3 이력 불변) — 사실만 알린다.
   */
  pendingQueue: number;
  onShift: () => void;
  onGoToWork: () => void;
  /**
   * ⚠ **개발 빌드에서만 채워지는 자리다.** 주면 [작업 화면으로 →] «대신» 선다
   * (`patterns/pop-dev-screen-nav`). 배포 번들에서는 호출부의 조건이 상수로 접혀 이 값이
   * 늘 `undefined`이므로 버튼이 그대로 남는다 — 화면의 제품 동작은 바뀌지 않는다.
   */
  devScreenNav?: ReactNode;
}

/** 빈 상태의 사람 그림 — 통일 아이콘(`PuIcon`)에 사람 모양이 없어 이 구획만 그린다. */
const PERSON_ICON = (
  <svg
    className="pu-ic"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
  </svg>
);

export const WorkerCard = ({
  worker,
  assignedAt,
  isOtherPlant,
  pendingQueue,
  onShift,
  onGoToWork,
  devScreenNav,
}: WorkerCardProps) => {
  const titleId = useId();

  return (
    <section className="pu-card wa-right" aria-labelledby={titleId}>
      <div className="pu-card-head">
        <h2 id={titleId}>{t.heading}</h2>
      </div>

      <div className="pu-card-body wa-right-body">
        {worker === null ? (
          <div className="pu-empty wa-none" role="status">
            {PERSON_ICON}
            <b>{t.none}</b>
            <span>{t.noneHelp}</span>
          </div>
        ) : (
          /*
           * ⚠ **소속을 그리지 못한다**(§3 도면 · §4-A 「확인 후 표시」). 계약의 작업자는
           * `departmentId`(숫자)만 주고 이름을 주지 않으며, 부서를 푸는 경로가 계약에 없다.
           * ⛔ 숫자를 소속인 척 그리지 않는다(G-9).
           */
          <div className="wa-who">
            <div className="wa-who-head">
              <b>{worker.workerName}</b>
              <PuChip tone="ok">{t.confirmed}</PuChip>
            </div>
            <PuKv
              items={[
                { label: t.workerNo, value: worker.workerNo },
                ...(assignedAt === null ? [] : [{ label: t.assignedAt, value: assignedAt }]),
              ]}
            />
          </div>
        )}

        {/* ⚠ 막지 않는다 — 사번이 전역 유일이라 조회되고 사람이 옮겨 다닌다. */}
        {worker !== null && isOtherPlant && <PuNote tone="warn">{t.otherPlant}</PuNote>}

        {/*
         * ⚠ 교대해도 이미 쌓인 기록은 이전 사번으로 남는다 — 그 사실을 알린다(§6).
         *
         * ⛔ **새 작업자가 정해지면 내린다.** 이 경고는 «교대라는 사건»에 붙는 것이지 단말의
         * 상태가 아니다 — 남겨 두면 새 작업자 카드 아래에 이전 사람 이야기가 붙는다(§5-4).
         */}
        {worker === null && pendingQueue > 0 && (
          <PuNote tone="warn">{t.pendingQueue(pendingQueue)}</PuNote>
        )}
      </div>

      {/* 변경·이동은 **현재 작업자가 있을 때만** 구획 아래 작업 줄에 선다(§5-8 · 시안). */}
      {worker !== null && (
        <div className="wa-right-actions">
          <PuButton onClick={onShift}>{t.shift}</PuButton>
          {devScreenNav ?? (
            <PuButton variant="primary" onClick={onGoToWork}>
              {t.toWork}
            </PuButton>
          )}
        </div>
      )}
    </section>
  );
};
