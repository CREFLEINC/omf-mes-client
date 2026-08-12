import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { ActivationDialog, type ActivationIntent } from './activation-dialog';
import { PLACEHOLDER_APPROVAL_TYPE_CODES, toApprovalTypeOptions } from './code-options';
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
import { StepPane } from './step-pane';
import {
  toRouteView,
  toStepView,
  type ApprovalRoute,
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
 * 표에 오르지 않은 상태는 규칙이 닿지 않는 사각이 된다. **스무째 조작이나 넷째 쓰기가 생기면
 * 표에 행을 먼저 더한 뒤에 코드를 고친다.** 단계 초안은 아직 없다(PR ④가 열을 더한다).
 *
 * | # | 조작 | 조건 4종 | `page` | `ar` | `new` | 폼 초안 | **열린 창** | **폼 배너** |
 * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
 * | 1 | 조건 변경·조회 | 바뀐다 | **첫 쪽** | **비운다** | **끈다** | **비운다** | **닫는다** | **비운다** |
 * | 2 | 초기화 | **비운다** | 첫 쪽 | 비운다 | 끈다 | 비운다 | 닫는다 | 비운다 |
 * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** | **끈다** | 비운다 | 닫는다 | 비운다 |
 * | 4 | 결재선 고르기·해제 | 유지 | **유지** | 넣고 뺀다 | 끈다 | **비운다** | 닫는다 | 비운다 |
 * | 5 | 「새 결재선」 | 유지 | 유지 | **비운다** | **켠다** | **빈 값으로 세운다** | 닫는다 | 비운다 |
 * | 6 | **상세가 404** | 유지 | 유지 | **비운다** | 끈다 | 비운다 | 닫는다 | 비운다 |
 * | 7 | 폼 입력 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | **유지** |
 * | 8 | 목록·상세·참조 **응답 도착** | 유지 | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 |
 * | 9 | **다시 조회**(새로고침) | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 |
 * | 10 | **폼 저장 성공(수정)** | 유지 | 유지 | 유지 | 끈다 | **서버 응답으로 다시 세운다** | 닫혀 있다 | 비운다 |
 * | 11 | **폼 저장 성공(등록)** | 유지 | 유지 | **새 번호를 넣는다** | **끈다** | 새 대상에서 다시 세운다 | 닫혀 있다 | 비운다 |
 * | 12 | 폼 저장 실패 | 유지 | 유지 | 유지 | 유지 | **유지** | 닫혀 있다 | **세운다** |
 * | 13 | **끄기·켜기 성공** | 유지 | 유지 | 유지 | 유지 | **유지** | **닫는다** | 비운다 |
 * | 14 | 끄기·켜기 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 창 안에 **세운다** |
 * | 15 | 취소(초안 파기) | 유지 | 유지 | 유지 | 유지 | **되돌린다** | 닫는다 | 비운다 |
 * | 16 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 유지 |
 *
 * **왜 이렇게 정했는가**
 *
 * - **1~6행이 창을 닫고 배너를 비우는 이유**: 배너·창은 **자기 대상보다 오래 살지 않는다.**
 *   대상이 바뀌면 배너가 가리킬 것이 없고, 열린 창은 사용자가 확인한 것과 나가는 것을 가른다 —
 *   앞 결재선을 끄려고 연 창이 다음 결재선을 끄게 된다. 뒤로가기·주소 직접 편집은 클릭 핸들러를
 *   거치지 않으므로 **`editTargetKey`에 묶인 effect 한 곳**이 그 일을 한다.
 * - **8행이 이 화면의 #43 자리다**: 응답 도착이 초안을 되돌리면 「치던 값이 사라진다」가
 *   재현된다. 초안은 **응답 객체가 아니라 대상 키**에 매여 있다.
 * - **10·13행이 초안을 「서버 응답으로 다시 세우거나 유지하는」 이유**: 서버가 정본이다.
 *   보낸 값을 그대로 두면 서버가 조정한 결과(파생값 `stepCount`·`inProgressCount`)를 놓친다.
 *   반면 사용 전환은 **폼 필드가 아니라서**(계약이 `isActive`를 PUT에서 뺐다) 켜고 끄는 일이
 *   편집 중인 값을 버릴 이유가 없다.
 * - **11행이 주소를 한 번만 갱신하는 이유**: `new` 해제와 `ar` 설정을 **한 patch로** 한다.
 *   두 번 갱신하면 그 사이에 「고른 것도 만드는 것도 아닌」 한 프레임이 히스토리에 남는다.
 * - **14행이 창을 닫지 않는 이유**: 닫으면 사용자는 무엇이 막았는지 모른 채 같은 버튼을 다시 누른다.
 * - **16행이 대상을 바꾸는 길까지 잠그는 이유**: 열어 두면 사용자가 다른 결재선으로 옮긴 뒤
 *   **앞 요청의 결과가 지금 보는 맥락에 나타난다.**
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
 * | 단계 치환 `PUT /{id}/steps`(PR ④) | **상세 경로**(결재선 토큰) | **주지 않는다** | 없음 | **반드시 부른다** |
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
  const stepViews = useMemo(() => (steps.data?.items ?? []).map(toStepView), [steps.data]);

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

  const [draft, setDraft] = useState<FormDraft | null>(null);
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

  const approvalTypeOptions = toApprovalTypeOptions(PLACEHOLDER_APPROVAL_TYPE_CODES);

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
    }
  };

  const reloadDetail = (): void => {
    void detail.refetch();
  };

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
      setFieldErrors({});
      /* **서버 응답이 정본이다.** 보낸 값을 그대로 두면 서버가 조정한 결과를 놓친다. */
      const next = routeToFormValues(toRouteView(saved));

      setDraft((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
      toast.show({ variant: 'success', description: messages.common.saved });
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
      setDialog(null);
      toast.show({ variant: 'success', description: messages.common.saved });
    },
  });

  /**
   * **네 쓰기가 한 벌의 잠금 토큰을 나눠 쓴다.** 하나가 나가는 중에는 나머지도 잠근다 —
   * 동시에 나가면 뒤엣것이 반드시 409이고, 그 실패는 사용자가 한 일과 이어지지 않는다.
   */
  const isLocked = createWrite.isSaving || updateWrite.isSaving || activationWrite.isSaving;

  /** 지금 모드의 쓰기. 등록과 수정이 한 폼을 쓰므로 배너·오류·진행 표시도 한 곳에서 골라 쓴다. */
  const activeWrite = isCreating ? createWrite : updateWrite;

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
   */
  const resetEditing = (): void => {
    createWrite.reset();
    updateWrite.reset();
    activationWrite.reset();
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

  /** 파기는 **서버를 부르지 않는다** — 초안을 기준값으로 되돌리거나 등록 폼을 닫을 뿐이다. */
  const handleDiscard = (): void => {
    setDialog(null);
    setFieldErrors({});
    activeWrite.reset();

    if (isCreating) {
      closeCreateForm();

      return;
    }

    setDraft((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
  };

  const openActivationDialog = (intent: ActivationIntent): void => {
    // 창을 열 때 앞선 전환 실패 배너를 걷는다 — 지금 하려는 일과 무관한 안내다.
    activationWrite.reset();
    setDialog(intent);
  };

  /**
   * 전환 확인. **보내는 자리가 스스로 한 번 더 본다** — 창이 열려 있는 동안 주소가 바뀌어
   * 대상이 사라졌을 수 있다. 그때는 보내지 않고 창을 닫는다.
   */
  const handleConfirmActivation = (): void => {
    if (dialog !== 'deactivate' && dialog !== 'activate') return;

    if (selectedRouteId === null || route === null || isLocked) {
      setDialog(null);

      return;
    }

    if (dialog === 'activate' && activateBlockedReason({ stepCount: route.stepCount, duplicate: activateDuplicate }) !== null) {
      setDialog(null);

      return;
    }

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
    error: ReturnType<typeof useMasterWrite<never, never>>['error'],
    onReload?: () => void,
  ) => (
    <>
      <SaveErrorBanner error={error} onReload={onReload} />
      {error?.kind === 'network' && <p className="field-note">{t.notes.networkUnconfirmed}</p>}
    </>
  );

  const formPane = (mode: 'create' | 'edit') => {
    if (draft === null) return null;

    return (
      <RouteFormPane
        mode={mode}
        route={mode === 'create' ? null : route}
        values={draft.values}
        onChange={changeValues}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...activeWrite.fieldErrors, ...fieldErrors }}
        /* 등록에는 저장 충돌이 없다(잠글 대상이 없다) — 「최신 불러오기」를 낼 자리가 아니다. */
        banner={
          mode === 'create'
            ? writeFailureSlot(createWrite.error)
            : writeFailureSlot(updateWrite.error, reloadDetail)
        }
        approvalTypeOptions={approvalTypeOptions}
        businessUnitOptions={toBusinessUnitOptions(businessUnits.entries)}
        businessUnitNote={lookupNote(businessUnits)}
        /* 확인해야 할 때만 「확인하지 못했다」가 참이다 — 부르지도 않은 판정을 안내로 내지 않는다. */
        duplicateUnknownNote={
          needsDuplicateCheck && saveDuplicate.kind === 'unknown' ? t.notes.duplicateUnknown : null
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
          steps={stepViews}
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
          banner={writeFailureSlot(activationWrite.error, reloadDetail)}
          onClose={() => {
            setDialog(null);
            activationWrite.reset();
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
