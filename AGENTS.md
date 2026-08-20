# Codex 저장소 지침

- 작업 전에 루트 `CLAUDE.md`를 끝까지 읽는다. 공개 저장소 경계와 기존 `.claude` 개발 하네스가 정책 정본이다.
- 고객사 식별 정보, 실 운영 값, 인프라 정보, 비공개 문서 본문을 코드·설정·보고서·커밋 메타데이터에 넣지 않는다.
- 현재 체크아웃의 worktree 루트 안에서만 작업한다. T1의 `omf-mes-client`를 포함한 다른 worktree 파일을 수정하지 않는다.
- 코드·테스트·개발 문서의 작성·수정·삭제 및 그 후속 수정·재실행에는 `.agents/skills/agent-development-orchestrator/SKILL.md`를 사용한다. 읽기 전용 질문과 상태 조회에는 사용하지 않는다.
- GitHub 이슈 착수 전 `.claude/team.local`을 확인하고 `docs/multi-team-workflow.md`의 팀 라벨·담당자 규칙을 따른다. 이 로컬 파일은 추적하지 않는다.
- Codex 어댑터에 정책 전문을 복제하지 않는다. 판단이 필요하면 `.claude/skills/agent-development-orchestrator/`와 `.claude/agents/`의 해당 문서를 읽는다.
