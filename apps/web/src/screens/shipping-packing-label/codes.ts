import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 **보내고 또 조회 축으로 쓰는** 코드 값 — 확정된 것과 아직 아닌 것을 한 곳에서 가른다.
 *
 * | 값 | 상태 | 근거 |
 * | --- | :-: | --- |
 * | `DELIVERY_LABEL` · `PACKING_LABEL` | ✅ 확정 | 계약 `DocumentIssueCreate.documentTypeCode` enum 9종 · 변경 통지 #700 |
 * | `DELIVERY_TARGET_TYPE_CODE` | ⚠ **자리표시** | 계약 `DocumentTarget.targetTypeCode` 가 `x-no-example` |
 * | `PACKING_TARGET_TYPE_CODE` | ⚠ **자리표시** | 동상 |
 * | `REISSUE_REASON_CODE_GROUP` | ✅ 확정 | 계약이 코드 그룹 코드로 명시 |
 */

/**
 * 납품 라벨 — **고객에게 나가는 것**이라 OQC 합격 건에만 붙는다(스펙 §5-1).
 *
 * ⭐ 2026-09-02 에 `enum` 9종으로 닫혔다. 그전까지 이 화면은 「대상 유형으로 가른다」였는데
 * (②안) **프린터 필터가 서지 않아** 뒤집혔다 — 거를 값이 하나면 창고 포장 프린터가
 * 납품 라벨 후보로 함께 나온다(스펙 §5-2 · 변경 통지 #700 §7).
 */
export const DELIVERY_LABEL = 'DELIVERY_LABEL';

/** 포장 라벨 — 포장하면 바로 붙인다. 물리적으로 붙어야 다음 공정이 식별한다(스펙 §5-1). */
export const PACKING_LABEL = 'PACKING_LABEL';

/** 이 화면이 다루는 출력물 두 종류. 배열 순서가 곧 라디오 순서다(스펙 §3 ①). */
export const LABEL_KINDS = [PACKING_LABEL, DELIVERY_LABEL] as const;

export type LabelKind = (typeof LABEL_KINDS)[number];

/**
 * ⚠ **자리표시다 — 그리고 이 화면에서는 «쓰기 전용» 자리표시가 아니다.**
 *
 * 앞선 두 화면(`P-01-01`·`P-02-05`)은 이 값을 `POST /app/document-issues` 에 **싣기만** 했다.
 * 쓰기는 서버가 보낸 값을 그대로 저장하므로 문자열이 무엇이든 기록끼리는 앞뒤가 맞는다.
 *
 * ⛔ **이 화면은 같은 값으로 «조회»도 한다.** `GET /app/document-issues/summary` 가 이 값을
 * **필수 질의**로 받고, 목록의 「최근 발행 · 회차」 열과 재발행 사유 활성 조건이 거기 달렸다.
 * 조회는 서버가 이미 가진 값과 대조하므로, 문자열이 다르면 **「발행한 적 없다」가 조용히
 * 돌아온다.** 그러면 화면은 재발행을 신규로 처리하고 `uq_document_issue_log`
 * (문서유형·대상유형·대상·회차)에 부딪히거나 회차가 어긋난 채 쌓인다.
 *
 * ⭐ **그래서 화면이 그 사실을 감추지 않는다** — 회차 열에 「확인 중」을 그리지 않고,
 * 조회가 0 을 돌려준 것과 값이 확정되지 않은 것을 안내로 함께 밝힌다(공유계약 G-2 · F-6).
 *
 * 값이 확정되면 **이 파일의 두 줄만** 바뀐다.
 */
/*
 * ⚠ **가정한 값이다 — 확정이 아니다**(사용자 결정 2026-09-03 · 설계팀 질문 대기).
 *
 * ⛔ 종전의 `'SHIPMENT_LOT_ALLOCATION'` 은 **계약이 거부한다.** 회차 조회
 * `GET /app/document-issues/summary` 의 `targetTypeCode` 가 7값 enum 으로 닫혀 있고
 * (`LOT`·`SERIAL_NUMBER`·`HANDLING_UNIT`·`GOODS_ISSUE_LINE`·`MOLD`·`LOCATION`·
 * `INSPECTION_RESULT`) 「출하 배분」이 그 안에 없다 — 실측 2026-09-03, 목 서버가 400 을
 * 냈고 화면은 회차를 몰라 발행을 막았다.
 *
 * enum 안에서 **우리가 실제로 가진 식별자로 부를 수 있는 값은 `LOT` 하나다**
 * (`GOODS_ISSUE_LINE` 은 출고 라인 식별자를 요구하는데 이 화면에 그 값이 없다).
 * 앞선 라벨 화면(`P-01-01`)도 같은 값을 쓴다.
 *
 * ⛔ **그래서 납품 라벨의 조회·발행 대상 식별자는 배분이 아니라 LOT 이다**
 * (`TargetRow.issueTargetId`). 목록의 줄은 여전히 배분 단위다.
 */
export const DELIVERY_TARGET_TYPE_CODE = 'LOT';

/** ⚠ 위와 같은 자리표시다. 포장 라벨의 대상은 취급 단위(`inventory.handling_unit`)다. */
export const PACKING_TARGET_TYPE_CODE = 'HANDLING_UNIT';

/** 계약이 대상 유형을 닫았다(코드 사전 2026-09-03) — 발행 본문과 회차 조회가 같은 형을 쓴다. */
export type LabelTargetTypeCode =
  components['schemas']['DocumentIssueCreate']['targets'][number]['targetTypeCode'];

/** 라벨 종류가 대상 유형을 정한다 — 화면이 둘을 따로 고르게 하지 않는다(스펙 §5-2 ①안). */
export const targetTypeCodeOf = (kind: LabelKind): LabelTargetTypeCode =>
  kind === DELIVERY_LABEL ? DELIVERY_TARGET_TYPE_CODE : PACKING_TARGET_TYPE_CODE;

/**
 * 재발행 사유 값 목록을 받는 코드 그룹.
 *
 * ⛔ 채번 식별자(`codeGroupId`)를 쓰지 않는다 — 환경마다 다르다(계약 명시). 코드로 받는다.
 */
export const REISSUE_REASON_CODE_GROUP = 'REISSUE_REASON';

/** 라벨은 이미지다. 성적서·보고서(`pdf`)는 이 화면의 출력물이 아니다. */
export const RENDITION_FORMAT = 'png';
import type { components } from '@omf-mes/api-client';

type DocumentTargetTypeCode = components['schemas']['DocumentTarget']['targetTypeCode'];
