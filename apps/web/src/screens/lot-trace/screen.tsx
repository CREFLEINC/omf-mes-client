/**
 * W-02-09 LOT 추적
 * 유형: T-W-A 조회형 셋을 화면 안 탭으로 묶었다 — 정방향 추적, 역방향 추적(목록과 사슬 드로어), 입출고 현황(목록).
 *       처음 열면 정방향. 탭과 조건은 주소에 남는다(`tab=`). 탭 하나가 메뉴 한 줄이 아니라 한 권한(W-02-09)이라
 *       셸 탭 묶음(`NavEntry.tabs`, 탭마다 화면 코드)이 아니라 화면이 탭을 그린다.
 * 이탈: C-10, C-16 1280×800에서 LOT 번호(말줄임 없음)가 길어 표의 코드 열과 낮은 우선 열을 드로어와 내려받은 파일에
 *       둔다. C-6 추적 탭의 기간은 조건 더보기 줄에 둔다(세 칸이 한 줄에 들어가지 않음).
 *       C-12 기간 칸의 「시작일부터」 적용은 DS 기간 선택이 지원하지 않아 미구현(W-02-01과 같다).
 */
import { Breadcrumb, PageHeader, Tabs, type TabItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useSearchParams } from 'react-router';

import { MovementsTab } from './movements-tab';
import { readTab, type TraceTab as TabValue } from './trace-filters';
import { TraceTab } from './trace-tab';

const t = messages.lotTrace;

const contentOf = (tab: TabValue) =>
  tab === 'movements' ? <MovementsTab /> : <TraceTab key={tab} direction={tab} />;

export const LotTraceScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readTab(searchParams);
  /* DS Tabs는 패널을 모두 그리고 숨기기만 한다 — 보이지 않는 탭에는 내용을 넣지 않는다(같은 이름 조작이 겹치지 않게). */
  const items: TabItem[] = (['forward', 'backward', 'movements'] as const).map((value) => ({
    value,
    label: t.tabs[value],
    content: value === tab ? contentOf(value) : null,
  }));

  return (
    <>
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
    </>
  );
};
