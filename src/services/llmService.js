import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import shopService from './shopService.js';

dotenv.config();

const claudeApiKey = process.env.ANTHROPIC_API_KEY;

const claudeClient = new Anthropic({
  apiKey: claudeApiKey,
});

/**
 * Creates a tool definition for structured character responses
 * @param {number} currentAffinity - Current affinity level to determine if outfitAction should be available
 * @returns {object} Tool definition with conditional schema
 */
function createChatResponseTool(currentAffinity) {
  const baseSchema = {
    type: 'object',
    properties: {
      dialogue: {
        type: 'string',
        description:
          "The character's spoken words. Minimum 30 characters, maximum 200 characters (Korean).",
      },
      narration: {
        type: 'string',
        description:
          "Description of character's physical actions, gestures, and body language. Maximum 150 characters.",
      },
      inner_thoughts: {
        type: 'string',
        description: "Character's internal thoughts in first-person. Maximum 100 characters.",
      },
      emotion: {
        type: 'string',
        enum: [
          'Neutral',
          'Happy',
          'Funny',
          'Affectionate',
          'Annoyed',
          'Sad',
          'Embarrassed',
          'Dominating',
          'Aroused',
          'Angry',
        ],
        description: "Character's current emotion from the allowed list.",
      },
      pose: {
        type: 'string',
        description: "Character's current pose from the allowed pose list.",
      },
      action: {
        type: 'string',
        description: "Character's current action from the allowed action list.",
      },
      affinity: {
        type: 'string',
        description: "Affinity change value (e.g., '+3', '0', '-3')",
      },
      spot: {
        type: 'string',
        description: 'Current location spot. Only include when location changes.',
      },
    },
    required: ['dialogue', 'narration', 'inner_thoughts', 'emotion', 'pose', 'action', 'affinity'],
  };

  // affinity >= 100일 때만 outfitAction 필드 추가
  if (currentAffinity >= 100) {
    baseSchema.properties.outfitAction = {
      type: 'string',
      enum: ['Dress', 'Undress'],
      description:
        "Outfit change command. ONLY include this field when user explicitly requests outfit change. 'Undress' removes all clothing except panties. 'Dress' puts all clothing back on.",
    };
    console.log(`[TOOL SCHEMA] outfitAction field ENABLED (affinity: ${currentAffinity})`);
  } else {
    console.log(`[TOOL SCHEMA] outfitAction field DISABLED (affinity: ${currentAffinity})`);
  }

  return {
    name: 'respond_as_character',
    description:
      'Generate a character response in the structured format with dialogue, narration, inner thoughts, emotion, pose, action, and affinity. This tool ensures proper JSON structure and type validation.',
    input_schema: baseSchema,
  };
}

export async function getLLMResponse(
  messages,
  model = 'claude',
  systemPrompt,
  currentAffinity = 0,
) {
  // RP팩 활성화 상태에 따라 max_tokens 조정
  const activeRpPack = shopService.getActiveRpPack();
  const maxTokens = activeRpPack ? 2000 : 800;

  try {
    // Tool 정의 생성 (affinity에 따라 동적으로 스키마 생성)
    const chatTool = createChatResponseTool(currentAffinity);

    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content[0].text,
      })),
      max_tokens: maxTokens,
      stream: false,
      tools: [chatTool], // Tool 추가
      tool_choice: {
        // 항상 이 도구 사용하도록 강제
        type: 'tool',
        name: 'respond_as_character',
      },
    };

    // systemPrompt가 유효한 경우에만 추가
    if (systemPrompt && systemPrompt.trim()) {
      requestBody.system = systemPrompt;
    }
    console.log('Claude API Request with Tools:', JSON.stringify(requestBody, null, 2));

    const response = await claudeClient.messages.create(requestBody);

    // Tool use 응답 처리
    if (response && response.content) {
      const toolUseBlock = response.content.find((block) => block.type === 'tool_use');

      if (toolUseBlock) {
        console.log('✅ Tool Use Response:', JSON.stringify(toolUseBlock.input, null, 2));

        const usage = {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        };

        // Tool use의 input을 JSON 문자열로 변환하여 기존 파싱 로직과 호환
        return {
          dialogue: JSON.stringify(toolUseBlock.input),
          usage: usage,
        };
      } else {
        // Fallback: 기존 텍스트 응답 처리
        console.warn('⚠️ No tool_use block found, falling back to text response');
        const content = response.content[0].text;
        const usage = {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        };
        return {
          dialogue: content,
          usage: usage,
        };
      }
    } else {
      throw new Error('Claude API 응답이 유효하지 않습니다.');
    }
  } catch (error) {
    console.error(`Error calling Claude API:`, error);
    throw error;
  }
}
