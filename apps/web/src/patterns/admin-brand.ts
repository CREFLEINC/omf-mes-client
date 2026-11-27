import type { LocalizedLabel } from './localized-label';

/**
 * 관리웹의 제품 이름 — **상단 바와 로그인 화면이 같은 값을 쓴다.**
 *
 * 로그인 화면은 셸 밖이라 `app/` 을 부를 수 없어(`dep:check` 의 `app-inner-direction`) 여기 둔다.
 * 두 자리가 따로 적으면 로그인 직후 이름이 바뀌어 보인다.
 *
 * ⚠ **관리웹만의 이름이다.** POP(`OMF-MES POP`) · 모바일(`OMF-MES 모바일`)과 브라우저 탭 제목
 * (`apps/web/index.html`)은 각자 제 자리에 적혀 있다 — 탭 제목은 이 값과 같은 글자로 맞춘다.
 */
export const ADMIN_PRODUCT_NAME = 'SAMJINLND VINA MES';

/** 제품 이름 뒤에 붙는 「관리웹」. 로그인 화면은 이 부분만 옅게 그린다 */
export const ADMIN_WEB_NAME: LocalizedLabel = { label: '관리웹', labelVi: 'Quản trị' };

/** 상단 바에 한 덩어리로 서는 전체 이름 */
export const ADMIN_BRAND: LocalizedLabel = {
  label: `${ADMIN_PRODUCT_NAME} ${ADMIN_WEB_NAME.label}`,
  labelVi: `${ADMIN_PRODUCT_NAME} ${ADMIN_WEB_NAME.labelVi}`,
};
