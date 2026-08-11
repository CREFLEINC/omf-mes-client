import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import {
  isCountTypeListPending,
  PLACEHOLDER_STOCKTAKING_CODES,
  toCodeOptionSets,
} from './code-options';
import { CountFilterBar } from './count-filter-bar';
import { CountTable } from './count-table';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedCountId,
  SELECTION_KEYS,
  toFilterQuery,
  toSearchParams,
  type ChipFilterKey,
  type CountFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
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
  useInventoryCountOpen,
  useInventoryCounts,
} from './queries';
import { ResultPane } from './result-pane';
import { SummaryPane } from './summary-pane';
import { describeBlindCount, type CountView, type ResultView, type SelectOption } from './types';
import { openBlockReason, OPEN_FIELD_NAMES, validateOpenDraft } from './validation';

const t = messages.stocktaking;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: CountView[] = [];

/** 같은 이유로 오류 없음도 고정 참조를 쓴다. */
const NO_FIELD_ERRORS: Record<string, string> = {};

/**
 * 결과 구획에 보이는 것과, 그것이 **어느 실사에 대한 것인가**.
 *
 * 번호는 화면에 나오지 않는다(#44) — 결과가 지금 보는 실사의 것인지 가리는 데만 쓴다.
 * 이 짝이 없으면 대상이 바뀐 뒤에도 앞 결과가 남아, 사용자는 방금 고른 실사가 방금 개시된
 * 것이라고 읽는다.
 */
interface ResultState {
  inventoryCountId: number;
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
 * **이 PR은 읽기까지다.** 개시(PR ②) · 결과 등록(PR ③) · 마감(PR ④)이 이 컨테이너에 차례로
 * 붙는다. 그때까지 **라우트·사이드바에 등록하지 않는다**(정책 §5.2 — 접근 불가능한 경계):
 * 실사를 개시할 수도 마감할 수도 없는 「재고실사」 화면을 노출하면 미완성 기능을 사용자에게
 * 내보이는 것이다.
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
 * | **S1** 실사를 골랐다 | `ct`가 있고 **상세가 200** | 위 + 제목줄 · **요약 4칸** (+위치 선택칸 · 마감 · 이력) | 위 + 다시 조회 (+위치 고르기 · 마감) | `+&ct` | ① (+③④) |
 * | **S2** 위치를 골랐다 | `ct`·`loc`가 있고 라인이 도착했다 | 위 + 라인 표 | 위 + 실물·사유 입력 · 저장 | `+&loc` | ③ |
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

  /** 「실사 개시」의 비활성 사유를 버튼에 잇는 id(배치 규범 4). */
  const openReasonId = `${useId()}-open-reason`;

  /**
   * **무엇이 바뀔 때 무엇을 비우는가 — 수명 표**(계획 결정 3).
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * **표는 화면 전체(PR ①~④)의 것이고, ★ 열이 이 PR까지 실물로 있는 상태다.**
   * 나머지 열(라인 초안·마감 플래그)은 뒤 PR에서 생기며, 그때 이 표에 행을 더하지 않아도
   * 되도록 지금 함께 적어 둔다. **열아홉째 조작이 생기면 행을 먼저 더하고, 열이 생겨도
   * 마찬가지다** — 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다.
   *
   * | # | 조작 | 조건 6종★ | `page`★ | `ct`★ | `loc`★ | **404 안내★** | 개시 초안★ | 라인 초안 | 결과 구획★ | 열린 창★ | **서버 실패★** | 마감 플래그 |
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
   * - **12행이 초안을 비우지 않는 이유**: 실패했는데 입력을 지우면 처음부터 다시 친다.
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
   * 보내기 전에 화면이 잡은 오류. **「실사 개시」를 누른 뒤에만 세운다** — 치는 도중에 붉은
   * 글씨를 띄우면 아직 넣지도 않은 칸이 잘못된 것처럼 보인다.
   */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);

  /** 쓰기 결과와 그 대상(수명 표 「결과 구획」 열). `null`이면 아직 아무것도 만들지 않았다. */
  const [result, setResult] = useState<ResultState | null>(null);

  /** 개시 확인 창이 열려 있는가. **확인하기 전에는 요청이 나가지 않는다**(완료 조건 C23). */
  const [isOpenConfirmVisible, setOpenConfirmVisible] = useState(false);

  /** 초안 파기 확인 창이 열려 있는가. */
  const [isDiscardConfirmVisible, setDiscardConfirmVisible] = useState(false);

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
   * 보내는 중인가. **대상을 바꾸는 길을 전부 닫는다**(수명 표 18행 · 중복 전송 완화의 한 층) —
   * 조건 줄·목록 선택·쪽 이동·개시 입력·두 버튼이 함께 잠긴다.
   */
  const isLocked = open.isSaving;

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
    setDiscardConfirmVisible(false);
  }, [searchParams]);

  /*
   * **결과가 자기 실사에서 떨어지면 스스로 사라진다**(수명 표 1~6행).
   *
   * 「방금 개시했다」는 그 실사에 매인 사실이다 — 대상이 바뀌었는데 남으면 사용자는 방금 고른
   * 실사를 방금 만든 것으로 읽는다. 조건 변경·초기화·쪽 이동·실사 고르기/해제·404 정리가
   * **전부 `ct`를 바꾸므로** 이 한 자리가 여섯 조작을 덮는다.
   *
   * 개시 성공(11행)은 `ct`를 그 결과의 실사로 옮기므로 번호가 맞아 남는다.
   *
   * **축이 하나 더 필요해지는 시점을 적어 둔다**: 수명 표 5행(위치 고르기·해제)도 결과 구획을
   * 비우는데, `loc`는 이 PR에 아직 없어 그 조작 자체가 없다. PR ③이 위치를 들이면 결과가
   * 매이는 축이 **`ct`와 `loc` 둘**이 되고, 그때 이 판정에 `loc`를 더해야 한다 —
   * 더하지 않으면 위치를 옮겨도 앞 위치의 저장 결과가 그대로 서 있다.
   */
  useEffect(() => {
    setResult((current) =>
      current === null || current.inventoryCountId === selectedCountId ? current : null,
    );
  }, [selectedCountId]);

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
   * **화면이 보고 있는 조회를 전부 다시 한다**(수명 표 10행).
   *
   * 목록만 다시 부르면 요약 4칸이 낡은 채로 남아 **갱신된 값과 갱신되지 않은 값이 한 화면에
   * 섞인다**(W-01-07의 Major 지적). 요약은 마감 가능 여부를 정하는 값이라(PR ④) 낡으면
   * 그 판단 자체가 낡는다.
   *
   * **고른 실사가 없으면 상세를 부르지 않는다.** 설치본의 `Query.fetch`는 `enabled`를 보지
   * 않아 `refetch()`가 비활성 쿼리에서도 `queryFn`을 실행한다 — 지금은 `queryFn`이 던져서
   * 요청이 나가지 않지만 그것은 **가드가 막는 것**이지 훅이 무동작인 것이 아니다.
   *
   * 조건·쪽·선택은 하나도 바꾸지 않는다.
   */
  const refreshAll = (): void => {
    void list.refetch();

    if (selectedCountId !== null) void detail.refetch();
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
   * 초안을 실제로 버린다(수명 표 17행).
   *
   * **결과 구획과 실패 배너도 함께 거둔다.** 「버린다」는 앞서 한 시도를 통째로 물리는 것이라,
   * 결과나 오류가 남으면 무엇이 지금 상태인지 화면이 말할 수 없다.
   */
  const discardOpenDraft = (): void => {
    setOpenDraft(EMPTY_OPEN_DRAFT);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setResult(null);
    setDiscardConfirmVisible(false);
    setOpenConfirmVisible(false);
    open.reset();
  };

  /**
   * 취소를 눌렀다. **버릴 것이 있으면 버리기 전에 확인을 받는다**(계획 결정 15).
   *
   * 버릴 것이 없으면 곧바로 한다 — 아무것도 잃지 않는 조작에까지 확인을 받으면 확인 창이
   * 의미를 잃고 사용자가 읽지 않고 누르게 된다. 그때도 결과 구획과 배너는 거둬진다.
   */
  const requestDiscardOpenDraft = (): void => {
    if (isLocked) return;

    if (hasAnyOpenDraftValue(openDraft)) {
      setDiscardConfirmVisible(true);

      return;
    }

    discardOpenDraft();
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

    return (
      <SummaryPane
        count={detail.data.count}
        summary={detail.data.summary}
        /*
         * 참조를 **이름으로 풀어 넘긴다** — 제목줄 부품 안에 번호를 문자열로 만드는 자리를
         * 두지 않으면 그 값이 화면으로 샐 경로도 없다(#44).
         */
        warehouseName={describeReference(toReference(warehouses, detail.data.count.warehouseId))}
      />
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

      {isDiscardConfirmVisible && (
        <DiscardConfirmDialog
          onConfirm={discardOpenDraft}
          onClose={() => {
            setDiscardConfirmVisible(false);
          }}
        />
      )}
    </>
  );
};
