import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { ActivationDialog, type ActivationIntent } from './activation-dialog';
import { approverNote, useApproverLookup, type ApproverOption } from './approver-options';
import {
  ENABLED_APPROVER_TYPE_CODES,
  PLACEHOLDER_APPROVAL_TYPE_CODES,
  approverTypeNote,
  toApprovalTypeOptions,
  toApproverTypeOptions,
} from './code-options';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { judgeDuplicate, type DuplicateProbe } from './duplicate-check';
import {
  DEFAULT_FILTERS,
  clearFilter,
  isCreating as readIsCreating,
  readFilters,
  readPage,
  readSelectedRouteId,
  toCreateSearchParams,
  toSearchParams,
  toSelectionSearchParams,
  withoutSelection,
  type FilterKey,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeBusinessUnit,
  lookupNote,
  toBusinessUnit,
  toBusinessUnitOptions,
  useBusinessUnitLookup,
} from './lookups';
import { toPageView } from './pagination';
import {
  routeDetailPath,
  routeKeys,
  useDuplicateProbe,
  useRouteDetail,
  useRouteList,
  useRouteSteps,
  type StepListResponse,
} from './queries';
import { RouteFilterBar } from './route-filter-bar';
import { RouteFormPane } from './route-form-pane';
import { RouteListPane } from './route-list-pane';
import {
  emptyRouteFormValues,
  isSameRouteValues,
  routeToFormValues,
  toBusinessUnitId,
  toRouteCreate,
  toRouteUpdate,
} from './route-request';
import {
  ROUTE_FORM_FIELDS,
  activateBlockedReason,
  saveBlockedReason,
  validateRouteForm,
} from './route-validation';
import {
  createStepDraft,
  isSameStepDrafts,
  moveStepDraft,
  removeStepDraft,
  stepRemoveBlockedReason,
  stepSaveBlockedReason,
  toStepDrafts,
  toStepsReplaceBody,
  type StepDraft,
} from './step-draft';
import { StepPane } from './step-pane';
import {
  toRouteView,
  type ApprovalRoute,
  type ApprovalRouteStepsReplace,
  type RouteFilters,
  type RouteFormValues,
} from './types';

const t = messages.approvalRoute;

/** 참조가 매 렌더 새로 만들어지면 이 값을 읽는 판정이 매번 달라 보인다. */
const EMPTY_ROUTES: ApprovalRoute[] = [];

/** 열려 있는 창. **한 번에 하나뿐이다** — 둘이 겹치면 어느 것을 확인한 것인지 알 수 없다. */
type DialogKind = ActivationIntent | 'discard';

/**
 * 폼 초안과 그것이 매인 대상.
 *
 * **`key`가 바뀔 때만 다시 세운다.** 서버 응답 객체에 매면 조회가 다시 돌 때마다(목록 갱신·
 * 캐시 무효화·재조회) 사용자가 치던 값이 서버 값으로 되돌아간다 — #43이 그 형태다.
 */
interface FormDraft {
  key: string;
  baseline: RouteFormValues;
  values: RouteFormValues;
}

/**
 * 단계 초안과 그것이 매인 대상.
 *
 * 폼 초안과 **같은 형태이되 다른 벌이다.** 둘은 다른 오퍼레이션이라 한쪽을 고치는 중에
 * 다른 쪽이 되돌아가면 안 된다 — 한 벌로 합치면 그 규칙을 세울 자리가 없어진다.
 *
 * `baseline`은 서버에서 온 순서다. **순서만 달라도 「고쳤다」로 본다** — 이 화면에서 순서는
 * 보기 방식이 아니라 저장되는 자료다.
 */
interface StepDraftState {
  key: string;
  baseline: StepDraft[];
  values: StepDraft[];
}

/**
 * W-06-15 결재선 정의 컨테이너.
 *
 * ## 단계 전이 표 (계획 결정 3)
 *
 * 화면이 `approvalTypeCode` **값으로는 분기하지 않는다**(값 목록 미확정). 반면
 * `isActive`·`stepCount`·`inProgressCount`로는 분기한다 — 셋은 열린 코드가 아니라 계약이
 * 뜻을 정의한 불리언·정수이고, 계약이 화면에 그 판정을 명시적으로 요구한다.
 *
 * | 단계 | 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 |
 * | :-: | --- | --- | --- | --- |
 * | **S0** 고르기 전 | `ar`도 `new`도 없다 | 조건 줄 · 목록 · 쪽 | 조회 · 초기화 · 쪽 이동 · 고르기 · **새 결재선** | `?ty&bu&inactive&q&page` |
 * | **S1** 결재선을 골랐다 | `ar`가 있고 **상세가 200** | 위 + 결재선 폼(수정) + **단계 구획** | 위 + 수정 저장 · 끄기/켜기 | `+&ar` |
 * | **S2** 새로 만드는 중 | `new`가 있다 | 위 + 결재선 폼(등록) · **단계 구획 없음** | 위 + 등록 저장 · 취소 | `+&new` |
 * | **S3** 그 결재선이 없다 | 상세가 **404** | 안내 「고른 결재선을 찾을 수 없습니다」 | 주소에서 `ar`를 정리한다 | `ar` 제거 |
 *
 * **S2에 단계 구획이 없다** — 등록 요청에 단계를 실을 수 없고(계약 `ApprovalRouteCreate`에
 * `steps`가 없다) 단계 치환은 번호를 요구한다. **붙일 대상이 아직 없다.** 등록에 성공하면
 * 그 번호로 S1로 옮겨 가고 그때 단계 구획이 빈 상태로 열린다(계획 결정 15).
 *
 * **S1에서 화면이 모르는 것을 밝힌다.** 「이 결재선이 지금 상신에 실제로 쓰이는가」는 화면이
 * 판정할 수 없다 — 같은 (유형, 사업부)로 사용 중인 결재선이 둘 이상 있을 수 있고 고르는
 * 규칙은 서버가 갖는다. 화면은 자기가 아는 사실(사용 여부·단계 수·진행 중 건수)만 말한다.
 *
 * ## 수명 표 (계획 결정 4)
 *
 * 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다. **스무째 조작이나 다섯째 쓰기가
 * 생기면 표에 행을 먼저 더한 뒤에 코드를 고친다.** 넷째 쓰기(단계 치환)가 서면서
 * **단계 초안·단계 배너 두 열과 8·18행이 더해졌다.**
 *
 * | # | 조작 | 조건 4종 | `page` | `ar` | `new` | 폼 초안 | **단계 초안** | **열린 창** | **폼 배너** | **단계 배너** |
 * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
 * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **끈다** | **비운다** | **비운다** | **닫는다** | **비운다** | **비운다** |
 * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | 끈다 | 비운다 | 비운다 | 닫는다 | 비운다 | 비운다 |
 * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **끈다** | 비운다 | 비운다 | 닫는다 | 비운다 | 비운다 |
 * | 4 | 결재선 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | 끈다 | **비운다** | **비운다** | 닫는다 | 비운다 | 비운다 |
 * | 5 | 「새 결재선」 | 유지 | 유지 | **비운다** | **켠다** | **빈 값으로 세운다** | **없다** | 닫는다 | 비운다 | 비운다 |
 * | 6 | **상세가 404** | 유지 | 유지 | **비운다** | 끈다 | 비운다 | 비운다 | 닫는다 | 비운다 | 비운다 |
 * | 7 | 폼 입력 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **유지** | 유지 | **유지** | 유지 |
 * | 8 | **단계 추가·삭제·순서 이동** | 유지 | 유지 | 유지 | 유지 | **유지** | 바뀐다 | 유지 | 유지 | **유지** |
 * | 9 | 목록·상세·단계·참조 **응답 도착** | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** | 유지 | 유지 | 유지 |
 * | 10 | **다시 조회**(새로고침) | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | 유지 |
 * | 11 | **폼 저장 성공(수정)** | 유지 | 유지 | 유지 | 끈다 | **서버 응답으로 다시 세운다** | 유지 | 닫혀 있다 | 비운다 | 유지 |
 * | 12 | **폼 저장 성공(등록)** | 유지 | 유지 | **새 번호를 넣는다** | **끈다** | 새 대상에서 다시 세운다 | **새 대상에서 세운다** | 닫혀 있다 | 비운다 | 비운다 |
 * | 13 | 폼 저장 실패 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 닫혀 있다 | **세운다** | 유지 |
 * | 14 | **단계 저장 성공** | 유지 | 유지 | 유지 | 유지 | **유지** | **서버 응답으로 다시 세운다** | 닫혀 있다 | 유지 | 비운다 |
 * | 15 | 단계 저장 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 닫혀 있다 | 유지 | **세운다** |
 * | 16 | **끄기·켜기 성공** | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | **닫는다** | 비운다 | 유지 |
 * | 17 | 끄기·켜기 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 창 안에 **세운다** |
 * | 18 | 취소(초안 파기) | 유지 | 유지 | 유지 | 유지 | **되돌린다** | **되돌린다** | 닫는다 | 비운다 | 비운다 |
 * | 19 | **전송 중**(화면 안 조작) | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 유지 | 유지 |
 * | 20 | **전송 중 · 바깥 주소 이동** | 바뀐다 | 바뀐다 | 바뀐다 | 바뀐다 | **새 대상에서 다시 세운다** | **새 대상에서 세운다** | **닫는다** | **비운다** | **비운다** |
 *
 * **왜 이렇게 정했는가**
 *
 * - **1~6행이 창을 닫고 배너를 비우는 이유**: 배너·창은 **자기 대상보다 오래 살지 않는다.**
 *   대상이 바뀌면 배너가 가리킬 것이 없고, 열린 창은 사용자가 확인한 것과 나가는 것을 가른다 —
 *   앞 결재선을 끄려고 연 창이 다음 결재선을 끄게 된다. 뒤로가기·주소 직접 편집은 클릭 핸들러를
 *   거치지 않으므로 **`editTargetKey`에 묶인 effect 한 곳**이 그 일을 한다.
 * - **7~8행이 서로의 초안을 유지하는 이유**: 폼과 단계는 **다른 오퍼레이션**이다. 한쪽을
 *   고치는 중에 다른 쪽이 되돌아가면 사용자가 잃는 것이 생긴다. 다만 **저장 순서는 강제한다** —
 *   폼이 더러우면 단계 저장이 잠긴다(둘이 한 벌의 토큰을 나눠 쓴다).
 * - **9행이 이 화면의 #43 자리다**: 응답 도착이 초안을 되돌리면 「치던 값이 사라진다」가
 *   재현된다. 두 초안 모두 **응답 객체가 아니라 대상 키**에 매여 있다.
 * - **11·14·16행이 초안을 「서버 응답으로 다시 세우거나 유지하는」 이유**: 서버가 정본이다.
 *   보낸 값을 그대로 두면 서버가 조정한 결과(파생값 `stepCount`·`inProgressCount`,
 *   새로 매겨진 단계 번호와 승인자의 부서 이름)를 놓친다.
 *   반면 사용 전환은 **폼 필드가 아니라서**(계약이 `isActive`를 PUT에서 뺐다) 켜고 끄는 일이
 *   편집 중인 값을 버릴 이유가 없다.
 * - **12행이 주소를 한 번만 갱신하는 이유**: `new` 해제와 `ar` 설정을 **한 patch로** 한다.
 *   두 번 갱신하면 그 사이에 「고른 것도 만드는 것도 아닌」 한 프레임이 히스토리에 남는다.
 * - **15행이 창을 닫지 않는 이유**: 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
 * - **19행이 대상을 바꾸는 길까지 잠그는 이유**: 열어 두면 사용자가 다른 결재선으로 옮긴 뒤
 *   **앞 요청의 결과가 지금 보는 맥락에 나타난다.**
 * - **20행이 19행과 갈리는 이유**: 뒤로가기·앞으로가기·주소 직접 편집은 **화면의 클릭
 *   핸들러를 지나지 않아** 19행의 잠금 문에 걸리지 않는다. 셸 셋 중 Capacitor의 하드웨어
 *   뒤로가기도 이 길이다 — **막을 수 없는 길이므로 막는 대신 다룬다.**
 *   화면은 새 대상으로 옮겨 가되 **나가는 중인 요청을 끊지 않는다**(§`resetEditing`) —
 *   끊으면 무효화·성공·실패·공동 잠금이 함께 사라져 서버에는 갔는데 화면만 없던 일로 친다.
 *   도착한 결과 중 **대상에 매인 것**(초안 재세움·창 닫기·배너)은 내지 않고, **대상과 무관한
 *   것**(무효화·성공 알림·등록이 만든 자원으로의 이동)은 그대로 한다.
 *
 * ## 토큰 수명 표 (계획 결정 12 — 이 화면의 중심)
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 * 그래서 「어느 응답이 어느 경로에 토큰을 남기는가」가 다음 쓰기의 성패를 정한다.
 *
 * | 쓰기 | `If-Match` 출처(`etagPath`) | 응답이 `ETag`를 주는가 | **어느 경로에 남는가** | 성공 뒤 상세를 다시 부르는가 |
 * | --- | --- | :-: | --- | :-: |
 * | 등록 `POST /app/approval-routes` | **없음**(`null`) | 준다(201) | **컬렉션 경로** — 상세 토큰이 되지 않는다 | **부른다**(새 번호를 고르면 상세 조회가 토큰을 확보) |
 * | 수정 `PUT /{id}` | **상세 경로** | 계약상 **선택**이다 | 주면 상세 경로 | **부른다**(주지 않는 서버에서도 살아야 한다) |
 * | 끄기·켜기 `POST /{id}:deactivate`·`:activate` | **상세 경로** | 준다(200) | **액션 경로** — **상세 토큰이 낡는다** | **반드시 부른다** |
 * | 단계 치환 `PUT /{id}/steps` | **상세 경로**(결재선 토큰) | **주지 않는다** | 없음 | **반드시 부른다** |
 *
 * **넷째 줄이 이 표를 만든 이유다.** 하위 컬렉션의 쓰기인데 잠금 토큰이 **부모의 것**이고
 * (계약: `If-Match`는 결재선의 판 번호다), 200 응답에 `ETag`가 아예 없다. 그래서 서버가
 * 그 저장으로 결재선의 판 번호를 올리는지 화면이 알 길이 없다 — 올린다면 다시 받지 않은
 * 토큰은 낡은 것이고, 올리지 않아도 다시 받아 손해가 없다. **어느 쪽이든 안전한 처리**를 택한다.
 *
 * 다른 화면의 하위 컬렉션 치환(공정 순서)을 그대로 베끼면 이 자리가 깨진다 — 그쪽은
 * `If-Match`가 아예 없어 `etagPath`가 `null`이고, 여기서 그러면 토큰 없이 나가 400이다.
 *
 * **규칙 하나로 요약한다 — 모든 쓰기 성공 뒤 `routeKeys.all`을 무효화한다.** 빠뜨리면
 * 두 번째 저장이 조용히 409로 죽거나, 훅이 토큰을 못 찾아 **요청을 보내지 않고 멈춘다**
 * (「저장을 눌러도 아무 일이 없다」 — 전례 W-CO-02의 실증된 증상).
 *
 * **`etagPath`는 늘 상세 경로다.** 액션 경로(`…:deactivate`)로 꺼내면 언제나 비어 있고,
 * `null`로 두면 토큰 없이 나가 서버가 400을 낸다.
 */
export const ApprovalRouteScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedRouteId = readSelectedRouteId(searchParams);
  const isCreating = readIsCreating(searchParams);

  const list = useRouteList(filters, page);
  const detail = useRouteDetail(selectedRouteId);
  const steps = useRouteSteps(selectedRouteId);
  const businessUnits = useBusinessUnitLookup();
  /* 승인자 후보는 **고른 뒤에만** 부른다 — 단계를 편집할 자리가 그때 열린다. */
  const approvers = useApproverLookup(selectedRouteId !== null);

  /**
   * 404 안내가 매인 대상. **조건·쪽의 서명**이며, 그것이 바뀌면 안내가 가리킬 것이 없다.
   * 조작마다 따로 지우면 뒤로가기·주소 직접 편집이 그 길을 지나지 않아 안내가 살아남는다.
   */
  const listContextKey = toSearchParams(filters, page).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);

  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isRouteNotFound =
    detailError !== null && detailError.kind === 'http' && detailError.status === 404;

  /**
   * 상세가 404면 주소에 남은 번호를 정리하고, **그 순간의 서명**에 안내를 맨다.
   *
   * **히스토리를 늘리지 않는다**(`replace`) — 늘리면 뒤로가기가 없는 결재선으로 되돌아가고,
   * 그 자리에서 다시 404가 나 같은 정리가 되풀이된다.
   *
   * **서명을 참조로 우회하지 않고 의존성에 그대로 둔다.** 참조로 두면 「참조를 언제 갱신하는가」가
   * effect 선언 순서에 매인 보이지 않는 규약이 되고, 그 규약은 잣대로 붙잡히지 않는다.
   * 의존성에 두면 조건·쪽이 바뀔 때 effect가 깨어나지만 **404가 아니면 곧바로 되돌아간다** —
   * 404인 채로 조건만 바뀌는 길에서는 새 서명에 다시 매이는 것이 옳은 동작이다.
   */
  useEffect(() => {
    if (!isRouteNotFound) return;

    setMissingContextKey(listContextKey);
    setSearchParams((prev) => withoutSelection(prev), { replace: true });
  }, [isRouteNotFound, listContextKey, setSearchParams]);

  const isRouteMissing =
    selectedRouteId === null && missingContextKey !== null && missingContextKey === listContextKey;

  const routes = useMemo(() => (list.data?.items ?? []).map(toRouteView), [list.data]);

  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, routes.length);

  const businessUnitLabelOf = (businessUnitId: number | null): string =>
    describeBusinessUnit(toBusinessUnit(businessUnits, businessUnitId));

  const route = detail.data === undefined ? null : toRouteView(detail.data);

  /**
   * **지금 편집 중인 대상.** 배너·인라인 오류·창·초안이 **같은 이름 하나**를 본다 —
   * 각자 다른 값을 보게 두면 「어느 조작이 무엇을 지우는가」가 자리마다 갈린다(전례 PR #91 R3-6).
   *
   * 고른 결재선과 등록 폼은 **함께 성립하지 않는 하나의 자리**다(`filters.ts`가 그 규칙을 갖는다).
   */
  const editTargetKey: string | null = isCreating
    ? 'new'
    : selectedRouteId === null
      ? null
      : String(selectedRouteId);

  /**
   * 단계 초안이 매인 대상. **`editTargetKey`와 갈린다** — 등록 중에는 단계 구획이 아예 없다
   * (등록 본문에 단계를 실을 수 없고 치환은 결재선 번호를 요구한다 — 붙일 자원이 없다).
   */
  const stepTargetKey: string | null = selectedRouteId === null ? null : String(selectedRouteId);

  const [draft, setDraft] = useState<FormDraft | null>(null);
  const [stepDraft, setStepDraft] = useState<StepDraftState | null>(null);
  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<DialogKind | null>(null);

  /*
   * 초안의 수명을 **렌더 중에** 맞춘다(effect가 아니다) — effect로 미루면 대상이 바뀐 첫
   * 프레임에서 앞 대상의 값이 새 대상의 폼에 한 번 그려진다.
   *
   * 두 걸음으로 나눈 이유: 대상이 바뀌는 순간과 새 값을 얻는 순간이 **다르다.** 상세가
   * 도착하기 전에는 세울 값이 없고, 그때 앞 초안을 남겨 두면 그것이 새 대상의 값처럼 보인다.
   */
  if (editTargetKey === null) {
    if (draft !== null) setDraft(null);
  } else if (draft !== null && draft.key !== editTargetKey) {
    setDraft(null);
  } else if (draft === null) {
    if (isCreating) {
      /* 등록 폼은 **빈 값으로** 선다 — 기본값을 지어내면 사용자가 고르지 않은 값이 저장된다. */
      const seeded = emptyRouteFormValues();

      setDraft({ key: editTargetKey, baseline: seeded, values: seeded });
    } else if (route !== null) {
      const seeded = routeToFormValues(route);

      setDraft({ key: editTargetKey, baseline: seeded, values: seeded });
    }
  }

  const isDirty = draft !== null && !isSameRouteValues(draft.values, draft.baseline);

  /*
   * 단계 초안도 같은 규율로 세운다 — 다만 **매인 대상이 다르다.** 단계는 등록 중에 존재하지
   * 않으므로(붙일 자원이 아직 없다) `editTargetKey`가 아니라 고른 결재선 번호에 맨다.
   *
   * **응답이 다시 와도 여기서 되돌리지 않는다**(수명 표 9행) — 저장 뒤 갱신은 그 저장의
   * 응답이 맡고(14행), 무효화로 뒤따라 오는 재조회는 이미 세워진 초안을 건드리지 않는다.
   */
  if (stepTargetKey === null) {
    if (stepDraft !== null) setStepDraft(null);
  } else if (stepDraft !== null && stepDraft.key !== stepTargetKey) {
    setStepDraft(null);
  } else if (stepDraft === null && steps.data !== undefined) {
    const seeded = toStepDrafts(steps.data.items);

    setStepDraft({ key: stepTargetKey, baseline: seeded, values: seeded });
  }

  const isStepDirty = stepDraft !== null && !isSameStepDrafts(stepDraft.values, stepDraft.baseline);

  const approvalTypeOptions = toApprovalTypeOptions(PLACEHOLDER_APPROVAL_TYPE_CODES);
  const approverTypeOptions = toApproverTypeOptions(ENABLED_APPROVER_TYPE_CODES);

  /**
   * 활성 중복 **조준 조회**가 필요한 자리는 셋뿐이다 — 등록(유형을 골랐다) · 수정(고친 것이
   * 있다) · 다시 사용(그 결재선이 꺼져 있다). 읽기만 하는 사용자에게까지 부르면 결재선을
   * 하나 고를 때마다 목록 경로로 두 번 나가는 화면이 된다.
   *
   * 승인 유형은 등록이면 폼 값, 수정·전환이면 **서버가 준 값**이다 — 수정 본문에 유형이 없어
   * 고른 결재선의 유형은 바뀌지 않는다.
   */
  const probeTypeCode = isCreating
    ? (draft?.values.approvalTypeCode.trim() ?? '')
    : (route?.approvalTypeCode ?? '');
  const needsDuplicateCheck = isCreating || isDirty || (route !== null && !route.isActive);
  const duplicateProbe = useDuplicateProbe(probeTypeCode, needsDuplicateCheck);

  const probeState: DuplicateProbe = {
    items: duplicateProbe.data?.items ?? EMPTY_ROUTES,
    total: duplicateProbe.data?.page.total ?? 0,
    isLoading: duplicateProbe.isPending,
    isError: duplicateProbe.isError,
  };

  /**
   * 저장이 만들려는 (유형, 사업부)의 중복. **사업부는 폼 값**이다 — 저장하면 그 값이 된다.
   * 자기 자신을 빼지 않으면 수정이 자기 때문에 늘 막힌다.
   */
  const saveDuplicate = judgeDuplicate(probeState, {
    businessUnitId: toBusinessUnitId(draft?.values.businessUnitId ?? ''),
    selfRouteId: selectedRouteId,
  });

  /**
   * 켜기가 만들려는 중복. **사업부는 서버 값**이다 — 켜기는 폼을 저장하지 않으므로
   * 편집 중인 값이 아니라 지금 서버에 있는 값으로 켜진다.
   */
  const activateDuplicate = judgeDuplicate(probeState, {
    businessUnitId: route?.businessUnitId ?? null,
    selfRouteId: selectedRouteId,
  });

  /**
   * 주소를 갈아 끼우는 **유일한 자리**. 404 안내를 여기서 함께 거둔다 —
   * 조회·초기화·쪽 이동·고르기·등록 성공이 모두 이 길을 지나므로 조작마다 따로 지울 자리가 없다.
   *
   * **같은 주소로는 갱신하지 않는다.** 화면을 바꾸지 않으면서 히스토리 칸만 늘어난다.
   */
  const applySearchParams = (next: URLSearchParams): void => {
    setMissingContextKey(null);

    if (next.toString() === searchParams.toString()) return;

    setSearchParams(next);
  };

  /**
   * 다시 조회 — **목록만 부르지 않는다.**
   *
   * 목록만 다시 부르면 갱신된 목록 값과 낡은 상세·단계가 한 화면에 섞인다.
   * 고르지 않았으면 상세·단계는 부를 대상이 없다 — **읽는 자리에서 판정한다.**
   *
   * **조준 조회는 여기서 부르지 않는다.** 그것은 보이는 자료가 아니라 저장 직전의 판정이고,
   * 모든 쓰기가 성공 뒤 `routeKeys.all`을 무효화하므로 저장과 저장 사이에 낡지 않는다.
   */
  const handleReload = (): void => {
    void list.refetch();
    businessUnits.refetch();

    if (selectedRouteId !== null) {
      void detail.refetch();
      void steps.refetch();
      /* 승인자 후보도 참조다 — 사람이 들고 나는 동안 낡는다. 고른 뒤에만 부르므로 여기 안이다. */
      approvers.refetch();
    }
  };

  const reloadDetail = (): void => {
    void detail.refetch();
  };

  /**
   * **지금 대상**을 참조로 들고 있는다.
   *
   * 쓰기의 되먹임은 그 요청을 **보낸 렌더의 값**을 들고 도착한다. 그것이 「지금」의 것인지
   * 알려면 도착 시점의 대상이 필요한데, 그 값은 렌더에 갇혀 있어 참조로만 꺼낼 수 있다.
   * **매임의 축은 그대로 `editTargetKey` 하나**이고 참조는 그 축을 시간 너머로 옮길 뿐이다.
   */
  const editTargetKeyRef = useRef(editTargetKey);
  editTargetKeyRef.current = editTargetKey;

  /** 보낸 대상과 지금 대상이 같은가. 도착한 되먹임 중 **대상에 매인 것**만 이 문을 지난다. */
  const isSameTarget = (sentTargetKey: string | null): boolean =>
    editTargetKeyRef.current === sentTargetKey;

  /**
   * 마지막으로 보낸 쓰기가 **겨눈 대상**. 셋이 한 벌의 잠금을 나눠 써서 한 번에 하나만 나간다.
   *
   * 대상이 바뀌는 순간 나가는 중이던 요청은 **끊지 않는다**(§`resetIfIdle`). 그 결과가
   * 나중에 도착하면 **지금 대상과 견주어** 낼지 정한다 — 「결과는 자기 대상보다 오래 살지
   * 않는다」가 요구하는 것은 *보이지 않는 것*이지 *일어나지 않는 것*이 아니다. 서버에는 이미 갔다.
   *
   * **성공 갈래와 같은 축이다.** 「한 번 세워지면 다음 쓰기까지 내려가지 않는 깃발」로 가리면
   * 두 축의 정밀도가 갈려, 들렀다 **돌아온** 대상의 거절 사유까지 삼킨다 — 그 사유는 남의
   * 것이 아니라 지금 보는 대상의 것이다.
   */
  const [writeTargetKey, setWriteTargetKey] = useState<string | null>(null);

  /** 훅에 남아 있는 쓰기 결과가 지금 보는 대상의 것인가. */
  const isWriteResultMine = writeTargetKey === editTargetKey;

  /**
   * 등록 — **`If-Match`가 없다.** 아직 없는 자원이라 잠글 대상이 없다.
   *
   * 201이 `ETag`를 주지만 그것은 **컬렉션 경로**(`/app/approval-routes`)에 캡처되어 상세
   * 토큰이 되지 않는다. 새 결재선을 고르면 상세 조회가 나가고 **그 조회가 토큰을 확보한다.**
   */
  const createWrite = useMasterWrite<RouteFormValues, ApprovalRoute>({
    request: (values, headers) =>
      client.POST('/app/approval-routes', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body: toRouteCreate(values),
      }),
    etagPath: null,
    invalidateKeys: [routeKeys.all],
    knownFields: ROUTE_FORM_FIELDS,
    onSuccess: (saved) => {
      setFieldErrors({});
      /*
       * 방금 만든 결재선을 연다 — **주소 갱신은 이 한 번뿐이다**(`new` 해제 + `ar` 설정).
       * 여기서 옮기지 않으면 사용자는 자기가 만든 결재선을 목록에서 다시 찾아야 하고,
       * **단계가 0인 채로 사용 중인 결재선**이 방치된다(계획 결정 15).
       *
       * 사용자 조작이 아니라 **이 쓰기 자신의 이동**이라 잠금 문을 지나지 않는다.
       *
       * **대상 가드를 두지 않는다.** 등록의 결과는 *새로 생긴 자원*이지 그때 보던 대상이
       * 아니다 — 보내는 사이에 사용자가 다른 데로 갔더라도 그 자원은 여전히 사용 중이고
       * 단계가 0이라 상신을 막는다. 옮겨 가지 않으면 그것을 아는 사람이 없다.
       */
      applySearchParams(toSelectionSearchParams(filters, page, saved.approvalRouteId));
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 수정 — **세 필드를 늘 명시해 보낸다**(전체 교체). 잠금 토큰은 **상세 경로**에서 꺼낸다.
   *
   * 계약이 200의 `ETag`를 **선택**으로 두었다. 응답이 토큰을 주지 않는 서버에서도 두 번째
   * 저장이 살아야 하므로 성공 뒤 상세를 무효화해 **재조회가 새 토큰을 확보하게** 한다.
   */
  const updateWrite = useMasterWrite<RouteFormValues, ApprovalRoute>({
    request: (values, headers) =>
      client.PUT('/app/approval-routes/{approvalRouteId}', {
        params: {
          path: { approvalRouteId: selectedRouteId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body: toRouteUpdate(values),
      }),
    etagPath: selectedRouteId === null ? null : routeDetailPath(selectedRouteId),
    invalidateKeys: [routeKeys.all],
    knownFields: ROUTE_FORM_FIELDS,
    onSuccess: (saved) => {
      /* 저장은 일어났다 — 대상이 바뀌었다고 그 사실까지 감추지 않는다. */
      toast.show({ variant: 'success', description: messages.common.saved });

      /*
       * **이 값이 앉을 자리는 그 대상뿐이다.** 보내는 사이에 다른 결재선으로 옮겨 갔다면
       * 새 대상의 초안에 **남의 값을 찍게 된다** — 무효화·토스트와 달리 이것은 대상에 매인다.
       */
      if (!isSameTarget(editTargetKey)) return;

      setFieldErrors({});
      /* **서버 응답이 정본이다.** 보낸 값을 그대로 두면 서버가 조정한 결과를 놓친다. */
      const next = routeToFormValues(toRouteView(saved));

      setDraft((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
    },
  });

  /**
   * 사용 전환 — **본문이 없다.** 본문을 실으면 `:deactivate`가 415, `:activate`가 400이다.
   *
   * 두 오퍼레이션을 한 훅으로 다룬다 — 잠금 토큰도 무효화 범위도 실패 배너도 같고,
   * **한 번에 하나만 나갈 수 있다**(한 결재선이 켜져 있으면서 꺼져 있을 수 없다).
   *
   * 잠금 토큰은 **상세 경로**에서 꺼낸다. 요청 경로(`…:deactivate`)로 꺼내면 언제나 비어 있어
   * 전환이 전부 멈춘다. 그리고 200의 `ETag`는 **액션 경로**에 캡처되므로 상세 토큰이 낡는다 —
   * 성공 뒤 무효화가 없으면 그다음 저장이 조용히 409다.
   */
  const activationWrite = useMasterWrite<ActivationIntent, ApprovalRoute>({
    request: (intent, headers) => {
      const params = {
        path: { approvalRouteId: selectedRouteId ?? 0 },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          'If-Match': headers['If-Match'] ?? '',
        },
      };

      return intent === 'deactivate'
        ? client.POST('/app/approval-routes/{approvalRouteId}:deactivate', { params })
        : client.POST('/app/approval-routes/{approvalRouteId}:activate', { params });
    },
    etagPath: selectedRouteId === null ? null : routeDetailPath(selectedRouteId),
    invalidateKeys: [routeKeys.all],
    /* 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다. */
    knownFields: [],
    onSuccess: () => {
      /* 전환은 일어났다 — 대상이 바뀌었어도 그 사실은 알린다. */
      toast.show({ variant: 'success', description: messages.common.saved });

      /* 창은 그 대상의 것이다. 대상이 바뀌었으면 정리 effect가 이미 닫았다. */
      if (!isSameTarget(editTargetKey)) return;

      setDialog(null);
    },
  });

  /**
   * 단계 치환 — **하위 컬렉션의 쓰기인데 잠금 토큰이 부모의 것이다**(계약: `If-Match`는
   * 결재선의 판 번호다). 그래서 `etagPath`가 **결재선 상세 경로**다. 다른 화면의 하위
   * 컬렉션 치환을 그대로 베끼면 여기가 깨진다 — 그쪽은 `If-Match`가 아예 없어 `null`이고,
   * 여기서 `null`을 주면 토큰 없이 나가 서버가 400을 낸다.
   *
   * **200 응답에 `ETag`가 없다.** 그 저장이 결재선의 판 번호를 올리는지 계약이 밝히지 않으므로
   * 성공 뒤 상세를 **반드시** 다시 부른다 — 올린다면 낡은 토큰을 갈아야 하고, 올리지 않아도
   * 다시 받아 손해가 없다. 빠뜨리면 이어지는 저장이 조용히 409다.
   *
   * **본문이 보낼 수 없는 상태면 요청 자체를 만들지 않는다.** 승인자를 확인할 수 없는 행이나
   * 빈 배열은 계약이 400으로 막는 자리이고, 목은 그중 앞엣것을 200으로 받는다 —
   * 막는 곳이 화면뿐이라 **보내는 자리가 스스로 한 번 더 본다.**
   */
  const stepsWrite = useMasterWrite<ApprovalRouteStepsReplace, StepListResponse>({
    request: (body, headers) =>
      client.PUT('/app/approval-routes/{approvalRouteId}/steps', {
        params: {
          path: { approvalRouteId: selectedRouteId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: selectedRouteId === null ? null : routeDetailPath(selectedRouteId),
    invalidateKeys: [routeKeys.all],
    /* 단계에는 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다. */
    knownFields: [],
    onSuccess: (saved) => {
      /* 저장은 일어났다 — 대상이 바뀌었다고 그 사실까지 감추지 않는다. */
      toast.show({ variant: 'success', description: messages.common.saved });

      /*
       * **이 값이 앉을 자리는 그 대상뿐이다.** 보내는 사이에 다른 결재선으로 옮겨 갔다면
       * 새 대상의 단계 표에 **남의 순서를 찍게 된다.**
       */
      if (!isSameTarget(editTargetKey)) return;

      /* **서버 응답이 정본이다.** 새로 매겨진 단계 번호와 승인자의 부서 이름이 여기 있다. */
      const next = toStepDrafts(saved.items);

      setStepDraft((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
    },
  });

  /**
   * **네 쓰기가 한 벌의 잠금 토큰을 나눠 쓴다.** 하나가 나가는 중에는 나머지도 잠근다 —
   * 동시에 나가면 뒤엣것이 반드시 409이고, 그 실패는 사용자가 한 일과 이어지지 않는다.
   */
  const isLocked =
    createWrite.isSaving || updateWrite.isSaving || activationWrite.isSaving || stepsWrite.isSaving;

  /** 지금 모드의 쓰기. 등록과 수정이 한 폼을 쓰므로 배너·오류·진행 표시도 한 곳에서 골라 쓴다. */
  const activeWrite = isCreating ? createWrite : updateWrite;

  /**
   * **나가는 중인 쓰기는 건드리지 않는다.**
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 **옵저버를 떼어 낸다**. 옵저버가 떨어지면
   * 그 호출에 매달린 되먹임이 통째로 오지 않는다 — **무효화도, 성공도, 실패도, 공동 잠금의
   * 해제도**. 그러면 이 화면이 스스로 못 박은 것 둘이 동시에 깨진다: 「하나가 나가는 중에는
   * 나머지도 잠근다」와 「모든 쓰기 성공 뒤 상세를 무효화한다」. 요청은 이미 서버에 갔는데
   * 화면만 없던 일로 친다.
   *
   * **끊는 것과 감추는 것은 다르다.** 도착한 결과를 화면에 낼지는 `isWriteResultMine`이
   * 정하고, 여기서는 **끝난 것만** 거둔다.
   *
   * `reset()`을 부르는 **모든 자리**가 이 함수를 지난다 — 자리마다 판정을 적으면 언젠가
   * 하나가 갈린다.
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /**
   * **사용자가** 대상을 바꾸는 길. 전송 중에는 지나가지 못한다(수명 표 16행).
   *
   * 첫째 겹은 컨트롤의 `disabled`인데 **목록 행·조건 칩·쪽 이동은 잠금을 받지 않는다** —
   * 그 길로 대상이 바뀌면 앞 요청의 결과가 지금 보는 맥락에 나타난다.
   * 쓰기 자신의 이동(등록 성공 뒤 새 결재선 열기)은 이 문을 지나지 않는다.
   */
  const applyUserNavigation = (next: URLSearchParams): void => {
    if (isLocked) return;

    applySearchParams(next);
  };

  const handleSearch = (next: RouteFilters): void => {
    // 조건·쪽·선택을 **한 patch로** 갱신한다. 나누면 그 사이에 어느 쪽도 아닌 한 프레임이 생긴다.
    applyUserNavigation(toSearchParams(next, 1));
  };

  const handleRemoveFilter = (key: FilterKey): void => {
    handleSearch(clearFilter(filters, key));
  };

  const handleChangePage = (nextPage: number): void => {
    applyUserNavigation(toSearchParams(filters, nextPage));
  };

  const handleSelect = (approvalRouteId: number): void => {
    applyUserNavigation(toSelectionSearchParams(filters, page, approvalRouteId));
  };

  const handleCreate = (): void => {
    applyUserNavigation(toCreateSearchParams(filters, page));
  };

  /** 등록 폼을 닫는다. 선택 자리도 등록 표시도 함께 비운다 — 두 자리는 하나의 자리다. */
  const closeCreateForm = (): void => {
    applyUserNavigation(toSelectionSearchParams(filters, page, null));
  };

  /**
   * 편집 중이던 것을 통째로 거둔다 — 창 · 인라인 오류 · 저장 실패 배너.
   *
   * **초안은 여기서 다루지 않는다.** 초안은 세울 값이 도착하는 시점이 따로 있어 렌더 중
   * 동기화가 맡는다 — 두 자리가 같은 것을 지우면 어느 쪽이 정본인지 흐려진다.
   *
   * 나가는 중인 쓰기를 건드리지 않는 규율은 `resetIfIdle`이 갖는다 — **이 화면에서 `reset()`을
   * 부르는 자리는 넷이고**(대상 변경 · 창 닫기 · 창 열기 · 초안 파기) 그중 하나라도 규율을
   * 비껴가면 같은 결함의 두 번째 문이 열린다.
   *
   * **넷째 쓰기도 여기를 지난다.** 단계 배너는 고른 결재선에 매이는데, 대상이 바뀌는 길은
   * `editTargetKey`가 바뀌는 길과 같다(등록 폼으로 들어가도 단계 구획은 사라진다).
   */
  const resetEditing = (): void => {
    resetIfIdle(createWrite);
    resetIfIdle(updateWrite);
    resetIfIdle(activationWrite);
    resetIfIdle(stepsWrite);
    setFieldErrors({});
    setDialog(null);
  };

  /*
   * 위 함수는 매 렌더 새로 만들어지므로 그대로 의존성에 넣으면 **렌더마다 초기화가 돈다** —
   * 저장 실패 배너가 서자마자 지워져 사용자가 이유를 볼 수 없다.
   * 최신 함수를 참조로 들고 **편집 대상에만** 반응하게 한다.
   */
  const resetEditingRef = useRef(resetEditing);
  resetEditingRef.current = resetEditing;

  /**
   * 배너·창 수명 규칙의 **유일한 실행 지점.** 클릭 핸들러가 아니라 편집 대상에 묶는다 —
   * 클릭에만 두면 뒤로가기·앞으로가기·주소 직접 편집처럼 핸들러를 거치지 않는 경로가 샌다.
   * 그 경로에서 창이 살아남으면 **앞 결재선을 끄려고 연 창이 다음 결재선을 끈다**(쓰기 대상은
   * 지금 주소를 읽는다). 조건 변경·쪽 이동도 주소에서 `ar`·`new`를 떨구므로 여기를 지나간다.
   */
  useEffect(() => {
    resetEditingRef.current();
  }, [editTargetKey]);

  const changeValues = (patch: Partial<RouteFormValues>): void => {
    setDraft((prev) => (prev === null ? prev : { ...prev, values: { ...prev.values, ...patch } }));

    // 고치는 즉시 그 칸의 오류를 지운다 — 고친 값 옆에 낡은 오류가 남으면 안 된다.
    setFieldErrors((prev) => {
      const next = { ...prev };

      for (const key of Object.keys(patch)) delete next[key];

      return next;
    });

    for (const key of Object.keys(patch)) activeWrite.clearFieldError(key);
  };

  const saveDisabledReason =
    draft === null
      ? null
      : saveBlockedReason({
          mode: isCreating ? 'create' : 'edit',
          values: draft.values,
          approvalTypeOptionCount: approvalTypeOptions.length,
          isDirty,
          duplicate: saveDuplicate,
        });

  /**
   * 저장. **화면이 잡을 수 있는 오류가 있으면 요청을 보내지 않는다** — 보내 놓고 서버가
   * 되돌려 주기를 기다리면 사용자가 두 번 기다린다.
   *
   * 값 구간의 형식·짝 제약은 **버튼을 잠그지 않는다**(입력 도중에 붉은 글씨를 띄우지 않으려는
   * 것이다). 그래서 **보내는 자리가 스스로 한 번 더 본다** — 이 판정이 없으면 목이 200으로
   * 받아 어긋난 구간이 그대로 저장된다.
   */
  const handleSave = (): void => {
    if (draft === null || isLocked) return;

    const errors = validateRouteForm(draft.values, isCreating ? 'create' : 'edit');

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    /* 지금 보내는 것은 **이 대상의 것**이다 — 도착한 결과를 견줄 축을 여기서 세운다. */
    setWriteTargetKey(editTargetKey);

    if (isCreating) {
      createWrite.write(draft.values);

      return;
    }

    /* 고른 결재선이 없으면 보내지 않는다 — 「번호 0으로 나가는 요청」을 만들 여지를 두지 않는다. */
    if (selectedRouteId !== null) updateWrite.write(draft.values);
  };

  /** 취소. **고친 것이 있으면 한 걸음 둔다** — 되돌리면 친 값이 사라진다. */
  const handleCancel = (): void => {
    if (isLocked) return;

    if (isDirty) {
      setDialog('discard');

      return;
    }

    if (isCreating) closeCreateForm();
  };

  /**
   * 파기는 **서버를 부르지 않는다** — 초안을 기준값으로 되돌리거나 등록 폼을 닫을 뿐이다.
   *
   * **두 초안을 함께 되돌린다.** 창이 묻는 것은 「이 결재선을 고치던 것」 전체이고, 폼만
   * 되돌리면 저장하지 않은 단계 순서가 남아 「파기했는데 남아 있는」 자리가 생긴다.
   * 단계 초안만 고친 상태에서는 이 길에 닿지 않는다 — 취소는 폼이 더러울 때만 열린다.
   */
  const handleDiscard = (): void => {
    setDialog(null);
    setFieldErrors({});
    resetIfIdle(activeWrite);
    resetIfIdle(stepsWrite);
    setStepDraft((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));

    if (isCreating) {
      closeCreateForm();

      return;
    }

    setDraft((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
  };

  /**
   * 단계 저장이 막힌 사유. **버튼의 잠금과 보내는 자리의 재판정이 같은 값을 본다** —
   * 갈리면 「버튼은 눌리는데 아무 일이 없는」 자리나 그 반대가 생긴다.
   */
  const stepSaveDisabledReason =
    stepDraft === null
      ? null
      : stepSaveBlockedReason({
          drafts: stepDraft.values,
          baseline: stepDraft.baseline,
          isRouteFormDirty: isDirty,
        });

  /** 단계 초안을 갈아 끼우는 **유일한 자리**. 순서를 다루는 규칙은 전부 `step-draft.ts`가 갖는다. */
  const changeStepDrafts = (next: StepDraft[]): void => {
    setStepDraft((prev) => (prev === null ? prev : { ...prev, values: next }));
  };

  const handleAddStep = (approver: ApproverOption): void => {
    if (stepDraft === null || isLocked) return;

    const created = createStepDraft(approver);

    /* 승인자 없는 행은 만들지 않는다 — 그런 행이 서면 저장 자체가 막힌다. */
    if (created === null) return;

    changeStepDrafts([...stepDraft.values, created]);
  };

  const handleRemoveStep = (draftId: string): void => {
    if (stepDraft === null || isLocked) return;
    /* 마지막 한 단계는 지울 수 없다 — 버튼의 잠금만 믿지 않는다. */
    if (stepRemoveBlockedReason(stepDraft.values.length) !== null) return;

    changeStepDrafts(removeStepDraft(stepDraft.values, draftId));
  };

  const handleReorderStep = (from: number, to: number): void => {
    if (stepDraft === null || isLocked) return;

    changeStepDrafts(moveStepDraft(stepDraft.values, from, to));
  };

  /**
   * 단계 치환 저장. **보내는 자리가 스스로 한 번 더 본다** — 잠금 사유가 있으면 보내지 않고,
   * 본문을 만들 수 없으면(승인자 미확인·빈 배열) 요청 자체를 만들지 않는다.
   */
  const handleSaveSteps = (): void => {
    if (stepDraft === null || selectedRouteId === null || isLocked) return;
    if (stepSaveDisabledReason !== null) return;

    const body = toStepsReplaceBody(stepDraft.values);

    if (body === null) return;

    /* 지금 보내는 것은 **이 대상의 것**이다 — 도착한 결과를 견줄 축을 여기서 세운다. */
    setWriteTargetKey(editTargetKey);
    stepsWrite.write(body);
  };

  const openActivationDialog = (intent: ActivationIntent): void => {
    // 창을 열 때 앞선 전환 실패 배너를 걷는다 — 지금 하려는 일과 무관한 안내다.
    resetIfIdle(activationWrite);
    setDialog(intent);
  };

  /**
   * 전환 확인. **보내는 자리가 스스로 한 번 더 본다.**
   *
   * 창이 열려 있는 동안 세 가지가 달라질 수 있다 — 대상이 **사라지고**(주소가 바뀐다),
   * 켜기의 **잠금 사유가 생기고**(조준 조회가 늦게 도착한다), 대상의 **사용 여부가 뒤집힌다**
   * (「다시 조회」는 잠기지 않고, 다른 사람이 먼저 바꿀 수도 있다). 셋 다 보내지 않고 창을 닫는다.
   *
   * 사용 여부가 뒤집힌 자리를 보지 않으면 **이미 꺼진 것에 `:deactivate`가, 이미 켜진 것에
   * `:activate`가** 나간다 — 뒤엣것은 계약이 400으로 막아 사용자가 이유를 알 수 없는 거절을 받는다.
   */
  const handleConfirmActivation = (): void => {
    if (dialog !== 'deactivate' && dialog !== 'activate') return;

    if (selectedRouteId === null || route === null || isLocked) {
      setDialog(null);

      return;
    }

    /* 열려는 조작과 지금 상태가 맞는가. 끄기는 켜져 있을 때만, 켜기는 꺼져 있을 때만 뜻이 있다. */
    if (dialog === 'deactivate' ? !route.isActive : route.isActive) {
      setDialog(null);

      return;
    }

    if (
      dialog === 'activate' &&
      activateBlockedReason({ stepCount: route.stepCount, duplicate: activateDuplicate }) !== null
    ) {
      setDialog(null);

      return;
    }

    /* 지금 보내는 것은 **이 대상의 것**이다 — 도착한 결과를 견줄 축을 여기서 세운다. */
    setWriteTargetKey(editTargetKey);
    activationWrite.write(dialog);
  };

  const existingDuplicateRouteId =
    saveDuplicate.kind === 'blocked' ? saveDuplicate.existingRouteId : null;

  /**
   * 저장 실패 표시 — 배너와 **응답 없음 안내**를 함께 낸다.
   *
   * 멱등 3층 완화의 셋째 층이다(#55 · 계획 결정 16). 첫째는 전송 중 전면 잠금, 둘째는
   * 되돌릴 수 없는 조작의 확인 창, 셋째가 이것 — **응답이 오지 않은 요청은 「실패」가 아니라는
   * 사실**을 말한다. 훅이 호출마다 새 멱등 키를 만들어 그대로 다시 보내면 서버에는 다른
   * 요청으로 보인다.
   *
   * **네트워크 갈래에만 붙는다.** 서버가 거절한 요청은 전달된 것이 확실하다.
   */
  const writeFailureSlot = (
    write: ReturnType<typeof useMasterWrite<never, never>>,
    onReload?: () => void,
  ) => {
    /* 남의 대상에 보낸 요청의 거절 사유를 이 화면에 세우지 않는다 — **감추는 것이 규칙이다.** */
    const error = isWriteResultMine ? write.error : null;

    return (
      <>
        <SaveErrorBanner error={error} onReload={onReload} />
        {error?.kind === 'network' && <p className="field-note">{t.notes.networkUnconfirmed}</p>}
      </>
    );
  };

  /** 인라인 오류도 같은 문을 지난다 — 배너만 감추면 새 대상의 칸 옆에 남의 오류가 붙는다. */
  const serverFieldErrors = isWriteResultMine ? activeWrite.fieldErrors : {};

  const formPane = (mode: 'create' | 'edit') => {
    if (draft === null) return null;

    return (
      <RouteFormPane
        mode={mode}
        route={mode === 'create' ? null : route}
        values={draft.values}
        onChange={changeValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...serverFieldErrors, ...fieldErrors }}
        /* 등록에는 저장 충돌이 없다(잠글 대상이 없다) — 「최신 불러오기」를 낼 자리가 아니다. */
        banner={
          mode === 'create'
            ? writeFailureSlot(createWrite)
            : writeFailureSlot(updateWrite, reloadDetail)
        }
        approvalTypeOptions={approvalTypeOptions}
        businessUnitOptions={toBusinessUnitOptions(businessUnits.entries)}
        businessUnitNote={lookupNote(businessUnits)}
        /*
         * **저장할 뜻이 있을 때만 밝힌다.** 조준 조회는 꺼진 결재선을 고르기만 해도 나가지만
         * (켜기 판정에 필요하다) 그때 이 안내를 내면 **구경만 하는 사용자에게 저장 안내**가 뜬다.
         * 「밝힐 때만 밝힌다」 — 안내가 걸리는 자리를 저장 판정이 걸리는 자리와 맞춘다.
         */
        duplicateUnknownNote={
          (isCreating || isDirty) && saveDuplicate.kind === 'unknown'
            ? t.notes.duplicateUnknown
            : null
        }
        onOpenExisting={
          existingDuplicateRouteId === null
            ? null
            : () => {
                handleSelect(existingDuplicateRouteId);
              }
        }
        saveDisabledReason={saveDisabledReason}
        activateDisabledReason={
          route === null || route.isActive
            ? null
            : activateBlockedReason({ stepCount: route.stepCount, duplicate: activateDuplicate })
        }
        isDirty={isDirty}
        isLocked={isLocked}
        onSave={handleSave}
        onCancel={handleCancel}
        onDeactivate={() => {
          openActivationDialog('deactivate');
        }}
        onActivate={() => {
          openActivationDialog('activate');
        }}
      />
    );
  };

  const detailSlot = () => {
    /* 등록 중에는 상세도 단계도 부를 대상이 없다 — 붙일 자원이 아직 만들어지지 않았다. */
    if (isCreating) return formPane('create');

    if (isRouteNotFound || isRouteMissing) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <EmptyState
            size="sm"
            live
            title={t.empty.notFoundTitle}
            description={t.empty.notFoundDescription}
          />
        </section>
      );
    }

    if (selectedRouteId === null) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <EmptyState
            size="sm"
            title={t.empty.noSelectionTitle}
            description={t.empty.noSelectionDescription}
          />
        </section>
      );
    }

    if (detail.isError) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <LoadErrorBanner error={detail.error} onRetry={reloadDetail} />
        </section>
      );
    }

    if (route === null || draft === null) {
      return (
        <section className="pane" aria-label={t.panes.detail}>
          <div role="status" aria-label={t.loading.detail}>
            <SkeletonText lines={5} />
          </div>
        </section>
      );
    }

    return (
      <>
        {formPane('edit')}
        <StepPane
          /*
           * **대상마다 새로 세운다.** 추가 줄에서 고른 승인자는 그 구획 안에만 있는 값이라
           * 수명 표에 열이 없다 — 대신 대상이 바뀌면 부품째 다시 서게 해 앞 결재선에 넣으려던
           * 사람이 다음 결재선의 추가 줄에 남지 않게 한다.
           */
          key={String(selectedRouteId)}
          drafts={stepDraft === null ? null : stepDraft.values}
          isLoading={steps.isPending}
          loadError={
            steps.isError ? (
              <LoadErrorBanner
                error={steps.error}
                onRetry={() => {
                  void steps.refetch();
                }}
              />
            ) : null
          }
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다 — 버릴 입력이 없다. */
          banner={writeFailureSlot(stepsWrite, reloadDetail)}
          approverOptions={approvers.options}
          approverNote={approverNote(approvers)}
          approverTypeOptions={approverTypeOptions}
          approverTypeNote={approverTypeNote(approverTypeOptions)}
          isLocked={isLocked}
          saveDisabledReason={stepSaveDisabledReason}
          onAdd={handleAddStep}
          onRemove={handleRemoveStep}
          onReorder={handleReorderStep}
          onSave={handleSaveSteps}
        />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <>
            <Button variant="outlined" disabled={isLocked} onClick={handleCreate}>
              {t.actions.create}
            </Button>
            <Button variant="outlined" onClick={handleReload}>
              {t.actions.reload}
            </Button>
          </>
        }
      />

      {/*
       * 좌 목록 / 우 스택. `.pane-stack`은 3단 배치 전용이 아니라 일반 격자이며
       * (`display:grid; gap; align-content:start; min-width:0`) 이음매를 담는 쪽이 한 번에
       * 정의한다 — **2단 배치에서 쓰는 첫 사례다.** 문서 갱신은 두 번째 사용처에서 한다.
       */}
      <div className="two-pane">
        <section className="pane" aria-label={t.panes.list}>
          <RouteFilterBar
            appliedFilters={filters}
            approvalTypeOptions={approvalTypeOptions}
            businessUnitOptions={toBusinessUnitOptions(businessUnits.entries)}
            businessUnitNote={lookupNote(businessUnits)}
            businessUnitLabel={(businessUnitId) => businessUnitLabelOf(Number(businessUnitId))}
            onSearch={handleSearch}
            onRemoveFilter={handleRemoveFilter}
            onReset={() => {
              handleSearch(DEFAULT_FILTERS);
            }}
          />
          <RouteListPane
            routes={routes}
            isLoading={list.isPending}
            pageView={pageView}
            onChangePage={handleChangePage}
            selectedRouteId={selectedRouteId}
            onSelect={handleSelect}
            businessUnitLabel={businessUnitLabelOf}
            loadError={
              list.isError ? (
                <LoadErrorBanner
                  error={list.error}
                  onRetry={() => {
                    void list.refetch();
                  }}
                />
              ) : null
            }
          />
        </section>

        <div className="pane-stack">{detailSlot()}</div>
      </div>

      {/*
       * 창은 **열 때만 붙인다** — 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아
       * 지난 값이 그대로 살아 있게 된다.
       *
       * 고른 결재선이 없으면 붙이지 않는 것이 확인 핸들러의 가드와 짝을 이루는 이중 방어다.
       */}
      {(dialog === 'deactivate' || dialog === 'activate') && route !== null && (
        <ActivationDialog
          intent={dialog}
          approvalTypeCode={route.approvalTypeCode}
          inProgressCount={route.inProgressCount}
          stepCount={route.stepCount}
          isSaving={activationWrite.isSaving}
          /* 충돌은 상세를 다시 받아 잠금 토큰을 갱신하면 풀린다. 버릴 입력이 없다. */
          banner={writeFailureSlot(activationWrite, reloadDetail)}
          onClose={() => {
            /*
             * **창에서 나가는 길은 바닥 버튼 둘뿐이 아니다** — Escape가 남아 있고 그것은
             * 막을 수 없다(native `<dialog>`의 `cancel`). 그 길로 나갈 때 나가는 중인
             * 요청을 끊으면 대상 이동과 똑같이 무효화·성공·잠금이 함께 사라진다.
             */
            setDialog(null);
            resetIfIdle(activationWrite);
          }}
          onConfirm={handleConfirmActivation}
        />
      )}

      {dialog === 'discard' && (
        <DiscardConfirmDialog
          onConfirm={handleDiscard}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}
    </>
  );
};
