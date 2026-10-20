import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 다루는 계약 타입. 화면 슬라이스끼리 타입을 나눠 쓰지 않는다 —
 * 다른 화면의 같은 이름 타입을 가져다 쓰면 그쪽 사정이 이 화면을 바꾼다.
 */
export type Bom = components['schemas']['Bom'];

/**
 * BOM 구성품 + ERP 자품목 순번.
 *
 * ⚠ `erpChildItemSeq`(ERP `CHILD_ITEM_SEQ`)는 서버 #737 이 응답에 더한 칸이라(장부 P-67
 * 「ERP 에서 받은 원본 칸을 응답에 싣는다」) 생성 타입에 아직 없다. 여기서만 넓힌다 —
 * 계약 사본이 같은 이름으로 실려 오면 이 교차를 걷는다.
 * ⭐ **0 도 유효한 값이다**(P-67 「0 도 온다」) — 거짓 같은 값으로 걸러 빈칸을 내면 안 된다.
 * 값이 없으면 서버가 `null` 을 준다. 사본 이전 서버는 키를 아예 빼므로 선택 칸으로 둔다.
 */
export type ErpBomComponent = components['schemas']['BomComponent'] & {
  erpChildItemSeq?: number | null;
};
