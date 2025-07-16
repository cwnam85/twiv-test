/**
 * AI 응답 처리 유틸리티
 * Pre-analysis와 JSON 응답을 깔끔하게 처리
 */

/**
 * mature 태그를 추출하고 분할된 텍스트 반환
 * @param {string} text - 원본 텍스트
 * @returns {object} 분할된 텍스트 배열과 태그 정보
 */
function extractMatureTags(text) {
  const segments = [];
  const tags = [];
  let currentText = '';

  // 정규식으로 태그를 찾되, 위치 정보도 함께 저장
  const tagRegex = /(_kiss_|_moan_|_breath_|_suck_)/g;
  let match;
  let lastIndex = 0;

  while ((match = tagRegex.exec(text)) !== null) {
    // 태그 이전 텍스트 추가
    const beforeTag = text.substring(lastIndex, match.index);
    if (beforeTag.trim()) {
      segments.push({ type: 'text', content: beforeTag.trim() });
    }

    // 태그 추가
    segments.push({ type: 'tag', content: match[0] });
    tags.push(match[0]);

    lastIndex = match.index + match[0].length;
  }

  // 마지막 태그 이후 텍스트 추가
  const afterLastTag = text.substring(lastIndex);
  if (afterLastTag.trim()) {
    segments.push({ type: 'text', content: afterLastTag.trim() });
  }

  // 태그가 없는 경우 전체 텍스트를 하나의 세그먼트로
  if (segments.length === 0) {
    segments.push({ type: 'text', content: text.trim() });
  }

  return {
    segments: segments,
    tags: tags,
  };
}

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
        outfitOn: [],
        outfitOff: [],
        matureTags: [],
        segments: [],
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
        const dialogue = jsonData.dialogue || '';

        // mature 태그 처리
        const { segments, tags } = extractMatureTags(dialogue);

        return {
          dialogue: segments
            .filter((seg) => seg.type === 'text')
            .map((seg) => seg.content)
            .join(' '), // 텍스트 세그먼트만 합치고 공백 추가
          emotion: jsonData.emotion || 'neutral',
          pose: jsonData.pose || 'stand',
          affinity: jsonData.affinity || '0',
          outfitOn: jsonData.outfitOn || [], // 새로운 형식
          outfitOff: jsonData.outfitOff || [], // 새로운 형식
          matureTags: tags,
          segments: segments, // 세그먼트 정보 추가
        };
      } catch (e) {
        console.warn('JSON 파싱 실패, 전체 텍스트 사용:', e.message);
      }
    }

    // 4. JSON이 없는 경우 전체 텍스트를 dialogue로 사용
    const { segments, tags } = extractMatureTags(cleaned.trim());
    return {
      dialogue: segments
        .filter((seg) => seg.type === 'text')
        .map((seg) => seg.content)
        .join(' '), // 텍스트 세그먼트만 합치고 공백 추가
      emotion: 'neutral',
      pose: 'stand',
      affinity: '0',
      outfitOn: [],
      outfitOff: [],
      matureTags: tags,
      segments: segments, // 세그먼트 정보 추가
    };
  } catch (error) {
    console.error('AI 응답 처리 중 오류:', error);
    return {
      dialogue: '응답을 처리할 수 없습니다.',
      emotion: 'neutral',
      pose: 'stand',
      affinity: '0',
      outfitOn: [],
      outfitOff: [],
      matureTags: [],
      segments: [],
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
