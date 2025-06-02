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
      const requestBody = {
        model: 'grok-2-1212',
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content[0].text,
        })),
      };
      console.log('Grok API Request:', JSON.stringify(requestBody, null, 2));

      const completion = await grokClient.chat.completions.create(requestBody);

      if (completion && completion.choices && completion.choices.length > 0) {
        return completion.choices[0].message.content;
      } else {
        throw new Error('Grok API 응답이 유효하지 않습니다.');
      }
    } else if (model === 'claude') {
      const requestBody = {
        model: 'claude-3-5-sonnet-20240620',
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content[0].text,
        })),
        system: systemPrompt,
        max_tokens: 400,
        stream: true,
      };
      console.log('Claude API Request:', JSON.stringify(requestBody, null, 2));

      const stream = await claudeClient.messages.create(requestBody);

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
