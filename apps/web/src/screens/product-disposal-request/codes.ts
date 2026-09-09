import type { components, paths } from '@omf-mes/api-client';

/**
 * 이 화면이 쓰는 **구조 값**들.
 *
 * ⭐ **전부 생성물 타입에서 파생한다** — 손으로 적은 문자열을 두면 계약이 값을 바꿔도 아무것도
 * 울지 않는다. `W-01-06`(자재 폐기 요청)이 같은 자리에서 같은 방법을 쓴다.
 *
 * ⛔ **여기 있는 것은 「고르는 값」이 아니다.** 사용자가 선택할 코드(출고 유형·폐기 사유)는
 * 계약이 받는 길을 명시했으므로(`GET /mdm/code-values?codeGroupCode=ISSUE_TYPE|GOODS_ISSUE_REASON`
 * · 공유계약 G-32) `lookups.ts` 가 조회로 채우고 이 파일에 두지 않는다.
 */

type GoodsIssueCreate = components['schemas']['GoodsIssueCreate'];

/**
 * 기타출고 전표의 **원천 문서 유형** — 이 화면 몫은 «처분 결정»이다.
 *
 * ⭐ **값 목록을 «기다릴» 자리가 아니었다**(통지 `#674`). A-10 다형 참조의 판별자라 값이 우리
 * 계약의 대상 테이블 이름이고(`DISPOSITION_DECISION` → `quality.disposition_decision`),
 * 고객이 늘릴 수 있는 값이 아니다(공유계약 A-10·A-16). 그래서 공통코드 조회로 받지 않는다.
 *
 * ⚠ 같은 이름의 다른 자리(`GoodsReceipt`·`InventoryTransaction`)는 값 집합이 다르다 — 자리마다
 * 닫혀 있으므로 **이 전표의 타입에서** 파생한다.
 */
export const SOURCE_DOCUMENT_TYPE_CODE: GoodsIssueCreate['sourceDocumentTypeCode'] =
  'DISPOSITION_DECISION';

/**
 * 진입 목록을 좁히는 **처분 유형** — 이 화면의 대상은 «폐기»로 판정된 것만이다(§5-2).
 *
 * ⭐ **계약이 `REWORK`·`SCRAP`·`NORMAL` 셋으로 닫았다**(통지 `#674`). 한때 이 축의 값이 없어
 * 처분을 열로 보여 사람이 가리게 했는데, 이제 **서버가 좁혀 준다.**
 *
 * ⚠ **「선별」은 값이 아니다** — 1차 범위 밖이라 실행 화면이 없다(통지 `#675`). 계약이 셋으로
 * 닫았으므로 이 자리에 넣을 수도 없다.
 */
export const DISPOSAL_DISPOSITION_TYPE: NonNullable<
  NonNullable<
    paths['/quality/disposition-decisions']['get']['parameters']['query']
  >['dispositionTypeCode']
> = 'SCRAP';

/**
 * 이 화면이 만드는 **출고 유형** — 기타출고 고정이다(§4-B).
 *
 * ⭐ **폐기는 출고 «유형»이 아니라 기타출고의 «사유»다**(✓확정 2026-08-31). `issueTypeCode` 는
 * `OTHER` 로 두고 `reasonCode` 로 가른다 — 승인 게이트도 사유를 보고 걸린다(공유계약 G-31).
 *
 * ⚠ **선택칸의 값은 조회로 온다** — 사용자가 고를 자리는 `lookups.ts` 가 채운다. 이 상수는
 * 「처리 이력」 탭이 **좁히는 축**으로만 쓴다. 계약이 이 칸을 `enum` 으로 닫지 않아(고객이
 * 값을 늘릴 수 있다 · G-31) 생성 타입에서 파생할 수 없다 — 값 하나를 손으로 적는 자리다.
 */
export const ISSUE_TYPE_OTHER = 'OTHER';

/**
 * 폐기 거래처를 좁히는 역할 코드 — **계약이 값을 좁혀 두었다.**
 *
 * ⛔ **생성물 타입에서 파생한다** — `W-01-06` 이 같은 자리에서 같은 방법을 쓴다.
 */
type PartnerRoleCode = components['schemas']['PartnerRole']['roleTypeCode'];

export const DISPOSAL_PARTNER_ROLE: PartnerRoleCode = 'DISPOSAL';

/**
 * **결재선이 있는지 물을 때만** 쓰는 승인 유형 — `GET /app/approval-routes?approvalTypeCode=`.
 *
 * ⛔ **상신 본문에 싣지 않는다.** 상신 오퍼레이션(`:request-approval`)이 만드는 승인 요청의
 * `approvalTypeCode` 는 **언제나 `GOODS_ISSUE_DISPOSAL`** 이고 **서버가 채운다**(✓확정
 * 2026-09-01 사용자 · `omf-mes#336` · 통지 `#674`). 이 상수는 «보낼 값»이 아니라 «찾을 축»이다.
 *
 * ⭐ 자재 폐기(`W-01-06`)와 제품 폐기(이 화면)는 **같은 유형**이다 — 둘의 결재선을 가르는 축은
 * 결재선 정의의 `businessUnitId` 이고, 어느 결재선을 고를지는 서버가 «전표의 `reasonCode`»로
 * 파생한다(공유계약 G-31). 그래서 이 조회는 **「폐기 결재선이 하나라도 있는가」까지만** 답한다 —
 * 서버가 실제로 고를 그 결재선인지는 상신해 봐야 안다(§6 의 400 처리가 그 자리다).
 *
 * ⚠ **한때 이 자리에 빈 문자열 `DISPOSAL_APPROVAL_TYPE_CODE` 를 두고 쓰기 전체를 잠갔다**
 * (2026-09-01). 「값이 오면 채운다」고 적어 두었는데 **올 값이 아니었다** — 상신 축의 값은
 * 서버 몫이었다. 되살리며 잠금 판정을 걷고 이 상수를 조회 축으로만 남겼다.
 */
export const ROUTE_LOOKUP_APPROVAL_TYPE: NonNullable<
  NonNullable<paths['/app/approval-routes']['get']['parameters']['query']>['approvalTypeCode']
> = 'GOODS_ISSUE_DISPOSAL';
