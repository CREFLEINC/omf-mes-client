import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText, useToast } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { SaveErrorBanner, useMasterWrite } from '../../patterns/master';
import { toApiError } from '../../patterns/request';
import { ActivationDialog } from './activation-dialog';
import {
  activationActionOf,
  activationIntentOf,
  judgeRemainingCoverage,
  type ActivationIntent,
} from './activation-guard';
import { ActivationPane } from './activation-pane';
import { findRuleBalance, toBalanceTargets, type RuleBalance } from './balance-lookup';
import { judgeCapacity } from './capacity-note';
import { DisabledAction } from './disabled-action';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { duplicateRuleIds } from './duplicate-badge';
import { judgeDuplicate } from './duplicate-check';
import {
  DEFAULT_FILTERS,
  clearFilter,
  isCreating as readIsCreating,
  readFilters,
  readPage,
  readSelectedRuleId,
  toCreateSearchParams,
  toSearchParams,
  toSelectionSearchParams,
  withoutSelection,
  type FilterKey,
} from './filters';
import { ItemPickerDialog } from './item-picker-dialog';
import { LoadErrorBanner } from './load-error-banner';
import { toLocationChoices } from './location-options';
import {
  describeLocation,
  describeReference,
  findLocationCapacity,
  findWarehouseLevel,
  lookupNote,
  nameLookupTruncatedNote,
  optionsPlaceholder,
  toLocation,
  toReference,
  toSelectOptions,
  useItemLookup,
  useLocationLookup,
  useUomLookup,
  useWarehouseLookup,
} from './lookups';
import {
  LOCATION_MANAGED_LEVEL_CODES,
  isLocationInputOpen,
  locationInputPendingNote,
} from './management-level';
import { toPageView } from './pagination';
import {
  putawayRuleKeys,
  ruleDetailPath,
  useDuplicateProbe,
  useRuleBalances,
  useRuleDetail,
  useRuleList,
  useUncoveredItems,
} from './queries';
import {
  emptyRuleFormValues,
  isSameRuleValues,
  ruleToFormValues,
  withWarehouse,
  type RuleFormValues,
} from './rule-draft';
import { RuleFilterBar } from './rule-filter-bar';
import { RuleFormPane } from './rule-form-pane';
import { RuleListPane } from './rule-list-pane';
import {
  toRuleCreate,
  toRuleUpdate,
  type PutawayRuleCreate,
  type PutawayRuleUpdate,
} from './rule-request';
import {
  RULE_FORM_FIELDS,
  parseIdentifier,
  parseIntegerValue,
  parseNumber,
  saveBlockedReason,
  validateRuleForm,
} from './rule-validation';
import { UncoveredItemsPane } from './uncovered-items-pane';
import {
  toRuleView,
  type PutawayRule,
  type RuleFilters,
  type RuleView,
  type UncoveredItem,
} from './types';

const t = messages.putawayRule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 읽는 판정이 매번 달라 보인다. */
const EMPTY_RULES: PutawayRule[] = [];
const EMPTY_UNCOVERED: UncoveredItem[] = [];

/**
 * 열려 있는 창. **한 번에 하나뿐이다** — 둘이 겹치면 어느 것을 확인한 것인지 알 수 없다.
 *
 * 초안 파기 창은 **두 자리에서 열린다**: 「취소」(되돌리기)와 「편집 중 다른 규칙 고르기」
 * (옮겨 가기). `next`가 그 둘을 가른다 — `null`이면 제자리에서 되돌리고, 값이 있으면 그
 * 주소로 옮겨 간다. 창을 두 벌 만들면 같은 문장을 두 자리에서 관리하게 된다.
 *
 * 사용 전환 창도 **한 벌을 갈래로 쓴다**(`intent`) — 끄기와 켜기가 말해야 하는 사실은 다르지만
 * 창의 수명·잠금·배너 규약이 같다.
 */
type DialogKind =
  | { kind: 'itemPicker' }
  | { kind: 'discard'; next: URLSearchParams | null }
  | { kind: 'activation'; intent: ActivationIntent };

/**
 * 폼 초안과 그것이 매인 대상.
 *
 * **`key`가 바뀔 때만 다시 세운다.** 서버 응답 객체에 매면 조회가 다시 돌 때마다(목록 갱신·
 * 캐시 무효화·재조회) 사용자가 치던 값이 서버 값으로 되돌아간다.
 */
interface FormDraft {
  key: string;
  baseline: RuleFormValues;
  values: RuleFormValues;
  /**
   * 창에서 방금 고른 품목의 이름.
   *
   * **이름 풀이 목록에 없을 수 있어 함께 들고 있는다** — 품목 찾기는 검색 조건으로 좁혀
   * 받으므로 좁히지 않은 이름 풀이 목록(잘릴 수 있다)에 그 품목이 없을 수 있다. 없으면
   * 방금 고른 품목이 폼에서 「알 수 없음」으로 보인다.
   */
  pickedItemLabel: string | null;
}

/**
 * W-06-14 적치 규칙 마스터 — **등록·수정 회차**.
 *
 * ## 이 회차가 하는 것과 하지 않는 것
 *
 * 규칙을 새로 만들고 고치고 **끄고 다시 켤 수 있다**. **라우트는 아직 열지 않는다**(다음
 * 회차) — 마스터의 네 조작이 다 서기 전에 화면을 노출하면 사용자가 잘못 만든 규칙을 어쩌지
 * 못한다. 그래서 이 화면은 아직 사용자에게 보이지 않고, 관찰은 시험으로 한다.
 *
 * ## 단계 전이 표
 *
 * | 단계 | 아는 근거 | 보이는 것 | 나가는 요청 |
 * | :-: | --- | --- | --- |
 * | **S0** 창고를 고르기 전 | `wh`가 없다 | 조건 줄 · 「창고를 고르세요」 안내 | **창고 목록뿐** |
 * | **S1** 창고를 골랐다 | `wh`가 있다 | 위 + 목록 표 + 규칙 없는 품목 + 「규칙을 고르세요」 | 목록 · 규칙 없는 품목 · 이름 풀이 · 보이는 (품목·위치)마다 잔액 |
 * | **S2** 규칙을 골랐다 | `rule`이 있다 | 위 + **수정 폼** | 위 + 상세 + **조준 조회** |
 * | **S3** 새로 만드는 중 | `new`가 있다 | 위 + **등록 폼** | 위 + 조준 조회(품목을 고른 뒤) |
 * | **S4** 그 규칙이 없다 | 상세가 **404** | 안내 「고른 규칙을 찾을 수 없습니다」 | 주소에서 `rule`을 정리한다 |
 *
 * **S2·S3이 함께 성립하지 않는다** — 고른 규칙과 등록 폼은 하나의 자리이며 그 규칙은
 * `filters.ts`가 갖는다(`toSelectionSearchParams`는 등록 표시를 담지 않는다).
 *
 * ## 조작별 상태 표
 *
 * | # | 조작 | 조건 | `page` | `rule`·`new` | 폼 초안 | 열린 창 | 저장 배너 |
 * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: |
 * | 1 | 창고 변경(품목 함께 비움) | 바뀐다 | **첫 쪽** | **비운다** | **비운다** | **닫는다** | **비운다** |
 * | 2 | 품목 변경 · 사용 중만 토글 · 조건 칩 × · 초기화 | 바뀐다 | 첫 쪽 | 비운다 | 비운다 | 닫는다 | 비운다 |
 * | 3 | 쪽 이동 | 유지 | 옮긴 쪽 | 비운다 | 비운다 | 닫는다 | 비운다 |
 * | 4 | 규칙 고르기 | 유지 | **유지** | 넣는다 | **비운다** | 닫는다 | 비운다 |
 * | 5 | 「규칙 추가」 | 유지 | 유지 | **등록을 켠다** | **빈 값으로 세운다** | 닫는다 | 비운다 |
 * | 6 | **상세가 404** | 유지 | 유지 | **비운다** | 비운다 | 닫는다 | 비운다 |
 * | 7 | 폼 입력 · 품목 고르기 | 유지 | 유지 | 유지 | 바뀐다 | 닫는다 | 유지 |
 * | 8 | 목록·상세·참조·잔액 **응답 도착** | 유지 | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 |
 * | 9 | 다시 조회 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 |
 * | 10 | **저장 성공(수정)** | 유지 | 유지 | 유지 | **서버 응답으로 다시 세운다** | 닫혀 있다 | 비운다 |
 * | 11 | **저장 성공(등록)** | 유지 | 유지 | **새 번호를 넣는다** | 새 대상에서 다시 세운다 | 닫혀 있다 | 비운다 |
 * | 12 | 저장 실패 | 유지 | 유지 | 유지 | **유지** | 닫혀 있다 | **세운다** |
 * | 13 | 취소(초안 파기) | 유지 | 유지 | 유지 | **되돌린다** | 닫는다 | 비운다 |
 * | 14 | **전송 중**(화면 안 조작) | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 |
 * | 15 | **전송 중 · 바깥 주소 이동** | 바뀐다 | 바뀐다 | 바뀐다 | **새 대상에서 세운다** | **닫는다** | **비운다** |
 *
 * **왜 이렇게 정했는가**
 *
 * - **1~6행이 초안과 배너를 비우는 이유**: 배너·창·초안은 **자기 대상보다 오래 살지 않는다.**
 *   대상이 바뀌면 배너가 가리킬 것이 없고, 남은 초안은 새 대상의 값처럼 보인다. 뒤로가기·주소
 *   직접 편집은 클릭 핸들러를 거치지 않으므로 **`editTargetKey`에 묶인 effect 한 곳**이 그 일을 한다.
 * - **8행이 이 화면의 「치던 값이 사라진다」 자리다**: 응답 도착이 초안을 되돌리면 그 결함이
 *   재현된다. 초안은 **응답 객체가 아니라 대상 키**에 매여 있다.
 * - **10·11행이 「서버 응답으로 다시 세우는」 이유**: 서버가 정본이다. 보낸 값을 그대로 두면
 *   서버가 조정한 결과를 놓친다.
 * - **14행이 대상을 바꾸는 길까지 잠그는 이유**(G-30): 열어 두면 사용자가 다른 규칙으로 옮긴 뒤
 *   **앞 요청의 결과가 지금 보는 맥락에 나타난다.**
 * - **15행이 14행과 갈리는 이유**: 뒤로가기·앞으로가기·주소 직접 편집은 화면의 클릭 핸들러를
 *   지나지 않아 잠금 문에 걸리지 않는다 — **막을 수 없는 길이므로 막는 대신 다룬다.**
 *   나가는 중인 요청을 **끊지 않고**(`resetIfIdle`) 도착한 결과 중 대상에 매인 것만 감춘다.
 *
 * ## 토큰 수명 표
 *
 * 토큰 보관소는 **응답이 온 URL 경로**를 열쇠로 쓴다(`packages/api-client/src/client.ts`).
 *
 * | 쓰기 | `If-Match` 출처(`etagPath`) | 응답이 `ETag`를 주는가 | 어느 경로에 남는가 | 성공 뒤 |
 * | --- | --- | :-: | --- | --- |
 * | 등록 `POST /logistics/putaway-rules` | **없음**(`null`) | 준다(201) | **컬렉션 경로** — 상세 토큰이 되지 않는다 | 새 번호를 고른다 → **상세 조회가 토큰을 확보** |
 * | 수정 `PUT /{id}` | **상세 경로** | 계약상 **선택** | 주면 상세 경로 | 무효화 → **재조회가 새 토큰을 확보** |
 * | 끄기·켜기 `POST /{id}:deactivate`·`:activate` | **상세 경로** | 계약상 **선택** | 주면 **액션 경로** — 상세 토큰이 낡는다 | 무효화 → **재조회가 새 토큰을 확보** |
 *
 * **규칙 하나로 요약한다 — 모든 쓰기 성공 뒤 `putawayRuleKeys.all`을 무효화한다.** 빠뜨리면
 * 두 번째 저장이 조용히 409로 죽거나, 훅이 토큰을 못 찾아 **요청을 보내지 않고 멈춘다.**
 *
 * ⚠ **전환 둘은 목록 행에서 곧바로 낼 수 없다**(위험 R2). 목록 응답에 잠금 토큰이 없고
 * `:activate`에도 `If-Match`가 **필수**다 — 상세 200이 온 뒤에만 손잡이가 열린다
 * (`activation-guard.ts`의 `activationIntentOf(null)`).
 */
export const PutawayRuleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { client } = useApiClient();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedRuleId = readSelectedRuleId(searchParams);
  const isCreating = readIsCreating(searchParams);

  /** 창고를 골랐는가. 이 화면의 거의 모든 조회가 이 하나에 걸린다. */
  const warehouseId = filters.warehouseId === '' ? null : Number(filters.warehouseId);

  const list = useRuleList(filters, page);
  const uncovered = useUncoveredItems(warehouseId);
  const detail = useRuleDetail(isCreating ? null : selectedRuleId);

  /* 창고 선택지는 첫 진입에 받는다 — 이 화면은 창고를 고르는 것으로 시작한다. */
  const warehouses = useWarehouseLookup();
  const locations = useLocationLookup(warehouseId);
  const items = useItemLookup(warehouseId !== null);
  const uoms = useUomLookup(warehouseId !== null);

  const rules = useMemo(() => (list.data?.items ?? EMPTY_RULES).map(toRuleView), [list.data]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rules.length);

  const balanceTargets = useMemo(() => toBalanceTargets(rules), [rules]);
  const balances = useRuleBalances(warehouseId, balanceTargets);

  const duplicatedRuleIds = useMemo(() => duplicateRuleIds(rules), [rules]);

  /**
   * 404 안내가 매인 대상. **조건·쪽의 서명**이며, 그것이 바뀌면 안내가 가리킬 것이 없다.
   * 조작마다 따로 지우면 뒤로가기·주소 직접 편집이 그 길을 지나지 않아 안내가 살아남는다.
   */
  const listContextKey = toSearchParams(filters, page).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);

  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isRuleNotFound =
    detailError !== null && detailError.kind === 'http' && detailError.status === 404;

  /**
   * 지금 편집 중인 대상. 배너·인라인 오류·창·초안이 **같은 이름 하나**를 본다 —
   * 각자 다른 값을 보게 두면 「어느 조작이 무엇을 지우는가」가 자리마다 갈린다.
   */
  const editTargetKey: string | null = isCreating
    ? 'new'
    : selectedRuleId === null
      ? null
      : String(selectedRuleId);

  const [draft, setDraft] = useState<FormDraft | null>(null);
  /** 보내기 전에 화면에서 잡은 오류. 저장을 누른 뒤에만 세운다 — 입력 도중에 붉은 글씨를 띄우지 않는다. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  /**
   * 마지막으로 보낸 쓰기가 **겨눈 대상**. 둘이 한 벌의 잠금을 나눠 써서 한 번에 하나만 나간다.
   *
   * 대상이 바뀌는 순간 나가는 중이던 요청은 **끊지 않는다**. 그 결과가 나중에 도착하면
   * **지금 대상과 견주어** 낼지 정한다 — 「결과는 자기 대상보다 오래 살지 않는다」가 요구하는
   * 것은 *보이지 않는 것*이지 *일어나지 않는 것*이 아니다. 서버에는 이미 갔다.
   */
  const [writeTargetKey, setWriteTargetKey] = useState<string | null>(null);

  /**
   * 마지막으로 보낸 **전환의 갈래**. 성공 문면이 끄기와 켜기로 갈리는데, 쓰기의 되먹임은
   * 보낸 값을 들고 오지 않는다. 창의 `intent`를 읽을 수는 없다 — 창은 그 사이에 닫힐 수 있고
   * (Escape·대상 변경) 목록 값도 성공 뒤에는 이미 뒤집혀 있다.
   *
   * 상태가 아니라 **참조**인 이유: 이 값은 그리는 데 쓰이지 않고 도착 시점에 한 번 읽힌다.
   */
  const sentIntentRef = useRef<ActivationIntent | null>(null);

  /**
   * **지금 대상**과 **보낸 대상**을 참조로 들고 있는다.
   *
   * 쓰기의 되먹임은 그 요청을 **보낸 렌더의 값**을 들고 도착한다. 그것이 「지금」의 것인지
   * 알려면 도착 시점의 두 값이 필요한데, 렌더에 갇혀 있어 참조로만 꺼낼 수 있다.
   * **매임의 축은 그대로 `editTargetKey` 하나**이고 참조는 그 축을 시간 너머로 옮길 뿐이다.
   */
  const editTargetKeyRef = useRef(editTargetKey);
  const writeTargetKeyRef = useRef(writeTargetKey);

  editTargetKeyRef.current = editTargetKey;
  writeTargetKeyRef.current = writeTargetKey;

  const rule: RuleView | null =
    detail.data === undefined ? null : toRuleView(detail.data.putawayRule);

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
      /* 등록 폼은 **고른 창고만** 미리 채운다 — 나머지 기본값을 지어내면 고르지 않은 값이 저장된다. */
      const seeded = emptyRuleFormValues(filters.warehouseId);

      setDraft({ key: editTargetKey, baseline: seeded, values: seeded, pickedItemLabel: null });
    } else if (rule !== null) {
      const seeded = ruleToFormValues(rule);

      setDraft({ key: editTargetKey, baseline: seeded, values: seeded, pickedItemLabel: null });
    }
  }

  const isDirty = draft !== null && !isSameRuleValues(draft.values, draft.baseline);

  const warehouseLabelOf = (id: string): string =>
    describeReference(toReference(warehouses, id === '' ? null : Number(id)));
  const itemLabelOf = (itemId: number): string => describeReference(toReference(items, itemId));
  const uomLabelOf = (uomId: number): string => describeReference(toReference(uoms, uomId));
  const locationLabelOf = (locationId: number | null): string =>
    describeLocation(toLocation(locations, locationId));
  /** 반환 타입을 적어 둔다 — 표에 넘기는 것이 **세 갈래 합타입**이라는 사실이 선언에서 읽힌다. */
  const balanceOf = (rule: RuleView): RuleBalance => findRuleBalance(balances, rule);

  /**
   * 폼이 고른 창고. **조건 줄의 창고와 갈릴 수 있다** — 등록에서는 다른 창고를 고를 수 있다.
   *
   * 위치 선택지와 위치 용량은 **이 창고**를 따라야 한다. 조건 줄의 창고를 따르면 폼에서 고른
   * 창고에 없는 위치가 선택지에 서고, 그 조합은 계약이 받지 않는다.
   */
  const formWarehouseId = parseIdentifier(draft?.values.warehouseId ?? '');
  /*
   * 캐시 열쇠가 창고 번호라 조건 줄과 폼이 같은 창고를 보는 동안에는 **요청이 한 번**만 나간다.
   * 폼이 다른 창고를 고른 순간에만 그 창고의 위치가 따로 선다.
   */
  const formLocations = useLocationLookup(formWarehouseId);

  const formLocationId = parseIdentifier(draft?.values.locationId ?? '');
  const formUomId = parseIdentifier(draft?.values.uomId ?? '');
  const formCapacity = parseNumber(draft?.values.capacityQty ?? '');
  const formPriority = parseIntegerValue(draft?.values.priorityNo ?? '');
  const formItemId = parseIdentifier(draft?.values.itemId ?? '');

  /**
   * 위치 자체 용량과 견준 결과. **견줄 값이 없으면 아무 말도 하지 않는다** —
   * 창고 전체 규칙(위치 없음) · 용량이 비어 있는 위치 · 목록 미도착·실패가 전부 그 자리다.
   */
  const capacityNote = judgeCapacity(
    findLocationCapacity(formLocations.capacities, formLocationId),
    {
      capacityQty: formCapacity.kind === 'number' ? formCapacity.value : null,
      uomId: formUomId,
    },
  );

  /**
   * 활성 중복 **조준 조회**.
   *
   * **폼이 닫혀 있으면 두 번호가 `null`이라 조회가 열리지 않는다** — 「폼이 열렸는가」를 따로
   * 넘기지 않는 이유다(같은 값을 두 번 말하면 언젠가 둘이 갈린다).
   *
   * **폼이 열리는 순간 부른다.** 「고친 것이 있을 때만」으로 미루면 첫 글자를 치는 순간 요청이
   * 나가고, 그 사이 판정이 「불러오는 중」이라 **막 치기 시작한 자리에서 안내가 깜빡인다.**
   * 미리 불러 두면 사용자가 저장을 누를 때쯤 답이 이미 와 있다.
   */
  const duplicateProbe = useDuplicateProbe(formWarehouseId, formItemId);

  /**
   * 저장이 만들려는 조합의 중복. **네 축이 전부 폼 값**이다 — 저장하면 그 값이 된다.
   * 자기 자신을 빼지 않으면 수정이 자기 때문에 늘 막힌다.
   */
  const saveDuplicate = judgeDuplicate(duplicateProbe, {
    itemId: formItemId,
    warehouseId: formWarehouseId,
    locationId: formLocationId,
    priorityNo: formPriority.kind === 'number' ? formPriority.value : null,
    selfRuleId: selectedRuleId,
  });

  /**
   * 켜기가 만들 조합의 중복. ⚠ **네 축이 전부 서버 값이다** — 전환은 폼을 저장하지 않으므로
   * 켜지는 것은 고치던 값이 아니라 **지금 서버에 있는 규칙**이다. 폼 초안에서 읽으면
   * 저장하지도 않은 조합으로 판정하게 된다(위치·우선순위는 폼에서 고칠 수 있다).
   *
   * 조준 조회 자체는 폼의 창고·품목으로 열리는데, **수정에서 그 둘은 잠겨 있어** 서버 값과
   * 갈릴 수 없다(계약이 수정 본문에서 두 키를 뺐다). 그 잠금이 풀리는 날 이 자리도 함께 본다.
   */
  const activateDuplicate = judgeDuplicate(duplicateProbe, {
    itemId: rule?.itemId ?? null,
    warehouseId: rule?.warehouseId ?? null,
    /* `null`은 「창고 전체」라는 확정된 값이다 — 그 뜻이 여기서도 그대로 흐른다. */
    locationId: rule?.locationId ?? null,
    priorityNo: rule?.priorityNo ?? null,
    selfRuleId: rule?.putawayRuleId ?? null,
  });

  /**
   * 끄고 나면 이 창고·품목에 남는 덮개. **끄기 확인 창의 문면을 가르는 값이다** —
   * 「끄면 위치 검증 없이 통과합니다」는 이것이 마지막 활성 규칙일 때만 참이다.
   *
   * ⚠ **바로 위 조준 조회와 축이 같아야 성립한다.** 조회는 폼 값으로 열리고 이 판정은 서버
   * 값으로 겨눈다 — 수정에서 품목·창고가 잠겨 있어 지금은 갈릴 수 없지만, **그 잠금이 풀리는
   * 회차는 이 자리를 함께 본다.** 어긋난 행이 섞여 오면 판정 함수가 세지 않고 「확인하지
   * 못했다」로 접는다(`activation-guard.ts`의 `outOfScope` — 세 갈래 중 가장 센 단언으로
   * 새지 않게 한다).
   */
  const remainingCoverage = judgeRemainingCoverage(duplicateProbe, {
    itemId: rule?.itemId ?? null,
    warehouseId: rule?.warehouseId ?? null,
    selfRuleId: rule?.putawayRuleId ?? null,
  });

  /** 지금 낼 수 있는 전환. **상세가 오기 전에는 `null`** — 잠금 토큰이 없다(위험 R2). */
  const activationIntent = activationIntentOf(rule === null ? null : rule.isActive);
  /** 전환 손잡이의 지금 상태. **막힘과 사유가 한 값이다** — 사유를 두 자리에서 만들지 않는다. */
  const activationAction = activationActionOf({
    intent: activationIntent,
    duplicate: activateDuplicate,
  });

  /**
   * 주소를 갈아 끼우는 **유일한 자리**. 404 안내를 여기서 함께 거둔다 —
   * 조회·초기화·쪽 이동·고르기·등록 성공이 모두 이 길을 지나므로 조작마다 따로 지울 자리가 없다.
   */
  const applySearchParams = (next: URLSearchParams): void => {
    setMissingContextKey(null);

    /* 같은 주소로는 갱신하지 않는다 — 화면을 바꾸지 않으면서 히스토리 칸만 늘어난다. */
    if (next.toString() === searchParams.toString()) return;

    setSearchParams(next);
  };

  /**
   * 상세가 404면 주소에 남은 번호를 정리하고, **그 순간의 서명**에 안내를 맨다.
   *
   * **히스토리를 늘리지 않는다**(`replace`) — 늘리면 뒤로가기가 없는 규칙으로 되돌아가고,
   * 그 자리에서 다시 404가 나 같은 정리가 되풀이된다(사본 체크리스트 1번).
   */
  useEffect(() => {
    if (!isRuleNotFound) return;

    setMissingContextKey(listContextKey);
    setSearchParams((prev) => withoutSelection(prev), { replace: true });
  }, [isRuleNotFound, listContextKey, setSearchParams]);

  const isRuleMissing =
    selectedRuleId === null && missingContextKey !== null && missingContextKey === listContextKey;

  /**
   * 등록 — **`If-Match`가 없다.** 아직 없는 자원이라 잠글 대상이 없다.
   *
   * 201이 `ETag`를 주지만 그것은 **컬렉션 경로**에 캡처되어 상세 토큰이 되지 않는다.
   * 새 규칙을 고르면 상세 조회가 나가고 **그 조회가 토큰을 확보한다.**
   */
  const createWrite = useMasterWrite<PutawayRuleCreate, PutawayRule>({
    request: (body, headers) =>
      client.POST('/logistics/putaway-rules', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [putawayRuleKeys.all],
    knownFields: RULE_FORM_FIELDS,
    onSuccess: (saved) => {
      setFieldErrors({});
      /*
       * 방금 만든 규칙을 연다 — 여기서 옮기지 않으면 사용자는 자기가 만든 규칙을 목록에서
       * 다시 찾아야 한다. **대상 가드를 두지 않는다**: 등록의 결과는 *새로 생긴 자원*이지
       * 그때 보던 대상이 아니다.
       */
      applySearchParams(toSelectionSearchParams(filters, page, saved.putawayRuleId));
      toast.show({ variant: 'success', description: messages.common.created });
    },
  });

  /**
   * 수정 — **다섯 필드를 늘 명시해 보낸다**(전체 교체). 잠금 토큰은 **상세 경로**에서 꺼낸다.
   *
   * 계약이 200의 `ETag`를 **선택**으로 두었다. 응답이 토큰을 주지 않는 서버에서도 두 번째
   * 저장이 살아야 하므로 성공 뒤 무효화해 **재조회가 새 토큰을 확보하게** 한다.
   */
  const updateWrite = useMasterWrite<PutawayRuleUpdate, PutawayRule>({
    request: (body, headers) =>
      client.PUT('/logistics/putaway-rules/{putawayRuleId}', {
        params: {
          path: { putawayRuleId: selectedRuleId ?? 0 },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': headers['If-Match'] ?? '',
          },
        },
        body,
      }),
    etagPath: selectedRuleId === null ? null : ruleDetailPath(selectedRuleId),
    invalidateKeys: [putawayRuleKeys.all],
    knownFields: RULE_FORM_FIELDS,
    onSuccess: (saved) => {
      /* 저장은 일어났다 — 대상이 바뀌었다고 그 사실까지 감추지 않는다. */
      toast.show({ variant: 'success', description: messages.common.saved });

      /*
       * **이 값이 앉을 자리는 그 대상뿐이다.** 보내는 사이에 다른 규칙으로 옮겨 갔다면
       * 새 대상의 초안에 **남의 값을 찍게 된다** — 무효화·토스트와 달리 이것은 대상에 매인다.
       */
      if (writeTargetKeyRef.current !== editTargetKeyRef.current) return;

      setFieldErrors({});
      /* **서버 응답이 정본이다.** 보낸 값을 그대로 두면 서버가 조정한 결과를 놓친다. */
      const next = ruleToFormValues(toRuleView(saved));

      setDraft((prev) => (prev === null ? prev : { ...prev, baseline: next, values: next }));
    },
  });

  /**
   * 사용 전환 — **본문이 없다.** 본문을 실으면 계약이 받지 않는다(요청 본문이 아예 없다).
   *
   * 두 오퍼레이션을 한 훅으로 다룬다 — 잠금 토큰도 무효화 범위도 실패 배너도 같고,
   * **한 번에 하나만 나갈 수 있다**(한 규칙이 켜져 있으면서 꺼져 있을 수 없다).
   *
   * 잠금 토큰은 **상세 경로**에서 꺼낸다. 요청 경로(`…:deactivate`)로 꺼내면 언제나 비어 있어
   * 전환이 통째로 멈춘다 — 증상은 「눌러도 아무 일이 없다」다. 그리고 200의 `ETag`는
   * **액션 경로**에 캡처되므로 상세 토큰이 낡는다 — 성공 뒤 무효화가 없으면 그다음 저장이
   * 조용히 409다.
   */
  const activationWrite = useMasterWrite<ActivationIntent, PutawayRule>({
    request: (intent, headers) => {
      /* 어느 갈래가 나갔는지 성공 문면이 알아야 한다 — 되먹임은 보낸 값을 들고 오지 않는다. */
      sentIntentRef.current = intent;
      const params = {
        path: { putawayRuleId: selectedRuleId ?? 0 },
        header: {
          'Idempotency-Key': headers['Idempotency-Key'],
          'If-Match': headers['If-Match'] ?? '',
        },
      };

      return intent === 'deactivate'
        ? client.POST('/logistics/putaway-rules/{putawayRuleId}:deactivate', { params })
        : client.POST('/logistics/putaway-rules/{putawayRuleId}:activate', { params });
    },
    etagPath: selectedRuleId === null ? null : ruleDetailPath(selectedRuleId),
    invalidateKeys: [putawayRuleKeys.all],
    /* 대응하는 입력칸이 없다 — 필드 오류도 전부 배너로 올린다. */
    knownFields: [],
    onSuccess: () => {
      /*
       * 전환은 일어났다 — 대상이 바뀌었다고 그 사실까지 감추지 않는다.
       *
       * ⛔ **저장 축의 「저장했습니다」를 쓰지 않는다.** 전환은 폼을 저장하지 않으며 이 화면은
       * **초안이 더러운 채로도 전환할 수 있다** — 그때 저장 문면을 내면 사용자가 고치던 값이
       * 저장된 것으로 읽는다.
       */
      toast.show({
        variant: 'success',
        description:
          sentIntentRef.current === 'deactivate' ? t.toast.deactivated : t.toast.activated,
      });

      /* 창은 그 대상의 것이다. 대상이 바뀌었으면 정리 effect가 이미 닫았다. */
      if (writeTargetKeyRef.current !== editTargetKeyRef.current) return;

      setDialog(null);
    },
  });

  /**
   * **세 쓰기가 한 벌의 잠금을 나눠 쓴다**(공유계약 G-30). 하나가 나가는 중에는 나머지도
   * 잠근다 — 동시에 나가면 뒤엣것이 409이고, 그 실패는 사용자가 한 일과 이어지지 않는다.
   */
  const isLocked = createWrite.isSaving || updateWrite.isSaving || activationWrite.isSaving;

  /** 지금 모드의 폼 쓰기. 등록과 수정이 한 폼을 쓰므로 배너·오류도 한 곳에서 골라 쓴다. */
  const activeWrite = isCreating ? createWrite : updateWrite;

  /** 훅에 남아 있는 쓰기 결과가 지금 보는 대상의 것인가. */
  const isWriteResultMine = writeTargetKey === editTargetKey;
  /**
   * **가릴 것 — 지금 이 대상의 *이* 쓰기인가.** 진행 표시는 자기 쓰기에만 돈다(G-30).
   *
   * ⛔ **전역 잠금(`isLocked`)으로 재지 않는다.** 쓰기가 셋이 되면서 그 둘이 갈렸다 —
   * 전환이 나가는 중에 잠금으로 재면 **손대지도 않은 폼이 「저장 중」이라고 말한다.**
   */
  const isSavingMine = activeWrite.isSaving && isWriteResultMine;
  const isActivationSavingMine = activationWrite.isSaving && isWriteResultMine;

  /**
   * **나가는 중인 쓰기는 건드리지 않는다.**
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 **옵저버를 떼어 낸다**. 옵저버가 떨어지면
   * 그 호출에 매달린 되먹임이 통째로 오지 않는다 — 무효화도, 성공도, 실패도, 공동 잠금의
   * 해제도. 요청은 이미 서버에 갔는데 화면만 없던 일로 친다(`omf-mes#96`).
   *
   * **끊는 것과 감추는 것은 다르다.** 도착한 결과를 화면에 낼지는 `isWriteResultMine`이
   * 정하고, 여기서는 **끝난 것만** 거둔다. `reset()`을 부르는 **모든 자리**가 이 함수를 지난다.
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /**
   * 편집 중이던 것을 통째로 거둔다 — 창 · 인라인 오류 · 저장 실패 배너.
   *
   * **초안은 여기서 다루지 않는다.** 초안은 세울 값이 도착하는 시점이 따로 있어 렌더 중
   * 동기화가 맡는다 — 두 자리가 같은 것을 지우면 어느 쪽이 정본인지 흐려진다.
   */
  const resetEditing = (): void => {
    resetIfIdle(createWrite);
    resetIfIdle(updateWrite);
    resetIfIdle(activationWrite);
    setFieldErrors({});
    setDialog(null);
  };

  /*
   * 위 함수는 매 렌더 새로 만들어지므로 그대로 의존성에 넣으면 **렌더마다 초기화가 돈다** —
   * 저장 실패 배너가 서자마자 지워져 사용자가 이유를 볼 수 없다.
   */
  const resetEditingRef = useRef(resetEditing);
  resetEditingRef.current = resetEditing;

  /**
   * 배너·창 수명 규칙의 **유일한 실행 지점.** 클릭 핸들러가 아니라 편집 대상에 묶는다 —
   * 클릭에만 두면 뒤로가기·앞으로가기·주소 직접 편집처럼 핸들러를 거치지 않는 경로가 샌다.
   */
  useEffect(() => {
    resetEditingRef.current();
  }, [editTargetKey]);

  /**
   * **사용자가** 대상·조건을 바꿀 수 있는가. 전송 중에는 지나가지 못한다(G-30 — 막는 것은 전역).
   *
   * 목록 행·조건 칩·쪽 이동은 컨트롤 자체가 잠기지 않으므로 **이 판정이 마지막 방어다** —
   * 그 길로 대상이 바뀌면 앞 요청의 결과가 지금 보는 맥락에 나타난다. 잠긴 사유는 폼 구획이
   * 상시 문구로 밝힌다(`t.notes.savingLock`).
   *
   * ⭐ **문이 둘인데 판정은 하나다.** 조건·쪽은 `applyUserNavigation`이, 편집 대상은
   * `navigateWithDraftGuard`가 지키는데 **둘 다 이 함수를 부른다** — 판정을 각자 두면
   * 언젠가 하나가 갈려 한쪽 길만 열린 채로 남는다.
   *
   * 쓰기 자신의 이동(등록 성공 뒤 새 규칙 열기)은 이 판정을 지나지 않는다.
   */
  const canUserNavigate = (): boolean => !isLocked;

  const applyUserNavigation = (next: URLSearchParams): void => {
    if (!canUserNavigate()) return;

    applySearchParams(next);
  };

  /**
   * 조건이 바뀌면 **첫 쪽으로 가고 편집 대상이 사라진다.** 보이는 행이 달라지므로 지금 쪽도
   * 고른 규칙도 그대로 둘 수 없다.
   */
  const applyFilters = (next: RuleFilters): void => {
    applyUserNavigation(toSearchParams(next, 1));
  };

  const handleRemoveFilter = (key: FilterKey): void => {
    applyFilters(clearFilter(filters, key));
  };

  const handleChangePage = (nextPage: number): void => {
    applyUserNavigation(toSearchParams(filters, nextPage));
  };

  /**
   * 편집 중이면 **한 걸음 둔다**(C3-15). 고른 규칙이 바뀌면 초안이 통째로 버려지는데,
   * 그것은 되돌릴 수 없는 조작이라 확인 없이 일어나면 안 된다.
   */
  const navigateWithDraftGuard = (next: URLSearchParams): void => {
    /*
     * ⛔ **잠금을 초안 확인보다 먼저 본다.** 뒤에 두면 잠긴 동안 파기 확인 창이 대신 열려,
     * 사용자가 「버리기」를 골라 대상을 바꿀 수 있다 — 잠금이 사라져도 창이 대신 막아 주는
     * 것처럼 보여 감지기까지 헛통과한다(뮤테이션 M8이 드러낸 형태).
     */
    if (!canUserNavigate()) return;

    if (isDirty) {
      setDialog({ kind: 'discard', next });

      return;
    }

    applySearchParams(next);
  };

  const handleSelect = (putawayRuleId: number): void => {
    navigateWithDraftGuard(toSelectionSearchParams(filters, page, putawayRuleId));
  };

  const handleCreate = (): void => {
    navigateWithDraftGuard(toCreateSearchParams(filters, page));
  };

  const reloadList = (): void => {
    void list.refetch();
  };

  const reloadDetail = (): void => {
    void detail.refetch();
  };

  /**
   * **넷을 함께 부른다.** 규칙을 고치면 규칙 없는 품목 수도 달라지고, 현재 적재는 이 화면과
   * 무관하게 현장에서 계속 움직인다 — 한쪽만 부르면 갱신된 값과 낡은 값이 한 화면에 섞이고,
   * 사용률은 **새 용량과 낡은 적재**로 계산된 수가 된다.
   *
   * **조준 조회는 여기서 부르지 않는다.** 그것은 보이는 자료가 아니라 저장 직전의 판정이고,
   * 모든 쓰기가 성공 뒤 `putawayRuleKeys.all`을 무효화하므로 저장과 저장 사이에 낡지 않는다.
   */
  const handleReload = (): void => {
    reloadList();
    void uncovered.refetch();
    balances.refetch();

    if (selectedRuleId !== null) reloadDetail();
  };

  /** 초안을 갈아 끼우는 **유일한 자리**. 창고를 바꾸면 위치를 함께 비우는 규칙도 여기 있다. */
  const changeValues = (patch: Partial<RuleFormValues>): void => {
    setDraft((prev) => {
      if (prev === null) return prev;

      const merged = { ...prev.values, ...patch };
      const next =
        patch.warehouseId === undefined ? merged : withWarehouse(merged, patch.warehouseId);

      return { ...prev, values: next };
    });

    // 고치는 즉시 그 칸의 오류를 지운다 — 고친 값 옆에 낡은 오류가 남으면 안 된다.
    setFieldErrors((prev) => {
      const next = { ...prev };

      for (const key of Object.keys(patch)) delete next[key];

      return next;
    });

    for (const key of Object.keys(patch)) activeWrite.clearFieldError(key);
  };

  /** 창에서 고른 품목. **이름을 함께 들고 온다** — 이름 풀이 목록에 없을 수 있다. */
  const handlePickItem = (picked: { itemId: number; itemCode: string; itemName: string }): void => {
    setDraft((prev) =>
      prev === null
        ? prev
        : {
            ...prev,
            values: { ...prev.values, itemId: String(picked.itemId) },
            pickedItemLabel: `${picked.itemCode} · ${picked.itemName}`,
          },
    );
    setFieldErrors((prev) => {
      const next = { ...prev };

      delete next.itemId;

      return next;
    });
    activeWrite.clearFieldError('itemId');
    setDialog(null);
  };

  const saveDisabledReason =
    draft === null
      ? null
      : saveBlockedReason({
          mode: isCreating ? 'create' : 'edit',
          isDirty,
          duplicate: saveDuplicate,
        });

  /**
   * 저장. **화면이 잡을 수 있는 오류가 있으면 요청을 보내지 않는다** — 보내 놓고 서버가
   * 되돌려 주기를 기다리면 사용자가 두 번 기다린다.
   *
   * **보내는 자리가 스스로 한 번 더 본다** — 버튼의 잠금과 같은 판정을 다시 지나고, 본문을
   * 만들 수 없으면 요청 자체를 만들지 않는다(「번호 0으로 나가는 요청」을 만들지 않는다).
   */
  const handleSave = (): void => {
    if (draft === null || isLocked) return;
    if (saveDisabledReason !== null) return;

    const errors = validateRuleForm(draft.values, isCreating ? 'create' : 'edit');

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;

    if (isCreating) {
      const body = toRuleCreate(draft.values);

      if (body === null) return;

      /* 지금 보내는 것은 **이 대상의 것**이다 — 도착한 결과를 견줄 축을 여기서 세운다. */
      setWriteTargetKey(editTargetKey);
      writeTargetKeyRef.current = editTargetKey;
      createWrite.write(body);

      return;
    }

    /* 고른 규칙이 없으면 보내지 않는다. */
    if (selectedRuleId === null) return;

    const body = toRuleUpdate(draft.values);

    if (body === null) return;

    setWriteTargetKey(editTargetKey);
    writeTargetKeyRef.current = editTargetKey;
    updateWrite.write(body);
  };

  /** 취소. **고친 것이 있으면 한 걸음 둔다** — 되돌리면 친 값이 사라진다. */
  const handleCancel = (): void => {
    if (isLocked) return;

    if (isDirty) {
      setDialog({ kind: 'discard', next: null });

      return;
    }

    if (isCreating) applySearchParams(toSelectionSearchParams(filters, page, null));
  };

  /**
   * 파기는 **서버를 부르지 않는다** — 초안을 기준값으로 되돌리거나 그 주소로 옮겨 갈 뿐이다.
   *
   * 옮겨 가는 갈래에서는 초안을 손대지 않는다 — 대상이 바뀌면 렌더 중 동기화가 초안을 버린다.
   * 여기서 함께 되돌리면 같은 일을 두 자리가 하게 되고, 언젠가 둘이 갈린다.
   */
  const handleDiscard = (next: URLSearchParams | null): void => {
    setDialog(null);
    setFieldErrors({});
    resetIfIdle(activeWrite);

    if (next !== null) {
      applySearchParams(next);

      return;
    }

    if (isCreating) {
      applySearchParams(toSelectionSearchParams(filters, page, null));

      return;
    }

    setDraft((prev) => (prev === null ? prev : { ...prev, values: prev.baseline }));
  };

  /**
   * 전환 확인 창을 연다.
   *
   * ⛔ **앞선 실패를 여기서 걷지 않는다.** 전례는 창을 열 때 배너를 걷었으나(「지금 하려는
   * 일과 무관한 안내다」) 이 화면에서 그 자리에 남아 있을 수 있는 실패는 **바로 그 일에 대한
   * 안내**다 — 전송 중 창이 닫힌 뒤 도착한 실패이며, 그 실패의 문면이 **「같은 버튼을 바로
   * 다시 누르지 마세요」**다. 창을 열면서 걷으면 **안내가 막으려던 이중 전송이 안내 없이
   * 열린다**(쓰기 훅은 호출마다 새 멱등 키를 만든다).
   *
   * 그래서 실패는 **창으로 옮겨 온다**(자리 배타 — `activationFailureSlot`). 걷는 자리는 둘로
   * 충분하다: 다시 보내는 순간(`write()`가 스스로 걷는다)과 대상이 바뀌는 순간(`resetEditing`).
   */
  const openActivationDialog = (intent: ActivationIntent): void => {
    if (isLocked) return;

    setDialog({ kind: 'activation', intent });
  };

  /**
   * 전환 확인. **보내는 자리가 스스로 한 번 더 본다.**
   *
   * 창이 열려 있는 동안 셋이 달라질 수 있다 — 대상이 **사라지고**(주소가 바뀐다), 대상의
   * **사용 여부가 뒤집히고**(「다시 조회」는 잠기지 않고 다른 사람이 먼저 바꿀 수도 있다),
   * 켜기의 **막힌 사유가 생긴다**(조준 조회가 늦게 도착한다). 셋 다 보내지 않고 창을 닫는다.
   *
   * 사용 여부가 뒤집힌 자리를 보지 않으면 **이미 꺼진 것에 `:deactivate`가, 이미 켜진 것에
   * `:activate`가** 나간다 — 뒤엣것은 계약이 400으로 막아 사용자가 이유를 알 수 없는 거절을 받는다.
   */
  const handleConfirmActivation = (): void => {
    if (dialog?.kind !== 'activation') return;

    if (selectedRuleId === null || rule === null || isLocked) {
      setDialog(null);

      return;
    }

    if (activationIntentOf(rule.isActive) !== dialog.intent) {
      setDialog(null);

      return;
    }

    if (
      activationActionOf({ intent: dialog.intent, duplicate: activateDuplicate }).kind !== 'open'
    ) {
      setDialog(null);

      return;
    }

    /* 지금 보내는 것은 **이 대상의 것**이다 — 도착한 결과를 견줄 축을 여기서 세운다. */
    setWriteTargetKey(editTargetKey);
    writeTargetKeyRef.current = editTargetKey;
    activationWrite.write(dialog.intent);
  };

  /**
   * 쓰기 실패 표시 — 배너와 **응답 없음 안내**를 함께 낸다.
   *
   * 멱등 완화의 마지막 층이다(공유계약 C-1). 첫째가 전송 중 전역 잠금, 둘째가 되돌릴 수 없는
   * 조작의 확인 창, 셋째가 이것 — **응답이 오지 않은 요청은 「실패」가 아니라는 사실**을
   * 말한다. 쓰기 훅은 호출마다 새 멱등 키를 만들어, 그대로 다시 보내면 서버에는 다른 요청으로
   * 보인다.
   *
   * **네트워크 갈래에만 붙는다.** 서버가 거절한 요청은 전달된 것이 확실하다 —
   * 400·403·409에 이 안내를 붙이면 확인된 사실을 「모른다」로 흐린다.
   *
   * **안내 문면은 축마다 다르다** — 확인할 자리와 하지 말아야 할 조작이 다르기 때문이다
   * (저장은 값을 다시 보내는 것, 전환은 같은 버튼을 다시 누르는 것).
   *
   * **매임을 지난다** — 남의 대상에 보낸 요청의 거절 사유를 이 화면에 세우지 않는다.
   */
  const writeFailureSlot = (
    write: { error: ApiError | null },
    unconfirmedNote: string,
    onReload?: () => void,
  ): ReactNode => {
    const error = isWriteResultMine ? write.error : null;

    return (
      <>
        <SaveErrorBanner error={error} onReload={onReload} />
        {error?.kind === 'network' && <p className="field-note">{unconfirmedNote}</p>}
      </>
    );
  };

  /** 인라인 오류도 같은 문을 지난다 — 배너만 감추면 새 대상의 칸 옆에 남의 오류가 붙는다. */
  const serverFieldErrors = isWriteResultMine ? activeWrite.fieldErrors : {};

  /**
   * 열려 있는 전환 창의 갈래. **`null`이면 창이 닫혀 있다.**
   *
   * 이 값 하나가 **실패가 서는 자리를 가른다**(아래 배타 규약). 「창이 열렸는가」를 자리마다
   * 따로 물으면 두 물음이 언젠가 갈려 사유가 둘 다 서거나 둘 다 사라진다.
   */
  const openActivationIntent: ActivationIntent | null =
    dialog?.kind === 'activation' ? dialog.intent : null;

  /**
   * 전환 실패가 서는 **하나의 자리** — 창이 열려 있으면 창, 닫혀 있으면 전환 구획.
   *
   * ⛔ **창 안에만 두면 잃는 갈래가 있다.** Escape는 막을 수 없고(native `<dialog>`의 `cancel`)
   * 전송 중에도 창이 닫힌다 — 그러면 **그 뒤 도착한 실패가 화면 어디에도 서지 않는다.** 성공
   * 토스트도 없고 목록 표식도 그대로라 사용자에게는 「아무 일도 없었다」로 읽히는데, 그때
   * 다음 조작이 정확히 금지된 조작(같은 버튼 다시 누르기 → **새 멱등 키로 이중 전송**)이다.
   * 이 회차가 가장 무겁게 쓴 문장(`activationUnconfirmed`)이 바로 그 조작을 막으려는 것이다.
   *
   * **두 자리에 함께 그리지 않는다.** 같은 사유가 창과 구획에 겹쳐 서면 사용자가 두 사건으로
   * 읽는다 — 창의 유무가 자리를 배타로 가른다.
   */
  const activationFailureSlot = (): ReactNode =>
    writeFailureSlot(
      activationWrite,
      t.notes.activationUnconfirmed,
      /* 409는 재조회로 풀린다 — 이 쓰기에는 잠글 대상이 있다(계약이 `If-Match`를 요구한다). */
      reloadDetail,
    );

  const listSlot = () => {
    /* 창고를 고르기 전에는 **빈 표가 아니라 안내다** — 빈 표는 「규칙이 없다」로 읽힌다. */
    if (warehouseId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noWarehouseTitle}
          description={t.empty.noWarehouseDescription}
        />
      );
    }

    return (
      <RuleListPane
        rules={rules}
        isLoading={list.isPending}
        pageView={pageView}
        onChangePage={handleChangePage}
        selectedRuleId={selectedRuleId}
        onSelect={handleSelect}
        itemLabel={itemLabelOf}
        locationLabel={locationLabelOf}
        uomLabel={uomLabelOf}
        balanceOf={balanceOf}
        duplicatedRuleIds={duplicatedRuleIds}
        nameLookupNote={nameLookupTruncatedNote(locations, uoms)}
        loadError={
          list.isError ? <LoadErrorBanner error={list.error} onRetry={reloadList} /> : null
        }
      />
    );
  };

  const formPane = () => {
    if (draft === null) return null;

    return (
      <RuleFormPane
        mode={isCreating ? 'create' : 'edit'}
        values={draft.values}
        onChange={changeValues}
        /*
         * 세 갈래다 — **창이 준 이름 → 이름 풀이 → 「아직 고르지 않았습니다」**.
         *
         * ⛔ **고르지 않은 칸에서 번호를 지어내지 않는다.** `Number('')`는 `0`이고 그 번호로
         * 참조를 풀면 목록에 없어 「알 수 없음」이 서는데, 이 슬라이스에서 그 낱말은
         * *값이 잘못됐다*는 뜻이다 — 아직 고르지 않은 것과 깨진 값을 사용자가 가를 수 없게 된다.
         * 널 안전한 `formItemId`를 쓰는 이유이며, 「번호 0으로 나가는」 형태를 만들지 않는
         * `rule-request.ts`의 규율과 같은 자리다.
         */
        itemLabel={
          draft.pickedItemLabel ??
          (formItemId === null ? t.form.itemNotChosen : itemLabelOf(formItemId))
        }
        warehouseLabel={warehouseLabelOf(draft.values.warehouseId)}
        onOpenItemPicker={() => {
          setDialog({ kind: 'itemPicker' });
        }}
        // 로컬 검증 결과가 서버 오류를 덮는다 — 지금 고칠 수 있는 것을 먼저 보인다.
        fieldErrors={{ ...serverFieldErrors, ...fieldErrors }}
        /* 등록에는 저장 충돌이 없다(잠글 대상이 없다) — 「최신 불러오기」를 낼 자리가 아니다. */
        banner={writeFailureSlot(
          activeWrite,
          t.notes.networkUnconfirmed,
          isCreating ? undefined : reloadDetail,
        )}
        warehouseOptions={toSelectOptions(warehouses)}
        warehouseNote={lookupNote(warehouses)}
        warehousePlaceholder={optionsPlaceholder(warehouses, t.filters.noWarehouseOptions)}
        locationChoices={toLocationChoices(formLocations)}
        locationNote={lookupNote(formLocations)}
        /*
         * 잠긴 사유는 **「아직 정해지지 않았다」가 아니다.** 자리표시가 채워져 칸이 잠기는 날
         * 그 문장을 세우면 화면이 「잠겼는데 **모든 창고에서 고를 수 있습니다**」라는
         * 자기모순을 말한다 — 두 문장을 처음부터 갈라 두었고, **이 자리가 그 갈래를 고르는
         * 유일한 배선**이다(`screen-managed-level.test.tsx`가 소생 상태를 모의해 잰다).
         */
        locationDisabledReason={
          isLocationInputOpen(
            LOCATION_MANAGED_LEVEL_CODES,
            findWarehouseLevel(warehouses.levels, formWarehouseId),
          )
            ? null
            : t.notes.locationNotManaged
        }
        locationPendingNote={locationInputPendingNote(LOCATION_MANAGED_LEVEL_CODES)}
        uomOptions={toSelectOptions(uoms)}
        uomNote={lookupNote(uoms)}
        uomPlaceholder={optionsPlaceholder(uoms, t.form.noUomOptions)}
        capacityNote={capacityNote}
        uomLabel={uomLabelOf}
        /**
         * **두 겹으로 억제한다.**
         *
         * ① `'incomplete'` — 겨눌 조합이 없으면 확인을 **시도한 적이 없다.** 그때 「확인하지
         *    못했습니다」는 거짓이다.
         * ② `(isCreating || isDirty)` — **전례에서 그대로 가져온 인자**다(「저장할 뜻이 있을
         *    때만 밝힌다」). 조준 조회는 규칙을 고르기만 해도 나가므로, 이것이 없으면 **구경만
         *    하는 사용자에게 저장 안내**가 뜬다. 안내가 걸리는 자리를 저장 판정이 걸리는
         *    자리와 맞춘다.
         */
        duplicateUnknownNote={
          (isCreating || isDirty) &&
          saveDuplicate.kind === 'unknown' &&
          saveDuplicate.reason !== 'incomplete'
            ? t.notes.duplicateUnknown
            : null
        }
        saveDisabledReason={saveDisabledReason}
        isDirty={isDirty}
        isLocked={isLocked}
        isSaving={isSavingMine}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  };

  /**
   * 편집 구획. **실패를 로딩보다 앞에서 판정한다**(C3-1 · 사본 대조 추가 ①) — 먼저 로딩을
   * 보면 실패한 조회가 영원히 「불러오는 중」으로 보이고, 사용자는 기다리면 될 일이라고 읽는다.
   */
  const editSlot = () => {
    if (isCreating) return formPane();

    if (isRuleNotFound || isRuleMissing) {
      return (
        <section className="pane" aria-label={t.panes.form}>
          <EmptyState
            size="sm"
            live
            title={t.empty.notFoundTitle}
            description={t.empty.notFoundDescription}
          />
        </section>
      );
    }

    if (selectedRuleId === null) {
      return (
        <section className="pane" aria-label={t.panes.form}>
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
        <section className="pane" aria-label={t.panes.form}>
          <LoadErrorBanner error={detail.error} onRetry={reloadDetail} />
        </section>
      );
    }

    /*
     * ⭐ **전환 구획은 초안보다 앞서 선다.** 상세가 아직 오지 않아 폼이 서지 못하는 동안에도
     * 「사용 전환은 규칙을 불러온 뒤에 쓸 수 있습니다」를 말할 자리가 있어야 한다 — 자리를
     * 비우면 그 사실이 화면 어디에도 없고 사용자는 손잡이를 찾다 만다(위험 R2).
     */
    return (
      <>
        {draft === null ? (
          <section className="pane" aria-label={t.panes.form}>
            <div role="status" aria-label={t.loading.detail}>
              <SkeletonText lines={5} />
            </div>
          </section>
        ) : (
          formPane()
        )}

        <ActivationPane
          action={activationAction}
          /* 창이 열려 있으면 창이 낸다 — 같은 사유를 두 자리에 겹쳐 세우지 않는다. */
          banner={openActivationIntent === null ? activationFailureSlot() : null}
          /*
           * **막지 않되 말한다**(C3-9와 같은 잣대). `'incomplete'`는 겨눌 조합이 없는 상태라
           * 확인을 **시도한 적이 없다** — 그때 「확인하지 못했습니다」는 거짓이다.
           */
          duplicateUnknownNote={
            activationIntent === 'activate' &&
            activateDuplicate.kind === 'unknown' &&
            activateDuplicate.reason !== 'incomplete'
              ? t.notes.activateDuplicateUnknown
              : null
          }
          isLocked={isLocked}
          isSaving={isActivationSavingMine}
          onStart={openActivationDialog}
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
            {/*
             * **잠긴 자리에는 반드시 사유가 붙는다**(배치 규범 4). 이 버튼은 두 사유로 잠기는데
             * 둘 다 사용자가 할 일이 다르다 — 창고를 고르거나(등록 본문이 창고를 요구한다),
             * 나가는 중인 요청을 기다리거나. 사유 없이 잠그면 고장으로 읽힌다.
             *
             * 폼 안 「등록」의 사유를 돌려 쓰지 않는다 — 사유는 **그 컨트롤의 이름으로 시작해야**
             * 사용자가 어느 버튼 이야기인지 되짚지 않는다.
             */}
            {warehouseId === null ? (
              <DisabledAction label={t.actions.create} reason={t.actionReasons.addNeedsWarehouse} />
            ) : isLocked ? (
              <DisabledAction
                label={t.actions.create}
                reason={t.actionReasons.addLockedByOtherSave}
              />
            ) : (
              <Button variant="outlined" onClick={handleCreate}>
                {t.actions.create}
              </Button>
            )}
            {/* 「다시 조회」는 잠그지 않는다 — 응답 없음 안내가 가리키는 **확인 자리**다. */}
            <Button variant="outlined" onClick={handleReload}>
              {t.actions.reload}
            </Button>
          </>
        }
      />

      {/*
       * **잠긴 이유를 상시 밝힌다**(G-30) — 자리가 **폼 밖**이다.
       *
       * 폼은 대상이 풀리면 닫히는데(뒤로가기·주소 직접 편집) 잠금은 요청이 끝날 때까지 남는다.
       * 사유를 폼 구획 안에 두면 **폼이 닫힌 채 잠긴 갈래**에서 잠긴 이유가 화면 어디에도 없다.
       * 전환(끄기·켜기)은 초안이 서기 전에도 시작될 수 있어 그 갈래가 흔해진다.
       */}
      {isLocked && <p className="field-note">{t.notes.savingLock}</p>}

      <div className="pane-stack">
        <section className="pane" aria-label={t.panes.list}>
          <RuleFilterBar
            appliedFilters={filters}
            warehouseOptions={toSelectOptions(warehouses)}
            warehouseNote={lookupNote(warehouses)}
            /*
             * ⛔ **「고를 창고가 없습니다」는 조회가 실제로 0건을 돌려줬을 때에만 말한다.**
             * 조건 줄은 배열 길이밖에 볼 수 없어 미도착·실패를 「없다」와 가를 수 없다.
             */
            warehousePlaceholder={optionsPlaceholder(warehouses, t.filters.noWarehouseOptions)}
            itemOptions={toSelectOptions(items)}
            itemNote={lookupNote(items)}
            itemPlaceholder={optionsPlaceholder(items, t.filters.noItemOptions)}
            warehouseLabel={warehouseLabelOf}
            itemLabel={(itemId) => itemLabelOf(Number(itemId))}
            onApply={applyFilters}
            onRemoveFilter={handleRemoveFilter}
            onReset={() => {
              applyFilters(DEFAULT_FILTERS);
            }}
          />
          {listSlot()}
        </section>

        {/* 창고를 고른 뒤에만 편집 자리가 선다 — 그전에는 만들 대상도 고를 대상도 없다. */}
        {warehouseId !== null && editSlot()}

        {warehouseId !== null && (
          <UncoveredItemsPane
            items={uncovered.data?.items ?? EMPTY_UNCOVERED}
            total={uncovered.data?.page.total ?? 0}
            isLoading={uncovered.isPending}
            loadError={
              uncovered.isError ? (
                <LoadErrorBanner
                  error={uncovered.error}
                  onRetry={() => {
                    void uncovered.refetch();
                  }}
                />
              ) : null
            }
          />
        )}
      </div>

      {/*
       * 창은 **열 때만 붙인다** — 디자인 시스템 `Dialog`는 닫혀도 내용이 DOM에 남아
       * 지난 값(검색어·검색 결과)이 그대로 살아 있게 된다.
       */}
      {dialog?.kind === 'itemPicker' && (
        <ItemPickerDialog
          onPick={handlePickItem}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}

      {dialog?.kind === 'discard' && (
        <DiscardConfirmDialog
          onConfirm={() => {
            handleDiscard(dialog.next);
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      )}

      {/*
       * 전환 확인 창. **대상 없이는 열지 않는다** — 무엇을 끄는지 말할 수 없는 창은
       * 확인을 받은 것이 아니다.
       */}
      {openActivationIntent !== null && rule !== null && (
        <ActivationDialog
          intent={openActivationIntent}
          itemLabel={itemLabelOf(rule.itemId)}
          locationLabel={locationLabelOf(rule.locationId)}
          remaining={remainingCoverage}
          isSaving={isActivationSavingMine}
          banner={activationFailureSlot()}
          onClose={() => {
            setDialog(null);
            /*
             * ⛔ **나가는 중인 요청은 끊지 않는다.** Escape·취소로 창에서 나가는 길이 옵저버를
             * 떼면 무효화·성공·잠금 해제가 통째로 오지 않는다 — 토큰 수명 표가 「반드시 부른다」고
             * 적은 재조회가 그때 빠진다.
             */
            resetIfIdle(activationWrite);
          }}
          onConfirm={handleConfirmActivation}
        />
      )}
    </>
  );
};
