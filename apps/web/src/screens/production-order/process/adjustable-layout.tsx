import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  PaneLayoutToggle,
  PaneSplitter,
  usePaneSplit,
  type PaneLayout,
} from '../../../patterns/po-board';
import { PaneHeightSplitter, useSplitOrientation } from '../../../patterns/split-orientation';

/** 배치와 비율만 바꾼다. 저장 중인 편집 상태와 선택 대상은 그대로 유지한다. */
export const AdjustableLayout = ({
  storageKey,
  label,
  initial = 'side',
  ratio = 0.5,
  className = '',
  collapsible = false,
  children,
}: {
  storageKey: string;
  label: string;
  initial?: PaneLayout;
  ratio?: number;
  className?: string;
  collapsible?: boolean;
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
  const panes = Children.toArray(children);
  return (
    <section className="erp-wo-adjustable" aria-label={label}>
      <div className="erp-wo-layout-tools" hidden={!fits}>
        <PaneLayoutToggle
          layout={layout}
          labels={{ group: `${label} 배치`, side: '좌우 배치', stack: '상하 배치' }}
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
      <div
        ref={ref}
        data-left-collapsed={side && collapsible && split.collapsed ? 'true' : undefined}
        className={`erp-wo-adjustable-grid ${side ? 'is-side' : 'is-stacked'} ${className}`}
        style={{ ...split.style, ...height.style }}
      >
        <div className="erp-wo-adjustable-first" hidden={side && collapsible && split.collapsed}>
          {panes[0]}
        </div>
        {side ? (
          <PaneSplitter
            label={`${label} 너비 조절`}
            ratio={split.ratio}
            onChange={split.commit}
            collapse={
              collapsible
                ? {
                    collapsed: split.collapsed,
                    onToggle: split.toggleCollapsed,
                    collapseLabel: '목록 접기',
                    expandLabel: '목록 펼치기',
                  }
                : undefined
            }
          />
        ) : (
          <PaneHeightSplitter
            label={`${label} 높이 조절`}
            height={height.listHeight}
            onChange={height.changeListHeight}
          />
        )}
        <div className="erp-wo-adjustable-second">{panes[1]}</div>
      </div>
    </section>
  );
};
