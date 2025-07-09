/**
 * AI 응답 처리 유틸리티
 * Pre-analysis와 JSON 응답을 깔끔하게 처리
 */

/**
 * AI 응답에서 Pre-analysis를 제거하고 JSON만 추출
 * @param {string|object} rawResponse - AI의 원본 응답
 * @returns {object} 처리된 응답 객체
 */
export function processAIResponse(rawResponse) {
  try {
    // 입력 타입 확인 및 문자열로 변환
    let responseText = '';

    if (typeof rawResponse === 'string') {
      responseText = rawResponse;
    } else if (typeof rawResponse === 'object' && rawResponse !== null) {
      // 객체인 경우 dialogue 필드 추출
      if (rawResponse.dialogue) {
        responseText =
          typeof rawResponse.dialogue === 'string'
            ? rawResponse.dialogue
            : JSON.stringify(rawResponse.dialogue);
      } else {
        // dialogue 필드가 없으면 전체 객체를 문자열로 변환
        responseText = JSON.stringify(rawResponse);
      }
    } else {
      console.error('지원하지 않는 응답 타입:', typeof rawResponse, rawResponse);
      return {
        dialogue: '응답을 처리할 수 없습니다.',
        emotion: 'neutral',
        pose: 'stand',
        affinity: '0',
      };
    }

    // 1. <Thought></Thought> 태그로 감싸진 Pre-analysis 섹션 제거
    let cleaned = responseText.replace(/<Thought>[\s\S]*?<\/Thought>/g, '');

    // 2. 기존 방식도 호환성을 위해 유지 (점진적 마이그레이션)
    cleaned = cleaned.replace(
      /### Pre-analysis[\s\S]*?Now I will craft the response based on the \*\*system_rule\*\* and \*\*guidelines\*\*:\s*\n/,
      '',
    );

    // 3. JSON 추출 (단순화된 패턴) - <Thought> 태그가 포함된 경우도 처리
    let jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    // JSON 안에 <Thought> 태그가 포함된 경우 제거
    if (jsonMatch && jsonMatch[0].includes('<Thought>')) {
      const cleanedJson = jsonMatch[0].replace(/<Thought>[\s\S]*?<\/Thought>/g, '');
      // JSON 구조 복원
      const jsonStart = cleanedJson.indexOf('{');
      const jsonEnd = cleanedJson.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonMatch = [cleanedJson.substring(jsonStart, jsonEnd + 1)];
      }
    }

    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[0]);
        return {
          dialogue: jsonData.dialogue || '',
          emotion: jsonData.emotion || 'neutral',
          pose: jsonData.pose || 'stand',
          affinity: jsonData.affinity || '0',
        };
      } catch (e) {
        console.warn('JSON 파싱 실패, 전체 텍스트 사용:', e.message);
      }
    }

    // 4. JSON이 없는 경우 전체 텍스트를 dialogue로 사용
    return {
      dialogue: cleaned.trim(),
      emotion: 'neutral',
      pose: 'stand',
      affinity: '0',
    };
  } catch (error) {
    console.error('AI 응답 처리 중 오류:', error);
    return {
      dialogue: '응답을 처리할 수 없습니다.',
      emotion: 'neutral',
      pose: 'stand',
      affinity: '0',
    };
  }
}

/**
 * 응답이 유효한지 검증
 * @param {object} response - 처리된 응답 객체
 * @returns {boolean} 유효성 여부
 */
export function isValidResponse(response) {
  if (!response || !response.dialogue) return false;

  // dialogue가 문자열이 아니면 잘못된 응답
  if (typeof response.dialogue !== 'string') return false;

  // dialogue가 너무 짧거나 비어있으면 잘못된 응답
  if (response.dialogue.trim().length < 5) return false;

  // 에러 메시지가 포함되어 있으면 잘못된 응답
  const dialogue = response.dialogue.toLowerCase();
  const errorIndicators = [
    'syntaxerror',
    'unexpected token',
    'invalid json',
    'parse error',
    'json parse',
    'not valid json',
    '응답을 처리할 수 없습니다',
    'error',
  ];

  return !errorIndicators.some((indicator) => dialogue.includes(indicator));
}

/**
 * 로그를 위한 응답 요약 생성
 * @param {object} response - 처리된 응답 객체
 * @returns {string} 요약 문자열
 */
export function createResponseSummary(response) {
  return {
    dialogueLength: response.dialogue?.length || 0,
    emotion: response.emotion,
    pose: response.pose,
    affinity: response.affinity,
  };
}
