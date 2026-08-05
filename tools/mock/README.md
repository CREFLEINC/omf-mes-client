# tools/mock — 목 서버

OpenAPI 정본을 Prism으로 그대로 서빙하는 **계약 검증·초기 개발용** 목 서버. 앱이 import하는 코드가 아니라 실행 도구이므로 워크스페이스 패키지가 아니다.

## 사용

```bash
pnpm mock          # 목 서버 실행 (기본 http://127.0.0.1:4010)
pnpm mock:smoke    # 대표 경로 smoke 테스트
```

환경변수:

| 변수 | 기본값 | 뜻 |
| --- | --- | --- |
| `OMF_SPEC_PATH` | `../omf/deliverables/openapi/mdm-기준정보.json` (형제 클론) | OpenAPI 정본 경로 |
| `MOCK_PORT` | `4010` | 목 서버 포트 |

## 정본 규칙

스펙 파일은 설계 저장소(omf-mes)가 정본이며 **이 저장소로 복사하지 않는다** — 복사하면 갱신이 갈린다. 항상 경로 참조로 쓴다.

## 한계 — 상태가 없다

Prism은 example을 반환할 뿐 상태를 갖지 않는다. 생성 후 목록 변화 · Rev 전이 · ETag 충돌 · `STATE_LOCKED` · 오프라인 재전송은 검증할 수 없다. 그 검증이 필요해지는 시점에 상태 기반 Mock을 이 폴더에 추가한다(구조설계 v0.2 §5).
