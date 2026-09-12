import {
  AppShell,
  Button,
  SearchInput,
  Sidebar,
  SidebarItem,
  SidebarSection,
  Topbar,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState, type ReactNode } from 'react';
import { useHref, useLinkClickHandler, useLocation } from 'react-router';

import { useSession, useSignOut } from '../patterns/session';
import { LocaleSelect } from './locale-select';
import { filterNavGroups, hasNoNavMatch, matchesNavEntry } from './nav-filter';
import { NavGroup } from './nav-group';
import { NAV_ENTRIES, NAV_GROUPS, NAV_LEAD } from './nav-tree';
import { localizedLabel, SHELL_BRAND } from './shell-label';

/** 사이드바 **조작** 문구. 화면 이름은 `nav-tree.ts` 가 갖는다. */
const t = messages.shellNav;

/**
 * 이 주소를 보고 있는가. **하위 경로도 그 항목의 것이다**(`/a/b` 는 `/a` 항목을 켠다).
 *
 * ⛔ **두 곳에서 같은 식을 적지 않는다.** 항목의 선택 표시와 「현재 묶음」 판정이 같은 뜻이어야
 * 하는데 식을 복사하면 한쪽만 고쳐지는 날이 온다 — 그러면 켜진 항목이 든 묶음이 닫힌 채 선다.
 */
const isPathActive = (pathname: string, to: string): boolean =>
  pathname === to || pathname.startsWith(`${to}/`);

interface NavItemProps {
  to: string;
  icon: string;
  children: ReactNode;
  /**
   * DS 항목 요소에 그대로 실리는 앱 소유 클래스.
   *
   * ⭐ **갈래를 하나로 못 박는다.** 지금 합법인 값이 하나뿐이어서가 아니라, 이 자리가
   * 서식을 덮는 문으로 자라지 않게 하려는 것이다 — 서식은 DS 가 정하고, 덮기 시작하면
   * 메뉴 항목의 모양이 두 곳에서 정해진다. 배치를 바로잡는 우회만 여기로 들어온다(#1077).
   *
   * ⚠ 상류(design-system-v2-webui#103)가 반영돼 우회를 걷어내는 날, 이 타입이 남은
   * 사용처를 `typecheck` 에서 짚어 준다. 넓은 `string` 이면 조용히 남는다.
   */
  className?: 'sidebar-lead';
}

/**
 * DS `SidebarItem`을 라우터에 잇는 어댑터.
 * `href`는 `useHref`로 만들고, 클릭은 `useLinkClickHandler`로 가로채 전체 새로고침 없이 이동한다.
 */
const NavItem = ({ to, icon, children, className }: NavItemProps) => {
  const href = useHref(to);
  const handleClick = useLinkClickHandler(to);
  const location = useLocation();
  const isActive = isPathActive(location.pathname, to);

  return (
    <SidebarItem
      icon={icon}
      href={href}
      active={isActive}
      onClick={handleClick}
      className={className}
    >
      {children}
    </SidebarItem>
  );
};

/**
 * 지금 보고 있는 화면이 속한 묶음 이름. 어디에도 속하지 않으면 `null`(섹션 밖 항목·로그인 등).
 *
 * 항목과 **같은 함수**를 쓴다(`isPathActive`) — 하위 경로를 보고 있어도 그 묶음이 열려 있어야 한다.
 *
 * ⛔ **보이는 이름이 아니라 `label`(한국어)을 돌려준다**(#1113). 이 값은 펼침 상태의 **키**로
 * 쓰이므로 언어를 타면 안 된다 — 타면 언어를 바꾼 뒤 열어 둔 묶음이 다른 키가 되어 닫힌다.
 */
const findActiveGroupLabel = (pathname: string): string | null =>
  NAV_GROUPS.find((group) => group.items.some((item) => isPathActive(pathname, item.to)))?.label ??
  null;

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * 상단 바 오른쪽 — **누구로 있는가와 나가는 길, 그리고 어느 언어로 볼 것인가**.
 *
 * ⭐ **이름 없이 로그아웃만 두지 않는다.** 사무실에서 여럿이 번갈아 쓰는 화면이라, 나가기 전에
 * **지금 누구로 있는지**를 같은 자리에서 확인할 수 있어야 한다.
 *
 * ⭐ **언어 선택이 로그아웃 옆인 것도 같은 사정이다**(#1113). 같은 자리를 한국인 관리자와
 * 베트남인 관리자가 번갈아 쓰므로, 자리에 앉은 사람이 **먼저 하는 일**이 「내 언어로 바꾸고
 * 내 계정으로 들어가기」다 — 그 둘을 한 자리에 둔다.
 *
 * ⚠ **나가는 중에는 잠근다.** 연타가 그대로 요청 두 벌이 되고, 계약이 쓰기마다 새 멱등 키를
 * 요구하므로 서버에는 서로 다른 요청으로 보인다.
 */
const SessionActions = ({ userName }: { userName: string }) => {
  const { signOut, isSigningOut } = useSignOut();

  return (
    <div className="topbar-session">
      <span>{userName}</span>
      <LocaleSelect />
      <Button variant="text" size="sm" onClick={signOut} disabled={isSigningOut}>
        {messages.session.actions.signOut}
      </Button>
    </div>
  );
};

/**
 * 관리웹 셸.
 *
 * **상단 바 오른쪽에 로그인 사용자의 이름과 로그아웃을 보인다.** 세션이 없으면 그 자리를
 * **비운다** — 「알 수 없음」류의 글자를 두지 않는다(공유계약 G-9: 모르는 값과 없는 값을 같은
 * 모양으로 그리지 않는다).
 *
 * ⚠ **이 셸은 `RequireSession` 안에서만 선다**(`routes/index.tsx`). 그래도 세션 없는 갈래를
 * 지우지 않는 것은, 이 파일이 그 사실을 강제할 수 없어서다 — 가드 밖에서 쓰이는 날
 * 「알 수 없음」이 그려지는 것보다 **비는 편**이 낫다.
 *
 * ⛔ 귀속(사업부·공장)은 그리지 않는다 — 계약이 정수 ID만 주고 이름을 주지 않아, 사람이 읽을
 * 값을 만들려면 셸이 기준정보 조회를 지게 된다. 값 자체는 세션에 그대로 실려 있다.
 *
 * **메뉴의 차례와 묶음은 `nav-tree.ts` 가 갖는다**(#1079). 이 파일은 그것을 그리는 일만 한다 —
 * 화면 검색과 섹션 접기가 같은 목록을 훑어야 해서, 트리를 JSX 로 두면 훑을 대상이 없다.
 * 항목을 더하거나 옮기는 일은 저기서 하고, **배치 근거도 저기에 적는다.**
 */
export const AppLayout = ({ children }: AppLayoutProps) => {
  const { session } = useSession();

  /**
   * 사이드바 접힘 — **한 곳에서 정해 양쪽에 내린다**(#1078).
   *
   * ⛔ **어느 한쪽에만 맡기지 않는다.** 접힌 폭은 셸 격자의 사이드바 칸과 사이드바 자신의
   * `width` 두 곳에서 정해진다. DS 는 둘이 **각자 비제어 상태**를 들고 있어, 배선하지 않으면
   * 접기 버튼이 사이드바만 72px 로 줄이고 칸은 256px 로 남아 **184px 죽은 띠**가 생긴다(실측).
   *
   * ⚠ **결정 지점이 하나 더 있고 이 배선 밖이다.** DS 에 `@media (width <= 768px)` 규칙이
   * 있어 그 폭에서는 칸이 `data-collapsed` 와 **무관하게** 72px 로 고정된다 — 펼친 상태의
   * 사이드바 256px 가 칸을 184px 넘어 잘린다(768px 실측 · 이 배선과 별개의 결함 #1085).
   * 여기서 고치지 않은 것은 그 구간의 의도(좁은 화면에서는 레일로 쓴다)가 DS 쪽에 있고,
   * 제품이 브레이크포인트를 제 손으로 읽기 시작하면 접힘의 주인이 둘로 갈리기 때문이다.
   */
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  /**
   * 화면 검색어 — **사이드바의 것이고 주소에 싣지 않는다.** 주소에 실으면 뒤로 가기가 검색을
   * 되돌리고, 링크를 공유할 때 남의 검색어가 따라간다. 화면을 고르면 그 자리에서 쓸모가 끝난다.
   */
  const [query, setQuery] = useState('');

  const { pathname } = useLocation();
  const activeGroupLabel = findActiveGroupLabel(pathname);

  /**
   * 펼쳐 둔 묶음 — **처음에는 지금 보고 있는 화면의 묶음 하나뿐이다**(#1079).
   *
   * ⭐ **전부 펼쳐 두지 않는다.** 묶음 9개에 화면 69개라 전부 펼치면 목록이 4208px 이 되어 한
   * 화면에 18% 만 보인다(실측). 처음 보이는 것을 9줄로 줄이는 것이 이 작업의 목적이다.
   *
   * ⚠ **기억하지 않는다.** 접힘 상태를 브라우저에 남기는 전례가 이 저장소 운영 코드에 하나도
   * 없어(`localStorage` 사용처 0) 이번에는 들이지 않는다 — 새로 고치면 「현재 묶음만」으로 돌아간다.
   */
  const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(
    () => new Set(activeGroupLabel === null ? [] : [activeGroupLabel]),
  );

  /**
   * 다른 묶음의 화면으로 **밖에서** 들어오면 그 묶음을 열어 준다 — 주소를 직접 치거나, 가드가
   * 돌려보내거나, 본문 안의 링크를 눌렀을 때다.
   *
   * ⛔ **「현재 묶음은 늘 열림」으로 계산하지 않는다.** 그러면 지금 보고 있는 묶음을 **접을 수
   * 없다** — 접어도 다음 렌더에 다시 열린다. 들어올 때 한 번 더해 주고, 그 뒤로는 사람이 정한다.
   */
  useEffect(() => {
    if (activeGroupLabel === null) return;

    setOpenGroups((previous) =>
      previous.has(activeGroupLabel) ? previous : new Set(previous).add(activeGroupLabel),
    );
  }, [activeGroupLabel]);

  /**
   * 화면을 고르면 **검색어를 버린다.**
   *
   * 남겨 두면 들어간 화면에서 사이드바가 걸린 한 줄로 줄어든 채 서서, 형제 화면도 대시보드도
   * 보이지 않는다 — 찾는 일은 끝났고 이제 필요한 것은 **평소의 사이드바**다.
   */
  useEffect(() => {
    setQuery('');
  }, [pathname]);

  const toggleGroup = (label: string): void => {
    setOpenGroups((previous) => {
      const next = new Set(previous);

      if (!next.delete(label)) next.add(label);

      return next;
    });
  };

  /**
   * 걸러는 데 실제로 쓰는 검색어 — **레일에서는 없는 것과 같다**(#1079 검토).
   *
   * ⛔ **판정을 여러 곳에서 각자 하지 않는다.** 레일에는 검색창이 없어(아래 `header`) **지울
   * 수단이 없는데**, 남은 검색어를 어떤 판정은 보고 어떤 판정은 안 보면 **절반만 걸린 사이드바**가
   * 된다 — 실제로 그랬다: 항목은 68개가 다 서는데 섹션 밖 항목만 사라지고, 맞는 것이 없으면
   * 72px 레일에 안내 문단이 아이콘들과 나란히 섰다. 끊는 자리를 하나로 둔다.
   *
   * ⭐ **접을 때 검색어를 지우지는 않는다.** 레일이 그것을 보지 않으므로 남아 있어도 해가 없고,
   * 다시 펼치면 찾던 것이 그대로 있다 — 폭을 잠깐 벌렸다고 사람의 일을 버리지 않는다.
   */
  const activeQuery = isSidebarCollapsed ? '' : query;

  const isSearching = activeQuery.trim() !== '';
  const visibleGroups = filterNavGroups(NAV_GROUPS, activeQuery);
  const isLeadVisible = matchesNavEntry(NAV_LEAD, activeQuery);

  return (
    <AppShell
      mainLabel="본문"
      collapsed={isSidebarCollapsed}
      onCollapsedChange={setIsSidebarCollapsed}
      topbar={
        <Topbar
          brand={<strong>{localizedLabel(SHELL_BRAND)}</strong>}
          actions={session === null ? undefined : <SessionActions userName={session.userName} />}
        />
      }
      sidebar={
        <Sidebar
          aria-label="주 메뉴"
          collapsed={isSidebarCollapsed}
          onCollapsedChange={setIsSidebarCollapsed}
          header={
            /*
             * ⛔ **레일(아이콘 전용)에서는 검색창을 세우지 않는다.** 72px 에 입력칸이 들어가지
             * 않고, 들어간다 해도 결과가 아이콘만 남아 **무엇이 걸렸는지 읽을 수 없다.**
             * 접힌 상태에서 찾으려는 사람은 먼저 펼친다.
             */
            isSidebarCollapsed ? undefined : (
              <SearchInput
                size="sm"
                fullWidth
                aria-label={t.search.label}
                placeholder={t.search.placeholder}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery('')}
              />
            )
          }
        >
          {/*
           * ⚠ **`.sidebar-lead` 는 서식이 아니라 배치를 지키는 자리다.** 섹션 밖 직계 항목은
           * 목록이 넘칠 때 DS 가 48px → 24px 로 줄여 버리고(design-system-v2-webui#103),
           * 선택 배경과 표시선이 절반 높이로 그려진다. 상류가 고쳐지면 이 클래스를 지운다.
           *
           * 이 항목이 **왜 섹션 밖 맨 위인지**는 `nav-tree.ts` 의 `NAV_LEAD` 에 적혀 있다.
           */}
          {isLeadVisible ? (
            <NavItem to={NAV_LEAD.to} icon={NAV_LEAD.icon} className="sidebar-lead">
              {localizedLabel(NAV_LEAD)}
            </NavItem>
          ) : null}
          {/*
           * ⭐ **레일에서는 접기 손잡이를 두지 않고 DS 섹션으로 돌아간다.** 아이콘만 남은 폭에서
           * 손잡이는 누를 이름이 없고, DS 가 그 상태의 섹션 라벨을 이미 접근명으로만 남긴다
           * (`sectionLabelHidden`). 두 모양을 한 갈래로 합치려다 레일에서 빈 줄이 서는 쪽을
           * 고르지 않는다.
           */}
          {isSidebarCollapsed
            ? /* 레일에서 `activeQuery` 가 비므로 이 목록은 `NAV_GROUPS` 와 같다 — 자료는 한 길이고
               * 갈라지는 것은 **그리는 모양**뿐이다(손잡이 대신 DS 섹션). */
              visibleGroups.map((group) => (
                <SidebarSection key={group.label} label={localizedLabel(group)}>
                  {group.items.map((item) => (
                    <NavItem key={item.to} to={item.to} icon={item.icon}>
                      {localizedLabel(item)}
                    </NavItem>
                  ))}
                </SidebarSection>
              ))
            : visibleGroups.map((group) => {
                /*
                 * ⭐ **검색 중에는 맞는 묶음을 강제로 펼친다.** 접혀 있으면 맞는 항목을 찾아
                 * 놓고도 보이지 않아 「결과 없음」과 구별되지 않는다. 접힘 상태 자체는 건드리지
                 * 않아, 검색어를 지우면 **사람이 정해 둔 모양으로 그대로 돌아온다.**
                 */
                const isOpen = isSearching || openGroups.has(group.label);

                return (
                  <NavGroup
                    key={group.label}
                    label={localizedLabel(group)}
                    count={group.items.length}
                    isOpen={isOpen}
                    /*
                     * ⛔ **검색 중에는 잠근다.** 강제로 펼쳐 둔 상태라 눌러도 화면이 바뀌지 않는데,
                     * 누름이 접힘 상태를 조용히 뒤집으면 그 결과가 **검색어를 지운 뒤에** 드러난다 —
                     * 「접기」를 눌렀는데 열려 있거나, 열어 둔 것이 닫혀 있다. 상태를 거짓으로
                     * 알리는 컨트롤을 두지 않는다.
                     */
                    isLocked={isSearching}
                    onToggle={() => toggleGroup(group.label)}
                  >
                    {group.items.map((item) => (
                      <NavItem key={item.to} to={item.to} icon={item.icon}>
                        {localizedLabel(item)}
                      </NavItem>
                    ))}
                  </NavGroup>
                );
              })}
          {/*
           * 맞는 것이 하나도 없을 때. ⛔ **빈 목록을 그대로 두지 않는다** — 사이드바가 통째로
           * 비면 사람은 화면이 깨진 것으로 읽는다.
           */}
          {hasNoNavMatch(NAV_ENTRIES, activeQuery) ? (
            <p className="nav-search-empty">{t.search.empty}</p>
          ) : null}
        </Sidebar>
      }
    >
      {children}
    </AppShell>
  );
};
