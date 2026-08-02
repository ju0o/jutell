## Phase 2. Codex Skill로 분리

AGENTS.md가 효과가 있으면, 모든 프로젝트에 긴 지침을 복사하지 않도록 Skill로 분리한다.

OpenAI 공식 구조상 Skill은 필수 SKILL.md와 선택적인 scripts/, references/로 구성된다. 
Codex는 처음에는 Skill의 이름과 설명만 확인하고, 필요하다고 판단할 때 전체 지침을 불러오는 방식으로 컨텍스트를 관리한다.

# 목표 구조

```

codex-beginner-bridge/
├─ AGENTS.md
├─ .agents/
│  └─ skills/
│     └─ beginner-bridge/
│        ├─ SKILL.md
│        ├─ references/
│        │  ├─ beginner-glossary-ko.md
│        │  ├─ report-format.md
│        │  ├─ file-role-guide.md
│        │  └─ risk-level-guide.md
│        └─ scripts/
│           ├─ collect-git-diff.mjs
│           ├─ collect-changed-files.mjs
│           └─ validate-report.mjs
├─ docs/
│  ├─ PRODUCT_SCOPE.md
│  ├─ ARCHITECTURE.md
│  ├─ TEST_SCENARIOS.md
│  └─ DECISIONS.md
├─ tests/
│  ├─ fixtures/
│  └─ skill-behavior/
├─ package.json
└─ README.md

```

# 역할 구분
AGENTS.md

항상 지켜야 하는 짧은 규칙만 넣는다.

```

- 작업 결과는 비개발자가 이해할 수 있게 보고한다.
- beginner-bridge Skill을 사용한다.
- 작업하지 않은 결과를 완료했다고 쓰지 않는다.

```

SKILL.md

구체적인 작업 절차를 넣는다.

```

변경 파일 확인
→ Git diff 확인
→ 기능별 분류
→ 어려운 용어 변환
→ 사용자 화면 변화 설명
→ 위험도 계산
→ 테스트 목록 작성
→ 최종 보고서 생성

```

references

필요할 때만 읽을 상세 기준을 넣는다.

scripts

모델의 추측이 아니라 Git에서 사실을 가져오는 역할이다.

