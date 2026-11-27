import { createPortal } from 'react-dom';
import {
  Children,
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  PaneLayoutToggle,
  PaneSplitter,
  usePaneSplit,
  type PaneCollapse,
  type PaneLayout,
} from '../../../patterns/po-board';
import { PaneHeightSplitter, useSplitOrientation } from '../../../patterns/split-orientation';

const LayoutOrientation = createContext<PaneLayout>('side');
export const useAdjustableOrientation = () => useContext(LayoutOrientation);
/** 좌우로 설 때 목록 접기(#350) — 목록이 제목 줄에 「목록 접기」를 단다. 접을 수 없으면 `null`. */
const LayoutCollapse = createContext<PaneCollapse | null>(null);
export const useAdjustableCollapse = () => useContext(LayoutCollapse);

/** 배치와 비율만 바꾼다. 저장 중인 편집 상태와 선택 대상은 그대로 유지한다. */
export const AdjustableLayout = ({
  storageKey,
  label,
  initial = 'side',
  ratio = 0.5,
  className = '',
  collapsible = false,
  count,
  toolsTargetId,
  children,
}: {
  storageKey: string;
  label: string;
  initial?: PaneLayout;
  ratio?: number;
  className?: string;
  collapsible?: boolean;
  /** 목록 건수 — 접힌 「목록」 탭에 함께 선다. */
  count?: number;
  toolsTargetId?: string;
  children: ReactNode;
}) => {
  const [layout, setLayout] = useState<PaneLayout>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === 'side' || saved === 'stack' ? saved : initial;
    } catch {
      return initial;
    }
  });
  const [toolsTarget, setToolsTarget] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setToolsTarget(toolsTargetId ? document.getElementById(toolsTargetId) : null);
  }, [toolsTargetId]);
  const split = usePaneSplit(`${storageKey}:ratio`, ratio);
  const height = useSplitOrientation(`${storageKey}:height`);
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => setFits(element.clientWidth >= 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const side = layout === 'side' && fits;
  const collapse: PaneCollapse | null =
    side && collapsible
      ? {
          collapsed: split.collapsed,
          onToggle: split.toggleCollapsed,
          collapseLabel: '목록 접기',
          expandLabel: '목록 펼치기',
          count,
        }
      : null;
  const panes = Children.toArray(children);
  const layoutTools = (
    <div className="erp-wo-layout-tools" hidden={!fits}>
      <PaneLayoutToggle
        layout={layout}
        labels={{ group: `${label} 배치`, side: '좌우 배치', stack: '상하 배치' }}
        expanded
        onChange={(next) => {
          setLayout(next);
          try {
            localStorage.setItem(storageKey, next);
          } catch {
            /* 이번 화면에서는 선택한 배치를 유지한다. */
          }
        }}
      />
    </div>
  );
  return (
    <section className="erp-wo-adjustable" aria-label={label}>
      {toolsTarget ? createPortal(layoutTools, toolsTarget) : layoutTools}
      <LayoutOrientation.Provider value={side ? 'side' : 'stack'}>
        <LayoutCollapse.Provider value={collapse}>
          <div
            ref={ref}
            data-left-collapsed={side && collapsible && split.collapsed ? 'true' : undefined}
            className={`erp-wo-adjustable-grid ${side ? 'is-side' : 'is-stacked'} ${className}`}
            style={{ ...split.style, ...height.style }}
          >
            <div
              className="erp-wo-adjustable-first"
              hidden={side && collapsible && split.collapsed}
            >
              {panes[0]}
            </div>
            {side ? (
              <PaneSplitter
                label={`${label} 너비 조절`}
                ratio={split.ratio}
                onChange={split.commit}
                collapse={collapse ?? undefined}
              />
            ) : (
              <PaneHeightSplitter
                label={`${label} 높이 조절`}
                height={height.listHeight}
                /* 위 영역이 이미 다 보이면 그보다 더 늘리지 않는다(사용자 지시 2026-11-27). */
                onChange={(next) => {
                  const first = ref.current?.firstElementChild;
                  const content = Array.from(first?.children ?? []).reduce(
                    (sum, child) => sum + child.getBoundingClientRect().height,
                    0,
                  );
                  height.changeListHeight(content > 0 ? Math.min(next, Math.ceil(content)) : next);
                }}
              />
            )}
            <div className="erp-wo-adjustable-second">{panes[1]}</div>
          </div>
        </LayoutCollapse.Provider>
      </LayoutOrientation.Provider>
    </section>
  );
};
