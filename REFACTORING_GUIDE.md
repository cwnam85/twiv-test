# Chat Router 리팩토링 가이드

## 개요

기존의 방대하고 복잡했던 `chat.router.js` 파일을 현업 수준의 깔끔한 구조로 리팩토링했습니다.

## 리팩토링 전후 비교

### 리팩토링 전 문제점

- **단일 파일에 882줄**: 너무 많은 책임이 한 파일에 집중
- **비즈니스 로직과 라우팅 로직 혼재**: 관심사 분리 부족
- **데이터 관리 로직이 라우터에 포함**: 재사용성 부족
- **복잡한 조건문과 중복 코드**: 유지보수 어려움

### 리팩토링 후 개선점

- **서비스 레이어 분리**: 각 기능별로 독립적인 서비스 생성
- **단일 책임 원칙 적용**: 각 클래스가 하나의 책임만 가짐
- **의존성 주입 패턴**: 느슨한 결합으로 테스트 용이성 향상
- **코드 재사용성 증대**: 서비스 간 독립적인 사용 가능

## 새로운 구조

### 1. AffinityService (`src/services/affinityService.js`)

**책임**: 호감도와 포인트 데이터 관리

- 호감도/레벨 로드/저장
- 포인트 차감/증가
- 레벨업/다운 로직
- 데이터 유효성 검증

### 2. CharacterService (`src/services/characterService.js`)

**책임**: 캐릭터 관련 로직 관리

- 활성 캐릭터 정보 관리
- 복장 데이터 로드/변경
- 시스템 프롬프트 관리
- Jailbreak 히스토리 렌더링

### 3. ConversationService (`src/services/conversationService.js`)

**책임**: 대화 기록 관리

- 대화 히스토리 초기화/추가
- Jailbreak 히스토리 관리
- 모델 설정 관리
- 시스템 메시지 처리

### 4. ResponseService (`src/services/responseService.js`)

**책임**: LLM 응답 처리

- 응답 파싱 및 검증
- 구매 요청/완료 처리
- TTS 및 포즈 전송
- 복장 변경 처리

### 5. Refactored Router (`src/routers/chat.router.refactored.js`)

**책임**: HTTP 라우팅만 담당

- 엔드포인트 정의
- 요청/응답 처리
- 서비스 호출 조율

## 사용법

### 기존 코드에서 새 구조로 전환

```javascript
// 기존: 직접 데이터 관리
let affinity = 0;
let level = 1;
let point = 100;

// 새로운 방식: 서비스 사용
import affinityService from '../services/affinityService.js';
const data = affinityService.getData();
affinityService.updateAffinity(10);
```

### 서비스 간 의존성

```javascript
// 서비스들은 서로를 import하여 사용
import characterService from './characterService.js';
import affinityService from './affinityService.js';

// 예: 레벨 변경 시 시스템 프롬프트 업데이트
const result = affinityService.updateAffinity(change);
if (result.levelChanged) {
  characterService.updateSystemPrompt(result.newLevel);
}
```

## 테스트 방법

### 1. 기존 라우터 백업

```bash
cp src/routers/chat.router.js src/routers/chat.router.backup.js
```

### 2. 새 라우터 적용

```bash
# app.js에서 import 경로 변경됨
# src/routers/chat.router.refactored.js 사용
```

### 3. 서버 실행 및 테스트

```bash
npm start
```

## 장점

### 1. 유지보수성

- 각 서비스가 독립적이므로 수정 시 영향 범위 최소화
- 기능별로 파일이 분리되어 찾기 쉬움

### 2. 테스트 용이성

- 각 서비스를 독립적으로 테스트 가능
- Mock 객체 사용으로 단위 테스트 작성 용이

### 3. 확장성

- 새로운 기능 추가 시 해당 서비스만 수정
- 다른 프로젝트에서 서비스 재사용 가능

### 4. 가독성

- 라우터 코드가 간결해져서 이해하기 쉬움
- 각 서비스의 책임이 명확함

## 주의사항

### 1. 환경 변수

- 기존과 동일한 환경 변수 사용
- `ACTIVE_CHARACTER`, `*_OUTFIT` 등

### 2. 데이터 파일

- `affinity.json`, `point.json` 파일 경로 동일
- 기존 데이터 그대로 사용 가능

### 3. 의존성

- 기존 서비스들(`llmService`, `ttsService` 등) 그대로 사용
- 새로운 의존성 추가 없음

## 다음 단계 제안

### 1. 에러 처리 개선

- 각 서비스에 전용 에러 클래스 추가
- 에러 로깅 및 모니터링 강화

### 2. 설정 관리

- 환경별 설정 파일 분리
- 설정 검증 로직 추가

### 3. 로깅 시스템

- 구조화된 로깅 도입
- 로그 레벨별 관리

### 4. 캐싱 전략

- 자주 사용되는 데이터 캐싱
- 성능 최적화

이 리팩토링을 통해 코드의 품질과 유지보수성이 크게 향상되었습니다. 각 서비스는 독립적으로 테스트하고 수정할 수 있으며, 새로운 기능 추가 시에도 기존 코드에 영향을 주지 않고 확장할 수 있습니다.
