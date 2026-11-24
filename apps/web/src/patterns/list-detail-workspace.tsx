import { messages } from '@omf-mes/i18n';
import { useLayoutEffect, useRef, type ReactNode } from 'react';

import { useHubActionsTarget } from './hub-actions';
import { PaneListHead, PaneSplitter, useFitToViewport, usePaneSplit } from './po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from './split-orientation';

const hubText = messages.common.inspectionHub;

export interface ListDetailWorkspaceProps {
  /** 폭 비율 · 접힘 · 배치(좌우/상하)를 브라우저에 남기는 열쇠 앞머리 — **화면마다 다르게.** */
  storageKey: string;
  /** 좌우/상하 배치를 같은 탭 묶음의 다른 화면과 함께 쓸 때 그 열쇠(예: 품질 기준 정보 묶음) — 없으면 화면 몫. */
  orientationKey?: string;
  /** 나란히 설 때 목록 몫(0~1). */
  initialRatio?: number;
  /** 탭 줄 오른쪽, 「⋯」(배치) 왼쪽에 둘 것 — 상태 칩 등. 탭 묶음 밖이면 조회 조건 위 오른쪽 줄에 선다. */
  toolbar?: ReactNode;
  /** 조회 조건 상자 — 목록 · 상세와 따로 선다. */
  filter?: { label: string; content: ReactNode };
  /**
   * 목록 상자 — 맨 위 「이름 · 건수 · 목록 접기」 제목 줄(#350). `title` 이 빈 글이면 건수 · 단추만.
   * `count` 는 조회 전이면 비운다.
   */
  list: {
    label: string;
    title: string;
    count?: number;
    content: ReactNode;
    className?: string;
    /** 제목 줄 오른쪽(「목록 접기」 앞)에 둘 것 — 선택 건수 · 일괄 동작 등. 없으면 종전과 같다(#358). */
    actions?: ReactNode;
  };
  /** 상세 상자. `bare` 면 상자를 씌우지 않는다(안에서 여러 상자를 쌓는 상세). */
  detail: { label: string; content: ReactNode; className?: string; bare?: boolean };
  /**
   * 화면 안 탭에 숨어 있는 동안 `false` — 탭 줄의 칩 · 「⋯」을 내려 보이는 탭의 것으로 읽히지 않게 한다. 배치 자체는
   * 그대로 두어(내리지 않는다) 적어 둔 조회 값 · 스크롤이 탭을 오가도 남는다. 주지 않으면 늘 보인다.
   */
  visible?: boolean;
}

/**
 * 조회 조건 · 목록 · 상세의 통일 배치(omf-all-around#350 · 검사 조회·판정과 같다).
 *
 * 위에 조회 조건 상자, 아래에 목록 | 상세 — 가운데 막대로 폭을 끌고, 탭 줄 오른쪽 「⋯」 에서 좌우 · 상하 배치를 고른다.
 * 목록은 제목 줄의 「목록 접기」로 접고 왼쪽 「목록 N건」 탭으로 다시 편다.
 */
export const ListDetailWorkspace = ({
  storageKey,
  orientationKey,
  initialRatio = 0.4,
  toolbar,
  filter,
  list,
  detail,
  visible = true,
}: ListDetailWorkspaceProps) => {
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit(`${storageKey}:split`, initialRatio);
  const layout = useSplitOrientation(orientationKey ?? `${storageKey}:split-orientation`);
  const hubTarget = useHubActionsTarget();
  const rootRef = useRef<HTMLDivElement>(null);
  /*
   * 처음 그릴 때는 탭 줄 자리를 아직 못 찾아 「⋯」 · 칩이 조회 상자 위에 잠깐 섰다가 탭 줄로 옮겨 간다 — 목록 | 상세가
   * 위로 올라오므로 윗변을 다시 잰다(재지 않으면 창 바닥 위에 빈 띠가 남는다 · #350 회귀 시험). 위 칸의 높이가 바뀌면
   * 이 상자 높이도 바뀌므로 그것을 지켜본다. 다음 그림 때 재서 같은 그림 안에서 크기가 되먹히지 않게 한다.
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const splitEl = splitRef.current;
    if (root === null || splitEl === null || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        splitEl.style.setProperty(
          '--split-top',
          `${String(splitEl.getBoundingClientRect().top)}px`,
        );
      });
    });
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [splitRef]);
  const collapse = {
    collapsed: split.collapsed,
    onToggle: split.toggleCollapsed,
    collapseLabel: hubText.listCollapse,
    expandLabel: hubText.listExpand,
    count: list.count,
  };
  const isStacked = layout.orientation === 'column';
  const toggle = (
    <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} inline />
  );

  return (
    <div ref={rootRef} className="list-detail-workspace">
      {/* 탭 묶음 안이면 칩 · 「⋯」은 탭 줄로 간다(그 자리에 그대로). 밖이면 조회 조건 위 오른쪽 한 줄. */}
      {!visible ? null : hubTarget === null ? (
        <div className="list-detail-toolbar">
          {toolbar}
          {toggle}
        </div>
      ) : (
        <>
          {toolbar}
          {toggle}
        </>
      )}

      {filter !== undefined && (
        <section
          ref={aboveRef}
          className="pane po-board-filter list-detail-filter"
          aria-label={filter.label}
        >
          {filter.content}
        </section>
      )}

      <div
        ref={splitRef}
        className={`po-board-split inspection-split list-detail-split${isStacked ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section
          className={`pane list-detail-list${list.className === undefined ? '' : ` ${list.className}`}`}
          aria-label={list.label}
        >
          <PaneListHead title={list.title} collapse={collapse}>
            {list.actions === undefined ? null : (
              <div className="list-detail-list-actions">{list.actions}</div>
            )}
          </PaneListHead>
          {list.content}
        </section>

        <PaneSplitter
          label={hubText.splitter}
          ratio={split.ratio}
          onChange={split.commit}
          collapse={collapse}
        />
        {isStacked && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
            collapse={collapse}
          />
        )}

        {detail.bare === true ? (
          <div
            className={`list-detail-detail is-bare${detail.className === undefined ? '' : ` ${detail.className}`}`}
            role="region"
            aria-label={detail.label}
          >
            {detail.content}
          </div>
        ) : (
          <section
            className={`pane list-detail-detail${detail.className === undefined ? '' : ` ${detail.className}`}`}
            aria-label={detail.label}
          >
            {detail.content}
          </section>
        )}
      </div>
    </div>
  );
};
