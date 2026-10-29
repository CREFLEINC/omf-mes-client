/**
 * W-02-09 LOT 추적
 * 유형: T-W-A 조회형 셋을 화면 안 탭으로 묶었다. 탭은 무엇으로 찾는지만 고른다 — 자재 LOT, 제품 LOT(목록과 상세),
 *       입출고 현황(목록). 상세는 고른 LOT을 가운데 두고 투입 자재와 사용처, 제품입고, 포장, 출하를 함께 보인다.
 *       처음 열면 자재 LOT. 탭과 조건은 주소에 남는다(`tab=`). 탭 하나가 메뉴 한 줄이 아니라 한 권한(W-02-09)이라
 *       셸 탭 묶음(`NavEntry.tabs`, 탭마다 화면 코드)이 아니라 화면이 탭을 그린다.
 * 이탈: C-10 목록의 품목은 검사 조회·판정 목록처럼 「이름 코드」 한 칸이다(목록 창이 좁아 열을 나누지 않는다).
 *       C-6 추적 탭의 기간은 조건 더보기 줄에 둔다(세 칸이 한 줄에 들어가지 않음).
 *       C-12 기간 칸의 「시작일부터」 적용은 DS 기간 선택이 지원하지 않아 미구현(W-02-01과 같다).
 */
import { Breadcrumb, PageHeader, Tabs, type TabItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useSearchParams } from 'react-router';

import { PermissionMenuContext } from './load-failure';
import { MovementsTab } from './movements-tab';
import { readTab, type TraceTab as TabValue } from './trace-filters';
import { TraceTab } from './trace-tab';

const t = messages.lotTrace;

const contentOf = (tab: TabValue) =>
  tab === 'movements' ? <MovementsTab /> : <TraceTab key={tab} direction={tab} />;

export interface LotTraceScreenProps {
  /** 권한 안내가 가리킬 메뉴 경로. 라우트가 사이드바 자료로 만든다. */
  permissionMenuPath: string | null;
}

export const LotTraceScreen = ({ permissionMenuPath }: LotTraceScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readTab(searchParams);
  /* DS Tabs는 패널을 모두 그리고 숨기기만 한다 — 보이지 않는 탭에는 내용을 넣지 않는다(같은 이름 조작이 겹치지 않게). */
  const items: TabItem[] = (['forward', 'backward', 'movements'] as const).map((value) => ({
    value,
    label: t.tabs[value],
    content: value === tab ? contentOf(value) : null,
  }));

  return (
    <PermissionMenuContext value={permissionMenuPath}>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <Tabs
        className="lot-trace-tabs"
        aria-label={t.tabs.label}
        items={items}
        value={tab}
        onChange={(next) =>
          setSearchParams(
            next === 'forward' ? new URLSearchParams() : new URLSearchParams({ tab: next }),
          )
        }
      />
    </PermissionMenuContext>
  );
};
