import {
  AlertBanner,
  Breadcrumb,
  EmptyState,
  PageHeader,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { readCancelAvailability } from './cancel-availability';
import { isSuccessorBlocked } from './cancel-error';
import { CancelPane, type CancelLock } from './cancel-pane';
import { CANCEL_REASON_FIELD, toCancelRequest } from './cancel-reason-draft';
import { PLACEHOLDER_DOCUMENT_STATUS_CODES, toStatusOptions } from './code-options';
import { DetailPane } from './detail-pane';
import {
  readSelectedDocumentId,
  toDetailSelection,
  withoutSelection,
  withSelection,
} from './detail-selection';
import {
  cancelResourceOf,
  describeDisabledTypes,
  DOCUMENT_TYPES,
  isDocumentTypeListPending,
  toDocumentTypeOptions,
} from './document-types';
import {
  DEFAULT_PROGRESS_FILTERS,
  readFilters,
  readPage,
  toListQuery,
  toSearchParams,
  type ProgressFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { ProgressFilterBar } from './progress-filter-bar';
import { ProgressTable } from './progress-table';
import {
  documentProgressKeys,
  isDocumentProgressNotFound,
  useCancelResourceLock,
  useDocumentProgressDetail,
  useDocumentProgressList,
  useRequestDocumentCancel,
  type CancelTarget,
} from './queries';
import { RequestCancelDialog } from './request-cancel-dialog';
import { SCREEN_ROUTES } from './screen-routes';
import { SaveErrorBanner } from '../../patterns/master';

const t = messages.documentProgress;

type ApprovalRequestCreate = components['schemas']['ApprovalRequestCreate'];

/**
 * 열려 있는 취소 요청 확인 창 — **`null`이면 창이 닫혀 있다.**
 *
 * ⭐ **창의 상태가 곧 「확인된 요청」이다.** 사유 검증을 창을 여는 자리에서 끝내고 그 결과를
 * 여기 담으므로, 확인 버튼이 눌렸을 때 다시 판정할 것이 없다 — **확인한 값과 보내는 값이 같은
 * 자리에서 나오고**, 「보낼 수 없는데 창이 열려 있는」 갈래가 타입 수준에서 사라진다.
 */
interface CancelDialogState {
  /** 확인 당시의 대상. **업무 번호다** — 창이 뜬 뒤 목록이 갱신돼도 확인한 대상이 바뀌지 않는다. */
  documentNo: string;
  /** 그대로 나갈 본문. 사유 하나뿐이다. */
  body: ApprovalRequestCreate;
}

/**
 * W-01-13 물류 문서 진행현황·취소 — **이 회차(작업 단위 ①~③)는 목록·상세와 취소 요청까지다.**
 *
 * 읽는 것이 주 동작이고 편집 폼이 없어 2단 배치를 쓰지 않는다. 표가 창 폭을 다 쓰고
 * 고른 문서의 상세는 **목록 아래 구획**에 선다(드로어도 창도 아니다 — 디자인 시스템에 드로어가
 * 없고, 창이면 목록이 가려져 「고르고 다시 목록으로 돌아가는」 반복이 매번 열고 닫는 일이 된다).
 * 조회 조건과 고른 문서는 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * ⭐ **지금 이 화면은 요청을 한 번도 보내지 않는다.** 문서 유형 값 목록이 확정되지 않아
 * (omf-mes#64) 자리표시 표가 비어 있고, 계약은 유형을 목록 조회의 **필수** 질의값으로 두었다.
 * 그것이 지금의 정직한 모습이며 화면은 그 사실을 「선택지 준비 중」 안내로 말한다 —
 * 빈 표를 내면 사용자는 조건에 맞는 문서가 없는 줄 안다.
 *
 * **표를 채우면 저절로 살아난다.** 채울 자리는 `document-types.ts` 한 곳이고, 이 파일은
 * 그 표를 **인자로 넘길 뿐** 값을 읽어 분기하지 않는다. 취소도 같다 — 표의 취소 리소스 열이
 * 채워지는 순간 취소 축이 살아난다.
 *
 * ⭐ **취소는 승인을 탄다.** 이 회차가 만드는 것은 **취소 요청**이며 문서는 아직 취소되지 않는다.
 * 승인 진행 표시와 취소 실행은 다음 회차(단위 ④)의 몫이고, 라우트와 사이드바는 그 뒤(단위 ⑤)에
 * 연다 — 실행할 자리가 서기 전에 화면을 열면 **승인을 받아 놓고 실행할 곳이 없는** 상태가
 * 사용자에게 보인다.
 */
export const DocumentProgressScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * | # | 조작 | `page` | `sel`(고른 문서) | 왜 |
   * | :-: | --- | --- | --- | --- |
   * | 1 | 조건 변경 · 초기화 | **첫 쪽으로** | **비운다** | 결과가 통째로 달라진다. 3쪽을 보다 조건을 좁히면 빈 쪽이 되고, 고른 문서도 새 결과에 없을 수 있다 |
   * | 2 | 쪽 이동 | 옮긴 쪽 | **비운다** | 조건은 그대로지만 고른 문서는 그 쪽에 없다 |
   * | 3 | 문서 고르기·해제 | 유지 | 넣고 뺀다 | 보이는 줄을 바꾸지 않는다 — 3쪽에서 고른 문서를 보는 동안 목록이 1쪽으로 튀면 안 된다 |
   * | 4 | 상세가 404 | 유지 | **비운다**(`replace`) | 사용자가 한 조작이 아니다 — 히스토리를 늘리면 뒤로가기가 없는 문서로 되돌아가 같은 정리가 되풀이된다 |
   * | 5 | **새로고침**(재조회) | 유지 | **유지** | 새로고침은 같은 조회를 다시 하는 것이다. 무언가를 비우면 새로고침이 조건 변경으로 둔갑한다 |
   *
   * **구현 규칙 하나가 1·2행을 함께 지킨다** — `toSearchParams(filters, page)`가 **`sel`을 만들지
   * 않는다.** 조건·쪽을 다시 쓰는 길이 모두 그 함수를 지나므로 비우는 것을 따로 적을 자리가 없고,
   * 고르는 쪽(`withSelection`)만 그 결과에 덧붙인다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다.
   * 조회 응답이 도착하는 순간(대기 → 성공)이 실제로 그 자리이며, 사용자에게는
   * 「치던 값이 갑자기 사라졌다」로 나타난다. `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<ProgressFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  /*
   * 자리표시 표는 **여기서 읽어 아래로 넘긴다.** 부품이나 판정 함수가 상수를 직접 읽으면
   * 「값이 확정되면 무엇이 살아나는가」를 화면 수준에서 잴 수 없다.
   */
  const documentTypes = DOCUMENT_TYPES;
  const documentTypeOptions = toDocumentTypeOptions(documentTypes);
  const disabledReasons = describeDisabledTypes(documentTypes);
  const statusOptions = toStatusOptions(PLACEHOLDER_DOCUMENT_STATUS_CODES);

  /*
   * ⭐ **조회가 성립하는가를 한 곳에서 정한다.** `toListQuery`가 `null`을 주면 목록 조회는
   * 나가지 않는다 — 표가 비어 있는 동안에는 어떤 주소로 들어와도 `null`이다.
   */
  const listQuery = toListQuery(filters, documentTypes, page);
  const list = useDocumentProgressList(listQuery);

  const rows = list.data?.items ?? [];
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /*
   * ⭐ **고른 문서도 주소에서 나온다 — 목록 응답에서 찾지 않는다.** 대상이 주소에 있으므로
   * 새로고침·주소 공유로 들어와도 상세가 곧바로 나가고(계획 갈래 24), 목록이 실패한 동안에도
   * 고른 문서를 볼 수 있다. 잣대는 목록과 **같은 한 곳**(`findSelectableDocumentType`)이다.
   */
  const selection = toDetailSelection(filters, documentTypes, searchParams);
  const detail = useDocumentProgressDetail(selection);

  /**
   * 취소 조작의 대상 — **유형 표가 리소스를 정하고 주소가 번호를 정한다.**
   *
   * ⭐ **고른 문서에서 유형을 읽는다.** 목록·상세와 같은 잣대를 지난 값이라(`toDetailSelection`)
   * 비활성 유형이나 표에 없는 유형이 여기까지 오지 않는다 — 잣대가 갈리면 손으로 고친 주소가
   * 취소를 내보내는 길이 된다.
   *
   * 표에 취소 리소스가 없으면 `null`이고, 그러면 조회도 조작도 서지 않는다(완료 조건 C3-1).
   */
  const cancelResource =
    selection === null ? null : cancelResourceOf(selection.documentTypeCode, documentTypes);

  const cancelTarget: CancelTarget | null =
    cancelResource === null || selection === null
      ? null
      : { resource: cancelResource, documentId: selection.documentId };

  /**
   * ⭐ **잠금 토큰은 진행현황 상세가 아니라 리소스 상세에서 온다**(계획 §5-1). 두 조회는 역할이
   * 달라 나란히 나가며, 이쪽이 실패해도 진행현황은 계속 읽을 수 있다.
   */
  const cancelLockQuery = useCancelResourceLock(cancelTarget);

  /**
   * 취소 대상의 서명 — **대상 매임의 축**이다.
   *
   * 쓰기의 되먹임은 그 요청을 **보낸 렌더의 값**을 들고 도착한다. 「지금 보고 있는 대상의
   * 것인가」를 견주려면 두 값을 같은 모양의 글자로 만들어 두어야 하고, 리소스와 번호가 **함께**
   * 들어가야 한다 — 번호만 견주면 리소스가 다른 같은 번호의 문서가 남의 결과를 받는다.
   */
  const cancelTargetKey =
    cancelTarget === null ? '' : `${cancelTarget.resource}:${String(cancelTarget.documentId)}`;

  /**
   * 마지막으로 **보낸** 대상.
   *
   * ⚠ **렌더 중에 읽는다.** 이 값은 보내는 길(`submitCancelRequest`)에서만 바뀌고 그 길은 반드시
   * 상태 변화(진행 중)를 함께 일으키므로, 값이 바뀐 뒤에는 반드시 다시 그려진다 — 한 렌더 안에서
   * 답이 흔들리지 않는다(전례 `putaway-rule/screen.tsx`의 같은 규율).
   */
  const sentCancelTargetKeyRef = useRef<string | null>(null);

  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState | null>(null);

  const cancelWrite = useRequestDocumentCancel({
    resource: cancelResource,
    documentId: selection?.documentId ?? null,
    onSuccess: () => {
      /*
       * 요청은 올라갔다 — 대상이 그 사이에 바뀌었어도 그 사실까지 감추지 않는다.
       *
       * ⛔ **승인 요청 번호를 내지 않는다.** 응답에 오는 것이 내부 식별자뿐이라(`ApprovalRequestRef`)
       * 화면에 낼 업무 번호가 없다(omf-mes#44).
       */
      toast.show({ variant: 'success', description: t.cancelRequest.submitted });

      /*
       * ⚠ **여기서 대상을 다시 견주지 않는다.** 대상이 바뀌면 정리 effect가 이미 창을 닫고
       * 초안을 비웠으므로, 견줌을 더해도 관찰이 갈리지 않는 가지가 하나 늘 뿐이다.
       */
      setCancelDialog(null);
      setCancelReason('');
      setCancelReasonError(null);
    },
  });

  /**
   * ⭐ **잠금의 축 — 전역이다.** 어느 대상이든 취소 요청이 나가는 중이면 조작을 잠근다.
   * 아래 진행 표시의 축(`isCancelSavingMine`)과 **일부러 갈라 둔 값**이다(완료 조건 C3-13).
   */
  const isCancelLocked = cancelWrite.isSaving;

  /** 훅에 남아 있는 쓰기 결과가 **지금 보는 대상의 것인가.** */
  const isCancelResultMine = sentCancelTargetKeyRef.current === cancelTargetKey;

  /**
   * ⭐ **진행 표시의 축 — 이 대상의 요청인가.**
   *
   * ⛔ 전역 잠금으로 재지 않는다 — 나가는 중에 바깥 주소 이동으로 대상이 바뀌면 **손대지도 않은
   * 문서가 「요청 중」이라고 말한다.**
   */
  const isCancelSavingMine = cancelWrite.isSaving && isCancelResultMine;

  /**
   * 사유 칸 옆에 설 오류 — **화면이 잡은 것과 서버가 준 것이 같은 칸에 붙는다**(공유계약 G-1).
   *
   * **인라인 오류도 매임을 지난다** — 배너만 감추면 대상이 바뀐 뒤 새 문서의 칸 옆에 **남의 문서가
   * 받은 거절 사유**가 붙는다.
   *
   * ⭐ **화면이 잡은 것을 앞에 둔다**(전례 `putaway-rule/screen.tsx`의 `{...서버, ...로컬}`과 같은
   * 방향). 서버 거절이 선 뒤 사용자가 칸을 **비우고 다시 누르면** 그 순간의 사실은 「비었다」이고,
   * 낡은 서버 문구가 그 위에 남으면 무엇을 고쳐야 하는지 흐려진다.
   *
   * ⛔ **글자를 칠 때 서버 거절을 걷지 않는다**(전례의 `clearFieldError`를 쓰지 않는다). 전례는
   * **여러 칸 폼**이라 A 칸을 고치는 동안 A의 거절이 남으면 방해가 되지만, 이 화면의 칸은 하나이고
   * 그 거절이 **지금 고치는 이유 그 자체**다 — 고치는 동안 사라지면 무엇 때문에 거절됐는지 볼
   * 수 없다. 걷는 자리는 **창을 닫는 순간**(`resetIfIdle`)과 **다시 보내는 순간**(공통 훅이 스스로
   * 걷는다) 둘뿐이다.
   *
   * ⚠ **차례 자체는 지금 관찰이 갈리지 않는다(등가).** 서버 거절은 **창이 열려 있을 때만** 서고,
   * 화면이 잡는 오류는 **창을 여는 자리**에서만 세워지며, 창을 닫는 순간 서버 거절이 걷힌다 —
   * 두 값이 함께 서는 순간이 없다. **갈릴 조건**: 사유 칸이 창 안으로 들어오거나, 창을 닫을 때
   * 서버 거절을 남기게 되는 날. 그래도 이 차례로 적는 이유는 전례와 **같은 방향**이기 때문이고
   * (`{...서버, ...로컬}`), 그날 뒤집힌 채로 발견되지 않게 하려는 것이다.
   */
  const cancelReasonFieldError =
    cancelReasonError ??
    (isCancelResultMine ? cancelWrite.fieldErrors[CANCEL_REASON_FIELD] : undefined);

  /**
   * 없음 안내가 매인 대상 — **조건·쪽의 서명**이다.
   *
   * 안내를 끄는 자리를 클릭 핸들러에 두면 뒤로가기·주소 직접 편집이 그 길을 지나지 않아 문장이
   * 남는다. 서명에 매어 두면 조회 조건이 바뀌는 순간 저절로 걷힌다 — 그 안내가 가리키던 목록이
   * 더는 화면에 없기 때문이다.
   */
  const listContextKey = toSearchParams(filters, page).toString();
  const [missingContextKey, setMissingContextKey] = useState<string | null>(null);

  const isDetailNotFound = detail.isError && isDocumentProgressNotFound(detail.error);

  /*
   * 404면 주소에 남은 선택을 정리하고 **그 순간의 서명**에 안내를 맨다(수명 표 4행).
   *
   * **히스토리를 늘리지 않는다**(`replace`) — 늘리면 뒤로가기가 없는 문서로 되돌아가고, 그
   * 자리에서 다시 404가 나 같은 정리가 되풀이되어 사용자가 갇힌다(사본 체크리스트 1번).
   *
   * **정리를 클릭 핸들러가 아니라 조회 결과에 묶는다.** 뒤로가기·주소 직접 편집은 핸들러를
   * 거치지 않고 주소만 바꾸므로, 핸들러에 두면 그 경로가 통째로 샌다.
   */
  useEffect(() => {
    if (!isDetailNotFound) return;

    setMissingContextKey(listContextKey);
    setSearchParams((prev) => withoutSelection(prev), { replace: true });
  }, [isDetailNotFound, listContextKey, setSearchParams]);

  /**
   * 방금 정리한 그 목록을 아직 보고 있는가. 조건이 바뀌면 안내가 가리킬 것이 없다.
   *
   * `missingContextKey !== null`을 먼저 본다 — 지금은 `listContextKey`가 늘 문자열이라 뒤 견줌만으로
   * 같은 답이 나오지만(등가), 서명을 만드는 자리가 바뀌어 빈 값이 될 수 있는 날 **안내가 세워진
   * 적도 없는데 서는** 상태를 이 한 줄이 막는다(전례 `putaway-rule/screen.tsx`의 같은 가드).
   */
  const isDetailMissing =
    readSelectedDocumentId(searchParams) === null &&
    missingContextKey !== null &&
    missingContextKey === listContextKey;

  /**
   * ⭐ **주소를 갈아 끼우는 유일한 자리. 없음 안내를 여기서 함께 거둔다.**
   *
   * 조회·초기화·쪽 이동·**고르기·해제**가 모두 이 길을 지나므로 조작마다 따로 지울 자리가 없다
   * (전례 `putaway-rule/screen.tsx`의 `applySearchParams`가 지고 있던 둘째 책임이다).
   *
   * 거두지 않으면 이런 일이 난다 — 404로 안내가 선 뒤 **같은 조건 안에서** 다른 문서를 골랐다
   * 해제하면 서명이 그대로라 안내가 **되살아난다.** 사용자가 스스로 닫은 것을 화면이 「찾을 수
   * 없다」고 말하는 상태이며, 방금 한 조작과 무관한 사정을 화면이 계속 말하는 것이다.
   *
   * ⚠ **404 정리(effect)는 이 길을 지나지 않는다** — 그쪽은 안내를 **세우는** 자리이고
   * 히스토리도 늘리지 않아야 해서 `setSearchParams`를 직접 부른다.
   *
   * ⭐ **취소 요청이 나가는 중에는 주소를 갈아 끼우지 않는다**(완료 조건 C3-13의 잠금 축).
   * 조회·초기화·쪽 이동·고르기·해제가 전부 이 문을 지나므로 잠글 자리가 하나로 남는다.
   *
   * ⚠ **이 잠금이 실제로 일하는 순간은 창이 닫힌 뒤다.** 창이 열려 있는 동안에는 모달이 화면 안
   * 조작을 이미 막지만, **Escape로 창이 닫히면**(막을 수 없는 길) 요청은 나가는 중인 채 목록이
   * 다시 눌리게 된다 — 그때 대상이 바뀌면 앞 요청의 결과가 지금 보는 맥락에 나타난다.
   *
   * ⛔ **바깥 주소 이동(뒤로가기·주소 직접 편집)은 이 문을 지나지 않는다.** 막을 수 없는 길이라
   * 막는 대신 다룬다 — 나가는 요청을 끊지 않고, 도착한 결과 중 **대상에 매인 것만** 그린다.
   */
  const applySearchParams = (next: URLSearchParams): void => {
    if (isCancelLocked) return;

    setMissingContextKey(null);
    setSearchParams(next);
  };

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다**(수명 규칙 1행) — 3쪽을 보다가 조건을 좁히면
   * 결과가 3쪽에 못 미쳐 사용자에게는 「조건을 좁혔더니 아무것도 없다」로 보인다.
   */
  const applyQuery = (nextFilters: ProgressFilters, nextPage = 1): void => {
    applySearchParams(toSearchParams(nextFilters, nextPage));
  };

  /**
   * 문서 고르기·해제(수명 표 3행).
   *
   * **보이는 줄을 바꾸지 않는다** — 조건·쪽을 그대로 두고 `sel`만 넣고 뺀다. 고를 때 첫 쪽으로
   * 튀면 사용자가 3쪽에서 고른 문서의 상세를 보는 동안 목록은 1쪽이 된다.
   */
  const toggleSelect = (documentId: number): void => {
    const base = toSearchParams(filters, page);

    applySearchParams(
      documentId === selection?.documentId ? base : withSelection(base, documentId),
    );
  };

  /**
   * 문서·후속 열기. **주소는 표(`SCREEN_ROUTES`)가 정하고 화면은 옮기기만 한다.**
   *
   * 지금은 표가 비어 있어 이 자리가 불리지 않는다 — 그래도 판정과 이동을 갈라 두는 이유는,
   * 표에 줄이 생기는 날 **표 한 곳만 고치면** 열기가 살아나게 하기 위해서다.
   */
  const openScreen = (path: string): void => {
    void navigate(path);
  };

  /**
   * **나가는 중인 쓰기는 건드리지 않는다.**
   *
   * 공통 훅의 `reset()`은 진행 중 mutation에서 **옵저버를 떼어 낸다**. 옵저버가 떨어지면 그
   * 호출에 매달린 되먹임이 통째로 오지 않는다 — 무효화도, 성공도, 실패도. 요청은 이미 서버에
   * 갔는데 화면만 없던 일로 친다(omf-mes#96).
   *
   * **끊는 것과 감추는 것은 다르다.** 도착한 결과를 화면에 낼지는 `isCancelResultMine`이 정하고,
   * 여기서는 **끝난 것만** 거둔다. `reset()`을 부르는 **모든 자리**가 이 함수를 지난다.
   */
  const resetIfIdle = (write: { isSaving: boolean; reset: () => void }): void => {
    if (write.isSaving) return;

    write.reset();
  };

  /**
   * 취소 축에서 편집 중이던 것을 거둔다 — 창 · 사유 초안 · 인라인 오류 · 실패 배너.
   *
   * **초안은 자기 대상보다 오래 살지 않는다.** 남겨 두면 A 문서에 적은 사유가 B 문서의 칸에
   * 그대로 서고, 그 상태로 확인 창을 열면 **다른 문서의 사유로 취소가 올라간다.**
   */
  const resetCancelEditing = (): void => {
    resetIfIdle(cancelWrite);
    setCancelDialog(null);
    setCancelReason('');
    setCancelReasonError(null);
  };

  /*
   * 위 함수는 매 렌더 새로 만들어지므로 그대로 의존성에 넣으면 **렌더마다 초기화가 돈다** —
   * 실패 배너가 서자마자 지워져 사용자가 이유를 볼 수 없고, 치던 사유도 사라진다.
   */
  const resetCancelEditingRef = useRef(resetCancelEditing);
  resetCancelEditingRef.current = resetCancelEditing;

  /*
   * ⭐ **대상이 바뀌면 취소 축을 거둔다.** 고르기·해제뿐 아니라 **뒤로가기·주소 직접 편집**까지
   * 같은 자리에서 다룬다 — 그 길은 클릭 핸들러를 지나지 않으므로 핸들러에 두면 통째로 샌다.
   */
  useEffect(() => {
    resetCancelEditingRef.current();
  }, [cancelTargetKey]);

  /**
   * ⭐ **후속 때문에 막힌 400에서 진행현황을 다시 부른다**(완료 조건 C3-11).
   *
   * 그 400은 **후속이 생겼다는 사실의 통지**다. 다시 부르지 않으면 사용자가 보고 있는 후속 목록은
   * 「0건」인 채로 남아, 화면이 「후속 때문에 막혔다」라고 말하면서 후속을 하나도 보이지 않는다.
   *
   * **되먹임 훅이 실패 콜백을 내주지 않아** effect로 잡는다. 오류 상태의 참조는 새 실패가 설
   * 때만 바뀌므로 이 자리가 되풀이되지 않는다.
   */
  useEffect(() => {
    const error = cancelWrite.error;

    if (error === null || !isSuccessorBlocked(error)) return;

    void queryClient.invalidateQueries({ queryKey: documentProgressKeys.all });
  }, [cancelWrite.error, queryClient]);

  /**
   * 확인 창을 연다 — **사유 검증이 여기서 끝난다**(완료 조건 C3-5).
   *
   * 빈 사유로는 **창조차 열지 않는다.** 창을 열어 두고 확인 버튼에서 막으면 사용자가 두 번
   * 물러나야 하고, 무엇보다 「확인했는데 안 나가는」 자리가 생긴다. 검증 결과(본문)를 창의
   * 상태에 담아 두므로 **확인한 값과 보내는 값이 같은 자리에서 나온다.**
   */
  const openCancelDialog = (documentNo: string): void => {
    if (isCancelLocked) return;

    const body = toCancelRequest(cancelReason);

    if (body === null) {
      setCancelReasonError(t.cancelRequest.reasonRequired);

      return;
    }

    setCancelReasonError(null);
    setCancelDialog({ documentNo, body });
  };

  /**
   * 창을 닫는다 — **Escape도 이 길을 지난다.**
   *
   * 나가는 중인 요청을 끊지 않는다(`resetIfIdle`). 창이 닫혀도 성공하면 안내가 뜨고 캐시가
   * 갱신되며, 실패하면 배너가 **구획으로 옮겨 온다**(자리 배타 — `cancelFailureSlot`).
   */
  const closeCancelDialog = (): void => {
    resetIfIdle(cancelWrite);
    setCancelDialog(null);
  };

  /**
   * 확인한 본문을 보낸다.
   *
   * **보낸 대상을 붙잡는다** — 되먹임은 보낸 값을 들고 오지 않으므로, 결과가 도착했을 때
   * 「그것이 지금 보는 대상의 것인가」를 물을 근거가 이 한 줄이다.
   */
  const submitCancelRequest = (body: ApprovalRequestCreate): void => {
    sentCancelTargetKeyRef.current = cancelTargetKey;
    cancelWrite.write(body);
  };

  /**
   * 취소 요청 실패가 서는 **하나의 자리** — 창이 열려 있으면 창, 닫혀 있으면 구획.
   *
   * **매임을 지난다** — 남의 대상에 보낸 요청의 거절 사유를 지금 대상에 세우지 않는다.
   *
   * ⭐ **후속 갈래만 문면을 갈아 낀다.** 계약이 그 400에 코드를 붙였고 사용자가 할 일이
   * 분명하기 때문이다(후속을 먼저 취소한다). ⛔ 나머지 400은 **서버 문구를 그대로** 낸다 —
   * 계약이 네 사유를 함께 적었는데 코드가 붙은 것은 하나뿐이라, 화면이 가르면 원인을 지어내게
   * 된다(완료 조건 C3-12).
   */
  const cancelFailureSlot = (): ReactNode => {
    const error = isCancelResultMine ? cancelWrite.error : null;

    if (error === null) return null;

    if (isSuccessorBlocked(error)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.cancelRequest.successorBlocked}</AlertBanner>
        </div>
      );
    }

    /*
     * 409는 재조회로 풀린다 — 이 쓰기에서 낡을 수 있는 것은 **잠금 토큰**이므로 리소스 상세를
     * 다시 부른다(진행현황이 아니다).
     */
    return (
      <SaveErrorBanner
        error={error}
        onReload={() => {
          void cancelLockQuery.refetch();
        }}
      />
    );
  };

  /** 잠금 토큰이 어디까지 왔는가 — **실패를 로딩보다 앞에서 판정한다**(사본 대조 추가 ①). */
  const cancelLock = ((): CancelLock => {
    if (cancelLockQuery.isError) return { kind: 'failed', error: cancelLockQuery.error };

    return cancelLockQuery.data === undefined ? { kind: 'preparing' } : { kind: 'ready' };
  })();

  /**
   * 아래 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다.
   *
   * ⭐ **실패를 로딩보다 앞에서 판정한다**(사본 대조 추가 ①). 먼저 로딩을 보면 실패한 조회가
   * 영원히 「불러오는 중」으로 보이고, 사용자는 기다리면 될 일이라고 읽는다. 404가 그보다도
   * 앞인 이유는 **할 일이 다르기 때문**이다 — 다시 시도가 아니라 다시 조회하고 다시 고르는 것이다.
   *
   * ⭐ **상세가 실패해도 위 목록은 그대로 둔다.** 배너를 이 구획 안에만 내는 것이 그 규칙을
   * 코드로 지키는 형태다 — 화면 전체를 덮으면 사용자가 목록까지 못 쓰게 되는데, 실패한 것은
   * 고른 문서 한 벌뿐이다.
   */
  const detailSlot = (): ReactNode => {
    if (isDetailNotFound || isDetailMissing) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.detailNotFoundTitle}
          description={t.empty.detailNotFoundDescription}
        />
      );
    }

    if (selection === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    if (detail.isError) {
      return <LoadErrorBanner error={detail.error} onRetry={() => void detail.refetch()} />;
    }

    if (detail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.detail}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    const { progress } = detail.data;

    return (
      <>
        <DetailPane detail={detail.data} routes={SCREEN_ROUTES} onOpen={openScreen} />

        {/*
         * ⭐ **취소 축이 상세 구획 안에 선다.** 후속 목록 바로 아래에 두는 이유는, 취소할 수
         * 있는가를 가르는 것이 그 목록이기 때문이다 — 읽고 나서 결정하는 차례가 화면의 차례다.
         *
         * ⭐ **판정 근거가 목록 열과 같은 자리에서 나온다**(`readCancelAvailability`) — 갈리면
         * 목록에서는 「취소 요청 가능」인데 아래에서는 잠긴 화면이 된다.
         */}
        <CancelPane
          hasCancelResource={cancelResource !== null}
          availability={readCancelAvailability(progress)}
          lock={cancelLock}
          reason={cancelReason}
          reasonError={cancelReasonFieldError}
          isSaving={isCancelSavingMine}
          isLocked={isCancelLocked}
          /* 창이 열려 있으면 실패는 창이 갖는다 — 두 자리에 같은 배너를 세우지 않는다. */
          banner={cancelDialog === null ? cancelFailureSlot() : null}
          onChangeReason={(value) => {
            setCancelReason(value);
            setCancelReasonError(null);
          }}
          onOpenConfirm={() => {
            openCancelDialog(progress.documentNo);
          }}
          onRetryLock={() => {
            void cancelLockQuery.refetch();
          }}
        />
      </>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      {list.isError && <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />}

      {/*
       * ⭐ **잠긴 이유를 상시 밝힌다 — 자리가 상세 구획 밖이다**(전례 `putaway-rule/screen.tsx`의
       * `savingLock`과 같은 자리).
       *
       * 잠금 문(`applySearchParams`)이 조회·초기화·쪽 이동·고르기·해제를 막는데, 그중 **조건 줄과
       * 쪽 이동은 컨트롤 자체가 잠기지 않는다** — 눌러도 아무 일이 없는 버튼이 생기고, 이 줄이
       * 없으면 그 이유가 화면 어디에도 없다. 이 슬라이스가 다른 자리에서 스스로 경고한
       * 「증상이 **눌러도 아무 일이 없다**라 알아채기 어렵다」와 같은 형태다.
       *
       * ⛔ **취소 구획 안에 두지 않는다.** 구획은 대상이 풀리면 사라지는데(나가는 중 바깥 주소
       * 이동으로 `sel`이 빠지는 갈래) 잠금은 요청이 끝날 때까지 남는다 — 그 갈래에서 잠긴 이유가
       * 통째로 사라진다. 진행 표시조차 대상 매임으로 걸러지므로 남는 단서가 하나도 없다.
       *
       * ⛔ **배너가 아니다.** 실패가 아니라 잠깐 지나가는 사실이라 `AlertBanner`를 쓰면 취소 축의
       * 실패 배너와 같은 무게로 읽힌다.
       */}
      {isCancelLocked && <p className="field-note">{t.notes.cancelLock}</p>}

      <section className="pane" aria-label={t.title}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <ProgressFilterBar
          appliedFilters={filters}
          documentTypeOptions={documentTypeOptions}
          disabledTypeNote={
            disabledReasons === undefined ? undefined : t.filters.disabledTypes(disabledReasons)
          }
          statusOptions={statusOptions}
          onSearch={(nextFilters) => {
            applyQuery(nextFilters);
          }}
          onReset={() => {
            applyQuery(DEFAULT_PROGRESS_FILTERS);
          }}
        />

        {/*
         * 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 사용자가
         * 자료가 없는 줄 알고 조건을 넓힌다.
         */}
        {!list.isError && (
          <>
            <ProgressTable
              rows={rows}
              isLoading={listQuery !== null && list.isPending}
              isTypeListPending={isDocumentTypeListPending(documentTypes)}
              hasDocumentType={listQuery !== null}
              isBeyondLast={pageView.isBeyondLast}
              onFirstPage={() => {
                applyQuery(filters);
              }}
              selectedDocumentId={selection?.documentId ?? null}
              isLocked={isCancelLocked}
              onToggleSelect={toggleSelect}
            />
            {listQuery !== null && !list.isPending && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>

      {/*
       * **아래 구획은 조회가 성립할 때만 낸다.** 유형 표가 비어 있거나 유형을 고르지 않았으면
       * 고를 대상 자체가 없어, 구획을 두면 「고르세요」가 할 수 없는 일을 시키는 안내가 된다.
       *
       * ⭐ **목록이 실패해도 낸다.** 이 구획은 목록 응답을 쓰지 않고 주소가 가리키는 문서를
       * 그린다 — 한쪽이 실패했다고 다른 쪽을 감추면 사용자가 쓸 수 있는 것까지 잃는다.
       */}
      {listQuery !== null && (
        <section className="pane" aria-label={t.panes.detail}>
          {detailSlot()}
        </section>
      )}

      {/*
       * ⭐ **창의 상태가 곧 확인된 요청이다.** 열려 있다는 것은 사유 검증을 통과했다는 뜻이고,
       * 그때 확인 버튼이 보내는 것은 **창을 열 때 만든 바로 그 본문**이다 — 타입이 「보낼 수
       * 없는데 창이 열려 있는」 갈래를 막는다.
       */}
      {cancelDialog !== null && (
        <RequestCancelDialog
          documentNo={cancelDialog.documentNo}
          isSaving={isCancelSavingMine}
          banner={cancelFailureSlot()}
          onClose={closeCancelDialog}
          onConfirm={() => {
            submitCancelRequest(cancelDialog.body);
          }}
        />
      )}
    </>
  );
};
