/**
 * ERP 가 보내는 공통코드 그룹 — ERP `TYPE_CODE` 여덟 가지.
 *
 * ⭐ 정본: `erp-gateway/docs/mes-temp-tables.md` §3.1 「공통코드 `erp_if.common_code`」 분류 표
 * (여덟 분류, 합계 244건). `erp-gateway/docs/mes-seed-mapping.md` §3 규칙 5 · §5.4 가 이 여덟을
 * 「접두어 없이 그대로」 `mdm.code_group.group_code` 로 넣는다고 정했고, 서버 반영
 * (`omf-mes-server/src/integration/erp/apply/common-code.apply.ts`)도 `TYPE_CODE` 를 그대로 쓴다.
 *
 * ⚠ 왜 목록을 화면에 두는가: 코드 그룹 API(`CodeGroup`)가 출처를 내리지 않는다. 서버는 ERP 그룹을
 * `is_system_owned=true` · `updated_by=null` 로 세우지만 MES 시드 그룹도 시스템 소유라 그 표시로는
 * 가를 수 없고, 응답에는 둘 다 실리지 않는다(상세의 `editability.reason` 도 MES 그룹과 같은 값이다).
 * 서버가 그룹에 출처(예: `sourceSystemCode: 'ERP'` 또는 `isErpOwned`)를 내리거나 목록에
 * 출처 조건(`source=ERP`)을 받으면 이 표를 지우고 그 신호로 거른다.
 *
 * ERP 가 새 분류를 보내기 시작하면 여기에 더해야 보인다 — 위 문서 표가 바뀌는 시점이다.
 */
export const ERP_CODE_GROUP_CODES: readonly string[] = [
  'TRANS_TYPE',
  'COST_TYPE',
  'SL_TYPE',
  'UNIT',
  'SO_TYPE',
  'ORDER_TYPE',
  'SALE_GROUP',
  'PUR_GROUP',
];

const ERP_GROUP_SET = new Set(ERP_CODE_GROUP_CODES);

export const isErpCodeGroup = (groupCode: string): boolean => ERP_GROUP_SET.has(groupCode);
