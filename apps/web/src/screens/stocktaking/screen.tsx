import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import {
  isCountTypeListPending,
  isVarianceReasonListPending,
  PLACEHOLDER_STOCKTAKING_CODES,
  toCodeOptionSets,
} from './code-options';
import { CountFilterBar } from './count-filter-bar';
import { CountLineTable } from './count-line-table';
import { CountTable } from './count-table';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedCountId,
  readSelectedLocationId,
  SELECTION_KEYS,
  toFilterQuery,
  toSearchParams,
  type ChipFilterKey,
  type CountFilters,
} from './filters';
import { HistoryPane } from './history-pane';
import {
  EMPTY_LINE_DRAFTS,
  hasAnyLineDraftValue,
  setDraftQty,
  setDraftReason,
  type LineDrafts,
} from './line-draft';
import {
  isLinesTruncated,
  replaceBlockReason,
  toLineReplace,
  toLineRows,
} from './line-replace-request';
import { LoadErrorBanner } from './load-error-banner';
import { LocationField } from './location-field';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemLookup,
  useLocationLookup,
  useLotLookup,
  useUomLookup,
  useWarehouseLookup,
  type LookupResult,
} from './lookups';
import { OpenConfirmDialog } from './open-confirm-dialog';
import { OpenForm } from './open-form';
import { EMPTY_OPEN_DRAFT, hasAnyOpenDraftValue, toCountCreate, type OpenDraft } from './open-request';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  isCountNotFound,
  useInventoryCountDetail,
  useInventoryCountLineReplace,
  useInventoryCountLines,
  useInventoryCountOpen,
  useInventoryCounts,
} from './queries';
import { ResultPane } from './result-pane';
import { SummaryPane } from './summary-pane';
import {
  describeBlindCount,
  type CountLineView,
  type CountView,
  type ResultView,
  type SelectOption,
} from './types';
import { openBlockReason, OPEN_FIELD_NAMES, validateOpenDraft } from './validation';

const t = messages.stocktaking;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: CountView[] = [];

/** 같은 이유로 라인도 고정 참조를 쓴다 — 이 배열이 참조 조회의 입력이 된다. */
const EMPTY_LINES: CountLineView[] = [];

/** 어느 초안을 버리려는가. `null`이면 파기 확인 창이 닫혀 있다. */
type DiscardTarget = 'open' | 'lines';

/** 같은 이유로 오류 없음도 고정 참조를 쓴다. */
const NO_FIELD_ERRORS: Record<string, string> = {};

/**
 * 결과 구획에 보이는 것과, 그것이 **어느 실사·어느 위치에 대한 것인가**.
 *
 * 번호는 화면에 나오지 않는다(#44) — 결과가 지금 보는 대상의 것인지 가리는 데만 쓴다.
 * 이 짝이 없으면 대상이 바뀐 뒤에도 앞 결과가 남아, 사용자는 방금 고른 실사가 방금 개시된
 * 것이라고 읽는다.
 *
 * **축이 둘인 것이 PR ③에서 실물이 됐다**(수명 표 5행 — 위치를 바꾸면 결과 구획을 비운다).
 * PR ②에는 `loc`가 없어 실사 하나로 충분했는데, 위치가 생기자 **같은 실사 안에서 위치만
 * 옮기는 조작**이 가능해졌다 — 축을 늘리지 않으면 앞 위치의 저장 결과가 새 위치의 라인 표
 * 아래에 그대로 서 있다.
 *
 * 개시 결과는 `locationId`가 `null`이다 — 개시 성공이 `loc`를 비우므로(11행) 짝이 맞는다.
 */
interface ResultState {
  inventoryCountId: number | null;
  locationId: number | null;
  view: ResultView;
}

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 창고를 대상으로 한 과거 실사의 이름을 풀기 위해서인데, 그 실사들을 **조건으로
 * 찾으려면** 선택지에도 있어야 한다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-04 컨테이너 — **단계가 있는 전표 화면**이다.
 *
 * 배치는 상하로 쌓는다 — 위: 조건 줄과 실사 목록 / 아래: 고른 실사의 제목줄과 요약 4칸.
 * 조회 조건과 고른 실사·위치는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **이 PR까지 개시(②)와 결과 등록(③)이 섰고 마감(④)이 남았다.** 그때까지 **라우트·사이드바에
 * 등록하지 않는다**(정책 §5.2 — 접근 불가능한 경계): 실사를 마감할 수 없는 「재고실사」 화면을
 * 노출하면 마감 없는 전표가 쌓인다.
 *
 * ---
 *
 * **단계 전이 표**(계획 결정 2 — 이 화면의 중심 결정).
 *
 * **화면이 단계를 `statusCode` 값으로 판정하지 않는다.** 값 목록이 확정되지 않았고
 * (`omf-mes#64`) 공유계약 G-2가 값 분기를 금지한다. 계약도 그렇게 적었다 —
 * 「화면은 서버가 내려주는 값을 그대로 표시하고 값 자체로 분기하지 않는다」.
 * 그래서 단계는 **화면이 스스로 아는 것**으로만 가른다.
 *
 * | 단계 | 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 | PR |
 * | :-: | --- | --- | --- | --- | :-: |
 * | **S0** 고르기 전 | `ct`가 없다 | 조건 줄 · 실사 목록 · 쪽 이동 (+개시 구획) | 조회 · 초기화 · 쪽 이동 · 실사 고르기 (+개시) | `?wh&from&to&ty&st&prog&page` | ① (+②) |
 * | **S1** 실사를 골랐다 | `ct`가 있고 **상세가 200** | 위 + 제목줄 · **요약 4칸** · 위치 선택칸 · 이력 구획(비활성) (+마감) | 위 + 다시 조회 · 위치 고르기 (+마감) | `+&ct` | ①③ (+④) |
 * | **S2** 위치를 골랐다 | `ct`·`loc`가 있고 라인이 도착했다 | 위 + **라인 표(실물 수량·차이 사유 입력)** · 치환 안내 | 위 + 실물·사유 입력 · **이 위치 실사 완료** · 취소 | `+&loc` | ③ |
 * | **S3** 이번 세션에서 마감했다 | **이 화면의 마감 성공 결과** | 위 + 마감 결과 | **조회만** | `ct` 유지 | ④ |
 * | **S4** 그 실사가 없다 | **상세가 404** | 안내 「고른 실사를 찾을 수 없습니다」 | 다시 고르기 | `ct`·`loc` 제거 | ① |
 *
 * **화면이 모르는 것을 밝힌다.** 세션 밖에서 **이미 마감된 실사**를 골라도 화면은 S1로 보인다.
 * 저장·마감을 시도하면 서버가 400 STATE_LOCKED로 되돌리고 `SaveErrorBanner`가 서버가 준 사유와
 * 함께 낸다. 화면이 상태 값을 읽어 미리 막는 것보다 이 편이 옳다 — 값 목록이 확정되면 그때
 * 막아도 늦지 않고, 지금 막으면 **값이 정해질 때 조용히 틀린다.**
 *
 * **S1의 근거를 목록 소속이 아니라 상세 200으로 두는 이유**: `ct`는 경로 조각이라 목록과
 * 무관하게 상세를 부를 수 있다. 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 실사를 고른
 * 상태가 지워진다** — 특히 개시 직후(PR ②)에 새 실사가 지금 조건에 안 걸리면 방금 만든 것이
 * 즉시 사라진다.
 *
 * **디자인 시스템의 `Stepper`를 쓰지 않는다.** 설치본에 실재하고(`a554d11`) 이 화면은 3단계
 * 전표라 가장 먼저 손이 가는 부품이지만, 그리려면 **셋째 단계(마감)의 완료를 화면이 알아야
 * 하는데 알 수 없다** — `statusCode` 값으로 분기할 수 없고(G-2) 세션 밖에서 마감된 것은
 * 이 화면에 아무 흔적도 남기지 않는다. 부분만 참인 진행 표시는 「아직 마감되지 않았다」는
 * **잘못된 확신**을 준다. 단계는 요약 4칸과 액션의 사유 문구가 말한다.
 * 단계 개념이 실제로 커지는 PR ②~④에서 이 판단이 다시 흔들릴 자리라 여기 적어 둔다.
 */
export const StocktakingScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /** 두 액션의 비활성 사유를 각 버튼에 잇는 id(배치 규범 4). 한 뿌리에서 갈라 쓴다. */
  const reasonIdRoot = useId();
  const openReasonId = `${reasonIdRoot}-open-reason`;
  const saveReasonId = `${reasonIdRoot}-save-reason`;

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표**(계획 결정 3).
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * **표는 화면 전체(PR ①~④)의 것이고, ★ 열이 이 PR까지 실물로 있는 상태다.**
   * 남은 열(마감 플래그)은 PR ④에서 생기며, 그때 이 표에 행을 더하지 않아도 되도록 지금 함께
   * 적어 둔다. **열아홉째 조작이 생기면 행을 먼저 더하고, 열이 생겨도 마찬가지다** —
   * 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다.
   *
   * | # | 조작 | 조건 6종★ | `page`★ | `ct`★ | `loc`★ | **404 안내★** | 개시 초안★ | **라인 초안★** | 결과 구획★ | 열린 창★ | **서버 실패★** | 마감 플래그 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | **비운다** | 유지 | **비운다** | 비운다 | **닫는다** | 유지 | **비운다** |
   * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | 비운다 | **비운다** | 유지 | 비운다 | 비운다 | **닫는다** | 유지 | 비운다 |
   * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **비운다** | **비운다** | 유지 | **비운다** | 비운다 | **닫는다** | 유지 | 비운다 |
   * | 4 | 실사 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | **비운다** | **비운다** | 유지 | **비운다** | 비운다 | **닫는다** | 유지 | **비운다** |
   * | 5 | 위치 고르기·해제 | 유지 | 유지 | 유지 | 넣고 뺀다 | 유지 | 유지 | **비운다** | 비운다 | **닫는다** | 유지 | 유지 |
   * | 6 | **상세가 404** | 유지 | 유지 | **비운다** | **비운다** | **세운다** | 유지 | 비운다 | 비운다 | **닫는다** | 유지 | 비운다 |
   * | 7 | 개시 초안 입력 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | **유지** | 유지 | **그 칸만 거둔다** | 유지 |
   * | 8 | 라인 초안 입력 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **유지** | 유지 | 유지 | 유지 |
   * | 9 | 목록·상세·라인·참조 응답 도착 | 유지 | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** | 유지 | 유지 | 유지 | 유지 |
   * | 10 | **다시 조회**(새로고침) | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | 유지 | 유지 |
   * | 11 | **개시 성공** | 유지 | 유지 | **새 실사로** | **비운다** | 비운다 | **비운다** | 비운다 | **채운다** | 닫혀 있다 | **비운다** | 비운다 |
   * | 12 | 개시 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 비운다 | 닫혀 있다 | **세운다** | 유지 |
   * | 13 | **위치 저장 성공** | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **비운다** | **채운다** | 닫혀 있다 | 비운다 | 유지 |
   * | 14 | 위치 저장 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 비운다 | 닫혀 있다 | 세운다 | 유지 |
   * | 15 | **마감 성공** | 유지 | 유지 | **유지** | **비운다** | 유지 | 유지 | **비운다** | **채운다** | 닫혀 있다 | 비운다 | **세운다** |
   * | 16 | 마감 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 비운다 | 닫혀 있다 | 세운다 | 유지 |
   * | 17 | 취소(초안 파기) | 유지 | 유지 | 유지 | 유지 | 유지 | **비운다** | **비운다** | 비운다 | **닫는다** | **비운다** | 유지 |
   * | 18 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 잠긴다 | 잠긴다 | 유지 | 유지 | 유지 | 유지 |
   *
   * **왜 이렇게 정했는가**(이 PR에 실물이 있는 것만)
   *
   * - **1~3행이 `ct`·`loc`를 비우는 이유**: 조건·쪽이 바뀌면 고른 실사가 새 결과에 없을 수
   *   있다. 규칙의 실물은 `toSearchParams`가 **`ct`·`loc`를 만들지 않는 것**이다 — 세 조작이
   *   전부 그 함수로 주소를 다시 짓는다(계획 결정 3의 구현 규칙 1).
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **6행이 클릭 핸들러가 아닌 이유**: 뒤로가기·앞으로가기·주소 직접 편집은 핸들러를 거치지
   *   않고 `ct`만 바꾼다 — 핸들러에 두면 그 경로가 통째로 샌다. **고른 실사와 상세 응답에 묶인
   *   effect 한 곳**이 한다.
   * - **6행의 「404 안내」가 열인 이유**: 주소에서 `ct`를 지우고 나면 화면은 「고른 것이 없다」와
   *   구분할 수 없게 된다 — 무엇이 왜 사라졌는지 말할 근거가 이 상태뿐이다. 계획의 표에는
   *   없던 열이라 **여기에 더해 규칙이 닿게 한다.**
   * - **10행이 목록만이 아니라 상세도 함께 부르는 이유**: W-01-07의 Major 지적 그대로다 —
   *   목록만 다시 부르면 **갱신된 값과 갱신되지 않은 값이 한 화면에 섞인다.** 요약 4칸이 낡은
   *   채로 마감 버튼의 활성 여부를 정하면 그 판단 자체가 낡는다(PR ④).
   * - **1~5행이 개시 초안을 유지하는 이유**: 개시 초안이 가리키는 것은 **만들 실사**이지 위에서
   *   고른 실사가 아니다. 조건을 좁혀 창고를 찾아본 뒤 그 창고로 개시하는 것이 정상 경로라,
   *   목록을 만지는 동안 입력이 사라지면 그 경로가 막힌다. **비우는 것은 취소(17행)와
   *   성공(11행) 둘뿐이고, 취소는 확인 창을 먼저 거친다.**
   * - **1~6·17행이 열린 창을 닫는 이유**: W-01-10 리뷰 R-1이 실증한 자리다 — 확인 창이 열린 채
   *   대상이 바뀌면 **사용자가 확인한 것과 나가는 것이 갈린다.** 뒤로가기·앞으로가기·주소 직접
   *   편집은 클릭 핸들러를 거치지 않으므로, 창 닫기는 **주소에 묶인 effect**가 한다.
   *   그 위에 **보내는 자리가 스스로 한 번 더 본다**(`submitOpen`) — 두 겹이라 한쪽이 뚫려도
   *   다른 쪽이 막는다.
   * - **1~6행이 결과 구획을 비우는 이유**: 결과는 「방금 이 실사를 개시했다」이지 「이 실사가
   *   개시된 것이다」가 아니다. 대상이 바뀌었는데 남으면 사용자는 방금 고른 실사를 방금 만든
   *   것으로 읽는다. 규칙의 실물은 **결과가 자기 실사 번호를 들고 있고, 주소의 `ct`와 어긋나면
   *   스스로 사라지는 것**이다 — 여섯 조작이 전부 `ct`를 바꾸므로 한 자리가 여섯을 덮는다.
   * - **11행이 결과를 남기면서도 그 규칙에 걸리지 않는 이유**: 개시 성공은 `ct`를 **그 결과의
   *   실사로** 옮긴다. 번호가 맞으므로 남고, 다른 어떤 조작에도 어긋나 사라진다.
   * - **7~10행이 개시 초안을 건드리지 않는 이유**: 이 화면의 #43 자리다. 개시 초안에는
   *   **되돌림 effect가 아예 없다** — 목록·상세·참조 응답이 도착해도 반응할 자리가 없으므로
   *   「치던 값이 사라진다」가 구조적으로 생기지 않는다. 「다시 조회」도 값을 버리려고 누르는
   *   것이 아니다.
   * - **9·10행이 라인 초안을 건드리지 않는 이유는 같은 자리의 더 아픈 형태다**(감지기 M35).
   *   라인 초안은 줄마다 칸이 둘이고 한 위치에 수십 줄이 있어, 한 번 사라지면 다시 치는 비용이
   *   개시 초안과 비교되지 않는다. 되돌림 effect의 의존성은 **`loc` 하나뿐**이며
   *   `useMemo` 파생 객체·라인 응답 배열을 넣지 않는다. 라인 응답으로 초안 키를 미리 깔지
   *   않는 것(`line-draft.ts`)이 그 축을 하나로 **묶어 두는** 구조다 — 키를 깔면 「응답이
   *   도착했다」가 초안을 만드는 사건이 되어 의존성이 늘 수밖에 없다.
   * - **1~5행이 라인 초안을 비우는 이유**: 다섯 조작이 전부 `loc`를 바꾸거나 비운다. 초안은
   *   **그 위치의 그 줄들**에 묶인 값이라 대상이 바뀌면 뜻을 잃는다 — 남으면 다른 위치의
   *   같은 순번 줄에 앞 위치의 수량이 실린다.
   * - **12행이 초안을 비우지 않는 이유**: 실패했는데 입력을 지우면 처음부터 다시 친다.
   * - **13행이 라인 초안을 비우고 `loc`를 유지하는 이유**: 저장한 값은 서버가 들고 있고
   *   화면은 그것을 다시 읽는다 — 초안이 남으면 **저장된 값 위에 같은 글자가 겹쳐** 무엇이
   *   저장된 것인지 알 수 없다. `loc`는 유지해야 방금 무엇을 저장했는지 화면에 남는다.
   * - **18행이 대상을 바꾸는 길까지 잠그는 이유**(W-01-03이 세운 규칙): 열어 두면 사용자가 다른
   *   실사·조건·쪽으로 옮긴 뒤 **앞 요청의 결과가 지금 보는 맥락에 나타난다.** 눈에 보이는
   *   컨트롤을 잠그는 것과 별도로 핸들러가 한 번 더 막는다 — 조건 칩의 ×처럼 디자인 시스템이
   *   잠금을 받지 않는 자리가 남기 때문이다.
   * - **18행이 「다시 조회」를 잠그지 않는 이유**: 그것은 **대상을 바꾸지 않는 조작**이다.
   *   조건·쪽·고른 실사를 하나도 건드리지 않고 보고 있던 것을 다시 받을 뿐이라, 보내는 중에
   *   눌러도 앞 요청의 결과가 다른 맥락에 놓일 길이 없다. 표가 규칙의 정본이므로 **잠기지
   *   않는 것도 여기 적어 둔다** — 적지 않으면 다음 사람이 빠뜨린 것으로 읽는다.
   *
   * **「서버 실패」 열이 무엇인가**(`open.error`·`open.fieldErrors` — 공통 쓰기 훅이 들고 있다).
   *
   * - **왜 열로 올리는가**: 이 PR이 새로 들인 일시 상태는 넷인데(개시 초안·결과 구획·창 둘)
   *   **서버가 준 실패도 그중 하나**다. 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다 —
   *   계획 결정 3이 세운 자리이고 W-01-10 R-1이 창으로 실증한 형태와 같다.
   * - **7행이 「그 칸만 거둔다」인 이유**: 고친 칸의 오류만 사라져야 한다. 통째로 지우면 아직
   *   고치지 않은 칸의 오류까지 없어져 **무엇이 남았는지** 화면이 말하지 못하고, 하나도 안
   *   지우면 이미 고친 값 옆에 붉은 글씨가 선다(`changeDraft`가 `clearFieldError`를 부른다).
   * - **11행이 비우는 이유**: 성공은 앞 실패를 물린다. 공통 쓰기 훅이 `write()` 첫머리에서
   *   이미 거두므로 화면이 따로 지우지 않는다.
   * - **12행이 세우는 이유**: 갈래를 갈라 내는 것이 이 열의 목적이다 — 배너(화면이 모르는
   *   필드·권한·네트워크)와 인라인(화면이 아는 칸)이 **같은 응답에서 갈려** 각자의 자리로 간다.
   * - **17행이 비우는 이유**: 「버린다」는 앞서 한 시도를 통째로 물리는 것이라 배너와 필드
   *   오류가 함께 사라져야 한다(`open.reset()`). 남으면 무엇이 지금 상태인지 알 수 없다.
   * - **1~6행이 유지인 이유**: 실패는 **그 초안에 대한 사실**이고 초안은 대상이 바뀌어도
   *   살아남는다(1~5행) — 초안은 남는데 그 초안이 왜 거절됐는지만 사라지면 사용자는 같은 값을
   *   그대로 다시 보낸다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<CountFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedCountId = readSelectedCountId(searchParams);
  const selectedLocationId = readSelectedLocationId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 진행 중인 실사가 보여야 무엇을 고를 수
   * 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   *
   * **기본 기간을 심지 않는다** — 첫 요청에 날짜 조건이 실리지 않는다(계획 결정 3).
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useInventoryCounts(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  const warehouses = useWarehouseLookup();

  /*
   * **고른 실사의 상세.** 이 응답이 단계 판정의 근거다(단계 전이 표) — 목록에 그 실사가
   * 있는지로 판정하지 않는다.
   */
  const detail = useInventoryCountDetail(selectedCountId);
  const isDetailNotFound = detail.isError && isCountNotFound(detail.error);

  /*
   * **위치는 실사의 창고를 알아야 부를 수 있다**(계약이 `warehouseId`를 필수 쿼리로 요구한다).
   * 상세가 도착하기 전에는 조회가 성립하지 않으므로 부르지 않는다 — 성립하지 않는 조회를
   * 내보내면 스켈레톤에 갇힌다(W-01-07 Minor).
   */
  const locations = useLocationLookup(detail.data?.count.warehouseId ?? null);

  /*
   * **실사와 위치가 둘 다 있어야 라인이 성립한다**(완료 조건 C31 · 감지기 M33).
   * 좁히는 조건을 만들지 않았으므로 이 응답의 줄이 곧 **그 위치의 전 줄**이다.
   */
  const lines = useInventoryCountLines(selectedCountId, selectedLocationId);
  const lineItems = lines.data?.items ?? EMPTY_LINES;

  /**
   * 이 실사가 블라인드인가 — **열 구성과 사유 규칙이 함께 읽는 하나의 축**이다(리뷰 R-1).
   *
   * **실사 헤더가 정한다.** 줄마다 `systemQty`가 왔는지로 판정하면 두 가지가 갈린다:
   * ①한 줄만 빠진 어긋난 응답에서 **열이 나타났다 사라지고**(M-10) ②계약을 그대로 따르는
   * 서버가 블라인드에서도 값을 보낼 때 **열은 감춰 놓고 전 줄에 사유를 요구한다**(R-1).
   * 계약에서 `systemQty`는 **필수**이고 「블라인드에서는 내려보내지 않는다」는 설명문뿐이라
   * (결정 4 · 어긋남 1) 두 판정은 언제든 갈릴 수 있다.
   *
   * 상세가 오기 전에는 라인 구획 자체가 그려지지 않는다(`detailPane`이 `detail.data`를 먼저
   * 본다) — 이 값이 거짓으로 읽히는 동안 화면에 보이는 것이 없다.
   */
  const isBlindCount = detail.data?.count.blindCount ?? false;

  /* 위치를 고르기 전에는 라인 표가 없다 — 그 표가 쓰는 참조 셋도 부르지 않는다. */
  const hasLocation = selectedLocationId !== null;
  const items = useItemLookup(hasLocation);
  const uoms = useUomLookup(hasLocation);
  const lots = useLotLookup(
    lineItems.flatMap((line) => (line.lotId === null ? [] : [line.itemId])),
    hasLocation,
  );

  /**
   * 방금 고른 실사가 **없었다**는 사실(수명 표 6행의 「404 안내」 열).
   *
   * 주소에서 `ct`를 지우고 나면 화면은 그 사정을 말할 근거를 잃는다 — 「아직 고르지 않았다」와
   * 글자가 같아지므로 사용자는 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  const [hasNotFoundNotice, setHasNotFoundNotice] = useState(false);

  /**
   * 개시 입력. **주소에 싣지 않는다**(계획 결정 3) — 글자마다 뒤로가기 기록이 쌓이고,
   * 화면이 조회 조건과 입력을 같은 통로로 다루게 된다.
   *
   * **되돌림 effect를 두지 않는다.** 이 값은 목록·상세·참조 응답 어느 것에도 반응하지 않는다 —
   * 반응할 자리가 없어야 「치던 값이 사라진다」(#43)가 구조적으로 생기지 않는다(수명 표 7~10행).
   */
  const [openDraft, setOpenDraft] = useState<OpenDraft>(EMPTY_OPEN_DRAFT);

  /**
   * 라인 입력. **주소에 싣지 않는다** — 줄마다 칸이 둘이라 주소가 통째로 초안이 된다.
   *
   * **성기다**(`line-draft.ts`) — 치지 않은 줄은 키가 없다. 그래서 라인 응답이 도착해도
   * 초안을 만들 일이 없고, 되돌림 축이 **고른 위치 하나**로 남는다(#43 · 감지기 M35).
   */
  const [lineDrafts, setLineDrafts] = useState<LineDrafts>(EMPTY_LINE_DRAFTS);

  /**
   * 보내기 전에 화면이 잡은 오류. **「실사 개시」를 누른 뒤에만 세운다** — 치는 도중에 붉은
   * 글씨를 띄우면 아직 넣지도 않은 칸이 잘못된 것처럼 보인다.
   */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);

  /** 쓰기 결과와 그 대상(수명 표 「결과 구획」 열). `null`이면 아직 아무것도 만들지 않았다. */
  const [result, setResult] = useState<ResultState | null>(null);

  /**
   * **지금 주소가 가리키는 대상.** 늦게 도착한 응답이 「보내던 그 대상이 아직 그대로인가」를
   * 물을 수 있어야 한다 — 콜백이 붙든 클로저 값은 보낸 시점에 얼어 있어 스스로와 견줄 수 없다.
   *
   * 커밋 뒤에 갱신한다(렌더 중에 쓰지 않는다) — 응답은 커밋이 끝난 뒤에 오므로 늦지 않다.
   */
  const selectionRef = useRef({ countId: selectedCountId, locationId: selectedLocationId });

  useEffect(() => {
    selectionRef.current = { countId: selectedCountId, locationId: selectedLocationId };
  }, [selectedCountId, selectedLocationId]);

  /** 개시 확인 창이 열려 있는가. **확인하기 전에는 요청이 나가지 않는다**(완료 조건 C23). */
  const [isOpenConfirmVisible, setOpenConfirmVisible] = useState(false);

  /**
   * 초안 파기 확인 창이 **어느 초안**을 두고 열려 있는가. `null`이면 닫혀 있다.
   *
   * **초안이 둘인데 창은 하나다**(계획 결정 15). 창을 둘 두면 둘이 동시에 열리는 상태가
   * 생기고, 열림 여부를 불리언 둘로 들고 있으면 「어느 것을 버리는 창인가」가 확인 버튼의
   * 핸들러에만 남아 화면이 그것을 말하지 못한다 — 대상을 상태에 담아 그 자리를 없앤다.
   */
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget | null>(null);

  const open = useInventoryCountOpen({
    onSuccess: (opened) => {
      /*
       * **`ct`를 새 실사로 옮긴다**(수명 표 11행). 조건·쪽은 그대로 두고 `loc`만 빠진다 —
       * `toSearchParams`가 `ct`·`loc`를 만들지 않으므로 여기서 `ct`만 덧붙이면 된다.
       *
       * **목록 소속으로 판정하지 않는 설계가 여기서 값을 한다**(계획 결정 2): 방금 만든 실사가
       * 지금 조건에 걸리지 않아 목록에 없어도, 상세가 200이면 아래 구획이 그대로 열린다.
       */
      const next = toSearchParams(filters, page);
      next.set(SELECTION_KEYS.count, String(opened.count.inventoryCountId));

      setSearchParams(next);

      /*
       * 결과는 **자기 실사 번호를 함께 들고 있다.** 방금 옮긴 `ct`와 번호가 맞아 남고,
       * 다른 조작으로 대상이 바뀌면 스스로 사라진다.
       *
       * `ct`를 옮기는 것과 이 결과를 세우는 것의 차례는 뜻을 바꾸지 않는다 — 결과 정리
       * effect는 `selectedCountId`가 **바뀔 때만** 돌고, 그 시점에는 이미 둘 다 새 실사를
       * 가리킨다.
       */
      setResult({
        inventoryCountId: opened.count.inventoryCountId,
        /* 개시 성공은 `loc`를 비운다(수명 표 11행) — 짝이 맞아야 결과가 남는다. */
        locationId: null,
        view: { kind: 'opened', countNo: opened.count.inventoryCountNo },
      });

      /*
       * **초안을 비운다**(수명 표 11행 · 중복 전송 완화의 한 층). 남겨 두면 같은 값으로 한 번
       * 더 보낼 수 있는데, 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어 서버는 그것을 재전송으로
       * 보지 못한다 — 되돌릴 수 없는 전표가 두 벌 생긴다.
       */
      setOpenDraft(EMPTY_OPEN_DRAFT);
      setLocalFieldErrors(NO_FIELD_ERRORS);
    },
  });

  /**
   * 위치를 고른 라벨. **결과 구획이 번호가 아니라 이름을 받는다**(#44) —
   * 저장 성공 시점에 풀어 담아 두면 그 뒤 참조가 다시 오더라도 결과 문구가 흔들리지 않는다.
   */
  const locationLabel = describeReference(toReference(locations, selectedLocationId));

  const replace = useInventoryCountLineReplace({
    inventoryCountId: selectedCountId,
    onSuccess: (saved) => {
      /*
       * **초안을 비운다**(수명 표 13행). 저장한 값은 서버가 들고 있고 화면이 다시 읽으므로,
       * 초안이 남으면 저장된 값 위에 같은 글자가 겹쳐 무엇이 저장된 것인지 알 수 없다.
       */
      setLineDrafts(EMPTY_LINE_DRAFTS);

      /*
       * **보내던 사이에 대상이 바뀌었으면 결과를 세우지 않는다**(수명 표 5행 · 리뷰 R-4).
       *
       * 전송 중 잠금은 컨트롤과 핸들러 두 겹인데 **뒤로가기·앞으로가기·주소 직접 편집은 그 둘을
       * 다 거치지 않는다**(W-01-10 R-1이 확인 창으로 실증한 형태). 그 길로 위치가 바뀌면 이
       * 콜백은 **클릭 시점 클로저의 옛 대상**을 들고 있어, 그대로 세우면 「위치를 고르면 라인이
       * 보입니다」 빈 상태 아래에 **앞 위치의 저장 결과**가 선다.
       *
       * 지금 대상은 렌더가 아니라 **ref**로 읽는다 — 클로저 값은 보낸 시점에 얼어 있어
       * 스스로와 견줄 수 없다.
       */
      const now = selectionRef.current;

      if (now.countId !== selectedCountId || now.locationId !== selectedLocationId) return;

      setResult({
        inventoryCountId: selectedCountId,
        /* `loc`는 유지된다(13행) — 방금 무엇을 저장했는지 화면에 남아야 결과를 읽는다. */
        locationId: selectedLocationId,
        view: {
          kind: 'saved',
          locationLabel,
          /* **서버가 되돌려 준 배열의 길이다** — 화면이 보낸 줄 수가 아니다. */
          replacedLineCount: saved.items.length,
        },
      });
    },
  });

  /**
   * 보내는 중인가. **대상을 바꾸는 길을 전부 닫는다**(수명 표 18행 · 중복 전송 완화의 한 층) —
   * 조건 줄·목록 선택·쪽 이동·**위치 선택**·개시 입력·**표 안 두 칸**·버튼들이 함께 잠긴다.
   *
   * **쓰기 둘을 한 값으로 묶는다.** 어느 쪽이 나가는 중이든 대상이 바뀌면 안 되는 것은 같고,
   * 갈라 두면 「개시 중에는 위치를 바꿀 수 있다」 같은 반쪽 상태가 생긴다.
   */
  const isLocked = open.isSaving || replace.isSaving;

  /*
   * **주소가 바뀌면 열린 창을 닫는다**(수명 표 1~6행 · W-01-10 리뷰 R-1).
   *
   * 확인 창은 「지금 이 값으로 개시한다」는 확인이다. 그 사이에 대상이 바뀌면 사용자가 확인한
   * 것과 실제로 일어나는 것이 갈린다. **클릭 핸들러에 두면 뒤로가기·앞으로가기·주소 직접
   * 편집이 통째로 샌다** — 그 셋은 핸들러를 거치지 않고 검색 파라미터만 바꾼다.
   *
   * 조건·쪽·고른 실사 어느 것이 바뀌어도 걸리도록 **주소 전체**에 묶는다. `searchParams`는
   * 주소가 바뀔 때만 새 참조라(react-router) 렌더마다 창이 닫히지 않는다.
   */
  useEffect(() => {
    setOpenConfirmVisible(false);
    setDiscardTarget(null);
  }, [searchParams]);

  /*
   * **위치가 바뀌면 라인 초안을 비운다**(수명 표 1~5행 · #43의 이 화면 형태).
   *
   * **의존성이 `loc` 하나뿐인 것이 이 effect의 전부다**(감지기 M35). 라인 응답이나 그것에서
   * 파생한 객체를 넣으면 **응답이 도착할 때마다 치던 값이 사라진다** — 「다시 조회」는 값을
   * 버리려고 누르는 것이 아니고(10행), 저장 실패 뒤 목록이 갱신되는 것도 마찬가지다.
   *
   * 조건 변경·초기화·쪽 이동·실사 고르기·404 정리가 **전부 `loc`를 비우므로** 이 한 자리가
   * 다섯 조작을 덮는다. 줄 집합이 바뀌어 없어진 줄의 초안은 여기서가 아니라 **요청 조립에서
   * 교차로 걸러진다**(`line-replace-request.ts` · 감지기 M46) — 그래야 축이 하나로 남는다.
   */
  useEffect(() => {
    setLineDrafts(EMPTY_LINE_DRAFTS);
  }, [selectedLocationId]);

  /*
   * **결과가 자기 실사에서 떨어지면 스스로 사라진다**(수명 표 1~6행).
   *
   * 「방금 개시했다」는 그 실사에 매인 사실이다 — 대상이 바뀌었는데 남으면 사용자는 방금 고른
   * 실사를 방금 만든 것으로 읽는다. 조건 변경·초기화·쪽 이동·실사 고르기/해제·404 정리가
   * **전부 `ct`를 바꾸므로** 이 한 자리가 여섯 조작을 덮는다.
   *
   * 개시 성공(11행)은 `ct`를 그 결과의 실사로 옮기고 `loc`를 비우므로 두 축이 다 맞아 남는다.
   * 저장 성공(13행)은 둘 다 그대로 두므로 이 effect가 아예 다시 돌지 않는다.
   *
   * **축이 둘인 것이 PR ③에서 실물이 됐다**(PR ② 주석이 예고한 자리). 수명 표 5행(위치
   * 고르기·해제)도 결과 구획을 비우는데, `loc`가 생기기 전에는 그 조작 자체가 없었다 —
   * 축을 늘리지 않으면 **같은 실사 안에서 위치만 옮겼을 때** 앞 위치의 저장 결과가 새 위치의
   * 라인 표 아래에 그대로 서 있다.
   *
   * **늦게 도착한 결과는 이 effect가 잡지 못한다**(리뷰 R-4). 전송 중에 주소가 바뀌면
   * ①이 effect는 그때 이미 돌았고(그 시점 `result`는 `null`이다 — `submitSave`가 비웠다)
   * ②응답이 뒤에 도착해 `onSuccess`가 결과를 세우며 ③의존성이 그대로라 다시 돌지 않는다.
   * 그 갈래는 **세우는 자리**(`replace`의 `onSuccess`)가 보낸 대상과 지금 대상을 대조해 막는다 —
   * 여기에 `result`를 의존성으로 더하면 **개시 성공이 함께 걸린다**: 개시는 주소를 새 실사로
   * 옮기는데, 옮김이 적용되기 전 렌더에서 결과만 먼저 서면 짝이 어긋난 것으로 보여 지워진다.
   */
  useEffect(() => {
    setResult((current) => {
      if (current === null) return current;

      const isSameTarget =
        current.inventoryCountId === selectedCountId && current.locationId === selectedLocationId;

      return isSameTarget ? current : null;
    });
  }, [selectedCountId, selectedLocationId]);

  /*
   * **상세가 404면 고른 실사를 주소에서 정리한다**(수명 표 6행).
   *
   * **클릭 핸들러가 아니라 고른 식별자와 상세 응답에 묶는다.** 뒤로가기·앞으로가기·주소 직접
   * 편집은 핸들러를 거치지 않고 `ct`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * replace로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다 — 늘리면 뒤로 눌렀을 때 없는 실사를
   * 가리키는 주소로 되돌아가 같은 정리가 되풀이된다.
   */
  useEffect(() => {
    if (selectedCountId === null) return;
    if (!isDetailNotFound) return;

    setHasNotFoundNotice(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(SELECTION_KEYS.count);
        next.delete(SELECTION_KEYS.location);

        return next;
      },
      { replace: true },
    );
  }, [selectedCountId, isDetailNotFound, setSearchParams]);

  /*
   * 다시 고르면 앞의 안내를 거둔다 — 남으면 새로 고른 실사의 요약 옆에 「찾을 수 없습니다」가
   * 함께 서 있게 된다. **고른 식별자가 생기는 순간에만** 반응한다.
   */
  useEffect(() => {
    if (selectedCountId !== null) setHasNotFoundNotice(false);
  }, [selectedCountId]);

  /**
   * 조작을 실제로 수행한다. **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면
   * 뒤로가기 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * `toSearchParams`가 `ct`·`loc`를 만들지 않으므로 조건·쪽이 바뀌면 고른 실사와 위치가
   * 함께 풀린다(수명 표 1~3행).
   */
  const applyQuery = (nextFilters: CountFilters, nextPage = 1): void => {
    if (isLocked) return;

    setHasNotFoundNotice(false);
    setSearchParams(toSearchParams(nextFilters, nextPage));
  };

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행) — 쪽을 그대로 둔다. */
  const toggleSelectCount = (inventoryCountId: number): void => {
    if (isLocked) return;

    const next = toSearchParams(filters, page);

    if (inventoryCountId !== selectedCountId) {
      next.set(SELECTION_KEYS.count, String(inventoryCountId));
    }

    setHasNotFoundNotice(false);
    setSearchParams(next);
  };

  /**
   * 위치를 고르거나 푼다(수명 표 5행). **고른 실사는 그대로 둔다** — 같은 실사 안에서
   * 위치만 옮기는 것이 이 화면의 정상 경로다.
   *
   * `toSearchParams`가 `ct`·`loc`를 만들지 않으므로 둘 다 여기서 덧붙인다 — 조건·쪽이 바뀔 때
   * 함께 풀리는 규칙(1~3행)을 그 비대칭이 지킨다.
   */
  const selectLocation = (locationId: number | null): void => {
    if (isLocked) return;

    const next = toSearchParams(filters, page);

    if (selectedCountId !== null) next.set(SELECTION_KEYS.count, String(selectedCountId));
    if (locationId !== null) next.set(SELECTION_KEYS.location, String(locationId));

    setSearchParams(next);
  };

  /**
   * **화면이 보고 있는 조회를 전부 다시 한다**(수명 표 10행).
   *
   * 목록만 다시 부르면 요약 4칸이 낡은 채로 남아 **갱신된 값과 갱신되지 않은 값이 한 화면에
   * 섞인다**(W-01-07의 Major 지적). 요약은 마감 가능 여부를 정하는 값이라(PR ④) 낡으면
   * 그 판단 자체가 낡는다. **라인도 같은 이유로 함께 부른다** — 다른 사람이 그 위치를 치환하면
   * 화면의 줄 집합이 낡고, 낡은 줄로 저장하면 **없어진 줄을 되살리거나 새 줄을 미실사로
   * 되돌린다.**
   *
   * **고르지 않은 것은 부르지 않는다.** 설치본의 `Query.fetch`는 `enabled`를 보지 않아
   * `refetch()`가 비활성 쿼리에서도 `queryFn`을 실행한다 — 지금은 `queryFn`이 던져서 요청이
   * 나가지 않지만 그것은 **가드가 막는 것**이지 훅이 무동작인 것이 아니다.
   *
   * **초안은 유지된다.** 「다시 조회」는 값을 버리려고 누르는 것이 아니다 —
   * 라인 초안 되돌림 effect가 `loc`에만 매여 있어 이 조작으로는 돌지 않는다.
   *
   * 조건·쪽·선택은 하나도 바꾸지 않는다.
   */
  const refreshAll = (): void => {
    void list.refetch();

    if (selectedCountId !== null) void detail.refetch();
    if (selectedCountId !== null && selectedLocationId !== null) void lines.refetch();
  };

  const codeOptions = toCodeOptionSets(PLACEHOLDER_STOCKTAKING_CODES);

  const warehouseReference = toReference(
    warehouses,
    filters.warehouse === '' ? null : Number(filters.warehouse),
  );

  /**
   * 창고 선택지. **한 렌더에 한 벌만 만든다** — 조건 줄과 개시 폼이 같은 목록을 쓰는데
   * 자리마다 부르면 내용이 같은 배열이 두 벌 생긴다.
   *
   * **`useMemo`로 감싸지 않는다.** 입력인 `warehouses.entries`가 `useWarehouseLookup` 안에서
   * 렌더마다 새로 만들어져(`lookups.ts`) 무엇을 의존성에 두든 매번 다시 계산된다 — 그 자리를
   * 고치는 것이 진짜 수선이고, 그것은 다른 소비처(목록 표·조건 칩)까지 함께 바뀌는 일이라
   * 이 PR의 범위 밖이다. 여기서는 **두 벌을 한 벌로 줄이는 것까지** 한다.
   */
  const warehouseOptions = toSelectOptions(warehouses);

  /**
   * 개시 입력을 고친다. **고친 칸의 오류를 함께 거둔다** — 남으면 이미 고친 값 옆에 붉은
   * 글씨가 서 있게 되고, 사용자는 무엇이 아직 잘못됐는지 알 수 없다.
   *
   * 서버가 준 필드 오류도 같은 자리에서 거둔다(`open.clearFieldError`) — 화면이 잡은 것과
   * 서버가 준 것을 갈라 두면 한쪽만 사라지는 상태가 생긴다.
   */
  const changeDraft = (patch: Partial<OpenDraft>, field?: string): void => {
    setOpenDraft((prev) => ({ ...prev, ...patch }));

    if (field === undefined) return;

    setLocalFieldErrors((prev) => {
      if (!(field in prev)) return prev;

      const next = { ...prev };
      delete next[field];

      return next;
    });
    open.clearFieldError(field);
  };

  /**
   * 표 안 두 칸을 고친다.
   *
   * **서버 오류를 거두는 자리가 없다** — 개시 폼과 갈리는 자리다. 계약이 줄마다의 오류를 어떤
   * 이름으로 주는지 정하지 않아 이 화면이 서버 오류를 칸에 붙이지 못하고 전부 배너로 받는다
   * (`queries.ts`의 `knownFields: []`). 붙이지 않은 오류는 거둘 자리도 없다.
   */
  const changeLineQty = (inventoryCountLineId: number, text: string): void => {
    setLineDrafts((prev) => setDraftQty(prev, inventoryCountLineId, text));
  };

  const changeLineReason = (inventoryCountLineId: number, code: string): void => {
    setLineDrafts((prev) => setDraftReason(prev, inventoryCountLineId, code));
  };

  /**
   * 초안을 실제로 버린다(수명 표 17행).
   *
   * **결과 구획과 실패 배너도 함께 거둔다.** 「버린다」는 앞서 한 시도를 통째로 물리는 것이라,
   * 결과나 오류가 남으면 무엇이 지금 상태인지 화면이 말할 수 없다.
   */
  const discardOpenDraft = (): void => {
    setOpenDraft(EMPTY_OPEN_DRAFT);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setResult(null);
    setDiscardTarget(null);
    setOpenConfirmVisible(false);
    open.reset();
  };

  /**
   * 라인 초안을 실제로 버린다(수명 표 17행).
   *
   * **개시 초안을 건드리지 않는다.** 둘은 서로 다른 것을 가리킨다 — 개시 초안은 **만들 실사**,
   * 라인 초안은 **고른 위치의 줄들**이다. 취소 하나가 둘을 다 지우면 개시 구획에서 치던 값이
   * 아래 구획의 취소에 사라진다.
   */
  const discardLineDrafts = (): void => {
    setLineDrafts(EMPTY_LINE_DRAFTS);
    setResult(null);
    setDiscardTarget(null);
    replace.reset();
  };

  /**
   * 취소를 눌렀다. **버릴 것이 있으면 버리기 전에 확인을 받는다**(계획 결정 15).
   *
   * 버릴 것이 없으면 곧바로 한다 — 아무것도 잃지 않는 조작에까지 확인을 받으면 확인 창이
   * 의미를 잃고 사용자가 읽지 않고 누르게 된다. 그때도 결과 구획과 배너는 거둬진다.
   *
   * **두 초안이 같은 창을 쓰되 대상을 밝힌다**(`discardTarget`) — 창은 하나이고 무엇을 버리는지는
   * 상태가 안다.
   */
  const requestDiscardOpenDraft = (): void => {
    if (isLocked) return;

    if (hasAnyOpenDraftValue(openDraft)) {
      setDiscardTarget('open');

      return;
    }

    discardOpenDraft();
  };

  const requestDiscardLineDrafts = (): void => {
    if (isLocked) return;

    if (hasAnyLineDraftValue(lineDrafts)) {
      setDiscardTarget('lines');

      return;
    }

    discardLineDrafts();
  };

  /**
   * 화면이 잡은 오류와 서버가 준 필드 오류를 한 벌로 합친다 — 어느 쪽이든 **같은 칸**에 낸다.
   *
   * 차례는 「화면이 잡은 것이 이긴다」로 두었다: 화면 판정은 **지금 화면에 있는 값**을 잰
   * 것이고 서버 오류는 **앞서 보낸 값**에 대한 것이라, 겹치면 새 쪽이 맞다.
   *
   * **다만 지금 이 차례는 관측되지 않는다 — 두 맵의 키가 겹칠 수 없기 때문이다.**
   * 리뷰가 X4(차례 뒤집기)를 주입해 생존한 자리이고, 다시 주입해 그 사실을 확인했다.
   * 근거는 구조에 있다:
   *
   * - 화면 판정이 만들 수 있는 키는 **`countTypeCode`·`plannedDate` 둘뿐**이고
   *   (`validateOpenDraft`), 그 오류는 **그 칸을 눌러 개시를 시도해야** 세워진다.
   * - 그런데 **어떤 칸을 고치면 그 칸의 서버 오류가 함께 거둬진다**(`changeDraft`의
   *   `clearFieldError`). 즉 한 칸에 화면 오류를 만들려면 그 칸을 고쳐야 하고, 고치는 순간
   *   같은 칸의 서버 오류가 사라진다 — **둘이 한 칸에 함께 설 수 없다.**
   *
   * 그래서 이 줄은 「합친다」만 실질이고 「누가 이기는가」는 지금 형식이다. **관측 가능해지는
   * 조건을 적어 둔다**: `changeDraft`를 거치지 않고 세워지는 화면 판정이 생기거나(예: 다른
   * 칸의 값에 걸리는 교차 규칙), 화면 판정의 키가 그 칸의 입력과 어긋나게 되면 — 그때
   * 차례가 실제로 갈리므로 **감지기를 함께 세워야 한다.**
   */
  const openFieldErrors = { ...open.fieldErrors, ...localFieldErrors };

  const openBlockedReason = openBlockReason({
    isCountTypeListPending: isCountTypeListPending(codeOptions),
    draft: openDraft,
  });

  /**
   * 보낼 수 있는 상태인가. **활성 조건과 형식·길이를 함께 본다.**
   *
   * 창을 여는 자리와 실제로 보내는 자리가 **둘 다** 이것을 부른다 — 「버튼이 막았으니 여기서는
   * 안 봐도 된다」가 성립하려면 버튼과 전송 사이에 상태가 바뀔 수 없어야 하는데, **확인 창이
   * 그 사이를 벌려 놓는다.** 창이 열려 있는 동안 주소로 대상이 바뀌거나 초안이 바뀔 수 있고,
   * 그때 나가는 요청은 사용자가 확인한 것과 다른 것이 된다(W-01-10 리뷰 R-1).
   */
  const findOpenBlocked = (): Record<string, string> | null => {
    const errors = validateOpenDraft(openDraft);

    if (Object.keys(errors).length > 0) return errors;

    /*
     * **사유로만 막힌 경우에도 고정 참조를 돌려준다.** 여기서 `{}`를 새로 만들면 호출자가
     * 그것을 그대로 `setLocalFieldErrors`에 넣어 **매 호출 새 참조**가 들어간다 —
     * 이 파일이 바로 위에서 세운 「오류 없음도 고정 참조를 쓴다」와 어긋난다.
     */
    return openBlockedReason === null ? null : NO_FIELD_ERRORS;
  };

  /** 확인 창을 연다. 막히면 **창을 열지 않고 요청도 만들지 않는다.** */
  const requestOpen = (): void => {
    const blocked = findOpenBlocked();

    setLocalFieldErrors(blocked ?? NO_FIELD_ERRORS);

    if (blocked !== null) return;

    setOpenConfirmVisible(true);
  };

  /**
   * 보낸다. **보내기 직전에 한 번 더 본다.**
   *
   * 막혀 있으면 **창을 닫고 보내지 않는다** — 여기서 그냥 보내면 되돌릴 수 없는 전표가 빈
   * 코드·창고 번호 `NaN`으로 나갈 수 있다(계약에 코드 `minLength`가 없어 서버가 받을 수 있다).
   */
  const submitOpen = (): void => {
    setOpenConfirmVisible(false);

    const blocked = findOpenBlocked();

    if (blocked !== null) {
      setLocalFieldErrors(blocked);

      return;
    }

    /* 실패하면 결과 구획이 비어 있어야 한다(수명 표 12행) — 앞 성공의 번호가 남으면 오해한다. */
    setResult(null);
    open.write(toCountCreate(openDraft));
  };

  /**
   * 표의 줄 — **표가 그리는 값과 보낼 값이 같은 재료에서 나온다**(`line-replace-request.ts`).
   * 두 곳에서 따로 만들면 사용자가 확인한 것과 다른 전표가 나간다.
   */
  const lineRows = toLineRows({ lines: lineItems, drafts: lineDrafts, isBlind: isBlindCount });

  /**
   * 이 위치의 라인을 **전부 받았는가.** 못 받았으면 저장을 차단한다(계획 결정 8) —
   * 못 받은 줄이 치환에 실리지 않아 **미실사로 되돌아가기** 때문이다. 경고가 아니라 차단이다.
   */
  const isLineListTruncated =
    lines.data !== undefined && isLinesTruncated(lines.data.page, lineItems.length);

  /**
   * 저장이 왜 막혔는가. 보낼 수 있으면 `null`이다.
   *
   * **버튼과 보내는 자리가 둘 다 이것을 부른다**(계획 결정 3의 구현 규칙 4). 저장에는 확인
   * 창이 없어(승인 13-5) 그 사이가 벌어지지 않는 것처럼 보이지만, **라인 응답은 뒤에서 다시
   * 온다** — 「다시 조회」나 저장 실패 뒤 무효화로 줄 집합이 바뀌면 버튼을 그린 렌더의 판정이
   * 낡는다. 특히 **잘림은 줄의 사정이 아니라 응답의 사정**이라 본문 조립이 잡아 낼 수 없다.
   */
  const findSaveBlocked = (): string | null =>
    replaceBlockReason({
      rows: lineRows,
      isTruncated: isLineListTruncated,
      isReasonListPending: isVarianceReasonListPending(codeOptions),
    });

  const saveBlockedReason = findSaveBlocked();

  /**
   * 한 위치를 치환한다. **확인 창을 두지 않는다**(승인 13-5) — 치환은 되돌릴 수 있고
   * (같은 위치를 다시 치환) 유실 위험은 **전 줄 필수**와 **잘림 차단**이 창보다 강하게 막는다.
   * 창이 지킬 것이 없는데 위치마다 되풀이되는 조작에 마찰만 더한다. 대신 치환의 뜻을 표 위
   * 안내가 늘 밝힌다.
   */
  const submitSave = (): void => {
    if (isLocked) return;
    if (selectedLocationId === null) return;
    if (findSaveBlocked() !== null) return;

    const body = toLineReplace({
      locationId: selectedLocationId,
      rows: lineRows,
      /* 시각은 **여기서 한 번만** 만든다 — 조립 안에서 부르면 고정 시각으로 검사할 수 없다. */
      now: new Date(),
    });

    /*
     * **전 줄 필수의 마지막 겹**(감지기 M38). 위의 사유 판정이 뚫려도 본문이 없으면 나가지
     * 않는다 — 「친 줄만 보낸다」가 이 화면에서 가장 큰 사고 경로라 겹을 둘로 둔다.
     */
    if (body === null) return;

    /* 실패하면 결과 구획이 비어 있어야 한다(수명 표 14행). */
    setResult(null);
    replace.write(body);
  };

  /**
   * 라인 구획. **위치를 고르기 전에는 구획 자체를 렌더하지 않는다**(계획 §12-11).
   *
   * 빈 표를 그려 두면 「이 위치에 라인이 없다」와 「아직 위치를 안 골랐다」가 같은 화면이 되고,
   * 표 안 입력칸이 없는 표가 잠시 서 있게 된다. **줄이 0건인 갈래는 `Table.empty`가 맡는다**
   * (감지기 M34) — 바깥에서 0건을 가르면 `empty`가 닿을 수 없는 죽은 가지가 된다.
   */
  const linesPane = (): ReactNode => {
    if (selectedLocationId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noLocationTitle}
          description={t.empty.noLocationDescription}
        />
      );
    }

    /* 조회 실패를 「라인이 없습니다」로 내면 자료가 없는 줄 안다 — 배너와 복구 경로를 낸다. */
    if (lines.isError) {
      return (
        <LoadErrorBanner
          error={lines.error}
          onRetry={() => {
            void lines.refetch();
          }}
        />
      );
    }

    return (
      <>
        <CountLineTable
          rows={lineRows}
          isLoading={lines.isPending}
          isTruncated={isLineListTruncated}
          isBlind={isBlindCount}
          itemLookup={items}
          uomLookup={uoms}
          lotLookup={lots}
          reasonOptions={codeOptions.varianceReason}
          isLocked={isLocked}
          onChangeQty={changeLineQty}
          onChangeReason={changeLineReason}
          onRetryReferences={() => {
            items.refetch();
            uoms.refetch();
            lots.refetch();
          }}
        />

        {/*
         * 저장 실패는 **네 갈래**다(완료 조건 C48) — 검증(400) · 권한(403) · **충돌(409)** ·
         * 응답 없음. **409에만 「최신 불러오기」를 낸다**(감지기 M48): 다시 읽어야 풀리는 것은
         * 충돌뿐이고, 다른 오류에 내면 사용자가 **입력만 버리게 된다.**
         */}
        <SaveErrorBanner error={replace.error} onReload={refreshAll} />

        {/*
         * **응답을 받지 못한 실패에만 한 줄을 더한다.** 개시와 달리 되돌릴 수는 있으나
         * (같은 위치를 다시 치환) 확인 없이 다시 보내면 그 위치가 **다시 통째로** 바뀐다.
         */}
        {replace.error?.kind === 'network' && <p className="field-error">{t.notes.saveRecheck}</p>}

        <div className="form-actions">
          {/* 취소가 저장보다 앞에 선다 — 파괴적인 것이 손 가까이 있으면 안 된다. */}
          <Button variant="text" disabled={isLocked} onClick={requestDiscardLineDrafts}>
            {messages.common.cancel}
          </Button>

          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={saveBlockedReason !== null || isLocked}
              loading={replace.isSaving}
              aria-describedby={saveBlockedReason === null ? undefined : saveReasonId}
              onClick={submitSave}
            >
              {t.actions.saveLocation}
            </Button>
            {saveBlockedReason !== null && (
              <span id={saveReasonId} className="field-note">
                {saveBlockedReason}
              </span>
            )}
          </div>
        </div>
      </>
    );
  };

  /**
   * 아래 구획. **넷 중 하나만 낸다** — 사용자가 할 조치가 서로 다르다.
   *
   * 404를 맨 앞에 둔다: 그 갈래는 `ct`를 지우고 나면 「아직 고르지 않았다」와 구분되지 않으므로,
   * 지우기 전(상세가 404인 렌더)과 지운 뒤(안내 상태)가 **같은 화면**을 내야 한다.
   */
  const detailPane = (): ReactNode => {
    if (hasNotFoundNotice || isDetailNotFound) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.notFoundTitle}
          description={t.empty.notFoundDescription}
        />
      );
    }

    if (selectedCountId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    /* 404가 아닌 실패는 다시 시도로 풀릴 수 있다 — 배너와 복구 경로를 함께 낸다. */
    if (detail.isError) {
      return (
        <LoadErrorBanner
          error={detail.error}
          onRetry={() => {
            void detail.refetch();
          }}
        />
      );
    }

    if (detail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={2} />
        </div>
      );
    }

    const count = detail.data.count;

    return (
      <>
        <SummaryPane
          count={count}
          summary={detail.data.summary}
          /*
           * 참조를 **이름으로 풀어 넘긴다** — 제목줄 부품 안에 번호를 문자열로 만드는 자리를
           * 두지 않으면 그 값이 화면으로 샐 경로도 없다(#44).
           */
          warehouseName={describeReference(toReference(warehouses, count.warehouseId))}
        />

        <LocationField
          lookup={locations}
          options={toSelectOptions(locations)}
          value={selectedLocationId === null ? '' : String(selectedLocationId)}
          isLocked={isLocked}
          onChange={selectLocation}
          onRetry={() => {
            locations.refetch();
          }}
        />

        {linesPane()}

        {/* 이력은 **실사 하나에 대한 것**이라 위치와 무관하게 늘 자리에 있다. */}
        <HistoryPane />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button variant="outlined" size="sm" onClick={refreshAll}>
            {t.actions.refresh}
          </Button>
        }
      />

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.list}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <CountFilterBar
          appliedFilters={filters}
          warehouseOptions={warehouseOptions}
          countTypeOptions={codeOptions.countType}
          statusOptions={codeOptions.status}
          chipNames={{ warehouse: describeReference(warehouseReference) }}
          warehouseNote={lookupNote(warehouses)}
          isLocked={isLocked}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key: ChipFilterKey) => {
            applyQuery(clearFilter(filters, key));
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <CountTable
              rows={rows}
              isLoading={list.isPending}
              isBeyondLast={pageView.isBeyondLast}
              selectedCountId={selectedCountId}
              warehouseLookup={warehouses}
              isLocked={isLocked}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelectCount}
              onRetryReferences={() => {
                warehouses.refetch();
              }}
            />
            {!list.isPending && (
              <PageNav
                view={pageView}
                isLocked={isLocked}
                onChange={(nextPage) => {
                  applyQuery(filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      {/*
       * 개시 구획. **목록과 아래 구획 사이에 선다**(계획 §5.5 배치) — 위에서 무엇이 이미 있는지
       * 보고, 없으면 여기서 만들고, 만든 것을 아래에서 이어 다룬다는 차례다.
       *
       * **고른 실사와 무관하게 늘 보인다.** 여기서 만드는 것은 새 실사라 대상이 필요 없다 —
       * 고른 실사가 있을 때만 보이면 「무엇을 골라야 개시할 수 있나」라는 없는 규칙이 생긴다.
       */}
      <section className="pane" aria-label={t.panes.open}>
        <OpenForm
          draft={openDraft}
          warehouseOptions={warehouseOptions}
          countTypeOptions={codeOptions.countType}
          warehouseNote={lookupNote(warehouses)}
          fieldErrors={openFieldErrors}
          isLocked={isLocked}
          onChangeCountType={(value) => {
            changeDraft({ countType: value }, OPEN_FIELD_NAMES.countType);
          }}
          onChangeWarehouse={(value) => {
            changeDraft({ warehouse: value }, OPEN_FIELD_NAMES.warehouse);
          }}
          onChangePlannedDate={(value) => {
            changeDraft({ plannedDate: value }, OPEN_FIELD_NAMES.plannedDate);
          }}
          onChangeBlindCount={(checked) => {
            changeDraft({ blindCount: checked });
          }}
        />

        {/*
         * 개시 실패는 **세 갈래**다(완료 조건 C30) — 검증 실패(400) · 권한 없음(403) ·
         * 응답 없음(네트워크). **충돌(409)은 이 오퍼레이션에 없다**(실측): 낙관적 잠금 자체가
         * 없어 「최신 불러오기」가 뜰 자리가 없다. 그래서 `onReload`를 주지 않는다.
         */}
        <SaveErrorBanner error={open.error} />

        {/*
         * **응답을 받지 못한 실패에만 한 줄을 더한다.** 공통 문구는 「다시 시도하세요」로 끝나는데,
         * 확인 없이 다시 보내면 같은 창고에 실사 전표가 두 벌 생긴다 — 공통 쓰기 훅이 호출마다
         * 새 멱등 키를 만들어 서버가 재전송으로 보지 못한다(중복 전송 완화의 한 층).
         */}
        {open.error?.kind === 'network' && <p className="field-error">{t.notes.openRecheck}</p>}

        <div className="form-actions">
          {/* 취소가 개시보다 앞에 선다 — 되돌릴 수 없는 것이 손 가까이 있으면 안 된다. */}
          <Button variant="text" disabled={isLocked} onClick={requestDiscardOpenDraft}>
            {messages.common.cancel}
          </Button>

          <div className="field-cell">
            <Button
              variant="outlined"
              disabled={openBlockedReason !== null || isLocked}
              loading={isLocked}
              aria-describedby={openBlockedReason === null ? undefined : openReasonId}
              onClick={requestOpen}
            >
              {t.actions.open}
            </Button>
            {openBlockedReason !== null && (
              <span id={openReasonId} className="field-note">
                {openBlockedReason}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="pane" aria-label={t.panes.detail}>
        {detailPane()}

        {/*
         * 결과 구획은 **아래 구획의 마지막**이다(계획 §5.5 배치). 개시 성공은 `ct`를 새 실사로
         * 옮기므로 바로 위에 그 실사의 제목줄과 요약이 함께 서고, 「무엇을 만들었고 그것이
         * 지금 어떤 상태인가」가 한 눈에 이어진다.
         */}
        {result !== null && <ResultPane result={result.view} />}
      </section>

      {isOpenConfirmVisible && (
        <OpenConfirmDialog
          summary={{
            countTypeCode: openDraft.countType,
            /*
             * **이름으로 풀어 넘긴다**(#44). 풀지 못한 갈래(미도착·목록에 없음·실패)도 그
             * 사정이 문구로 오며, 어느 갈래에도 번호가 담기지 않는다.
             */
            warehouseName: describeReference(toReference(warehouses, Number(openDraft.warehouse))),
            plannedDate: openDraft.plannedDate,
            blindCount: describeBlindCount(openDraft.blindCount),
          }}
          onConfirm={submitOpen}
          onClose={() => {
            setOpenConfirmVisible(false);
          }}
        />
      )}

      {/*
       * **초안이 둘인데 창은 하나다**(계획 결정 15). 무엇을 버리는지는 `discardTarget`이
       * 알고, 문구는 공통(`messages.common.discardChangesConfirm`)이라 어느 초안이든 뜻이 같다.
       */}
      {discardTarget !== null && (
        <DiscardConfirmDialog
          onConfirm={discardTarget === 'open' ? discardOpenDraft : discardLineDrafts}
          onClose={() => {
            setDiscardTarget(null);
          }}
        />
      )}
    </>
  );
};
