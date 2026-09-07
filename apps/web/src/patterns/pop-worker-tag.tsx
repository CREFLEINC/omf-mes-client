import { messages } from '@omf-mes/i18n';

const t = messages.common.popWorker;

export interface PopWorkerTagProps {
  /** 지금 화면을 쓰는 사람의 사번. 아직 못 받았으면 `null`. */
  workerNo: string | null;
}

/**
 * POP 머리줄의 **사번 한 자리** — 화면마다 같게 보이도록 한 곳에서 그린다
 * (사용자 지시 2026-09-07).
 *
 * 화면들이 제각기 그리면서 세 갈래로 갈렸다 — 어떤 화면은 칩으로, 어떤 화면은 글자로,
 * 어떤 화면은 **사번이 없으면 아예 감췄다.** POP 은 한 사람이 화면을 옮겨 다니며 쓰는
 * 자리라, 같은 값이 화면마다 다른 모양이면 그때마다 눈이 다시 찾는다.
 *
 * ⛔ **칩으로 그리지 않는다.** 칩은 «상태»의 어휘다(연결·프린터·판정). 사번은 상태가 아니라
 * 맥락 값이라, 칩으로 두면 색이 무슨 뜻인지 묻게 된다 — 실제로 연결 상태를 사번 칩의 색으로
 * 말하던 화면이 있었고, 끊기면 사번이 붉어져 «사번이 틀린 것»처럼 보였다.
 *
 * ⛔ **없을 때 감추지 않는다.** 사번이 없으면 대개 쓰기가 막히는데, 자리까지 사라지면 왜
 * 막혔는지 짚을 곳이 없다. 「모른다」를 「없다」와 다르게 적는다.
 */
export const PopWorkerTag = ({ workerNo }: PopWorkerTagProps) => (
  <span className="pop-worker-tag">
    {workerNo === null ? t.unknown : `${t.label} ${workerNo}`}
  </span>
);
