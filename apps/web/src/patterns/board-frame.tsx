import type { ReactNode } from 'react';

import { PaneSplitter, useFitToViewport, usePaneSplit } from './po-board';

/** 한 구획 — 접근 이름(보이지 않아도 구획을 부르는 이름)과 내용. */
export interface BoardFramePane {
  label: string;
  content: ReactNode;
}

interface BoardFrameBase {
  /** 위 상자 — 조회 조건 · 목록 조회 실패 안내. 크기가 바뀌면 아래 구획이 창 바닥에 다시 맞춘다. */
  above?: BoardFramePane;
  /** 왼쪽(상세가 없으면 전체 폭) — 목록. 표가 구획 안에서 스크롤하고(머리줄 고정) 표 아래 쪽 이동은 바닥에 선다. */
  list: BoardFramePane;
}

/** 목록 | 상세 두 구획. */
interface BoardFrameSplit extends BoardFrameBase {
  /** 두 구획의 폭 비율 · 왼쪽 접힘을 브라우저에 남기는 열쇠 — **화면마다 다르게.** */
  splitKey: string;
  /** 나란히 설 때 왼쪽 몫(0~1). 없으면 1/3. */
  initialRatio?: number;
  /**
   * 오른쪽 — 고른 건. 기본은 구획을 통째로 스크롤한다(사실 칸 · 라인 표가 이어진다). 표 하나만 서는 구획은
   * `scroll: false` 로 표가 구획 안에서 스크롤하게 한다(머리줄 고정).
   */
  detail: BoardFramePane & { scroll?: boolean };
  /** 막대 이름과 접기 단추 이름 — 업무 이름이 들어가 부르는 화면이 넘긴다. */
  splitter: { label: string; collapseLabel: string; expandLabel: string };
}

/**
 * 목록 한 구획 — 상세가 목록의 줄과 같은 내용뿐인 화면(사용자 지시 2026-10-27 「상세가 왼쪽과 같으면 상세는 필요 없다」).
 * 막대도 접기도 없다.
 */
interface BoardFrameSingle extends BoardFrameBase {
  splitKey?: undefined;
  initialRatio?: undefined;
  detail?: undefined;
  splitter?: undefined;
}

export type BoardFrameProps = BoardFrameSplit | BoardFrameSingle;

/**
 * **입고 관리 짜임의 화면 틀**(사용자 지시 2026-10-27 — ERP 데이터 탭이 입고 관리와 같은 배치를 쓴다). 위에 조회 조건,
 * 아래에 왼쪽 목록 | 오른쪽 상세. 두 구획은 창 바닥에서 멈추고, 가운데 막대를 끌어 폭을 나누며, 막대 위 단추로 왼쪽을
 * 접는다. 창이 1440px 보다 좁으면 위아래로 쌓인다(app.css `.po-board-split`).
 *
 * 상세가 없으면(`detail` 을 주지 않으면) 목록 한 구획이 전체 폭을 쓴다.
 *
 * 표는 `BoardTable`(board-table.tsx)을 쓴다 — 틀은 구획만 세우고 안의 내용은 모른다.
 */
export const BoardFrame = ({
  splitKey,
  initialRatio,
  above,
  list,
  detail,
  splitter,
}: BoardFrameProps) => {
  const { splitRef, aboveRef } = useFitToViewport();
  /* 훅은 늘 부른다 — 한 구획이면 그 결과를 쓰지 않는다. */
  const split = usePaneSplit(splitKey ?? 'omf-mes:board-frame:single', initialRatio);
  const isSingle = detail === undefined || splitter === undefined;

  return (
    <>
      {above !== undefined && (
        <section ref={aboveRef} className="board-frame-above" aria-label={above.label}>
          {above.content}
        </section>
      )}

      {isSingle ? (
        <div ref={splitRef} className="po-board-split board-frame-single">
          <section className="pane po-board-pane" aria-label={list.label}>
            {list.content}
          </section>
        </div>
      ) : (
        /* 왼쪽 목록을 접으면 오른쪽 상세가 폭을 다 쓴다 — 나란히 설 때만(app.css). */
        <div
          ref={splitRef}
          className="po-board-split"
          style={split.style}
          data-left-collapsed={split.collapsed ? 'true' : undefined}
        >
          <section className="pane po-board-pane" aria-label={list.label}>
            {list.content}
          </section>

          <PaneSplitter
            label={splitter.label}
            ratio={split.ratio}
            onChange={split.commit}
            collapse={{
              collapsed: split.collapsed,
              onToggle: split.toggleCollapsed,
              collapseLabel: splitter.collapseLabel,
              expandLabel: splitter.expandLabel,
            }}
          />

          <section
            className={
              detail.scroll === false ? 'pane po-board-pane' : 'pane po-board-pane po-board-scroll'
            }
            aria-label={detail.label}
          >
            {detail.content}
          </section>
        </div>
      )}
    </>
  );
};
