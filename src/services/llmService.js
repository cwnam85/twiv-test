import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const grokApiKey = process.env.GROK_API_KEY;
const claudeApiKey = process.env.ANTHROPIC_API_KEY;

const grokClient = new OpenAI({
  apiKey: grokApiKey,
  baseURL: 'https://api.x.ai/v1',
});

const claudeClient = new Anthropic({
  apiKey: claudeApiKey,
});

export async function getLLMResponse(messages, model = 'grok', systemPrompt) {
  try {
    if (model === 'grok') {
      const completion = await grokClient.chat.completions.create({
        model: 'grok-2-1212',
        messages,
      });

      if (completion && completion.choices && completion.choices.length > 0) {
        return completion.choices[0].message.content;
      } else {
        throw new Error('Grok API 응답이 유효하지 않습니다.');
      }
    } else if (model === 'claude') {
      // Claude API 형식에 맞게 메시지 변환
      const claudeMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));

      const stream = await claudeClient.messages.create({
        model: "claude-3-5-sonnet-20240620",
        messages: claudeMessages,
        max_tokens: 400,
        system: systemPrompt,
        stream: true
      });

      let fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
          fullResponse += chunk.delta.text;
        }
      }

      if (fullResponse) {
        return fullResponse;
      } else {
        throw new Error('Claude API 응답이 유효하지 않습니다.');
      }
    } else {
      throw new Error('지원하지 않는 모델입니다.');
    }
  } catch (error) {
    console.error(`Error calling ${model} API:`, error);
    throw error;
  }
}
