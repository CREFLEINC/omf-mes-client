import { AppShell, Topbar } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.popShell;

interface PopLayoutProps {
  children: ReactNode;
}

/**
 * POP 셸 — 1024×768 터치 키오스크.
 *
 * **관리웹 셸(`layout.tsx`)과 갈라 둔다.** 같은 코드베이스에서 폼팩터만 다른 것이 아니라
 * 셸이 하는 일이 다르다 —
 *
 * | | 관리웹 | POP |
 * | --- | --- | --- |
 * | 이동 | 사이드바로 화면을 고른다 | **고르지 않는다** — 단말이 할 일이 정해져 있다 |
 * | 사용자 | 로그인 계정 이름 | 사번 귀속(진입점 화면 소관 · 이 저장소 #157) |
 *
 * ⛔ **사이드바를 두지 않는다.** 전체 화면 키오스크라 메뉴로 화면을 옮겨 다니는 조작이
 * 없고, 세로 여유가 119px뿐이라 상시 구획을 하나라도 더 두면 본문이 잘린다.
 *
 * ⛔ **머리에 단말·사용자 값을 그리지 않는다.** 단말 이름을 받을 경로가 계약에 없고,
 * 사번 귀속은 진입점 화면(#157)이 소유한다. 없는 값을 「알 수 없음」으로 채우지 않는다
 * (공유계약 G-9 — 모르는 값과 없는 값을 같은 모양으로 그리지 않는다).
 * 프린터·단말 상태는 **화면이 그린다** — 화면마다 무엇을 보일지가 달라 셸이 미리 정하지
 * 않는다. 그 배치 클래스도 화면과 함께 들어온다.
 */
export const PopLayout = ({ children }: PopLayoutProps) => (
  <AppShell
    mainLabel={t.mainLabel}
    skipLinkLabel={t.skipLink}
    topbar={<Topbar brand={<strong>{t.brand}</strong>} />}
  >
    {children}
  </AppShell>
);
