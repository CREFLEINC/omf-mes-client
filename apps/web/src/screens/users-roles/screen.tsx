import { AlertBanner, Breadcrumb, EmptyState, PageHeader, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { lookupLabel, selectableOptions } from './code-options';
import { readPage, readSelectedId, readUserFilters, toUserSearchParams } from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { useDepartmentOptions, type LookupResult } from './lookups';
import { toPageView } from './pagination';
import { USERS_ROLES_TABS, resolveTab, tabSearchParams } from './tabs';
import { UserListPane } from './user-list-pane';
import { useUserList } from './user-queries';
import type { UserFilters } from './types';

const t = messages.usersRoles;

/**
 * W-CO-02 컨테이너.
 *
 * 조회 조건과 선택은 **주소가 소유한다**(`?tab=&q=&dept=&inactive=1&page=&usr=&new=`) —
 * 새로고침·뒤로가기·공유가 같은 화면을 낸다.
 *
 * **탭은 만든 것만 렌더한다**(`tabs.ts`). 역할·권한 탭은 그 탭의 목록·폼이 생길 때 붙는다 —
 * 자리만 먼저 두면 「탭은 있는데 눌러도 빈 화면인」 상태가 된다.
 *
 * **이 화면은 권한 판정을 하지 않는다.** 누가 무엇을 할 수 있는지는 서버가 정하고,
 * 화면은 그 거부를 사용자에게 옮기는 데까지다(계획 결정 4).
 */
export const UsersRolesScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = resolveTab(searchParams.get('tab'));
  const isUsersTab = tab.id === 'users';

  const filters = useMemo<UserFilters>(() => readUserFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  const isCreatingUser = isUsersTab && searchParams.get('new') === 'user';
  const selectedParam = isUsersTab ? readSelectedId(searchParams, 'usr') : null;
  /** 등록 폼이 열려 있는 동안에는 상세를 조회하지 않는다 — 만들고 있는 자원에는 상세가 없다. */
  const selectedAppUserId = isCreatingUser ? null : selectedParam;

  const userList = useUserList(filters, page, isUsersTab);
  const users = userList.data?.items ?? [];

  /*
   * 서버가 준 쪽 정보를 정본으로 쓴다. 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
   * 표시와 내용이 어긋난다. 아직 받지 못했으면 건수를 지어내지 않고 0으로 둔다.
   */
  const userPageView = toPageView(userList.data?.page ?? { page, size: 0, total: 0 }, users.length);

  const departmentOptions = useDepartmentOptions(isUsersTab);

  /**
   * 선택 목록이 잘리거나 실패했다는 사실을 목록 위에 낸다.
   * 알리지 않으면 이름이 이유 없이 비어 보이고 사용자는 값이 사라진 줄 안다.
   */
  const renderOptionsNotice = (lookups: LookupResult[]): ReactNode => {
    if (lookups.some((lookup) => lookup.isError)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsLoadFailed}</AlertBanner>
        </div>
      );
    }

    if (lookups.some((lookup) => lookup.truncated)) {
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.optionsTruncated}</AlertBanner>
        </div>
      );
    }

    return null;
  };

  /**
   * 주소의 일부만 고친다.
   *
   * **한 조작은 이 함수를 한 번만 부른다.** 한 틱에 두 번 부르면 앞 갱신이 렌더되지 않은 채
   * 히스토리 칸으로 남아, 뒤로가기가 사용자가 본 적 없는 중간 상태로 떨어진다.
   *
   * **주소가 달라지지 않으면 갱신하지 않는다.** 같은 값을 다시 쓰는 갱신은 화면을 바꾸지 않으면서
   * 히스토리 칸만 늘린다.
   */
  const patchSearchParams = (patch: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    patch(next);

    if (next.toString() === searchParams.toString()) return;

    setSearchParams(next);
  };

  /**
   * 조건·쪽이 바뀌면 **주소를 통째로 새로 만든다.**
   * 그래야 `usr`·`new`가 자연히 사라진다 — 보이는 행이 달라지는데 선택이 남으면
   * 우 칸의 폼이 어디서 온 것인지 알 수 없다.
   */
  const applyFilters = (next: UserFilters) => {
    setSearchParams(toUserSearchParams(tab.id, next, 1));
  };

  const changeUserPage = (nextPage: number) => {
    setSearchParams(toUserSearchParams(tab.id, filters, nextPage));
  };

  const selectUser = (appUserId: number) => {
    patchSearchParams((next) => {
      next.set('usr', String(appUserId));
      // 사용자를 고르는 것과 등록 폼이 열려 있는 것은 함께 성립하지 않는다.
      next.delete('new');
    });
  };

  const handleAddUser = () => {
    patchSearchParams((next) => {
      next.set('new', 'user');
      // 등록 폼이 열려 있는 동안 고른 사용자의 상세가 함께 보이면 어느 쪽을 고치는지 가릴 수 없다.
      next.delete('usr');
    });
  };

  /** 탭을 바꾸면 **탭 값 하나만 남긴다** — 규칙은 `tabs.ts`가 갖는다. */
  const changeTab = (nextTabId: string) => {
    setSearchParams(tabSearchParams(nextTabId));
  };

  const usersTabContent = (
    <div className="two-pane">
      <UserListPane
        users={users}
        isLoading={userList.isPending}
        appliedFilters={filters}
        onApplyFilters={applyFilters}
        departmentOptions={selectableOptions(departmentOptions.entries, filters.departmentId)}
        /*
         * 조건 칩에는 번호가 아니라 이름을 낸다. 선택 목록을 아직 받지 못했으면
         * 「알 수 없음」이 나오고 목록이 도착하면 이름으로 바뀐다 —
         * 번호를 대신 보이면 사용자가 쓸 수 없는 값을 자료로 읽는다.
         */
        departmentLabel={(departmentId) =>
          lookupLabel(departmentOptions.entries, Number(departmentId))
        }
        departmentNameOf={(departmentId) => lookupLabel(departmentOptions.entries, departmentId)}
        optionsNotice={renderOptionsNotice([departmentOptions])}
        pageView={userPageView}
        onChangePage={changeUserPage}
        selectedAppUserId={selectedAppUserId}
        onSelect={selectUser}
        isCreating={isCreatingUser}
        onAddUser={handleAddUser}
        loadError={
          userList.isError ? (
            <LoadErrorBanner error={userList.error} onRetry={() => void userList.refetch()} />
          ) : null
        }
      />

      {/*
       * 우 칸은 구획을 세로로 쌓는다 — 사용자 정보 아래에 역할 부여·데이터 접근범위가 붙는다.
       * `.pane-stack`은 선택자에 매이지 않은 기본 규칙이라 2단 배치의 칸 안에서도 그대로 동작한다.
       */}
      <div className="pane-stack">
        <section className="pane" aria-label={t.panes.userForm}>
          <EmptyState size="sm" title={t.user.empty.notSelected} />
        </section>
      </div>
    </div>
  );

  const tabContentOf = (tabId: string): ReactNode => (tabId === 'users' ? usersTabContent : null);

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <Tabs
        aria-label={t.tabs.label}
        value={tab.id}
        onChange={changeTab}
        items={USERS_ROLES_TABS.map((definition) => ({
          value: definition.id,
          label: definition.label,
          /*
           * 활성 탭의 내용만 만든다. 디자인 시스템 `Tabs`는 비활성 패널도 DOM에 두므로
           * 모두 만들면 보이지 않는 표가 함께 살아 있게 된다.
           */
          content: definition.id === tab.id ? tabContentOf(definition.id) : null,
        }))}
      />
    </>
  );
};
