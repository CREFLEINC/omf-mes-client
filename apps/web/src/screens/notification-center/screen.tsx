import { Breadcrumb, Button, EmptyState, PageHeader, SkeletonText, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { formatAsOf } from './as-of';
import { NotificationFilterBar } from './filter-bar';
import {
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  withPeriod,
  type NotificationFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { describeEvent, useNotificationEventOptions, withCurrentEvent } from './lookups';
import { NotificationRow } from './notification-row';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import {
  defaultPeriod,
  hasPeriodKeys,
  readPeriod,
  resolvePeriod,
  type NotificationPeriod,
} from './period';
import { useMarkAllRead, useMarkRead, useNotificationList, useUnreadCount } from './queries';
import { EMPTY_READ_STATE, isRead, withRead, type ReadState } from './read-state';
import type { NotificationView, SelectOption } from './types';
import { WriteErrorBanner, writeFailureTitle } from './write-error-banner';

const t = messages.notificationCenter;

/**
 * 응답이 아직 없을 때 쓰는 자리표시 둘.
 *
 * **자리표시 값을 한 곳에 모으는 것이 근거다.** 렌더 안에 인라인으로 두면 「받은 것이 없을 때
 * 무엇으로 보는가」가 두 자리로 흩어지고, 한쪽만 고쳐지면 목록은 비었다고 보는데 쪽 계산은
 * 다른 기본을 쓰는 어긋남이 생긴다.
 *
 * ⚠ **참조 안정성이 근거가 아니다.** 이 회차의 소비처는 `rows.length`·`rows.map(...)`과
 * `toPageView(meta, shown)`인데 **셋 다 값만 읽고 참조 동일성을 보지 않는다** — 메모된 계산도
 * `memo` 부품도 이 값들을 받지 않는다. 그 근거가 참이 되는 시점이 오면 그때 적는다.
 */
const EMPTY_ROWS: NotificationView[] = [];

/** 쪽 메타가 아직 없을 때의 자리. 서버가 준 값이 오면 그것이 정본이다. */
const EMPTY_PAGE = { page: 1, size: 0, total: 0 };

/**
 * 「모두 읽음」이 잠긴 사유. `undefined`면 열려 있다.
 *
 * ⭐ **순서가 뜻을 정한다 — 나가는 중이 안 읽은 수보다 앞선다.** 보낸 직후에는 아직 그 수가
 * 갱신되지 않아 둘이 함께 참일 수 있는데, 그때 사용자에게 참인 것은 「기다리는 중」이다.
 * 「안 읽은 알림이 없습니다」라고 말하면 방금 누른 조작이 **이미 끝난 것처럼** 읽힌다.
 *
 * ⚠ **아직 그 수를 받지 못했으면 잠근 채로 둔다** — 안 읽은 것이 있는지 모르는데 여는 것은
 * 없는 근거로 조작을 허락하는 일이다.
 *
 * ⭐ **내보내는 이유는 단위 시험이 이 순서를 직접 재기 위해서다.** 두 조건이 함께 참이 되는
 * 자리(쓰기가 나가는 중에 안 읽은 수 재조회가 0을 돌려주는 순간)는 화면 조작으로 도달하기가
 * 매우 좁아 화면 시험으로는 규격을 고정할 수 없다. 다른 부품이 소비하지 않는다.
 */
export const describeMarkAllReadReason = (
  isSubmitting: boolean,
  unreadCount: number | undefined,
): string | undefined => {
  if (isSubmitting) return t.actionReasons.markingAllRead;
  if (unreadCount === undefined || unreadCount <= 0) return t.actionReasons.nothingUnread;

  return undefined;
};

/**
 * W-CO-03 알림센터 — 사용자가 **자기가 받은 알림을 기간·상태·유형으로 찾아 보는** 자리.
 *
 * ⭐ **이 화면이 다른 조회 화면과 가장 크게 갈리는 자리는 기간이다.** 계약이 기간을 필수로
 * 두어(공유계약 L-3) 「조건 없이 일단 조회한다」가 성립하지 않는다. 그래서 저장소의 조회형
 * 골격이 규율로 세운 **「기본 기간을 심지 않는다」가 여기서는 거짓**이고, 심지 않으면 첫
 * 진입이 곧 400이다. 무엇을 왜 뒤집었는지는 `period.ts` 머리의 표에 있다.
 *
 * **주소 키의 수명 — 무엇이 바뀔 때 무엇이 달라지는가.**
 *
 * | # | 조작·상태 | `from`·`to` | `unread`·`ev` | `page` | 왜 |
 * | :-: | --- | --- | --- | --- | --- |
 * | 1 | 첫 진입 — **기간 키가 없다** | **기본 7일을 심는다** | 건드리지 않는다 | 건드리지 않는다 | 사용자가 기간에 대해 아직 아무 말도 하지 않았다 |
 * | 2 | **기간 키는 있고 값이 비었다**(`?from=&to=`) | **그대로 둔다** | 그대로 | 그대로 | 비운 것이 사용자의 뜻이다. 덮으면 기간을 비울 수단이 사라진다 |
 * | 3 | 손으로 고친 **깨진 기간** | **그대로 둔다** | 그대로 | 그대로 | 조용히 덮으면 무엇이 왜 달라졌는지 화면 어디에도 없다 |
 * | 4 | 조건 변경(기간 · 안 읽음만 · 유형) | 고른 값 | 고른 값 | **첫 쪽으로** | 결과가 통째로 달라진다. 3쪽을 보다가 조건을 좁히면 결과가 3쪽에 못 미쳐 「좁혔더니 아무것도 없다」로 보인다 |
 * | 5 | 쪽 이동 | 그대로 | 그대로 | 옮긴 쪽 | 조건은 그대로다 |
 * | 6 | 이 쪽에 결과가 없어 **「첫 쪽으로」** | 그대로 | 그대로 | **첫 쪽으로** | 조건은 그대로다 — 사용자가 할 일은 조건을 넓히는 것이 아니라 앞쪽으로 가는 것이다 |
 *
 * ⭐ **1행과 2행을 가르는 것이 `hasPeriodKeys`다.** 값만 보면 둘이 같은 빈 문자열이라 구분되지
 * 않는다 — 전례 둘(`master-change/screen.tsx`·`integration-sync/screen.tsx`)이 같은 자리를
 * `searchParams.has()`로 갈라 두었다. 2·3행은 조회하지 않고 사유를 보이며, 사유는 **갈래마다
 * 다르다**(비었다 ↔ 날짜가 아니다 ↔ 뒤집혔다 — 공유계약 G-9).
 *
 * **쪽을 첫 쪽으로 되돌리는 자리는 둘이다**(4행·6행) — 둘 다 `applyQuery`의 **기본 인자**를
 * 쓰는 호출이고, 갈리는 것은 조건을 함께 바꾸느냐뿐이다. 일곱째가 생기면 이 표에 행을 먼저 더한다.
 *
 * ⛔ **자동 갱신을 두지 않는다**(공유계약 L-6). ⚠ L-6의 각주는 **이 화면을 실시간 예외로
 * 지목**하지만, 나중 판(화면 스펙 §8-4와 계약)이 「화면은 자동 갱신 없음 · 셸 배지만 화면 전환
 * 시 갱신」으로 정리했고 그쪽을 따랐다. 두 문서의 어긋남 자체는 질문 `omf-mes#164`로 추적 중이다.
 * 상단 바의 종 배지는 셸의 책임이라 이 화면이 만들지 않는다.
 */
export const NotificationCenterScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가
   * 달라, 이 값을 prop으로 받는 조건 줄이 부모가 다시 그려질 때마다 새 값을 받은 것으로 본다
   * (조회 응답이 도착하는 순간이 실제로 그 자리다 — 전례 `inbound-schedule` #43).
   */
  const period = useMemo<NotificationPeriod>(() => readPeriod(searchParams), [searchParams]);
  const filters = useMemo<NotificationFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  /*
   * ⭐ **「키가 없다」와 「키는 있고 값이 비었다」를 가른다**(주소 키 수명 표 1·2행).
   * 값만 보면 둘이 같은 빈 문자열이라, 이 한 줄이 없으면 사용자가 비운 기간을 화면이 덮어쓴다.
   */
  const hasKeys = hasPeriodKeys(searchParams);

  /*
   * 실행 환경의 「지금」을 한 번만 읽어 넘긴다. 판정 함수 안에서 읽으면 그 함수가 환경에 따라
   * 다른 값을 내어 테스트가 코드가 아니라 환경을 검사하게 된다.
   */
  const periodState = resolvePeriod(period, hasKeys, new Date());
  const isSeeding = periodState.kind === 'empty';

  /*
   * 빈 화면으로 시작하지 않는다 — 기간이 필수라 심지 않으면 아무것도 조회할 수 없다.
   *
   * ⭐ **`replace`로 바꾼다.** 밀어 넣으면 기본값을 채운 것이 뒤로가기 기록에 칸을 쌓고,
   * 사용자가 뒤로 누르면 기간 없는 주소로 돌아가 **같은 채우기가 다시 돌아 그 자리에 갇힌다.**
   *
   * ⭐ **기존 주소를 통째로 갈아 끼우지 않는다**(`withPeriod`) — 기간을 채우는 김에 사용자가
   * 걸어 둔 다른 조건이 함께 사라지면 안 된다.
   *
   * ⚠ **여기서 시계를 다시 읽는다**(위 `resolvePeriod`의 것과 다른 `new Date()`다). effect는
   * 렌더보다 늦게 도므로 그 사이에 날이 바뀌었다면 **심는 시점의 오늘**이 맞다 — 렌더 때 읽은
   * 값을 나르면 자정 직후에 하루 지난 기간을 심는다.
   */
  useEffect(() => {
    if (!isSeeding) return;

    const seeded = defaultPeriod(new Date());

    setSearchParams((prev) => withPeriod(prev, seeded), { replace: true });
  }, [isSeeding, setSearchParams]);

  const listQuery =
    periodState.kind === 'ready'
      ? { ...periodState.query, ...toFilterQuery(filters), ...(page > 1 ? { page } : {}) }
      : null;

  const list = useNotificationList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? EMPTY_PAGE, rows.length);

  /*
   * 유형 목록 — **조건 줄의 선택지와 카드 제목의 이름 풀이가 같은 조회를 쓴다.**
   * 좁힘 인자가 없는 경로라(실측) 한 조회로 둘 다 쓰는 것이 위험을 만들지 않는다.
   */
  const events = useNotificationEventOptions();

  /**
   * 「이 회차에 읽음 처리한 번호」 — **목록을 다시 부르지 않고 표시만 바꾸는 수단**이다
   * (결정 ⑤ · `read-state.ts`).
   *
   * ⭐ **조건·쪽·기간이 바뀌면 비운다.** 새 결과에는 서버 값이 실려 오므로 그것이 정본이고,
   * 남겨 두면 **다른 조회의 결과에 앞 조회의 판정이 얹힌다** — 같은 번호가 재사용되는 자리는
   * 아니지만, 규칙을 「집합은 이 조회의 것」으로 못 박아 두어야 다음 회차가 흔들지 않는다.
   */
  const [readState, setReadState] = useState<ReadState>(EMPTY_READ_STATE);

  const listKey = JSON.stringify(listQuery);

  const unreadCount = useUnreadCount();

  const markRead = useMarkRead({
    /*
     * ⭐ **성공 되먹임이 캐시를 건드리지 않는다.** 집합에 번호를 더할 뿐이라 목록 조회는
     * 그대로 살아 있고, 그래서 **방금 누른 카드가 사라지지 않는다.**
     */
    onSuccess: (notificationId) => {
      setReadState((current) => withRead(current, notificationId));
    },
  });

  const toast = useToast();
  const markAllReasonId = useId();

  const markAllRead = useMarkAllRead({
    /*
     * ⚠ **여기서는 반대다 — 훅이 목록과 안 읽은 수를 무효화한다.** 사용자가 「전부 읽음으로
     * 바꾼다」를 명시적으로 눌렀으므로 안 읽음 목록이 비는 것이 그 조작의 결과 그대로다.
     */
    onSuccess: (readCount) => {
      toast.show({ variant: 'success', description: t.toast.allRead(readCount) });
    },
  });

  /**
   * 조회 조건이 바뀌면 **앞 조회에 매인 것을 거둔다** — 읽음 집합과 쓰기 실패 진술 둘 다.
   *
   * ⭐ **집합**: 새 결과에는 서버 값이 실려 오므로 그것이 정본이다. 남겨 두면 다른 조회의
   * 결과에 앞 조회의 판정이 얹힌다(T3-4).
   *
   * ⭐ **실패 진술**: 「읽음으로 바꾸지 못했습니다」는 **그 목록의 그 알림**에 대한 말이다.
   * 조건이 바뀌어 그 알림이 화면에 없는데 배너만 남으면, 사용자는 지금 보이는 것들이 실패한
   * 줄로 읽는다.
   *
   * ⭐ **거두는 자리를 조회 키 하나에 매단다.** 클릭 핸들러에 두면 뒤로가기·앞으로가기·주소
   * 직접 편집이 그 자리를 지나지 않아 통째로 샌다(전례 `inbound-schedule`의 정리 effect와 같은
   * 판단). ⚠ **거둠은 `resetIfIdle`을 지난다** — 나가는 중인 쓰기의 되먹임을 끊으면 서버는
   * 바꿨는데 화면은 없던 일로 친다(사본 체크리스트 · `omf-mes#96`).
   *
   * ⚠ **예외 하나 — 거둔 *뒤에* 도착한 실패는 남는다.** 조건을 바꾸는 순간 나가는 중이던
   * 쓰기가 **그 뒤에** 실패하면, 거둠은 이미 지나갔고 실패는 `.catch`가 **새로** 기록한다.
   * 그래서 앞 목록의 알림에 대한 배너가 새 목록 위에 설 수 있다.
   *
   * **지금은 그대로 둔다**(결정). 고칠 자리는 거둠도 `resetIfIdle`도 아니다 — 검증이 가드를
   * 지운 판에서 같은 시나리오를 재서 **결과가 같음을 확정했다.** 바꾸려면 **실패가 도착한 시점에
   * 그것이 아직 유효한 조회의 것인지 판정하는 자리**(도착 시점의 조회 키 대조)가 새로 필요하고,
   * 그것은 이 회차의 범위를 넘는 설계다. 도달이 좁고 배너 문구가 특정 알림을 지명하지 않아
   * 거짓말이 되지도 않는다. **감지기로 굳히지 않는다** — 열린 물음으로 두어야 다음 회차가
   * 이 결정을 다시 볼 수 있다.
   *
   * ⭐ **이미 서 있던 실패는 예외가 아니다** — 다른 카드의 쓰기가 나가는 중이어도 거둔다.
   * 거둠은 `setFailure(null)`을 가드 **앞**에서 하고, 규율(`omf-mes#96`)에 매인 것은 `reset()`
   * 하나뿐이다(`queries.ts`). 그 자리를 재는 감지기가 있다.
   */
  const { resetIfIdle: resetMarkRead } = markRead;
  const { resetIfIdle: resetMarkAllRead } = markAllRead;

  useEffect(() => {
    setReadState(EMPTY_READ_STATE);
    resetMarkRead();
    resetMarkAllRead();
  }, [listKey, resetMarkRead, resetMarkAllRead]);

  /*
   * 기준 시각은 **응답이 도착한 시각**이다(`dataUpdatedAt`) — 렌더 시각이 아니다.
   * 아직 받은 자료가 없으면 그 값이 `0`이고, 그때는 표기 자체를 내지 않는다(공유계약 L-5).
   */
  const asOf = formatAsOf(list.data === undefined ? null : list.dataUpdatedAt);

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다**(수명 규칙 4행) — 기본 인자가 그 규칙이다.
   * 쪽 이동만 그 값을 명시해 넘긴다(5행).
   */
  const applyQuery = (
    nextPeriod: NotificationPeriod,
    nextFilters: NotificationFilters,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextPage));
  };

  const markAllReadReason = describeMarkAllReadReason(markAllRead.isSubmitting, unreadCount.data);

  /**
   * 유형 선택지 — 「전체」가 맨 앞이고, 그 뒤가 조회로 받은 목록이다.
   *
   * **「전체」를 값이 빈 선택지로 둔다.** 두지 않으면 한 번 고른 뒤에 조건을 해제할 방법이
   * 선택칸 안에 없어진다.
   *
   * **주소로 들어온 값이 목록에 없으면 맨 앞에 남긴다**(`withCurrentEvent`) — 남기지 않으면
   * 그 조건을 푸는 수단이 사라진다. 목록 조회가 실패한 동안에도 같은 일이 일어난다.
   */
  const eventOptions: SelectOption[] = [
    { value: '', label: t.filters.all },
    ...withCurrentEvent(events.entries, filters.eventCode).map((entry) => ({
      value: entry.value,
      label: entry.label,
    })),
  ];

  /** 목록 구획. 다섯 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. */
  const listPane = (): ReactNode => {
    if (periodState.kind === 'blocked') {
      return (
        <EmptyState
          size="sm"
          /*
           * ⭐ **`live`를 둔다.** 조건 줄이 생겨 화면 안에서 기간이 바뀌므로 이 안내는 이제
           * **동적으로 나타난다** — 보조 기술에 알려지지 않으면 조회가 멈춘 것을 알 수 없다.
           */
          live
          title={t.empty.blockedTitle}
          description={periodState.reason}
        />
      );
    }

    /* 기간을 심는 동안에도 조회를 기다리는 것과 같은 모양이다 — 한 순간 뒤 요청이 나간다. */
    if (isSeeding || list.isPending) {
      return (
        <div role="status" aria-label={t.loading.list}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    /*
     * ⭐ **결과가 있는데 이 쪽에 없는 것은 0건과 다르다.** 같은 문구로 두면 사용자가 조건을
     * 헛되이 넓힌다 — 넓혀도 그 쪽에는 여전히 아무것도 없다. 할 일은 첫 쪽으로 가는 것이다.
     */
    if (pageView.isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button
              variant="outlined"
              size="sm"
              onClick={() => {
                applyQuery(period, filters);
              }}
            >
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.noneTitle}
          description={t.empty.noneDescription}
        />
      );
    }

    /*
     * **카드의 key는 알림 번호다.** 인덱스로 두면 앞 카드가 목록에서 빠질 때 뒤 카드가 앞
     * 카드의 DOM 자리로 옮겨 붙어, 그 자리에 있던 포커스와 상태가 다른 알림의 것이 된다.
     * 뒤따르는 회차의 「모두 읽음」이 정확히 그 경로를 만든다.
     */
    return (
      <ul className="notification-list">
        {rows.map((view) => (
          <li key={view.notificationId}>
            <NotificationRow
              view={view}
              title={describeEvent(view.eventCode, events.entries)}
              isRead={isRead(view, readState)}
              isPending={markRead.pendingIds.has(view.notificationId) || markAllRead.isSubmitting}
              onRead={markRead.markRead}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        /*
         * 기준 시각을 제목 줄에 둔다. **live 영역으로 두지 않는다** — 조건을 바꿀 때마다
         * 낭독되는데, 조회가 끝났다는 사실은 목록·빈 상태가 이미 알린다.
         */
        actions={
          <div className="field-cell">
            <div className="filter-actions">
              {asOf !== null && <span className="field-note">{t.asOf(asOf)}</span>}
              {/*
               * ⭐ **활성 판정이 전용 조회에서 온다**(`useUnreadCount`) — 지금 쪽의 안 읽음으로
               * 재면 다른 쪽에 안 읽음이 있어도 잠긴다. 「모두」라는 말과 어긋나는 틀린 판정이다.
               *
               * 아직 그 수를 받지 못했으면 **잠근 채로 둔다** — 안 읽은 것이 있는지 모르는데
               * 여는 것은 없는 근거로 조작을 허락하는 일이다.
               *
               * 비활성 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로
               * 잇는다 — 비활성 컨트롤은 포커스를 받지 못해 시각으로만 두면 보조기술이 닿지 않는다.
               */}
              <Button
                variant="outlined"
                size="sm"
                disabled={markAllReadReason !== undefined}
                aria-describedby={markAllReadReason === undefined ? undefined : markAllReasonId}
                onClick={markAllRead.markAllRead}
              >
                {t.actions.markAllRead}
              </Button>
            </div>
            {markAllReadReason !== undefined && (
              <span id={markAllReasonId} className="field-note">
                {markAllReadReason}
              </span>
            )}
          </div>
        }
      />

      {/*
       * 쓰기 실패는 **화면 수준 배너**로 낸다(공유계약 G-1). 카드마다 붙이면 목록이 오류로
       * 뒤덮이고, 어느 조작이 막혔는지는 제목이 가른다.
       */}
      {/* 제목이 **무엇이 실패했는지와 어느 쓰기인지** 두 축으로 정해진다(`writeFailureTitle`). */}
      {markRead.failure !== null && (
        <WriteErrorBanner
          error={markRead.failure.error}
          title={writeFailureTitle(markRead.failure.kind, 'read')}
        />
      )}
      {markAllRead.failure !== null && (
        <WriteErrorBanner
          error={markAllRead.failure.error}
          title={writeFailureTitle(markAllRead.failure.kind, 'allRead')}
        />
      )}

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 알림이 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <section className="pane" aria-label={t.panes.list}>
        {/*
         * ⭐ **결과가 없어도, 조회에 실패해도 조건 줄은 감추지 않는다** — 조건을 고칠 수단이
         * 사라지면 사용자가 실패에서 빠져나올 길이 없다. T1은 조건 줄이 없어 실패 시 구획
         * 자체를 그리지 않았는데, 이 회차부터는 전례(`master-change`·`inbound-schedule`)의
         * 형태로 돌아간다.
         */}
        <NotificationFilterBar
          period={period}
          filters={filters}
          eventOptions={eventOptions}
          eventNote={events.isError ? t.filters.eventsFailed : undefined}
          onChangePeriod={(nextPeriod) => {
            applyQuery(nextPeriod, filters);
          }}
          onChangeFilters={(nextFilters) => {
            applyQuery(period, nextFilters);
          }}
        />

        {/* 실패했으면 목록도 빈 상태도 내지 않는다 — 위 배너가 그 자리를 맡는다. */}
        {!list.isError && (
          <>
            {listPane()}
            {listQuery !== null && !list.isPending && !pageView.isBeyondLast && (
              <PageNav
                view={pageView}
                onChange={(nextPage) => {
                  applyQuery(period, filters, nextPage);
                }}
              />
            )}
          </>
        )}
      </section>
    </>
  );
};
