import {
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  Tabs,
  type TabItem,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';

import {
  hasPostedLine,
  isApprovalJudgePending,
  readSubmission,
  toRequestProgressView,
  APPROVED_APPROVAL_STATUS_CODES,
  REJECTION_DECISION_CODES,
} from './approval-progress';
import { ApprovalProgressPane, type ApprovalProgressState } from './approval-progress-pane';
import {
  DEFECT_WAREHOUSE_TYPE_CODES,
  isDefectWarehouseTypePending,
  narrowToDefectWarehouses,
  PLACEHOLDER_DISPOSAL_ISSUE_CODES,
  toCodeOptionSets,
} from './code-options';
import { DiscardConfirmDialog } from './discard-confirm-dialog';
import { DisposalForm } from './disposal-form';
import { describeDisposalSelection, toDisposalLineRows } from './disposal-selection';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedReceiptId,
  SELECTION_KEYS,
  toFilterQuery,
  toSearchParams,
  type ReceiptFilters,
  type RemovableChipKey,
} from './filters';
import { GiFilterBar } from './gi-filter-bar';
import { GiTable } from './gi-table';
import { GrFilterBar } from './gr-filter-bar';
import { GrLineTable } from './gr-line-table';
import { GrTable } from './gr-table';
import {
  clearIssueFilter,
  DEFAULT_ISSUE_FILTERS,
  HISTORY_SELECTION_KEYS,
  readIssueFilters,
  readIssuePage,
  readSelectedIssueId,
  toHistorySearchParams,
  toIssueFilterQuery,
  type IssueFilters,
  type RemovableIssueChipKey,
} from './history-filters';
import { IssueDetailPane } from './issue-detail-pane';
import { IssueLineTable } from './issue-line-table';
import {
  toBusinessDate,
  toDestinationId,
  toDisposalLines,
  toGoodsIssueRequest,
  toIssuedLocal,
} from './issue-request';
import {
  EMPTY_LINE_DRAFT,
  hasAnyLineDraftValue,
  setDraftQty,
  toggleLineSelection,
  type LineDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  useLocationOptions,
  useLotOptions,
  useUomOptions,
  useWarehouseOptions,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  isIssueNotFound,
  isReceiptNotFound,
  useApprovalRequest,
  useCreateGoodsIssue,
  useGoodsIssueDetail,
  useGoodsIssues,
  useGoodsReceiptDetail,
  useGoodsReceipts,
  useIssueDetailFetcher,
  useOnHandBalances,
  useRequestApproval,
} from './queries';
import { firstLineOf, readReason, toApprovalRequest } from './reason-draft';
import { ReceiptSummaryPane } from './receipt-summary-pane';
import { RegisterResultPane, type ResultLineSummary } from './register-result-pane';
import { ResubmitConfirmDialog } from './resubmit-confirm-dialog';
import { ResubmitPane } from './resubmit-pane';
import { SubmitConfirmDialog, type SubmitLineSummary } from './submit-confirm-dialog';
import {
  DISPOSAL_ISSUE_TABS,
  readTab,
  TAB_KEY,
  tabLabel,
  toTabParam,
  type DisposalIssueTab,
} from './tabs';
import {
  EMPTY_DISPOSAL_DRAFT,
  formatDateTime,
  hasAnyDisposalDraftValue,
  type DisposalCodeKey,
  type DisposalDraft,
  type IssueDetailResult,
  type IssueLineView,
  type IssueView,
  type ReceiptLineView,
  type ReceiptView,
  type SelectOption,
  type WarehouseEntry,
} from './types';
import { disposalBlockReason, resubmitBlockReason, validateDisposalDraft } from './validation';

const t = messages.disposalIssue;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: ReceiptView[] = [];
const EMPTY_LINES: ReceiptLineView[] = [];
const EMPTY_ISSUE_ROWS: IssueView[] = [];
const EMPTY_ISSUE_LINES: IssueLineView[] = [];
const NO_ITEM_IDS: number[] = [];
const NO_FIELD_ERRORS: Record<string, string> = {};

/**
 * 「품의 상신」 연쇄가 어디까지 갔는가 — **화면이 확인한 사실만 담는다**(승인 기록 정정 1-1).
 *
 * 사용자 조작은 하나인데 요청은 둘이다. 그 사이에 **전표는 만들어졌고 상신은 아직**인 순간이
 * 실재하며, 둘째 요청이 실패하면 그 상태로 **남는다** — 통째로 실패로 말하면 사용자가 처음부터
 * 다시 만들어 전표가 두 벌 되고, 통째로 성공으로 말하면 결재에 올라가지 않은 품의를 올라간
 * 것으로 믿는다.
 *
 * | 갈래 | 무슨 일이 있었나 |
 * | --- | --- |
 * | `none` | 아직 아무것도 만들지 않았다(등록 자체가 실패한 뒤도 여기다 — 전표가 없다) |
 * | `created` | **전표는 만들어졌다.** 상신은 진행 중이거나 실패했다 |
 * | `submitted` | 둘 다 끝났다 |
 *
 * `tokenSettled`는 **잠금 토큰을 얻는 사이의 틈**을 덮는다. 상신의 `If-Match`는 출고 상세
 * 200에서만 오므로(계약) 전표 생성과 상신 사이에 조회가 하나 더 들어가는데, 그 틈에 두 쓰기
 * 모두 「보내는 중」이 아니어서 잠금이 풀리면 **연타로 전표가 두 벌** 만들어진다.
 */
type SubmitChain =
  | { kind: 'none' }
  | { kind: 'created'; issue: IssueDetailResult; reason: string; tokenSettled: boolean }
  | { kind: 'submitted'; issue: IssueDetailResult };

const NO_CHAIN: SubmitChain = { kind: 'none' };

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 창고를 `includeInactive=true`로 받는 이유는
 * 미사용 창고로 들어온 과거 입고의 이름을 풀기 위해서인데, 그 입고들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다.
 */
const toSelectOptions = (entries: readonly WarehouseEntry[]): SelectOption[] =>
  entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-06 컨테이너 — **폐기 품의를 올릴 대상을 고르고, 이미 올라간 품의를 읽는 화면**이다.
 *
 * **탭이 둘이고 대상이 둘이다.** 「품의 발의」 탭은 고른 **입고 전표**(`gr`)를 다루고,
 * 「처리 이력」 탭은 고른 **품의**(`gi`)를 다룬다. 두 대상은 서로를 비우지 않는다 —
 * 발의해 놓고 이력에서 이어서 다루는 것이 이 화면의 정상 경로이기 때문이다(수명 표 8행).
 *
 * **결재는 이 화면이 하지 않는다.** 승인·반려는 결재함(W-CO-09)이 소유하고 여기서는
 * 결재 진행을 **읽기만** 한다 — 탭 줄의 안내가 그 사실을 밝힌다.
 *
 * 배치는 각 탭 안에서 상하로 쌓는다 — 위: 조건 줄과 목록 / 아래: 고른 것의 구획.
 * 탭·조회 조건·고른 것은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **이 회차에 쓰기가 둘 생긴다**(전표 생성 · 상신). 사용자 조작은 「품의 상신」 **한 번**이고
 * 그 한 번이 요청 둘을 잇는다(승인 기록 정정 1-1) — 계약에 「등록하고 상신한다」가 없어
 * 두 요청이며, 그 사이에 **잠금 토큰을 얻는 상세 조회**가 하나 더 든다.
 *
 * **중간 상태를 숨기지 않는다.** 「전표는 만들어졌고 상신이 실패했다」가 실재하는 상태이고,
 * 그때 화면은 통째로 실패라고도 통째로 성공이라고도 말하지 않는다 — 그 전표는 **「처리 이력」
 * 탭에서 이어서 상신**한다. 상신 자리가 둘이면 규칙이 둘이 되므로, **이미 만들어진 전표를
 * 올리는 자리는 이력 탭 하나**다(계획 결정 6).
 *
 * **기타출고 처리(전기)는 아직 없다.** 그때까지 이 화면은 **라우트에도 사이드바에도 등록되지
 * 않는다** — 승인까지 받아 놓고 재고를 뺄 수 없는 화면을 사용자에게 내보이는 것이 된다.
 *
 * **보이지 않는 탭의 조회는 나가지 않는다.** 두 탭의 조건과 선택이 한 주소에 함께 살아 있어
 * 값만으로는 조회가 성립한다 — 탭을 조회의 조건으로 함께 넘기지 않으면 숨은 탭의 목록·상세·
 * 승인 요청이 배경에서 왕복한다(감지기 M38).
 *
 * **대상의 원천이 입고 전표인 이유**(계획 결정 2): 계약이 요구하는 출고 라인 다섯(품목·
 * 자재 LOT·수량·단위·출발 위치)을 재고 잔액은 축 하나만 채워 내려 만들 수 없고, 입고 라인은
 * 그대로 준다. 재고 잔액은 **수량 상한**을 만드는 데만 쓴다(`on-hand.ts`).
 *
 * **두 표가 2단으로 대상을 말한다**(승인 기록 정정 2). 위 표(6열)가 원천·입고일·창고로 전표
 * 한 건을 고르고, 아래 표(7열)가 그 전표의 **품목·자재 LOT·보유 수량**을 낸다 — 계약에 입고
 * 라인의 전역 목록 경로가 없어 한 표로는 그 다섯을 함께 낼 수 없다.
 *
 * **「불량창고」를 화면이 판정하지 않는다**(계획 결정 2·8). 창고 유형의 값 목록이 확정되지
 * 않아 「이 창고가 그 창고인가」를 물을 수 없다 — 사용자가 창고를 고르고, 값 목록이 채워지면
 * 선택지가 그 유형으로 좁혀지며 안내가 사라진다. **그 좁힘은 선택지 하나에만 걸린다** —
 * 아래 구획의 위치 이름과 잔액은 **고른 전표의 창고**로 조회한다(조건 줄의 창고가 아니다).
 *
 * ### 단계 전이 표 (계획 결정 3)
 *
 * **화면이 단계를 `statusCode` 값으로 판정하지 않는다.** 값 목록이 확정되지 않았고 공유계약이
 * 값 분기를 금지한다 — 계약도 「화면은 서버가 내려주는 값을 그대로 표시하고 값 자체로
 * 분기하지 않는다」고 적었다.
 *
 * | 단계 | 화면이 이 단계를 아는 근거 | 보이는 것 | 할 수 있는 것 | 주소 |
 * | :-: | --- | --- | --- | --- |
 * | **S0** 고르기 전 | 「품의 발의」 탭 · `gr`이 없다 | 조건 줄 · 목록 · 쪽 · **고르기 전 안내** | 조회 · 초기화 · 쪽 이동 · 고르기 | `?tab&wh&from&to&ty&st&q&page` |
 * | **S1** 전표를 골랐다 | `gr`이 있고 **상세가 200** | 위 + 제목줄 · 라인 표 · **품의 정보 폼** | 위 + 줄 고르기 · 폐기 수량 · 품의 정보·사유 입력 | `+&gr` |
 * | **S2** 보낼 것이 갖춰졌다 | 줄이 하나 이상 골라졌고 전 검증 통과 | 위 + **「품의 상신」이 열린다** | 위 + **품의 상신**(확인 창을 지난다) | 같음 |
 * | **S3** 이번 세션에서 올렸다 | 전표 생성 성공 | 위 + **상신 결과 구획**(전표 번호 · 상태 · 라인 · 「이 품의 열기」) | 조회 · 다시 고르기 · **이 품의 열기** | `gr` 유지 · `gi` 채움 |
 * | **S4** 그 전표가 없다 | **상세가 404** | 안내 「고른 입고 전표를 찾을 수 없습니다」 | `gr`를 주소에서 정리한다 | `gr` 제거 |
 * | **H0** 이력에서 고르기 전 | 「처리 이력」 탭 · `gi`가 없다 | 이력 조건 줄 · 목록 · 쪽 · **고르기 전 안내** | 조회 · 초기화 · 쪽 이동 · 고르기 | `?tab=history&i*&ipage` |
 * | **H1** 품의를 골랐다 | `gi`가 있고 **출고 상세가 200** | 위 + 품의 정보 · 라인 표 · **결재 진행 구획** · **상신 구획** | 위 + **재상신**(미상신일 때) · 처리 — **뒤 회차** | `+&gi` |
 * | **H2** 그 품의가 없다 | **출고 상세가 404** | 안내 「고른 품의를 찾을 수 없습니다」 | `gi`를 주소에서 정리한다 | `gi` 제거 |
 *
 * **S3이 세 갈래로 갈린다** — 전표 생성은 끝났고 상신이 ① 진행 중이거나 ② 끝났거나
 * ③ **실패했다.** 셋째가 이 화면이 정면으로 말하는 중간 상태이며, 그 전표는 이력 탭의 상신
 * 구획에서 되살린다. **전표조차 만들어지지 않은 실패는 S3이 아니다** — 결과 구획이 서지 않고
 * 배너만 선다.
 *
 * **H1 안에 결재 진행의 하위 상태 다섯이 있다.** 이것은 단계가 아니라 **한 구획의 상태**이며,
 * 어느 것이어도 H1의 다른 구획은 바뀌지 않는다 — 결재 진행은 판단을 돕는 자료이지 처리의
 * 전제가 아니기 때문이다(수명 표 26행 · `approval-progress-pane.tsx`의 표).
 *
 * | 하위 상태 | 근거 |
 * | :-: | --- |
 * | **A0 미상신** | 출고 상세의 `approvalRequestId`가 **없다** |
 * | **A0′ 쓸 수 없는 값** | 값은 있으나 조회 조각으로 쓸 수 없다 — 미상신도 상신도 아니다 |
 * | **A1 부르는 중** | 승인 요청 조회 진행 중 |
 * | **A2 읽었다** | 승인 요청 상세가 200 |
 * | **A3 읽을 수 없다** | 403·404·네트워크 — **화면 배너를 세우지 않는다** |
 *
 * **H2를 404로만 판정하고 403을 별도로 가르지 않는 이유**: 물류 두 상세에는 **403이 없다**
 * (입고·출고 상세 모두 200과 404 둘뿐 — 실측). 403 갈래를 만들면 닿을 수 없는 가지가 된다.
 * 403이 있는 것은 **승인 요청 상세뿐**이고 그것이 A3다.
 *
 * **화면이 모르는 것을 밝힌다.** 이미 폐기됐거나 취소된 전표를 골라도 화면은 막지 않는다.
 * 값 목록이 정해지면 그때 막아도 늦지 않고, 지금 막으면 **값이 정해질 때 조용히 틀린다.**
 *
 * **S1의 근거를 목록 소속이 아니라 상세 200으로 두는 이유**: `gr`는 경로 조각이라 목록과
 * 무관하게 상세를 부를 수 있다. 목록 소속으로 판정하면 **조건이 좁아 목록에 없는 전표를 고른
 * 상태가 조용히 지워진다**(W-01-07 Minor의 형태).
 */
export const DisposalIssueScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * ### 수명 표 (계획 결정 12) — 무엇이 바뀔 때 무엇을 비우는가
   *
   * 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다. 규칙이 흩어지면 한쪽만 고쳐져
   * 비대칭이 생긴다(조건을 바꾸면 아래 구획이 닫히는데 쪽을 옮기면 안 닫히는 식).
   *
   * **「처리」 열만 아직 없다**(기타출고 처리가 뒤 회차다). 열을 지우지 않고 남겨 두는 이유는,
   * 표에 오르지 않은 상태가 규칙이 닿지 않는 사각이 되기 때문이다 — 그 쓰기가 생길 때
   * **행을 다시 세는 대신 그 열만 채운다.**
   *
   * 열 이름: 조건 = 대상 조건 6종 · `gr` = 고른 입고 전표 · 줄 = 줄·수량 초안 ·
   * 폐기 = **품의 정보 초안**(코드 다섯·출고 일시·비고와 **상신 사유**) · 이력 = 이력 조건 ·
   * `gi` = 고른 품의 · 사유 = **이력 탭의 재상신 사유 초안** · 등록 = 상신 결과 구획 ·
   * 처리 = 처리 결과 · 창 = 열린 창 · 배너 = 실패 배너
   *
   * **「폐기」 열이 상신 사유를 함께 담는다**(승인 기록 정정 1-1). 계획은 사유를 이력 탭에만
   * 두었으나 조작이 한 버튼이 되면서 사유가 발의 자리로 왔다 — 매인 대상이 **고른 입고 전표**
   * 쪽이므로 「사유」 열이 아니라 이 열의 규칙을 따른다. 「사유」 열은 이력 탭의 재상신 초안이
   * 그대로 물려받는다.
   *
   * | # | 조작 | 조건 | `gr` | 줄 | 폐기 | 이력 | `gi` | 사유 | 등록 | 처리 | 창 | 배너 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | 대상 조건 변경·조회 | 바뀐다 | **비운다** | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 2 | 대상 초기화 | **비운다** | 비운다 | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 3 | 대상 쪽 이동 | 유지 | **비운다** | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 4 | 입고 전표 고르기·해제 | 유지 | 넣고 뺀다 | **비운다** | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 5 | **입고 상세가 404** | 유지 | **비운다** | 비운다 | 유지 | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | 등록분만 비운다 |
   * | 6 | 줄 고르기·수량 입력 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **유지** |
   * | 7 | 폐기 정보 입력 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **유지** |
   * | 8 | **탭 전환** | 유지 | **유지** | **유지** | **유지** | 유지 | **유지** | **유지** | **유지** | **유지** | **닫는다** | 유지 |
   * | 9 | 이력 조건 변경·조회·초기화·쪽 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **비운다** | **비운다** | 유지 | **비운다** | 닫는다 | 상신·처리분만 비운다 |
   * | 10 | 품의 고르기·해제 | 유지 | 유지 | 유지 | 유지 | 유지 | 넣고 뺀다 | **비운다** | 유지 | **비운다** | 닫는다 | 상신·처리분만 비운다 |
   * | 11 | **출고 상세가 404** | 유지 | 유지 | 유지 | 유지 | 유지 | **비운다** | 비운다 | 유지 | 비운다 | 닫는다 | 상신·처리분만 비운다 |
   * | 12 | 사유 입력 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | 유지 | 유지 | 유지 | **유지** |
   * | 13 | 목록·상세·참조·잔액·승인 요청 응답 도착 | 유지 | 유지 | **건드리지 않는다** | **건드리지 않는다** | 유지 | 유지 | **건드리지 않는다** | 유지 | 유지 | 유지 | 유지 |
   * | 14 | **다시 조회**(새로고침) | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | **유지** | 유지 | 유지 | 유지 | 유지 |
   * | 15 | 창 열기 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **연다** | **유지** |
   * | 16 | 창 닫기(취소·Escape·스크림) | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **닫는다** | **유지** |
   * | 17 | **등록 성공** | 유지 | **유지** | **비운다** | **비운다** | 유지 | **채운다** | 유지 | **채운다** | 유지 | 닫는다 | 비운다 |
   * | 18 | 등록 실패 | 유지 | 유지 | **유지** | **유지** | 유지 | 유지 | 유지 | 비운다 | 유지 | 닫는다 | **세운다** |
   * | 19 | **상신 성공** | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | **비운다** | 유지 | 유지 | 닫는다 | 비운다 |
   * | 20 | 상신 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | 닫는다 | **세운다** |
   * | 21 | **처리 성공** | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | 유지 | **채운다** | 닫는다 | 비운다 |
   * | 22 | 처리 실패 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 비운다 | 닫는다 | **세운다** |
   * | 23 | 초안 파기(취소) | 유지 | 유지 | **비운다** | **비운다** | 유지 | 유지 | **비운다** | 비운다 | 비운다 | 닫는다 | **비운다** |
   * | 24 | **전송 중** | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 잠긴다 | 유지 | 유지 | 유지 | 유지 |
   * | 25 | **상세를 더는 읽을 수 없다** | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **닫는다** | 유지 |
   * | 26 | **승인 요청 조회 실패** | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | **유지** | 유지 | **유지** | **유지** | **유지** |
   *
   * **이 회차가 지키는 것은 「처리」 열을 뺀 전부다.** 21·22행(처리 성공·실패)만 뒤 회차에
   * 남는다.
   *
   * ### 토큰 수명 표 (계획 결정 13)
   *
   * 토큰 보관소는 **요청 URL의 경로별로** `ETag`를 담는다(실측). 그래서 「어느 경로에서 꺼내는가」가
   * 규칙이고, 그 규칙이 틀리면 **요청이 나가지 않거나 남의 토큰이 실린다.**
   *
   * | 조회·쓰기 | `If-Match` 출처 | `ETag`를 주는가 | 어느 경로에 남는가 | 성공 뒤 |
   * | --- | --- | :-: | --- | --- |
   * | 입고 목록·상세 | — | **주지 않는다** | — | — |
   * | 출고 목록 | — | **주지 않는다** | — | — |
   * | **출고 상세** | — | **준다** | **상세 경로** ← 토큰을 확보하는 **유일한 자리** | — |
   * | 승인 요청 상세 | — | 준다 | 승인 상세 경로 | **쓰지 않는다**(이 화면은 승인 요청에 쓰기를 하지 않는다) |
   * | 재고 잔액·참조 | — | 주지 않는다 | — | — |
   * | **전표 생성** | **`null`**(새 전표라 매길 버전이 없다) | 준다(201) | **컬렉션 경로** — **쓰지 않는다** | 출고 뿌리 무효화 |
   * | **상신** | **출고 상세 경로** | **주지 않는다** | — | **출고·승인 뿌리 무효화** |
   * | 전기 | 출고 상세 경로 | 주지 않는다 | — | 뿌리 무효화 — **뒤 회차** |
   *
   * **규칙 넷.** ① `etagPath`는 **늘 출고 상세 경로**다 — 컬렉션 경로를 주면 목록 조회와 열쇠가
   * 겹치고, 액션 경로를 주면 토큰이 비어 훅이 요청을 만들지 않고 멈춘다(「눌러도 아무 일이
   * 없다」). ② 상신 응답에 `ETag`가 **없으므로** 성공 뒤 뿌리를 무효화해 상세를 다시 부른다 —
   * 그래야 다음 쓰기의 토큰이 새것이 된다. ③ 전표 생성은 `etagPath: null`이라 토큰 없이 나간다
   * (계약이 허용). ④ **409 뒤의 길**은 「최신 불러오기」가 출고 상세를 다시 불러 새 토큰을 얻는
   * 것이다.
   *
   * **연쇄 가운데의 상세 조회가 ①의 귀결이다** — 방금 만든 전표의 토큰은 **컬렉션 경로**에
   * 앉으므로 상신이 쓸 수 없다. 그래서 전표 생성과 상신 사이에 상세 조회가 한 번 든다.
   *
   * - **1~3행이 `gr`를 비우는 이유**: 조건·쪽이 바뀌면 고른 전표가 새 결과에 없을 수 있다.
   *   `toSearchParams`가 **`gr`를 만들지 않으므로** 이 세 행이 한 자리에서 함께 지켜진다.
   * - **8행(탭 전환)이 아무것도 비우지 않는 이유**: 탭은 **보는 자리**를 바꿀 뿐 대상을 바꾸지
   *   않는다. 두 탭이 서로 다른 대상(`gr`·`gi`)을 갖고 각자 살아 있어야 「발의해 놓고 이력에서
   *   이어서 다룬다」가 성립한다.
   * - **9~11행이 `gi`를 비우는 이유**: 이력 조건·쪽이 바뀌면 고른 품의가 새 결과에 없을 수 있다.
   *   `toHistorySearchParams`가 **`gi`를 만들지 않으므로** 그 규칙이 한 자리에서 지켜진다.
   *   그리고 **`gr`와 대상 조건은 건드리지 않는다** — 범위 있는 규칙은 잣대도 같은 범위로.
   * - **26행이 아무것도 건드리지 않는 이유**: 결재 진행은 판단을 돕는 자료이지 처리의 전제가
   *   아니다 — 못 읽었다고 고른 품의가 풀리거나 화면 배너가 서면 사용자는 나머지까지 못 믿는다.
   * - **4행이 쪽을 유지하는 이유**: 보이는 행이 그대로다. 3쪽에서 하나 골랐다고 1쪽으로 튀면 안 된다.
   * - **1~5행이 줄 초안을 함께 비우는 이유**: 앞 전표에서 고른 줄과 친 수량은 새 전표에서 뜻을
   *   잃는다. 다섯 행이 전부 **`gr`가 달라지는 자리**이므로 되돌림은 **`gr` 하나에 매인 effect**
   *   한 곳이 맡는다 — 조작마다 손으로 비우면 뒤로가기·주소 편집 경로가 통째로 샌다.
   * - **5·11행이 클릭 핸들러가 아니라 상세 응답에 묶일 이유**: 뒤로가기·앞으로가기·주소 직접
   *   편집은 핸들러를 거치지 않고 `gr`·`gi`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   * - **6행이 등록 결과·배너를 유지하는 이유**: 줄을 고치는 것은 대상을 바꾸는 것이 아니다.
   *   이 회차에는 그 두 열이 아직 없어 지킬 것이 없지만, 행은 미리 서 있다.
   * - **13행이 이 화면의 `omf-mes#43` 자리다**(감지기 M30): 응답 도착이 초안을 되돌리면
   *   「치던 값이 사라진다」가 재현된다. 초안 되돌림 effect의 의존성은 **`gr` 하나뿐**이고
   *   라인·참조·잔액 응답 배열이나 `useMemo` 파생 객체를 넣지 않는다.
   * - **14행이 목록만이 아니라 상세를 함께 부를 이유**: W-01-07의 Major 지적 그대로다 —
   *   목록만 다시 부르면 **갱신된 값과 갱신되지 않은 값이 한 화면에 섞인다.** 이 화면에서 그
   *   어긋남은 비싸다: 낡은 줄로 폐기 품의를 올리면 **이미 없어진 자재를 폐기하려 한다.**
   *   그리고 **초안은 지우지 않는다** — 사라진 줄의 초안은 표에 없는 줄이라 세지 않는다
   *   (`disposal-selection.ts`).
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다
   * (`omf-mes#43`). `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const tab = readTab(searchParams);
  const isDisposalTab = tab === 'disposal';
  const isHistoryTab = tab === 'history';

  const filters = useMemo<ReceiptFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedReceiptId = readSelectedReceiptId(searchParams);

  const historyFilters = useMemo<IssueFilters>(
    () => readIssueFilters(searchParams),
    [searchParams],
  );
  const historyPage = readIssuePage(searchParams);
  const selectedIssueId = readSelectedIssueId(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 들어오자마자 폐기할 수 있는 입고가 보여야 무엇을
   * 고를 수 있는지 안다 — 빈 화면으로 시작하면 조건을 먼저 정해야 하는 줄 안다.
   *
   * **기본 기간도 기본 창고도 심지 않는다** — 첫 요청에 조건이 하나도 실리지 않는다.
   */
  const listQuery = { ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) };

  const list = useGoodsReceipts(listQuery, isDisposalTab);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /* 창고는 첫 진입에 받는다 — **두 탭의 목록 표가 모두 이 이름을 쓴다.** */
  const warehouses = useWarehouseOptions();

  const detail = useGoodsReceiptDetail(selectedReceiptId, isDisposalTab);
  const detailData = detail.data;
  const lineRows = detailData?.lines ?? EMPTY_LINES;
  const isDetailNotFound = detail.isError && isReceiptNotFound(detail.error);

  /* 이력 목록·상세도 같은 형태다 — **그 탭이 서 있을 때만** 성립한다. */
  const historyQuery = {
    ...toIssueFilterQuery(historyFilters),
    ...(historyPage > 1 ? { page: historyPage } : {}),
  };

  const issueList = useGoodsIssues(historyQuery, isHistoryTab);
  const issueRows = issueList.data?.items ?? EMPTY_ISSUE_ROWS;
  const issuePageView = toPageView(
    issueList.data?.page ?? { page: historyPage, size: 0, total: 0 },
    issueRows.length,
  );

  const issueDetail = useGoodsIssueDetail(selectedIssueId, isHistoryTab);
  const issueDetailData = issueDetail.data;
  const issueLineRows = issueDetailData?.lines ?? EMPTY_ISSUE_LINES;
  const isIssueDetailNotFound = issueDetail.isError && isIssueNotFound(issueDetail.error);

  /**
   * 이 품의가 상신됐는가 — **판정은 `approval-progress.ts` 한 곳에서 나온다.**
   *
   * 여기서 다시 판정하면 두 자리가 갈리고, 갈리는 순간 `/app/approval-requests/0` 같은
   * 요청이 나가거나 상신된 품의가 미상신으로 보인다.
   */
  const submission = readSubmission(issueDetailData?.issue.approvalRequestId);
  const approvalRequest = useApprovalRequest(submission, isHistoryTab);

  /*
   * 품목·단위·자재 LOT·위치는 **아래 구획의 라인 표가 그려질 때** 쓴다 — 그 표는 상세 응답을
   * 기다리므로 미리 받아 둘 이득이 없고, 고르기 전에 부르면 첫 진입의 요청 수만 이유 없이 는다.
   *
   * **활성 탭의 줄만 이름을 푼다.** 두 탭의 라인이 함께 살아 있어도 보이는 것은 하나뿐이고,
   * 둘의 품목을 합쳐 부르면 보이지 않는 표를 위한 요청이 나간다.
   */
  const lineItemIds = isHistoryTab
    ? issueLineRows.map((line) => line.itemId)
    : lineRows.map((line) => line.itemId);
  const lineWarehouseId = isHistoryTab
    ? (issueDetailData?.issue.sourceWarehouseId ?? null)
    : (detailData?.receipt.warehouseId ?? null);
  const hasLineSelection = isHistoryTab ? selectedIssueId !== null : selectedReceiptId !== null;

  const items = useItemOptions(hasLineSelection);
  const uoms = useUomOptions(hasLineSelection);

  /*
   * 자재 LOT은 **라인이 가리키는 품목마다** 받는다 — 번호 여러 개로 한 번에 조회하는 수단이
   * 계약에 없다. 라인이 오기 전에는 품목이 없어 요청도 없다.
   */
  const lots = useLotOptions(lineItemIds, hasLineSelection);

  /*
   * 위치는 **그 전표의 창고**로 조회한다 — 계약이 창고를 필수 조건으로 두었다.
   * 상세가 오기 전에는 창고 번호가 없어 요청도 없다. `?? 0` 같은 대체값으로 메우면
   * **없는 창고의 조건으로 요청이 나간다.**
   */
  const locations = useLocationOptions(lineWarehouseId);

  /*
   * 재고 잔액은 **폐기 수량의 상한**을 만드는 데만 쓴다 — 「품의 발의」 탭에서만 쓰인다.
   * 이미 만들어진 품의의 라인에는 상한이 뜻이 없다(수량이 이미 정해져 서버에 갔다).
   *
   * **조건 줄의 창고를 쓰지 않는다.** 그 값은 비어 있을 수 있고, 값 목록이 확정되면 선택지가
   * 폐기 대상 유형으로 좁혀진다 — 좁힌 조건을 축으로 쓰면 좁힘 밖 창고의 전표를 골랐을 때
   * **남의 창고 잔액이 상한이 된다.**
   */
  const balances = useOnHandBalances(
    isDisposalTab ? (detailData?.receipt.warehouseId ?? null) : null,
    isDisposalTab ? lineRows.map((line) => line.itemId) : NO_ITEM_IDS,
  );

  /**
   * 줄 선택과 폐기 수량 초안 — **아직 보내지 않은 입력**이다(수명 표의 「줄」 열).
   *
   * **주소에 싣지 않는다.** 글자마다 뒤로가기 기록이 쌓이고, 화면이 조회 조건과 입력을 같은
   * 통로로 다루게 된다.
   */
  const [lineDraft, setLineDraft] = useState<LineDraft>(EMPTY_LINE_DRAFT);

  /*
   * **고른 전표가 바뀌면 초안을 비운다**(수명 표 1~5행). 앞 전표에서 고른 줄과 친 수량은
   * 새 전표에서 뜻을 잃는다 — 그대로 두면 남의 전표의 수량이 실린다.
   *
   * **의존성은 `gr` 하나뿐이다**(`omf-mes#43` · 감지기 M30). 라인·참조·잔액 응답이나
   * `useMemo`로 만든 파생 객체를 넣으면 갱신이 도착할 때마다 **치던 값이 사라진다.**
   */
  useEffect(() => {
    setLineDraft(EMPTY_LINE_DRAFT);
  }, [selectedReceiptId]);

  /**
   * 방금 고른 전표가 **없었다**는 사실(수명 표 5행).
   *
   * 주소에서 `gr`를 지우고 나면 화면은 그 사정을 말할 근거를 잃는다 — 「아직 고르지 않았다」와
   * 글자가 같아지므로 사용자는 자기가 무엇을 눌렀는지 되짚을 수 없다.
   */
  const [hasNotFoundNotice, setNotFoundNotice] = useState(false);

  /** 같은 사실의 이력 쪽(수명 표 11행) — **두 안내를 하나로 묶지 않는다.** */
  const [hasIssueNotFoundNotice, setIssueNotFoundNotice] = useState(false);

  /**
   * **사용자가 대상을 바꾸는 길이 지나는 한 문**(구현 규칙 5).
   *
   * 한 주소가 탭·대상 조건·이력 조건·두 선택을 함께 싣는다. 조립을 자리마다 손으로 하면
   * 「대상 조건을 바꿨더니 이력 조건까지 사라졌다」가 조용히 생긴다 — **무엇을 남기고 무엇을
   * 비우는가가 이 함수의 인자로만 정해진다.**
   *
   * 두 하위 조립기(`toSearchParams`·`toHistorySearchParams`)는 **선택(`gr`·`gi`)을 만들지
   * 않는다.** 그래서 조건·쪽이 바뀌는 자리에서 그 선택을 다시 실어 주지 않으면 저절로 풀리고,
   * 유지해야 하는 자리에서만 명시적으로 실린다.
   */
  const toScreenParams = (next: {
    tab: DisposalIssueTab;
    filters: ReceiptFilters;
    page: number;
    historyFilters: IssueFilters;
    historyPage: number;
    goodsReceiptId: number | null;
    goodsIssueId: number | null;
  }): URLSearchParams => {
    const params = new URLSearchParams();
    const tabParam = toTabParam(next.tab);

    if (tabParam !== null) params.set(TAB_KEY, tabParam);

    for (const [key, value] of toSearchParams(next.filters, next.page)) params.set(key, value);

    for (const [key, value] of toHistorySearchParams(next.historyFilters, next.historyPage)) {
      params.set(key, value);
    }

    if (next.goodsReceiptId !== null) {
      params.set(SELECTION_KEYS.goodsReceipt, String(next.goodsReceiptId));
    }

    if (next.goodsIssueId !== null) {
      params.set(HISTORY_SELECTION_KEYS.goodsIssue, String(next.goodsIssueId));
    }

    return params;
  };

  /** 지금 주소가 담고 있는 것 전부. 한 자리만 바꾸는 조작이 나머지를 그대로 나른다. */
  const currentAddress = {
    tab,
    filters,
    page,
    historyFilters,
    historyPage,
    goodsReceiptId: selectedReceiptId,
    goodsIssueId: selectedIssueId,
  };

  /**
   * 지금 주소를 **응답이 도착한 뒤에도** 읽는 자리.
   *
   * 쓰기의 성공 핸들러는 **보낼 시점 렌더의 클로저**라 그 안의 주소는 「보낼 때의 것」이다.
   * 전송 중에도 주소가 바뀌는 길이 하나 남아 있으므로(뒤로가기·앞으로가기·주소 직접 편집 —
   * 잠금도 핸들러 가드도 거치지 않는 셋째 길) 만들어진 품의를 주소에 실을 때는 **지금** 값을 본다.
   */
  const addressRef = useRef(currentAddress);

  addressRef.current = currentAddress;

  /**
   * 품의 정보 초안 — 어떤 전표로·언제·왜 폐기하는가(수명 표의 「폐기」 열).
   *
   * **줄 초안과 갈라 둔다.** 되돌림 축이 다르기 때문이다 — 줄 초안은 **그 전표의 줄**에 매여
   * 있어 전표가 바뀌면 뜻을 잃지만(수명 표 1~5행), 품의 정보는 **폐기라는 행위**에 매여 있어
   * 같은 코드·사유로 여러 전표를 잇달아 올리는 흔한 쓰임을 살린다.
   *
   * **상신 사유가 여기 함께 있다**(승인 기록 정정 1-1) — 사용자 조작이 하나이고 그 한 번에
   * 전표 생성과 상신이 잇달아 나가므로, 결재에 올릴 문장을 보내기 전에 이 폼에서 받는다.
   */
  const [disposalDraft, setDisposalDraft] = useState<DisposalDraft>(EMPTY_DISPOSAL_DRAFT);

  /**
   * 이력 탭의 재상신 사유 초안(수명 표의 「사유」 열).
   *
   * **발의 탭의 사유와 갈라 둔다** — 매인 대상이 다르다(이쪽은 고른 품의, 저쪽은 고른 입고
   * 전표). 하나로 묶으면 품의를 바꿨을 때 발의 탭에 쓰던 사유가 사라진다.
   */
  const [resubmitReason, setResubmitReason] = useState('');

  /** 연쇄가 어디까지 갔는가. **전표가 만들어졌다는 사실은 여기 남는다.** */
  const [chain, setChain] = useState<SubmitChain>(NO_CHAIN);

  /**
   * 그 연쇄가 겨눈 입고 전표(**매임 이름 하나**). 결과 구획과 등록·연쇄 배너가 이 값에 매인다 —
   * 대상이 바뀌면 앞 대상의 결과가 새 대상의 라인 표 아래 서지 않는다.
   */
  const [chainTargetKey, setChainTargetKey] = useState<string | null>(null);

  /** 재상신이 겨눈 품의(**매임 이름 둘**). 재상신 배너·인라인 오류가 이 값에 매인다. */
  const [resubmitTargetKey, setResubmitTargetKey] = useState<string | null>(null);

  /**
   * 보내기 전에 화면이 잡은 오류. **버튼을 누른 뒤에만 세운다** — 치는 도중에 붉은 글씨를
   * 띄우면 아직 넣지도 않은 칸이 잘못된 것처럼 보인다.
   */
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>(NO_FIELD_ERRORS);
  const [localResubmitError, setLocalResubmitError] = useState<string | undefined>(undefined);

  /** 확인 창 셋. **확인하기 전에는 요청이 나가지 않는다.** */
  const [isSubmitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [isResubmitConfirmOpen, setResubmitConfirmOpen] = useState(false);
  const [isDiscardOpen, setDiscardOpen] = useState(false);

  /**
   * 지금 무엇에 매여 있는가 — **이름 둘**(계획 결정 12).
   *
   * 배너·인라인 오류·창·결과가 각자 다른 값을 보게 두지 않고, **둘을 하나로 묶지도 않는다** —
   * 묶으면 입고 전표를 바꿨을 때 이력 탭의 판정까지 사라진다(범위 있는 규칙은 잣대도 같은 범위로).
   */
  const registerTargetKey = selectedReceiptId === null ? null : String(selectedReceiptId);
  const issueTargetKey = selectedIssueId === null ? null : String(selectedIssueId);

  /** 잠금 토큰을 확보하는 자리 — 연쇄 가운데의 상세 조회다(`queries.ts`). */
  const fetchIssueDetail = useIssueDetailFetcher();

  /**
   * 전표 생성 — **연쇄의 첫째 요청**.
   *
   * 성공하면 ① 전표가 생겼다는 사실을 연쇄에 적고 ② **줄·품의 정보 초안을 비우며**
   * (수명 표 17행 — 같은 줄이 골라져 있으면 한 번 더 누르는 사고가 생긴다) ③ 만들어진 품의를
   * 주소의 `gi`에 실어 **이어서 다룰 수 있게** 한다. **탭은 바꾸지 않는다** — 방금 무엇을
   * 만들었는지 보던 자리가 말없이 사라지면 사용자가 결과를 읽을 수 없다(계획 결정 6).
   */
  const createWrite = useCreateGoodsIssue({
    onSuccess: (created) => {
      setChain({ kind: 'created', issue: created, reason: disposalDraft.reason, tokenSettled: false });
      setLineDraft(EMPTY_LINE_DRAFT);
      setDisposalDraft(EMPTY_DISPOSAL_DRAFT);
      setLocalFieldErrors(NO_FIELD_ERRORS);
      setSearchParams(
        toScreenParams({ ...addressRef.current, goodsIssueId: created.issue.goodsIssueId }),
      );

      /*
       * **상신 직전에 상세를 한 번 부른다.** 계약이 `If-Match`의 출처를 「같은 리소스의 상세
       * GET 200」으로 못 박아, 이 조회가 없으면 방금 만든 전표의 토큰이 어디에도 없다.
       *
       * **실패해도 갈래를 새로 만들지 않는다.** 토큰을 못 얻은 채 상신하면 공통 훅이 요청을
       * 만들지 않고 「최신 상태를 불러오지 못했습니다」를 세우며, 그 자리는 부분 실패 안내와
       * 함께 선다 — 사용자가 할 일(이력에서 이어서 상신)이 그때와 같다.
       */
      void fetchIssueDetail(created.issue.goodsIssueId)
        .catch(() => undefined)
        .finally(() => {
          setChain((prev) =>
            prev.kind === 'created' && prev.issue.issue.goodsIssueId === created.issue.goodsIssueId
              ? { ...prev, tokenSettled: true }
              : prev,
          );
        });
    },
  });

  /**
   * 연쇄의 **둘째 요청**. 재상신과 훅을 갈라 두는 이유가 셋이다 —
   * ① `etagPath`가 서로 다른 전표를 가리킨다(방금 만든 것 ↔ 이력에서 고른 것)
   * ② 실패 배너가 매이는 대상이 다르다(입고 전표 ↔ 품의)
   * ③ 하나로 묶으면 한쪽 실패가 다른 쪽 자리에 선다.
   */
  const chainSubmitWrite = useRequestApproval({
    goodsIssueId: chain.kind === 'created' ? chain.issue.issue.goodsIssueId : null,
    onSuccess: () => {
      setChain((prev) => (prev.kind === 'created' ? { kind: 'submitted', issue: prev.issue } : prev));
      setSubmitConfirmOpen(false);
    },
  });

  /**
   * 이력 탭의 재상신 — **미상신 전표를 이어서 결재에 올린다.**
   *
   * 성공 뒤 **사유 초안을 비운다**(수명 표 19행). 상신은 끝났고 그 사유는 서버로 갔다 —
   * `gi`는 남겨 결재 진행을 보게 한다.
   */
  const resubmitWrite = useRequestApproval({
    goodsIssueId: selectedIssueId,
    onSuccess: () => {
      setResubmitReason('');
      setLocalResubmitError(undefined);
      setResubmitConfirmOpen(false);
    },
  });

  /**
   * 지금 무엇이 나가는 중인가 — **첫째 겹의 원천이다.**
   *
   * 이 값 하나가 컨트롤 전부(조회·초기화·쪽 이동·전표 선택·줄 선택·수량·품의 정보·**탭**)를
   * 닫고, 잠금을 받지 않는 컨트롤(조건 칩의 ×)은 핸들러 가드(둘째 겹)가 막는다.
   *
   * **세 쓰기를 함께 본다.** 연쇄 가운데의 틈(토큰을 얻는 사이)까지 덮지 않으면 그 순간
   * 잠금이 풀려 **연타로 전표가 두 벌** 만들어진다 — 멱등 키가 호출마다 새로 만들어져
   * 서버가 재전송으로 보지 못하는 한계(`omf-mes#55`)와 겹치는 자리다.
   */
  const isChainPending =
    createWrite.isSaving ||
    chainSubmitWrite.isSaving ||
    (chain.kind === 'created' && !chain.tokenSettled);
  const isLocked = isChainPending || resubmitWrite.isSaving;

  /**
   * **사용자가 대상을 바꾸는 길이 지나는 한 문**(계획 결정 12의 구현 규칙 5).
   *
   * 조건 칩·쪽·목록 행·**탭**이 전부 여기를 지나므로, 전송 중 잠금이 이 한 자리에만 있으면
   * 된다 — 자리마다 손으로 막으면 한 곳을 잊고 그 길로 대상이 바뀌어 **앞서 보낸 품의의 결과가
   * 다른 전표 맥락에** 나타난다.
   */
  const applyUserNavigation = (next: Parameters<typeof toScreenParams>[0]): boolean => {
    /* 지나갔는지를 되돌려 준다 — 막힌 조작이 딸린 뒷일(안내 거두기)까지 하지 않게 한다. */
    if (isLocked) return false;

    setSearchParams(toScreenParams(next));

    return true;
  };

  /**
   * 대상 조건·쪽을 적용한다. **주소를 한 번만 갱신한다** — 조건과 쪽을 따로 갱신하면 뒤로가기
   * 기록이 두 칸 늘어 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
   *
   * **`gr`를 싣지 않아** 조건·쪽이 바뀌면 고른 전표가 함께 풀리고(수명 표 1~3행),
   * **`gi`와 이력 조건은 그대로 나른다** — 다른 탭의 대상은 이 조작과 무관하다.
   */
  const applyQuery = (nextFilters: ReceiptFilters, nextPage = 1): void => {
    const moved = applyUserNavigation({
      ...currentAddress,
      filters: nextFilters,
      page: nextPage,
      goodsReceiptId: null,
    });

    /*
     * **새 조회는 앞의 「없음」 안내를 거둔다.** 없어진 전표는 방금 한 조작과 무관한 사정인데,
     * 남겨 두면 새 결과 옆에서 화면이 그 사정을 계속 말한다. **문을 지나지 못했으면 거두지도
     * 않는다** — 조회가 일어나지 않았는데 안내만 사라지면 화면이 앞뒤가 맞지 않는다.
     */
    if (moved) setNotFoundNotice(false);
  };

  /** 고르고 푸는 것은 **보이는 행을 바꾸지 않는다**(수명 표 4행). */
  const toggleSelectReceipt = (goodsReceiptId: number): void => {
    const moved = applyUserNavigation({
      ...currentAddress,
      goodsReceiptId: goodsReceiptId === selectedReceiptId ? null : goodsReceiptId,
    });

    if (moved) setNotFoundNotice(false);
  };

  /**
   * 이력 조건·쪽을 적용한다. **`gi`를 싣지 않아** 고른 품의가 함께 풀리고(수명 표 9행),
   * **`gr`와 대상 조건·쪽은 그대로 나른다** — 범위 있는 규칙은 잣대도 같은 범위로.
   */
  const applyHistoryQuery = (nextFilters: IssueFilters, nextPage = 1): void => {
    const moved = applyUserNavigation({
      ...currentAddress,
      historyFilters: nextFilters,
      historyPage: nextPage,
      goodsIssueId: null,
    });

    if (moved) setIssueNotFoundNotice(false);
  };

  const toggleSelectIssue = (goodsIssueId: number): void => {
    const moved = applyUserNavigation({
      ...currentAddress,
      goodsIssueId: goodsIssueId === selectedIssueId ? null : goodsIssueId,
    });

    if (moved) setIssueNotFoundNotice(false);
  };

  /**
   * 탭을 바꾼다. **아무것도 비우지 않는다**(수명 표 8행).
   *
   * 탭은 **보는 자리**를 바꿀 뿐 대상을 바꾸지 않는다 — 두 탭이 서로 다른 대상을 갖고 각자
   * 살아 있어야 「발의해 놓고 이력에서 이어서 다룬다」가 성립한다. 비우면 탭을 잠깐 확인하고
   * 돌아왔을 때 고르던 것이 통째로 사라진다.
   *
   * **전송 중에는 탭도 바뀌지 않는다**(W-01-05 R3-1이 세운 셋째 길의 형태) — 탭이 바뀌면
   * 보내는 자리가 화면에서 사라져, 도착한 되먹임이 설 곳을 잃는다.
   */
  const changeTab = (nextTab: string): void => {
    /*
     * **탭 목록을 손으로 한 번 더 적지 않는다.** 정본은 `DISPOSAL_ISSUE_TABS` 하나이고,
     * 여기 목록을 따로 두면 셋째 탭이 생길 때 이 줄을 잊어 **그 탭 버튼이 말없이 아무 일도
     * 하지 않는다.** 모르는 값을 걸러 내는 규칙은 주소를 읽는 자리(`readTab`)와 같다.
     */
    const target = DISPOSAL_ISSUE_TABS.find((value) => value === nextTab);

    if (target === undefined || target === tab) return;

    /* **잠금은 문 하나에만 있다** — 여기서 한 번 더 막으면 그 문의 규칙을 지워도 아무 일이 없다. */
    applyUserNavigation({ ...currentAddress, tab: target });
  };

  /** 만들어진 품의를 이력 탭에서 연다 — **탭을 바꾸는 것은 사용자다**(계획 결정 6). */
  const openCreatedIssue = (goodsIssueId: number): void => {
    applyUserNavigation({ ...currentAddress, tab: 'history', goodsIssueId });
  };

  /**
   * **나가는 중인 쓰기는 건드리지 않는다**(`omf-mes#96`).
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 **옵저버를 떼어 낸다.** 옵저버가 떨어지면 그
   * 호출에 매달린 되먹임이 통째로 오지 않는다 — **무효화도, 성공도, 실패도, 잠금 해제도.**
   * 요청은 이미 서버에 갔는데 화면만 없던 일로 친다.
   *
   * **끊는 것과 감추는 것은 다르다.** 도착한 결과를 화면에 낼지는 매임 이름 둘이 정하고,
   * 여기서는 **끝난 것만** 거둔다. `reset()`을 부르는 자리가 전부 이 함수를 지난다.
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /**
   * 연쇄의 둘째 요청을 **토큰을 얻은 뒤에** 보낸다.
   *
   * **클릭 핸들러가 아니라 연쇄 상태에 묶는다.** 첫째 요청의 성공 핸들러에서 곧바로 보낼 수
   * 없는 이유가 둘이다 — ① 토큰이 아직 상세 경로에 앉지 않았고 ② 그 렌더의 쓰기 훅은
   * **방금 만든 전표를 모르는** `etagPath`를 들고 있다. 상태를 한 번 지나면 두 문제가 함께
   * 풀린다: 렌더가 새 `etagPath`를 만들고, 그 뒤에 이 effect가 돈다.
   *
   * **같은 연쇄를 두 번 보내지 않는다.** 개발 모드의 이중 호출과 무관한 렌더에서 되돌릴 수 없는
   * 요청이 한 번 더 나가지 않도록, 이미 보낸 연쇄인지를 **객체 동일성**으로 가른다.
   *
   * **의존성은 연쇄 하나뿐이다.** 쓰기 훅은 렌더마다 새 참조라 넣으면 이 자리가 매 렌더 돈다 —
   * 최신 훅은 참조로 들고 **연쇄에만** 반응한다.
   */
  const chainSubmitWriteRef = useRef(chainSubmitWrite);

  chainSubmitWriteRef.current = chainSubmitWrite;

  const dispatchedChainRef = useRef<SubmitChain | null>(null);

  useEffect(() => {
    if (chain.kind !== 'created') return;
    if (!chain.tokenSettled) return;
    if (dispatchedChainRef.current === chain) return;

    dispatchedChainRef.current = chain;

    const body = toApprovalRequest(chain.reason);

    /*
     * **보내는 자리가 스스로 한 번 더 본다**(계획 §5.2). 목이 공백만인 사유를 202로 받으므로
     * 막는 곳이 화면뿐이고, 여기가 연쇄에서 그 마지막 겹이다 — 사유가 비면 전표만 남고
     * 결과 구획이 그 사실을 말한다.
     */
    if (body === null) return;

    chainSubmitWriteRef.current.write(body);
  }, [chain]);

  /*
   * **대상이 바뀌면 그 대상에 매인 것만 거둔다**(수명 표 1~5행).
   *
   * 여기 있는 것은 **창과 서버 되먹임**이다. **품의 정보 초안은 여기 없다** — 매인 대상이
   * 다르기 때문이다:
   *
   * | 초안 | 무엇에 매여 있나 | 대상이 바뀌면 |
   * | --- | --- | :-: |
   * | 줄 선택·폐기 수량 | **그 전표의 줄** — 앞 전표의 줄 번호는 새 전표에서 뜻이 없다 | **비운다**(위 effect) |
   * | 품의 정보·상신 사유 | **폐기라는 행위** — 어떤 코드로·언제·왜 올리는가 | **유지한다** |
   *
   * 같은 사유로 **여러 전표를 잇달아 올리는 것이 이 화면의 흔한 쓰임**이다. 전표를 옮길 때마다
   * 코드 다섯·출고 일시·사유를 다시 치게 하면, 사용자는 값을 잃지 않으려고 전표를 한 번에
   * 하나씩만 다루게 된다.
   *
   * **끝난 연쇄만 거둔다**(`resetIfIdle`과 같은 규율). 나가는 중이던 연쇄는 그대로 두고,
   * 그 결과가 다른 대상 위에 서지 않는 것은 **매임 이름**이 맡는다.
   *
   * **의존성은 매임 이름 하나뿐이다**(`omf-mes#43`). 초안·응답 배열·`reset` 함수 참조를 넣으면
   * 한 글자 칠 때마다 배너가 지워지거나(너무 지움) 아예 보이지 않는다(늘 지움).
   */
  const collectRegisterRef = useRef((): void => {
    /* 자리를 미리 만든다 — 아래에서 매 렌더 최신 함수로 갈아 끼운다. */
  });

  collectRegisterRef.current = (): void => {
    setSubmitConfirmOpen(false);
    setDiscardOpen(false);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    resetIfIdle(createWrite);
    resetIfIdle(chainSubmitWrite);

    if (!isChainPending) {
      setChain(NO_CHAIN);
      setChainTargetKey(null);
    }
  };

  useEffect(() => {
    collectRegisterRef.current();
  }, [registerTargetKey]);

  /** 이력 쪽의 같은 자리(수명 표 9~11행). **규칙이 둘로 갈리지 않게 형태를 맞춘다.** */
  const collectResubmitRef = useRef((): void => {
    /* 위와 같다. */
  });

  collectResubmitRef.current = (): void => {
    setResubmitConfirmOpen(false);
    setResubmitReason('');
    setLocalResubmitError(undefined);
    resetIfIdle(resubmitWrite);
  };

  useEffect(() => {
    collectResubmitRef.current();
  }, [issueTargetKey]);

  /**
   * **창은 자기 맥락보다 오래 살지 않는다**(수명 표 8·25행).
   *
   * 탭을 옮기거나 상세를 더는 읽을 수 없으면 창이 그려지지 않는데, **감추는 것과 상태를
   * 내리는 것은 다른 일이다** — 감추기만 하면 열림 상태가 선 채 남아, 사용자가 그 탭으로
   * 돌아오거나 「다시 조회」로 상세를 되찾는 순간 **누른 적 없는 확인 창**이 떠 있다.
   * 되돌릴 수 없는 조작의 확인이 저절로 되살아나는 것이다(전례 W-CO-09가 실측한 자리).
   *
   * **의존성이 원시값 둘뿐이다.** 상세 응답 객체를 넣으면 참조가 새로 올 때마다 —
   * 「다시 조회」 한 번에 — 열린 창이 닫힌다(`omf-mes#43`의 형태).
   */
  const hasReceiptDetail = detailData !== undefined;
  const hasIssueDetail = issueDetailData !== undefined;

  useEffect(() => {
    if (isDisposalTab && hasReceiptDetail) return;

    setSubmitConfirmOpen(false);
    setDiscardOpen(false);
  }, [isDisposalTab, hasReceiptDetail]);

  useEffect(() => {
    if (isHistoryTab && hasIssueDetail) return;

    setResubmitConfirmOpen(false);
  }, [isHistoryTab, hasIssueDetail]);

  /*
   * **상세가 404면 고른 전표를 주소에서 정리한다**(수명 표 5행 · 완료 조건 C20).
   *
   * **클릭 핸들러가 아니라 고른 식별자와 상세 응답에 묶는다.** 뒤로가기·앞으로가기·주소 직접
   * 편집은 핸들러를 거치지 않고 `gr`만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   *
   * **`replace`로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다** — 늘리면 뒤로 눌렀을 때
   * 없는 전표를 가리키는 주소로 되돌아가 같은 정리가 되풀이되고, 사용자는 **앞 화면으로
   * 빠져나갈 수 없다.**
   *
   * 조건·쪽은 하나도 바꾸지 않는다 — 없어진 전표 하나 때문에 사용자가 좁혀 둔 조건까지
   * 되돌리면 처음부터 다시 찾아야 한다.
   */
  useEffect(() => {
    if (selectedReceiptId === null) return;
    if (!isDetailNotFound) return;

    setNotFoundNotice(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.delete(SELECTION_KEYS.goodsReceipt);

        return next;
      },
      { replace: true },
    );
  }, [selectedReceiptId, isDetailNotFound, setSearchParams]);

  /*
   * 다시 고르면 앞의 안내를 거둔다 — 남으면 새로 고른 전표의 제목줄 옆에 「찾을 수 없습니다」가
   * 함께 서 있게 된다. **고른 식별자가 생기는 순간에만** 반응한다.
   *
   * 클릭 핸들러(`toggleSelectReceipt`)에도 같은 줄이 있으나 **이 effect가 정본이다** —
   * 뒤로가기·앞으로가기·주소 직접 편집으로 `gr`가 다시 생기는 경로는 핸들러를 거치지 않는다.
   */
  useEffect(() => {
    if (selectedReceiptId !== null) setNotFoundNotice(false);
  }, [selectedReceiptId]);

  /* 이력 쪽의 같은 자리 두 곳(수명 표 11행). **규칙이 둘로 갈리지 않게 형태를 맞춘다.** */
  useEffect(() => {
    if (selectedIssueId === null) return;
    if (!isIssueDetailNotFound) return;

    setIssueNotFoundNotice(true);
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        next.delete(HISTORY_SELECTION_KEYS.goodsIssue);

        return next;
      },
      { replace: true },
    );
  }, [selectedIssueId, isIssueDetailNotFound, setSearchParams]);

  useEffect(() => {
    if (selectedIssueId !== null) setIssueNotFoundNotice(false);
  }, [selectedIssueId]);

  /**
   * **화면이 보고 있는 조회를 전부 다시 한다**(수명 표 14행 · 감지기 M18).
   *
   * **목록만 다시 부르지 않는다** — 그러면 아래 구획이 낡은 채로 남아 **갱신된 값과 갱신되지
   * 않은 값이 한 화면에 섞인다**(W-01-07의 Major 지적). 이 화면에서 그 어긋남은 비싸다:
   * 낡은 줄로 폐기 품의를 올리면 **이미 없어진 자재를 폐기하려 한다.**
   *
   * **참조(이름)는 다시 부르지 않는다.** 기준정보는 이 조작으로 달라지지 않고, 못 받았을
   * 때의 복구는 각 구획의 「다시 시도」가 따로 갖는다. **잔액은 다시 부른다** — 이름이 아니라
   * **화면이 그 값으로 막고 푸는** 값이다.
   *
   * **고르지 않은 것은 부르지 않는다.** 설치본의 `refetch()`는 `enabled`를 보지 않아 비활성
   * 쿼리에서도 `queryFn`을 실행한다 — 지금은 `queryFn`이 던져서 요청이 나가지 않지만 그것은
   * **가드가 막는 것**이지 훅이 무동작인 것이 아니다.
   *
   * **보고 있는 탭의 것만 부른다.** 숨은 탭의 조회는 성립하지 않는데 `refetch()`는 `enabled`를
   * 보지 않으므로, 탭으로 가르지 않으면 「이 탭에 있는 동안 저 목록을 부르지 않는다」가 이
   * 버튼 하나로 깨진다.
   *
   * 조건·쪽·선택·초안은 하나도 바꾸지 않는다.
   */
  const refreshAll = (): void => {
    if (isDisposalTab) {
      void list.refetch();

      if (selectedReceiptId !== null) void detail.refetch();

      /*
       * 잔액에는 가드가 따로 없다 — 고르기 전에는 라인이 없어 **만들어진 조회 자체가 0건**이라
       * 순회할 것이 없다. 「고르지 않았으면 부르지 않는다」가 자료 구조로 지켜지는 자리다.
       */
      balances.refetch();

      return;
    }

    void issueList.refetch();

    if (selectedIssueId !== null) void issueDetail.refetch();

    /*
     * **결재 진행도 함께 부른다**(완료 조건 C47). 목록·상세만 다시 부르면 방금 결재된 건이
     * 앞 단계 그대로 서 있고, 사용자는 그 낡은 진행을 보고 처리 여부를 판단한다.
     * 상신되지 않은 품의에는 부를 것이 없다 — 그 판정은 `submission` 하나가 갖는다.
     */
    if (submission.kind === 'submitted') void approvalRequest.refetch();
  };

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다.
   * 안내 문구가 적은 대상과 다시 부르는 대상이 어긋나면, 눌러도 한쪽은 실패인 채로 남는데
   * 문구는 둘 다 고쳐질 것처럼 말한다.
   */
  const retryReferences = (): void => {
    warehouses.refetch();
  };

  const retryLineReferences = (): void => {
    items.refetch();
    uoms.refetch();
    lots.refetch();
    locations.refetch();
  };

  const warehouseReference = toReference(
    warehouses,
    filters.warehouse === '' ? null : Number(filters.warehouse),
  );

  /**
   * 창고 선택지. **좁힘을 화면이 한다**(계획 결정 2·8).
   *
   * 지금은 폐기 대상 창고 유형의 값 목록이 비어 있어 전체가 그대로 넘어가고, 배열이 채워지는
   * 순간 그 유형만 남는다. **목록 표의 이름 풀이에는 좁히지 않은 참조를 쓴다** — 창고 조건
   * 없이 조회하면 다른 창고의 입고가 함께 오고, 좁힌 목록으로 이름을 풀면 그 전표의 창고가
   * **「목록에 없음」으로 찍힌다**(`omf-mes#47`이 금지한 표기).
   *
   * 좁힘이 살아난 뒤 주소를 손으로 고쳐 좁힘 밖 창고를 조건으로 걸면 선택칸에는 그 값이 서지
   * 않는다 — 그래도 **조건은 걸려 있고 조건 칩이 그 사실을 이름으로 말한다.**
   */
  const warehouseOptions = toSelectOptions(
    narrowToDefectWarehouses(warehouses.entries, DEFECT_WAREHOUSE_TYPE_CODES),
  );

  /**
   * 창고 선택칸의 한계 안내. **못 불러온 것이 먼저다** — 목록을 받지도 못했는데 「좁히지
   * 못했다」를 말하면 사용자가 원인을 잘못 읽는다. 좁힘이 살아나면 마지막 갈래가 사라진다.
   */
  const warehouseNote =
    lookupNote(warehouses) ??
    (isDefectWarehouseTypePending(DEFECT_WAREHOUSE_TYPE_CODES)
      ? t.filters.warehouseTypePending
      : undefined);

  /**
   * 값 목록이 확정되지 않은 코드의 선택지. **화면이 만들어 조건 줄에 넘긴다** —
   * 배열이 차는 순간 화면이 달라지는 것을 화면 수준에서 잴 수 있게 하기 위해서다.
   */
  const codeOptions = toCodeOptionSets(PLACEHOLDER_DISPOSAL_ISSUE_CODES);

  /**
   * 표가 그릴 줄. **판정을 여기서 만들지 않는다**(감지기 M24·M31) — 고를 수 있는가·골라졌는가·
   * 상한을 넘었는가는 전부 `disposal-selection.ts` 한 곳에서 나오고, 표와 요약이 같은 결과를 본다.
   *
   * **지금 표에 있는 줄만 만든다.** 초안에 남아 있어도 사라진 줄은 여기 나타나지 않으므로
   * 요약에도 뒤따르는 회차의 요청에도 실리지 않는다.
   */
  const lineTableRows = toDisposalLineRows(lineRows, lineDraft, balances);

  /**
   * 무엇을 얼마나 폐기할 것인가. **화면이 한 번만 부르고 아래로 나눠 준다**(감지기 M31).
   *
   * 라인 표의 요약도, 뒤 회차의 「품의 등록」 활성 판정도, 확인 창의 줄 목록도, 요청 조립의
   * 입력도 전부 이 한 결과에서 나온다 — 부르는 자리가 둘이면 같은 함수라도 **한쪽 인자만
   * 바뀌었을 때 표와 버튼이 서로 다른 말을 한다.**
   */
  const selection = describeDisposalSelection(lineTableRows);

  /** 표기 헬퍼 — 확인 창과 결과 구획이 **같은 규칙으로** 이름과 수량을 읽는다. */
  const itemNameOf = (itemId: number): string => describeReference(toReference(items, itemId));
  const lotNameOf = (lotId: number): string => describeReference(toReference(lots, lotId));
  const qtyTextOf = (qty: number, uomId: number): string =>
    t.lineTable.receiptQtyPair(qty, describeReference(toReference(uoms, uomId)));

  /**
   * **실제로 보낼 줄.** 요청 본문의 `lines`가 이 배열 그대로다.
   *
   * **확인 창도 이 배열에서 나온다**(바로 아래) — 「확인한 것과 나가는 것이 갈리지 않는다」를
   * 규칙이 아니라 **자료 구조로** 지키는 자리다. 창이 자기 목록을 따로 만들면 두 곳의 거르는
   * 조건이 갈릴 수 있고, 그때 **창에 뜨는데 요청에는 없는 줄**(또는 그 반대)이 생긴다.
   */
  const submitInputs = toDisposalLines(selection.selectedRows);

  /**
   * 확인 창이 보일 줄 — **보낼 줄을 이름으로 옮긴 것뿐이다.** 거르지도 더하지도 않는다.
   *
   * 순번은 **보낼 줄 안에서의 차례**다. 창은 순번을 글자로 내지 않고 줄을 가르는 데만 쓰므로
   * (내부 번호를 쓰지 않기 위한 것이다 · `omf-mes#44`) 표의 순번과 달라도 뜻을 잃지 않는다.
   */
  const submitLines: SubmitLineSummary[] = submitInputs.map((line, index) => ({
    ordinal: index + 1,
    item: itemNameOf(line.itemId),
    lot: lotNameOf(line.lotId),
    qty: qtyTextOf(line.issueQty, line.uomId),
  }));

  /**
   * 결과 구획이 보일 값 — **서버가 되돌려 준 전표에서 나온다**(계획 결정 15).
   *
   * 화면이 보낸 줄을 되비추면 서버가 무엇을 만들었는지가 아니라 화면이 무엇을 보냈는지를
   * 말하는 것이 된다 — 서버가 줄을 하나 떨어뜨렸어도 화면은 알아채지 못한다.
   */
  const toResultSummary = (created: IssueDetailResult) => ({
    goodsIssueNo: created.issue.goodsIssueNo,
    statusCode: created.issue.statusCode,
    lines: created.lines.map(
      (line, index): ResultLineSummary => ({
        ordinal: index + 1,
        item: itemNameOf(line.itemId),
        lot: lotNameOf(line.lotId),
        qty: qtyTextOf(line.issueQty, line.uomId),
      }),
    ),
  });

  /**
   * 이 되먹임이 **지금 보고 있는 대상의 것인가.**
   *
   * 성공은 세우는 자리가 화면에 있어 거기서 걸렀지만, **실패는 공통 쓰기 훅의 안쪽 상태**라
   * 화면이 세우는 자리를 갖지 않는다 — 그래서 **읽는 자리에서** 매단다. 되돌아와도 되살아나지
   * 않는다: 대상을 떠난 순간 그 사실은 화면에서 수명을 다했고 정리 effect가 그 뒤에 거둔다.
   */
  const isChainForCurrentTarget = chainTargetKey === registerTargetKey;
  const isResubmitForCurrentTarget = resubmitTargetKey === issueTargetKey;

  /**
   * 재상신 확인 창이 보일 합계. **단위가 섞이면 합계를 내지 않는다** — 100 개와 5 상자를 더한
   * 105는 어떤 뜻도 없고, 화면이 확인하지 않은 것을 말하는 것이 된다(라인 표의 요약과 같은 규칙).
   */
  const issueUomIds = new Set(issueLineRows.map((line) => line.uomId));
  const [issueUomId] = [...issueUomIds];
  const issueTotalQtyText =
    issueUomIds.size === 1 && issueUomId !== undefined
      ? qtyTextOf(
          issueLineRows.reduce((sum, line) => sum + line.issueQty, 0),
          issueUomId,
        )
      : t.dialog.mixedUom;

  /** 서버가 사유 칸에 준 오류. **재상신 자리에만** 붙는다 — 매인 대상이 고른 품의다. */
  const resubmitFieldError = isResubmitForCurrentTarget
    ? resubmitWrite.fieldErrors.reason
    : undefined;

  /**
   * 발의 자리의 실패 배너. **등록 실패와 연쇄의 상신 실패가 같은 자리에 선다** —
   * 사용자가 누른 것이 하나(「품의 상신」)라 실패도 그 자리에서 읽혀야 한다.
   *
   * 등록이 먼저다: 등록에 실패했으면 상신은 시작되지도 않았다.
   */
  const registerError = isChainForCurrentTarget
    ? (createWrite.error ?? chainSubmitWrite.error)
    : null;
  const resubmitError = isResubmitForCurrentTarget ? resubmitWrite.error : null;

  /**
   * 서버가 준 되먹임이 **하나라도 남아 있는가**(배너 또는 인라인 필드 오류).
   *
   * 둘을 함께 보는 이유는 **한쪽만 서는 경우가 실재하기 때문**이다 — 400의 필드 오류가 전부
   * 인라인으로 소화되면 배너로 남을 것이 없어 `error`가 `null`이 된다.
   */
  const hasSubmitFailure =
    registerError !== null || Object.keys(chainSubmitWrite.fieldErrors).length > 0;

  /**
   * 폼이 그 칸에 붙일 오류 — **서버가 준 것과 화면이 잡은 것이 같은 칸에서 만난다.**
   *
   * 연쇄의 상신 실패가 사유 칸으로 오는 것이 이 화면의 형태다(사유가 발의 폼에 있다).
   */
  const formFieldErrors = isChainForCurrentTarget
    ? { ...createWrite.fieldErrors, ...chainSubmitWrite.fieldErrors, ...localFieldErrors }
    : localFieldErrors;

  /**
   * 「품의 상신」을 열지 말지. **판정은 `validation.ts` 한 곳에서 나온다** — 버튼과 보내는
   * 자리가 같은 함수를 부르므로 둘이 갈리지 않는다.
   */
  const blockReason = disposalBlockReason({
    codeOptions,
    draft: disposalDraft,
    selection: selection.ready,
  });

  /** 버릴 것이 있는가. **두 초안을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다. */
  const hasDraft = hasAnyLineDraftValue(lineDraft) || hasAnyDisposalDraftValue(disposalDraft);

  /** 잠긴 버튼의 사유를 잇는 `id`. 사유는 **잠근 자리 옆에서** 읽혀야 한다(배치 규범 4). */
  const actionReasonId = useId();
  const discardReasonId = `${actionReasonId}-discard`;

  /**
   * 지금도 보낼 수 있는가. **창을 여는 자리와 실제로 보내는 자리가 둘 다 이것을 부른다** —
   * 「버튼이 막았으니 여기서는 안 봐도 된다」가 성립하려면 버튼과 전송 사이에 상태가 바뀔 수
   * 없어야 하는데, **확인 창이 그 사이를 벌려 놓는다**(창이 열린 채 「다시 조회」로 줄이 사라질 수 있다).
   */
  const findRegisterBlocked = (): Record<string, string> | null => {
    const errors = validateDisposalDraft(disposalDraft);

    if (Object.keys(errors).length > 0) return errors;

    return blockReason === null ? null : {};
  };

  /** 확인 창을 연다. 막히면 **창을 열지 않고 요청도 만들지 않는다.** */
  const openSubmitConfirm = (): void => {
    const blocked = findRegisterBlocked();

    setLocalFieldErrors(blocked ?? NO_FIELD_ERRORS);

    if (blocked !== null) return;

    setSubmitConfirmOpen(true);
  };

  /**
   * 연쇄를 시작한다. **보내기 직전에 한 번 더 본다**(둘째 겹).
   *
   * 막혀 있으면 **창을 닫고 보내지 않는다** — 여기서 그냥 보내면 되돌릴 수 없는 전표가 빈
   * 코드나 사라진 줄로 나간다(계약에 `minItems`도 `minLength`도 없어 서버가 받는다).
   */
  const startSubmitChain = (receipt: ReceiptView): void => {
    setSubmitConfirmOpen(false);

    const blocked = findRegisterBlocked();

    if (blocked !== null) {
      setLocalFieldErrors(blocked);

      return;
    }

    const body = toGoodsIssueRequest({
      receipt,
      /* **확인 창이 보인 그 배열이다** — 여기서 다시 만들면 확인한 것과 나가는 것이 갈린다. */
      lines: submitInputs,
      draft: disposalDraft,
      destinationId: toDestinationId(disposalDraft.codes.disposalAccount),
      /* 발생 시각은 **제출 순간**이다. 순수 함수에 넘겨 그 사실이 인자로 드러나게 한다. */
      now: new Date(),
    });

    /* 조립이 마지막으로 거른다 — 빈 라인·빈 코드는 계약이 막지 않는다. */
    if (body === null) return;

    /* 앞 연쇄의 결과가 새 연쇄의 자리에 남아 있으면 무엇이 지금 상태인지 알 수 없다. */
    setChain(NO_CHAIN);
    /* **이 연쇄가 겨눈 전표를 적어 둔다** — 도착한 되먹임이 어느 전표의 것인지 가르는 기준이다. */
    setChainTargetKey(registerTargetKey);
    createWrite.write(body);
  };

  /**
   * 두 초안을 함께 버린다(수명 표 23행). **서버를 부르지 않는다** — 보내기 전 복귀이고,
   * 이미 만들어진 전표를 되돌리는 것이 아니다.
   *
   * **결과 구획과 실패 배너도 함께 거둔다.** 「버린다」는 앞서 한 시도를 통째로 물리는 것이라,
   * 방금 만든 전표 번호나 거절 사유만 남으면 무엇이 지금 상태인지 알 수 없다.
   *
   * **이력 탭의 사유 초안은 건드리지 않는다.** 이 버튼은 발의 자리의 것이고, 매인 대상이 다른
   * 초안까지 버리면 범위 있는 규칙을 넓은 잣대로 재는 것이 된다.
   */
  const discardDrafts = (): void => {
    setLineDraft(EMPTY_LINE_DRAFT);
    setDisposalDraft(EMPTY_DISPOSAL_DRAFT);
    setLocalFieldErrors(NO_FIELD_ERRORS);
    setDiscardOpen(false);
    setChain(NO_CHAIN);
    setChainTargetKey(null);
    resetIfIdle(createWrite);
    resetIfIdle(chainSubmitWrite);
  };

  /**
   * 발의 자리의 「최신 불러오기」 — **충돌한 자원을 다시 읽는다.**
   *
   * 409는 **누구의 버전이 낡았는가**의 문제라 다시 읽을 대상이 요청마다 다르다. 연쇄가 이미
   * 전표를 만들었다면 낡은 것은 **그 전표의 잠금 토큰**이므로 출고 상세를 다시 부르고, 아직
   * 만들지 않았다면 낡은 것은 **고른 입고 전표와 그 잔액**이다. 한쪽으로 뭉치면 눌러도 풀리지
   * 않는 「최신 불러오기」가 된다.
   */
  const reloadRegisterTarget = (): void => {
    if (chain.kind === 'created') {
      void fetchIssueDetail(chain.issue.issue.goodsIssueId);

      return;
    }

    refreshAll();
  };

  /** 이력 탭의 재상신 — 판정도 본문도 발의 자리와 **같은 파일**에서 나온다. */
  const resubmitBlock = resubmitBlockReason({ submission: submission.kind, reason: resubmitReason });

  const findResubmitBlocked = (): string | undefined => {
    if (readReason(resubmitReason).kind === 'empty') return t.errors.reasonRequired;

    return resubmitBlock === null ? undefined : t.errors.reasonRequired;
  };

  const openResubmitConfirm = (): void => {
    const blocked = findResubmitBlocked();

    setLocalResubmitError(blocked);

    if (blocked !== undefined) return;

    setResubmitConfirmOpen(true);
  };

  const sendResubmit = (): void => {
    setResubmitConfirmOpen(false);

    const blocked = findResubmitBlocked();

    if (blocked !== undefined) {
      setLocalResubmitError(blocked);

      return;
    }

    const body = toApprovalRequest(resubmitReason);

    if (body === null) return;

    setResubmitTargetKey(issueTargetKey);
    resubmitWrite.write(body);
  };

  /**
   * 고른 전표의 창고 이름. **좁히지 않은 참조로 푼다** — 좁힘은 선택지 하나에만 걸린다
   * (좁힌 목록으로 풀면 좁힘 밖 창고의 전표에서 정상 값이 「알 수 없음」으로 찍힌다).
   */
  const detailWarehouseName = describeReference(
    toReference(warehouses, detailData?.receipt.warehouseId ?? null),
  );

  /** 고른 품의의 창고 이름. 같은 이유로 **좁히지 않은 참조**로 푼다. */
  const issueWarehouseName = describeReference(
    toReference(warehouses, issueDetailData?.issue.sourceWarehouseId ?? null),
  );

  /**
   * 결재 진행 구획이 설 갈래 — **판정을 한 자리에 모은다.**
   *
   * 갈래를 그리는 자리에서 각자 판정하면 「부르는 중인데 미상신이라고 말하는」 어긋남이 생긴다.
   * 순서가 뜻을 정한다: **상신 여부가 조회 상태보다 앞선다** — 부르지 않는 갈래에서 조회 상태를
   * 먼저 보면 영영 오지 않을 응답을 기다리는 뼈대가 선다.
   */
  const approvalState = ((): ApprovalProgressState => {
    if (submission.kind === 'notSubmitted') return { kind: 'notSubmitted' };
    if (submission.kind === 'unusable') return { kind: 'unusable' };
    if (approvalRequest.isError) return { kind: 'failed', error: approvalRequest.error };
    if (approvalRequest.data === undefined) return { kind: 'loading' };

    return {
      kind: 'ready',
      view: toRequestProgressView(
        approvalRequest.data,
        REJECTION_DECISION_CODES,
        APPROVED_APPROVAL_STATUS_CODES,
      ),
    };
  })();

  /**
   * 이력 라인 표의 참조 실패. **넷을 하나로 접어 넘긴다** — 안내 문구가 넷을 함께 적고
   * 「다시 시도」가 넷을 함께 부르므로, 판정도 같은 범위여야 문구와 조치가 어긋나지 않는다.
   */
  const hasLineReferenceError =
    items.isError || uoms.isError || lots.isError || locations.isError;

  const disposalTabContent: ReactNode = (
    <>
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
        <GrFilterBar
          appliedFilters={filters}
          isLocked={isLocked}
          warehouseOptions={warehouseOptions}
          warehouseNote={warehouseNote}
          receiptTypeOptions={codeOptions.receiptType}
          statusOptions={codeOptions.status}
          chipNames={{ warehouse: describeReference(warehouseReference) }}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onRemoveFilter={(key: RemovableChipKey) => {
            applyQuery(clearFilter(filters, key));
          }}
          onReset={() => {
            applyQuery(DEFAULT_FILTERS);
          }}
        />

        {!list.isError && (
          <>
            <GrTable
              rows={rows}
              isLoading={list.isPending}
              isLocked={isLocked}
              isBeyondLast={pageView.isBeyondLast}
              selectedReceiptId={selectedReceiptId}
              warehouseLookup={warehouses}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              onToggleSelect={toggleSelectReceipt}
              onRetryReferences={retryReferences}
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
       * 아래 구획 — **네 갈래를 가른다**: 없음 안내(S4) · 고르기 전(S0) · 불러오는 중 · 고른 뒤(S1·S2).
       *
       * 「없음」이 「고르기 전」보다 앞선다 — 404로 `gr`를 정리하고 나면 주소가 같아져, 순서를
       * 뒤집으면 사용자가 **자기가 무엇을 눌렀는지 되짚을 수 없다.**
       *
       * **상세 실패의 다른 갈래를 여기서 가르지 않는다.** 계약의 입고 상세 응답은 200과 404
       * 둘뿐이고(실측) **403이 없다** — 만들면 닿을 수 없는 가지가 된다. 네트워크 끊김은
       * 골격이 서 있는 동안 화면이 조용히 기다리고, 사용자가 「다시 조회」로 되살린다.
       */}
      <section className="pane" aria-label={t.panes.lines}>
        {hasNotFoundNotice && selectedReceiptId === null && (
          <EmptyState
            size="sm"
            live
            title={t.empty.notFoundTitle}
            description={t.empty.notFoundDescription}
          />
        )}

        {!hasNotFoundNotice && selectedReceiptId === null && (
          <EmptyState
            size="sm"
            title={t.empty.noSelectionTitle}
            description={t.empty.noSelectionDescription}
          />
        )}

        {selectedReceiptId !== null && detailData === undefined && (
          <div role="status" aria-label={t.loading.detail}>
            <SkeletonText lines={3} />
          </div>
        )}

        {detailData !== undefined && (
          <>
            <ReceiptSummaryPane receipt={detailData.receipt} warehouseName={detailWarehouseName} />

            <GrLineTable
              rows={lineTableRows}
              itemLookup={items}
              uomLookup={uoms}
              lotLookup={lots}
              locationLookup={locations}
              hasBalanceError={balances.isError}
              hasBalanceTruncated={balances.truncated}
              isLocked={isLocked}
              selection={selection}
              onToggleSelect={(goodsReceiptLineId) => {
                setLineDraft((prev) => toggleLineSelection(prev, goodsReceiptLineId));
              }}
              onChangeQty={(goodsReceiptLineId, text) => {
                setLineDraft((prev) => setDraftQty(prev, goodsReceiptLineId, text));
              }}
              onRetryReferences={retryLineReferences}
              onRetryBalances={() => {
                balances.refetch();
              }}
            />

            {/*
             * 품의 정보 — **어떤 전표로·언제·왜 폐기하는가.** 창이 아니라 구획인 이유는
             * 선택칸이 다섯이라 창에 넣으면 펼침 목록이 잘리는 결함(`omf-mes#45`)에 걸리기
             * 때문이다. 고칠 수 없는 결함은 **걸릴 자리를 만들지 않는 것**으로 피한다.
             */}
            <DisposalForm
              values={disposalDraft}
              codeOptions={codeOptions}
              fieldErrors={formFieldErrors}
              isLocked={isLocked}
              onChangeCode={(key: DisposalCodeKey, value) => {
                setDisposalDraft((prev) => ({ ...prev, codes: { ...prev.codes, [key]: value } }));
              }}
              onChangeIssuedDate={(value) => {
                setDisposalDraft((prev) => ({ ...prev, issuedDate: value }));
              }}
              onChangeIssuedTime={(value) => {
                setDisposalDraft((prev) => ({ ...prev, issuedTime: value }));
              }}
              onChangeRemarks={(value) => {
                setDisposalDraft((prev) => ({ ...prev, remarks: value }));
              }}
              onChangeReason={(value) => {
                setDisposalDraft((prev) => ({ ...prev, reason: value }));
              }}
            />

            {/*
             * 저장 실패는 **네 갈래**다(계획 결정 16). 배너가 검증 실패(400)·권한 없음(403)·
             * 저장 충돌(409)·응답 없음(네트워크)의 문구를 갈라 내고, **409에만** 「최신
             * 불러오기」가 붙는다 — 다시 읽어 풀리는 것은 충돌뿐이라 다른 갈래에 내면 입력만
             * 버리게 된다. **결재선이 없어 오는 400도 여기 온다**(계약 명시) — 코드로 분기해
             * 원인을 지어내지 않고 서버 문구를 그대로 낸다.
             */}
            <SaveErrorBanner error={registerError} onReload={reloadRegisterTarget} />

            {/*
             * **응답을 받지 못한 실패에만 한 줄을 더한다.** 공통 문구는 「다시 시도하세요」로
             * 끝나는데, 확인 없이 다시 보내면 같은 품의가 전표 두 벌로 남는다 — 공통 쓰기 훅이
             * 호출마다 새 멱등 키를 만들어 서버가 재전송으로 보지 못한다(`omf-mes#55`).
             */}
            {registerError?.kind === 'network' && (
              <p className="field-error">{t.notes.submitRecheck}</p>
            )}

            {/*
             * **한 번 눌러 요청이 둘 나간다**는 사실을 버튼 앞에서 밝힌다(승인 기록 정정 1-1).
             * 밝히지 않으면 「상신했는데 전표만 생겼다」는 중간 실패가 까닭 없는 일이 된다.
             */}
            <p className="field-note">{t.form.chainNote}</p>

            <div className="form-actions">
              {/* 지우기가 상신보다 앞에 선다 — 되돌릴 수 없는 것이 손 가까이 있으면 안 된다. */}
              <div className="field-cell">
                <Button
                  variant="text"
                  disabled={!hasDraft || isLocked}
                  aria-describedby={hasDraft ? undefined : discardReasonId}
                  onClick={() => {
                    setDiscardOpen(true);
                  }}
                >
                  {t.actions.discardDrafts}
                </Button>
                {!hasDraft && (
                  <span id={discardReasonId} className="field-note">
                    {t.actionReasons.nothingToDiscard}
                  </span>
                )}
              </div>

              <div className="field-cell">
                <Button
                  disabled={blockReason !== null || isLocked}
                  loading={isLocked}
                  aria-describedby={blockReason === null ? undefined : actionReasonId}
                  onClick={openSubmitConfirm}
                >
                  {t.actions.submitDisposal}
                </Button>
                {blockReason !== null && (
                  <span id={actionReasonId} className="field-note">
                    {blockReason}
                  </span>
                )}
              </div>
            </div>

            {/* **창은 열 때만 붙인다** — 닫혀도 남아 있으면 지난 값이 DOM에 살아 있게 된다. */}
            {isSubmitConfirmOpen && (
              <SubmitConfirmDialog
                summary={{
                  goodsReceiptNo: detailData.receipt.goodsReceiptNo,
                  warehouseName: detailWarehouseName,
                  issueTypeCode: disposalDraft.codes.issueType,
                  sourceDocumentTypeCode: disposalDraft.codes.sourceDocumentType,
                  destinationTypeCode: disposalDraft.codes.destinationType,
                  disposalAccount: disposalDraft.codes.disposalAccount,
                  reasonCode: disposalDraft.codes.reason,
                  issuedAt: formatDateTime(toIssuedLocal(disposalDraft)),
                  businessDate: toBusinessDate(toIssuedLocal(disposalDraft)),
                  remarks: disposalDraft.remarks,
                  lines: submitLines,
                  reason: disposalDraft.reason,
                  reasonFirstLine: firstLineOf(disposalDraft.reason),
                  /* 상한을 확인하지 못한 줄이 **보낼 줄에 섞여 있을 때만** 밝힌다. */
                  hasUnknownOnHand: selection.selectedRows.some(
                    (row) => row.onHand.kind !== 'known',
                  ),
                }}
                onConfirm={() => {
                  startSubmitChain(detailData.receipt);
                }}
                onClose={() => {
                  setSubmitConfirmOpen(false);
                }}
              />
            )}

            {isDiscardOpen && (
              <DiscardConfirmDialog
                onConfirm={discardDrafts}
                onClose={() => {
                  setDiscardOpen(false);
                }}
              />
            )}
          </>
        )}
      </section>

      {/*
       * 상신 결과 — **화면이 확인한 것만 말한다**(계획 결정 15). 라인 표 구획 **밖**에 두는
       * 이유는 이 결과가 고른 입고 전표가 아니라 **만들어진 품의**에 대한 것이기 때문이다.
       *
       * **자기 대상보다 오래 살지 않는다** — 매임 이름(`chainTargetKey`)이 지금 고른 전표와
       * 다르면 서지 않는다.
       */}
      {chain.kind !== 'none' && isChainForCurrentTarget && (
        <RegisterResultPane
          outcome={
            chain.kind === 'submitted'
              ? { kind: 'submitted', issue: toResultSummary(chain.issue) }
              : {
                  /*
                   * **부분 실패를 갈라 내는 자리.** 상신이 실패했다는 사실은 훅의 되먹임에서
                   * 오고, 그전까지는 「올리는 중」이다 — 실패를 성공처럼도, 진행 중을 실패처럼도
                   * 말하지 않는다.
                   */
                  kind: hasSubmitFailure ? 'partial' : 'submitting',
                  issue: toResultSummary(chain.issue),
                }
          }
          onOpenIssue={() => {
            openCreatedIssue(chain.issue.issue.goodsIssueId);
          }}
        />
      )}
    </>
  );

  const historyTabContent: ReactNode = (
    <>
      {issueList.isError && (
        <LoadErrorBanner
          error={issueList.error}
          onRetry={() => {
            void issueList.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.historyList}>
        <GiFilterBar
          appliedFilters={historyFilters}
          isLocked={isLocked}
          /*
           * **출고 유형·폐기 사유는 폐기 정보 폼과 같은 값 목록을 쓴다** — 같은 공통코드라
           * 갈라 두면 값이 확정될 때 채울 자리가 둘이 된다(`code-options.ts`).
           * **상태만 따로다** — 출고 전표의 상태는 입고 전표의 상태와 다른 값 목록이다.
           */
          issueTypeOptions={codeOptions.issueType}
          reasonOptions={codeOptions.reason}
          statusOptions={codeOptions.issueStatus}
          onSearch={(nextFilters) => {
            applyHistoryQuery(nextFilters);
          }}
          onRemoveFilter={(key: RemovableIssueChipKey) => {
            applyHistoryQuery(clearIssueFilter(historyFilters, key));
          }}
          onReset={() => {
            applyHistoryQuery(DEFAULT_ISSUE_FILTERS);
          }}
        />

        {!issueList.isError && (
          <>
            <GiTable
              rows={issueRows}
              isLoading={issueList.isPending}
              isLocked={isLocked}
              isBeyondLast={issuePageView.isBeyondLast}
              selectedIssueId={selectedIssueId}
              warehouseLookup={warehouses}
              onFirstPage={() => {
                applyHistoryQuery(historyFilters);
              }}
              onToggleSelect={toggleSelectIssue}
              onRetryReferences={retryReferences}
            />
            {!issueList.isPending && (
              <PageNav
                view={issuePageView}
                isLocked={isLocked}
                onChange={(nextPage) => {
                  applyHistoryQuery(historyFilters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      {/* 아래 구획 — 대상 탭과 **같은 네 갈래**다. 형태를 맞춰야 규칙이 둘로 갈리지 않는다. */}
      <section className="pane" aria-label={t.panes.historyDetail}>
        {hasIssueNotFoundNotice && selectedIssueId === null && (
          <EmptyState
            size="sm"
            live
            title={t.empty.issueNotFoundTitle}
            description={t.empty.issueNotFoundDescription}
          />
        )}

        {!hasIssueNotFoundNotice && selectedIssueId === null && (
          <EmptyState
            size="sm"
            title={t.empty.historyNoSelectionTitle}
            description={t.empty.historyNoSelectionDescription}
          />
        )}

        {selectedIssueId !== null && issueDetailData === undefined && (
          <div role="status" aria-label={t.loading.issueDetail}>
            <SkeletonText lines={3} />
          </div>
        )}

        {issueDetailData !== undefined && (
          <>
            <IssueDetailPane issue={issueDetailData.issue} warehouseName={issueWarehouseName} />

            <IssueLineTable
              rows={issueLineRows}
              itemLookup={items}
              uomLookup={uoms}
              lotLookup={lots}
              locationLookup={locations}
              hasReferenceError={hasLineReferenceError}
              onRetryReferences={retryLineReferences}
            />

            {/*
             * 결재 진행. **못 읽어도 위 두 구획은 그대로 산다**(수명 표 26행) —
             * 판단을 돕는 자료이지 이 품의를 다루는 전제가 아니다.
             */}
            <ApprovalProgressPane
              state={approvalState}
              /*
               * **자리표시를 화면이 읽어 넘긴다** — 부품이 상수를 직접 읽으면 「채워지면 무엇이
               * 달라지는가」를 화면 수준에서 잴 수 없어 그 자리가 죽은 가지가 된다.
               */
              isJudgePending={isApprovalJudgePending(APPROVED_APPROVAL_STATUS_CODES)}
              hasPosted={hasPostedLine(issueLineRows)}
              onRetry={() => {
                void approvalRequest.refetch();
              }}
            />

            {/*
             * 상신 — **미상신 전표를 이어서 결재에 올리는 자리다**(승인 기록 정정 1-1).
             *
             * 「품의 상신」의 연쇄가 둘째 요청에서 실패하면 **전표만 남는데**, 이 구획이 없으면
             * 그 전표는 이 화면의 정상 경로로 되살릴 수 없다. 상신 자리를 **한 곳**에 두는
             * 규칙(계획 결정 6)이 지켜지는 자리이기도 하다 — 발의 탭의 버튼은 전표를 만드는
             * 조작이고, **이미 있는 전표를 올리는 자리는 여기 하나다.**
             */}
            <ResubmitPane
              submission={submission.kind}
              reason={resubmitReason}
              reasonError={localResubmitError ?? resubmitFieldError}
              blockReason={resubmitBlock}
              isLocked={isLocked}
              onChangeReason={(value) => {
                setResubmitReason(value);
              }}
              onOpenConfirm={openResubmitConfirm}
            />

            <SaveErrorBanner error={resubmitError} onReload={refreshAll} />

            {resubmitError?.kind === 'network' && (
              <p className="field-error">{t.notes.submitRecheck}</p>
            )}

            {isResubmitConfirmOpen && (
              <ResubmitConfirmDialog
                summary={{
                  goodsIssueNo: issueDetailData.issue.goodsIssueNo,
                  lineCount: issueLineRows.length,
                  totalQtyText: issueTotalQtyText,
                  reason: resubmitReason,
                  reasonFirstLine: firstLineOf(resubmitReason),
                }}
                onConfirm={sendResubmit}
                onClose={() => {
                  setResubmitConfirmOpen(false);
                }}
              />
            )}
          </>
        )}
      </section>
    </>
  );

  /**
   * 탭 둘. **활성 탭의 `content`에만 내용을 담는다.**
   *
   * 디자인 시스템 `Tabs`는 패널을 전부 렌더하고 비활성만 감춘다(구현 실측) — 두 패널에 내용을
   * 두면 숨은 탭의 표가 접근성 트리에 남고, 이름으로 집는 조작·시험이 숨은 글자를 잡는다.
   */
  const tabItems: TabItem[] = [
    {
      value: 'disposal',
      label: tabLabel('disposal'),
      content: isDisposalTab ? disposalTabContent : null,
      /*
       * **전송 중에는 다른 탭으로 건너가지 못한다**(잠금의 첫째 겹 · W-01-05 R3-1의 셋째 길).
       * 탭이 바뀌면 보내는 자리가 화면에서 사라져 도착한 되먹임이 설 곳을 잃는다.
       *
       * **보고 있는 탭은 잠그지 않는다** — 자기 자신을 누르는 것은 아무 일도 하지 않고,
       * 잠그면 탭 줄 전체가 죽은 것처럼 보인다.
       */
      disabled: isLocked && !isDisposalTab,
    },
    {
      value: 'history',
      label: tabLabel('history'),
      content: isHistoryTab ? historyTabContent : null,
      disabled: isLocked && !isHistoryTab,
    },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          /* 전송 중에는 다시 부르지 않는다 — 나가는 중인 쓰기가 곧 그 자료를 바꾼다. */
          <Button variant="outlined" size="sm" disabled={isLocked} onClick={refreshAll}>
            {t.actions.refresh}
          </Button>
        }
      />
      {/*
       * **탭 줄 안내**(승인 기록 정정 1-2). 이 화면은 승인·반려를 하지 않고 결재 진행을
       * 읽기만 한다 — 밝히지 않으면 사용자가 여기서 결재할 수 있다고 믿고 있지도 않은
       * 승인 버튼을 찾아 헤맨다. 탭 안이 아니라 **탭 줄 위**에 두는 이유는 이 사실이 두 탭에
       * 함께 걸리기 때문이다.
       */}
      <p className="field-note">{t.tabs.note}</p>

      <Tabs aria-label={t.tabs.label} items={tabItems} value={tab} onChange={changeTab} />
    </>
  );
};
