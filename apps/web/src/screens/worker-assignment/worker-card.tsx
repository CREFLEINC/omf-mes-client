import { AlertBanner, Button, Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { POP_TOUCH_SIZE } from './touch-spec';
import type { WorkerResponse } from './verify';

/**
 * 우측 《현재 작업자》 구획 — 화면 스펙 §3 의 오른쪽 512 다.
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
}

export const WorkerCard = ({
  worker,
  assignedAt,
  isOtherPlant,
  pendingQueue,
  onShift,
  onGoToWork,
}: WorkerCardProps) => (
  <section className="pane pop-pane" aria-label={t.heading}>
    <h2 className="field-label">{t.heading}</h2>

    {worker === null ? (
      <p className="field-note">{t.none}</p>
    ) : (
      <>
        {/*
         * ⚠ **소속을 그리지 못한다**(§3 도면 · §4-A 「확인 후 표시」). 계약의 작업자는
         * `departmentId`(숫자)만 주고 이름을 주지 않으며, 부서를 푸는 경로가 계약에 없다 —
         * 설치 위치와 **같은 종류의 공백**이다. ⛔ 숫자를 소속인 척 그리지 않는다(G-9
         * 「모르는 값과 없는 값을 같은 모양으로 그리지 않는다」).
         */}
        <Card>
          <p className="worker-card__name">{`${worker.workerName} · ${worker.workerNo}`}</p>
          {assignedAt !== null && <p className="field-note">{`${t.assignedAt} ${assignedAt}`}</p>}
        </Card>

        {/* ⚠ 막지 않는다 — 사번이 전역 유일이라 조회되고 사람이 옮겨 다닌다. */}
        {isOtherPlant && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.otherPlant}</AlertBanner>
          </div>
        )}
      </>
    )}

    {/*
     * ⚠ 교대해도 이미 쌓인 기록은 이전 사번으로 남는다 — 그 사실을 알린다(§6).
     *
     * ⛔ **새 작업자가 정해지면 내린다.** 이 경고는 «교대라는 사건»에 붙는 것이지 단말의
     * 상태가 아니다 — 남겨 두면 새 작업자 카드 아래에 이전 사람 이야기가 붙어, 지금 누구로
     * 기록되는지를 정확히 보여야 하는 화면이 틀린 귀속을 말하게 된다(§5-4).
     */}
    {worker === null && pendingQueue > 0 && (
      <div className="banner-slot">
        <AlertBanner variant="warning">{t.pendingQueue(pendingQueue)}</AlertBanner>
      </div>
    )}

    {/* 지금 누구로 기록되는지를 늘 말한다 — 작업자가 없을 때도 자리를 지킨다. */}
    <p className="field-note">{t.note}</p>

    {/*
     * 교대·이동은 **현재 작업자가 있을 때만** 눌린다(§5-8). 터치 규격 72px(`2xl`).
     */}
    <Button
      type="button"
      variant="outlined"
      size={POP_TOUCH_SIZE}
      disabled={worker === null}
      onClick={onShift}
    >
      {t.shift}
    </Button>
    <Button
      type="button"
      variant="filled"
      size={POP_TOUCH_SIZE}
      disabled={worker === null}
      onClick={onGoToWork}
    >
      {t.toWork}
    </Button>
  </section>
);
