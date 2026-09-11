import type { components } from '@omf-mes/api-client';

/**
 * 이 화면이 **보내고 또 조회 축으로 쓰는** 코드 값 — 확정된 것과 아직 아닌 것을 한 곳에서 가른다.
 *
 * | 값 | 상태 | 근거 |
 * | --- | :-: | --- |
 * | `DELIVERY_LABEL` · `PACKING_LABEL` | ✅ 확정 | 계약 `DocumentIssueCreate.documentTypeCode` enum 9종 · 변경 통지 #700 |
 * | `DELIVERY_TARGET_TYPE_CODE` | ✅ 확정 | P-04-01 §4·공통 출력물 계약 |
 * | `PACKING_TARGET_TYPE_CODE` | ✅ 확정 | P-04-01 §4·공통 출력물 계약 |
 * | `REISSUE_REASON_CODE_GROUP` | ✅ 확정 | 계약이 코드 그룹 코드로 명시 |
 */
import {
  labelRenditionFormat,
  type LabelRenditionFormat,
} from '../../patterns/pop-label-rendition';

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

/**
 * ⛔⛔ **`DELIVERY_LABEL` 발행은 서버가 항상 422 `INVALID` 로 거부한다**(대응표 P1 「공용
 * 문서 발행」· I-27 마감 결정). 대상 유형 `SHIPMENT_LOT_ALLOCATION` 도 계약 enum
 * (`DocumentIssueCreate.targets[].targetTypeCode`)에서 빠졌다(2026-09-11 전달본 · 아래
 * `targetTypeCodeOf` 주석). 그래서 이 문서 유형의 발행 동작 자체를 잠근다 — 종류 선택
 * (`label-kind-radio.tsx`)과 재진입 복구 단추(`screen.tsx`) 둘 다 이 상수를 보고, 참이면
 * `POST /app/document-issues` 를 이 유형으로 부르지 않는다. 서버가 지원을 시작하면 이
 * 상수와 아래 단언(`as unknown as`)을 함께 되돌리면 된다.
 */
export const DELIVERY_LABEL_ISSUE_LOCKED = true;

export type LabelKind = (typeof LABEL_KINDS)[number];

/** 납품 라벨은 출하 LOT 배분 한 건을 대상으로 발행·조회한다. */
export const DELIVERY_TARGET_TYPE_CODE = 'SHIPMENT_LOT_ALLOCATION';

/** 포장 라벨의 대상은 취급 단위(`inventory.handling_unit`)다. */
export const PACKING_TARGET_TYPE_CODE = 'HANDLING_UNIT';

/** 계약이 대상 유형을 닫았다(코드 사전 2026-09-03) — 발행 본문과 회차 조회가 같은 형을 쓴다. */
export type LabelTargetTypeCode =
  components['schemas']['DocumentIssueCreate']['targets'][number]['targetTypeCode'];

/** 라벨 종류가 대상 유형을 정한다 — 화면이 둘을 따로 고르게 하지 않는다(스펙 §5-2 ①안). */
export const targetTypeCodeOf = (kind: LabelKind): LabelTargetTypeCode =>
  kind === DELIVERY_LABEL
    ? /*
       * ⛔⛔ **`SHIPMENT_LOT_ALLOCATION` 이 계약 enum 에서 빠졌다**(생성 타입
       * `DocumentIssueCreate['targets'][number]['targetTypeCode']` · 2026-09-11 전달본 —
       * 대응표 P1 「공용 문서 발행」· I-27 마감 결정: `DELIVERY_LABEL` 은 항상 422 `INVALID`
       * 로 거부한다). 지어낸 값으로 바꾸지 않고(추측 금지) 원래 값을 그대로 두되, 이
       * 문서 유형의 발행 동작 자체를 숨겨(`label-kind-radio.tsx`·`screen.tsx` 의
       * `DELIVERY_LABEL_ISSUE_LOCKED`) 실제로는 이 값이 요청 본문에 실려 나가지 않는다.
       * 서버가 다시 지원하면 계약 enum 이 이 값을 되찾을 것이고, 그때 이 단언을 걷어내면
       * 된다.
       */
      (DELIVERY_TARGET_TYPE_CODE as unknown as LabelTargetTypeCode)
    : PACKING_TARGET_TYPE_CODE;

/**
 * 재발행 사유 값 목록을 받는 코드 그룹.
 *
 * ⛔ 채번 식별자(`codeGroupId`)를 쓰지 않는다 — 환경마다 다르다(계약 명시). 코드로 받는다.
 */
export const REISSUE_REASON_CODE_GROUP = 'REISSUE_REASON';

/** 라벨은 이미지다. 성적서·보고서(`pdf`)는 이 화면의 출력물이 아니다. */
/**
 * 라벨 형식. **셸이 있으면 명령형(`tspl`)** 으로 받아 프린터가 자기 글꼴로 찍게 한다 —
 * 그림으로 받으면 드라이버가 픽셀로 그려, 명령으로 뽑은 라벨과 다른 물건으로 보인다
 * (`patterns/pop-label-rendition` 머리말 · 사용자 지시 2026-09-08).
 */
export const RENDITION_FORMAT: LabelRenditionFormat = labelRenditionFormat();
