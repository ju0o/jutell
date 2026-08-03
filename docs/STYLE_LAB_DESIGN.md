# Style Lab 설계 (문서·데이터 구조만)

## 이 문서는 무엇을 설명하나요?

Style Lab은 보고서 말투를 사용자가 고른 프리셋으로 바꾸는 선택형 기능의 설계 문서입니다. 이 단계에서는 **설계 문서와 로컬 데이터 구조만** 정의합니다. AI 학습이나 스타일 생성 엔진은 구현하지 않습니다.

## 현재 상태

- 설계 문서: 이 문서
- 데이터 구조: 아래 정의만 하며 아직 생성하지 않습니다.
- 구현: 없음. 관리자 화면 토글, CLI 옵션, 스타일 생성기는 구현하지 않습니다.
- 실제 사용 기준: 개인 베타에서 "말투가 어렵거나 딱딱하다"는 확인된 피드백이 쌓이기 전에는 프리셋을 늘리지 않습니다.

## JUTELL_STYLE.md와의 관계

[JUTELL_STYLE.md](JUTELL_STYLE.md)는 말투 정책(기본 스타일, JuTell Style 예시, voice.preset 준비 단계)을 정의합니다. Style Lab은 그 정책을 로컬 데이터로 표현하고 나중에 선택형으로 적용하기 위한 설계입니다.

- 기본 스타일: 모든 사용자에게 적용되는 공식 정책
- Style Lab 프리셋: 사용자가 선택하면 보고서 말투만 바꾸는 옵션
- `voice.preset`은 호환을 위해 유지하며 Style Lab과 별개로 동작합니다.

## 데이터 구조 (아직 생성하지 않음)

제안 위치: `.jutell-local/style-lab/style-lab.json` (로컬 전용, 원격 전송 없음)

```jsonc
{
  "version": 1,
  "presets": [
    {
      "id": "jutell",
      "label": "JuTell Style",
      "description": "핵심부터 친근하게 말하지만 사실과 위험은 그대로 남깁니다.",
      "guide": "문장을 짧게 하고 핵심부터 말하며, 어려운 말은 쉬운 예를 붙입니다.",
      "status": "draft"
    }
  ],
  "profileMapping": {
    "balanced": "jutell",
    "learning": "jutell"
  },
  "safetyRules": {
    "protectedSections": [
      "실패와 오류",
      "중요한 미확인 사항",
      "범위 밖 변경",
      "데이터 손실·보안 위험"
    ],
    "protectedFields": [
      "확인 상태",
      "근거 출처",
      "사용자 행동 안내"
    ]
  }
}
```

## 데이터 규칙

- 프리셋은 사용자가 직접 고를 때만 적용됩니다. 기본값을 바꾸지 않습니다.
- 프리셋을 바꾸어도 보호 항목(위 JSON의 `safetyRules`)은 생략하거나 축소할 수 없습니다.
- 원래 용어, 근거 출처, 확인 상태, 위험과 사용자 행동은 [GLOSSARY_POLICY.md](GLOSSARY_POLICY.md)와 [BEGINNER_REPORT_SPEC.md](BEGINNER_REPORT_SPEC.md) 기준을 그대로 따릅니다.
- 예시 문장과 기준 문구는 비공개 연구 기록([PRIVATE_DOCUMENTS_MAP.md](PRIVATE_DOCUMENTS_MAP.md)의 STYLE_RESEARCH_NOTES)에서 가져오지 않고, 공개 가능한 문장만 사용합니다.

## 이후 순서 (피드백 후 판단)

1. 개인 베타에서 말투 관련 실제 불편 사례를 기록합니다.
2. 반복되는 패턴이 확인되면 프리셋 가이드 문구를 다듬고 로컬 데이터를 생성합니다.
3. 관리자 화면 토글과 보고서 적용은 그 이후 별도 결정으로 진행합니다.

지금은 위 순서를 위한 설계만 존재하며, 기능으로 주장하지 않습니다.
