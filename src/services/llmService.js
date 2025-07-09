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
        const response = completion.choices[0].message.content;
        const usage = {
          input_tokens: completion.usage.input_tokens,
          output_tokens: completion.usage.output_tokens,
        };
        return {
          dialogue: response,
          usage: usage,
        };
      } else {
        throw new Error('Grok API 응답이 유효하지 않습니다.');
      }
    } else if (model === 'claude') {
      const requestBody = {
        model: 'claude-sonnet-4-20250514',
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content[0].text,
        })),
        system: systemPrompt,
        max_tokens: 800,
        stream: false,
      };
      console.log('Claude API Request:', JSON.stringify(requestBody, null, 2));
      // 클로드 api 실제 요청 콘솔

      const response = await claudeClient.messages.create(requestBody);

      if (response && response.content) {
        const content = response.content[0].text;
        // Parse the content if it's a JSON string
        let parsedContent = content;
        try {
          parsedContent = JSON.parse(content);
        } catch (e) {
          // If parsing fails, keep the original content
          console.log('Content is not JSON, using as is');
        }
        const usage = {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        };
        return {
          dialogue: parsedContent,
          usage: usage,
        };
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
