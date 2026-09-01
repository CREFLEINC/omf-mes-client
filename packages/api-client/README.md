# @omf-mes/api-client

OpenAPI 계약 기반 클라이언트. 소유 범위:

- OpenAPI에서 생성된 요청·응답 타입(DTO)
- HTTP 요청 처리
- API 오류 정규화 (409 저장 충돌 ↔ 400 `STATE_LOCKED` 구분 등)
- `ETag` / `If-Match` 낙관적 잠금 규약
- `Idempotency-Key` 멱등 규약
- 서버 DTO ↔ 도메인 모델 변환

**허용 의존: `@omf-mes/domain`만.**

계약 정본은 설계 저장소(omf-mes)의 `design/wiki/api-contracts/openapi/` 아래에 도메인별로 갈려 있다 — 이 저장소로 복사하지 않는다(`tools/mock/README.md` 참조).
