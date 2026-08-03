# 비공개 문서 지도 (PRIVATE_DOCUMENTS_MAP)

이 문서는 어떤 문서를 비공개 저장소에 보관해야 하는지 안내한다.
비밀 내용 자체는 포함하지 않는다.

## 보관 대상 종류

- 구체적인 수익 목표와 가격 전략
- 유료 전환·경쟁사 대응 전략
- 아직 공개하지 않을 Premium 기능 목록과 우선순위
- 중앙 서버 도입 시점의 내부 판단
- 사용자 행동 데이터 분석 전략과 내부 KPI
- 개인적인 장기 사업 방향
- 미공개 마케팅 계획
- 운영자 개인 메모
- Beta Journal·Style Lab 원본 기록

## 권장 저장소 이름

```text
jutell-private
```

## 권장 폴더 구조

```text
jutell-private/
├── strategy/     # 사업·가격·경쟁 전략
├── product/      # 미공개 Premium·기능 우선순위
├── cloud/        # 중앙 서버·Cloud 도입 판단
├── research/     # 사용자 행동 분석·내부 KPI
└── operations/   # 개인 메모·마케팅 계획·베타 원본
```

## 공개 저장소에서 제거되어 이동 대기 중인 파일

| 파일 | 분류 사유 | 이동 목적지 |
|---|---|---|
| `planner/Phase 8. Plugin·MCP·수익화.md` | 내부 사업·출시 전략: 무료/유료 기능 구분, 중앙 서버 도입 시점, 유료 전환 시점 | `jutell-private/strategy/` |

이 파일들은 2026-08-03 운영자 승인으로 공개 저장소에서 제거했다.
내용은 운영자 로컬에 보관되어 있으며, 운영자가 `jutell-private` 저장소로 이동할 때까지 공개 저장소에 다시 넣지 않는다.

## 공개 문서와 비공개 문서의 연결 방식

- 공개 문서는 공개 원칙만 담는다. 예: `docs/foundation/BUSINESS_MODEL.md`는 원칙 5개만.
- 비공개 상세는 공개 저장소에 넣지 않는다.
- 필요하면 비공개 저장소의 문서 제목만 공개 문서에 목록으로 남길 수 있지만, 내용이나 경로는 참조하지 않는다.

## 공개 저장소에서 비공개 파일을 참조하지 않는 원칙

- 공개 문서에서 `jutell-private` 저장소의 파일 경로를 링크하지 않는다.
- 공개 저장소에 `.jutell-private/`, `private/`, `docs/private/`, `*.private.md`, `*.internal.md` 파일을 만들지 않는다. (실수 방지 패턴은 `.gitignore`에 보강)
- 비공개 내용이 공개 커밋에 섞일 위험이 있으면 `npm run check:public`으로 확인한다.
