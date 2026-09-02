import { popRoutes } from '../routes/pop';

/**
 * 브라우저 탭·창 제목.
 *
 * ## 왜 필요한가
 *
 * `index.html`의 `<title>`은 **한 벌뿐인데 이 앱은 셸 둘을 담는다** — 관리웹과 POP이 같은
 * 번들에 살기 때문이다(코드 1벌 · 셸 3종). 그래서 POP 주소로 들어가도 관리웹 제목이 뜬다.
 *
 * ⚠ **운영에서 깨지는 것은 없다.** POP은 Electron 설치형 앱에서 전체 화면 키오스크로 뜨고
 * 탭도 주소창도 없다(공유계약 §E 결정 기록). 이 값이 보이는 곳은 **개발·검증 중 브라우저**이고,
 * POP 화면이 늘수록 「지금 어느 셸을 보고 있는가」를 탭으로 구분할 수 없는 것이 문제다.
 *
 * ⛔ **설계가 정한 자리가 아니다.** 화면 스펙·공유계약 어디에도 탭 제목 규정이 없다 — 키오스크를
 * 전제로 쓰였기 때문이다. 그래서 값은 **형제 셸의 표기를 따른다**: 관리웹 `index.html`이
 * 「OMF-MES 관리웹」, 모바일 `apps/mobile/index.html`이 「OMF-MES 모바일」이므로 POP은
 * 「OMF-MES POP」이다. 설계가 화면 «안»에 그린 제품명(진입 화면의 「오마이팩토리 MES」)은
 * 다른 축이라 가져오지 않는다.
 */
export const ADMIN_DOCUMENT_TITLE = 'OMF-MES 관리웹';
export const POP_DOCUMENT_TITLE = 'OMF-MES POP';

/**
 * 이 주소가 POP 셸인가.
 *
 * ⛔ **주소 앞머리를 여기서 다시 적지 않는다.** POP 라우트 표에 있는 경로로 판정한다 —
 * 문자열을 따로 두면 라우트가 옮겨질 때 한쪽만 고쳐지고, **틀린 제목은 오류를 내지 않아**
 * 아무 데서도 안 보인다.
 */
const isPopPath = (pathname: string): boolean =>
  popRoutes.some(({ path }) => path !== undefined && pathname.startsWith(path));

export const titleForPath = (pathname: string): string =>
  isPopPath(pathname) ? POP_DOCUMENT_TITLE : ADMIN_DOCUMENT_TITLE;

/** 라우터에서 이 모듈이 쓰는 것만 추린 모양. 시험이 진짜 라우터를 세우지 않아도 되게 한다. */
export interface TitleSyncTarget {
  state: { location: { pathname: string } };
  subscribe: (listener: (state: { location: { pathname: string } }) => void) => () => void;
}

/**
 * 주소가 바뀔 때마다 제목을 맞춘다. 첫 호출에서 **지금 주소로 한 번** 맞춘 뒤 구독한다 —
 * POP 주소로 «바로» 들어온 경우가 그렇지 않으면 첫 화면에서 관리웹 제목으로 남는다.
 *
 * @returns 구독 해제 함수
 */
export const syncDocumentTitle = (router: TitleSyncTarget): (() => void) => {
  document.title = titleForPath(router.state.location.pathname);

  return router.subscribe((state) => {
    document.title = titleForPath(state.location.pathname);
  });
};
