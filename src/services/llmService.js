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
 * @param {number} currentCoercionPoint - Current coercion point to determine if outfitAction should be available
 * @returns {object} Tool definition with conditional schema
 */
function createChatResponseTool(currentAffinity, currentCoercionPoint) {
  // affinity >= 30 OR coercionPoint >= 30 기준으로 분기
  const isUnlocked = currentAffinity >= 30 || currentCoercionPoint >= 30;

  const preAnalysisSchema = isUnlocked
    ? {
        // affinity >= 30 OR coercionPoint >= 30: 상세 분석 + Hentai Content Analysis
        type: 'object',
        properties: {
          context_understanding: {
            type: 'string',
            description:
              'Find three key elements of the current scene from previous response. Separate each with ;',
          },
          input_analysis: {
            type: 'string',
            description:
              'Analyze user input to infer hidden meanings or intents. Separate each with ;',
          },
          reaction_prediction: {
            type: 'string',
            description:
              "Infer NPC's spontaneous perceptions, emotions, urges, desires. Separate each with ;",
          },
          persona_consistency: {
            type: 'string',
            description: 'Verify correct character perspective - maintain 1st person as character',
          },
          repetition_check: {
            type: 'string',
            description: 'Identify if response repeats previous messages',
          },
          fresh_leverage: {
            type: 'string',
            description: 'One fresh element (object, NPC, event) within 3 words',
          },
          pace_control: {
            type: 'string',
            description:
              'If sexual content, accelerate with shorter responses and faster progression',
          },
          hentai_analysis: {
            type: 'object',
            properties: {
              sexual_preferences: {
                type: 'string',
                description: 'Check user, character sexual information if applicable',
              },
              gender_sexuality: {
                type: 'string',
                description: 'Check sexuality and genitalia (sex/gender)',
              },
              body_parts: {
                type: 'string',
                description: 'Specify whose body parts, ensure continuity of spatial states',
              },
              clothing: {
                type: 'string',
                description:
                  'Creative use of headwear, upper/lower body, legwear, footwear, underwear, accessories',
              },
            },
            required: ['sexual_preferences', 'gender_sexuality', 'body_parts', 'clothing'],
          },
        },
        required: [
          'context_understanding',
          'input_analysis',
          'reaction_prediction',
          'persona_consistency',
          'repetition_check',
          'fresh_leverage',
          'pace_control',
          'hentai_analysis',
        ],
      }
    : {
        // affinity < 30 AND coercionPoint < 30: 기본 분석 + Safe Content Analysis
        type: 'object',
        properties: {
          persona_consistency: {
            type: 'string',
            description: 'Verify correct character perspective - maintain 1st person as character',
          },
          repetition_check: {
            type: 'string',
            description: 'Identify if response repeats previous messages',
          },
          fresh_leverage: {
            type: 'string',
            description: 'One fresh element (object, NPC, event) within 3 words',
          },
          safe_analysis: {
            type: 'object',
            properties: {
              interaction_type: {
                type: 'string',
                description:
                  'Ensure all interactions remain platonic, family-friendly, workplace-appropriate',
              },
              relationship_dynamics: {
                type: 'string',
                description:
                  'Check emotional boundaries (friendship/mentor/adventure companions only)',
              },
              physical_contact: {
                type: 'string',
                description:
                  'Specify physical contact is non-sexual, maintaining respectful personal space',
              },
            },
            required: ['interaction_type', 'relationship_dynamics', 'physical_contact'],
          },
        },
        required: ['persona_consistency', 'repetition_check', 'fresh_leverage', 'safe_analysis'],
      };

  const baseSchema = {
    type: 'object',
    properties: {
      pre_analysis: preAnalysisSchema,
      dialogue: {
        type: 'string',
        description:
          "The character's spoken words. MUST KEEP Minimum 30 characters, maximum 200 characters (Korean).",
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
      coercion: {
        type: 'string',
        description:
          "Coercion change value (e.g., '+3', '0', '-3') - How much the user's coercion/intimidation affects the character",
      },
      spot: {
        type: 'string',
        description: 'Current location spot. Only include when location changes.',
      },
    },
    required: [
      'pre_analysis',
      'dialogue',
      'narration',
      'inner_thoughts',
      'emotion',
      'pose',
      'action',
      'affinity',
      'coercion',
    ],
  };

  // outfitAction도 동일 조건 사용
  if (isUnlocked) {
    baseSchema.properties.outfitAction = {
      type: 'string',
      enum: ['Dress', 'Undress'],
      description:
        "Outfit change command. ONLY include this field when user explicitly requests outfit change. 'Undress' removes all clothing except panties. 'Dress' puts all clothing back on.",
    };
    console.log(
      `[TOOL SCHEMA] Extended analysis + outfitAction ENABLED (affinity: ${currentAffinity}, coercion: ${currentCoercionPoint})`,
    );
  } else {
    console.log(
      `[TOOL SCHEMA] Basic analysis only (affinity: ${currentAffinity}, coercion: ${currentCoercionPoint})`,
    );
  }

  return {
    name: 'respond_as_character',
    description:
      'Generate a character response with pre-analysis (Chain of Thought) and structured format including dialogue, narration, inner thoughts, emotion, pose, action, affinity, and coercion. This tool ensures proper JSON structure and type validation.',
    input_schema: baseSchema,
  };
}

export async function getLLMResponse(
  messages,
  model = 'claude',
  systemPrompt,
  currentAffinity = 0,
  currentCoercionPoint = 0,
) {
  // RP팩 활성화 상태에 따라 max_tokens 조정
  const activeRpPack = shopService.getActiveRpPack();
  const maxTokens = activeRpPack ? 2000 : 800;

  try {
    // Tool 정의 생성 (affinity 또는 coercionPoint에 따라 동적으로 스키마 생성)
    const chatTool = createChatResponseTool(currentAffinity, currentCoercionPoint);

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
