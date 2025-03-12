import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const grokApiKey = process.env.GROK_API_KEY;
const grokClient = new OpenAI({
  apiKey: grokApiKey,
  baseURL: 'https://api.x.ai/v1',
});

export async function getLLMResponse(messages) {
  try {
    const completion = await grokClient.chat.completions.create({
      model: 'grok-2-1212',
      messages,
    });

    if (completion && completion.choices && completion.choices.length > 0) {
      return completion.choices[0].message.content;
    } else {
      throw new Error('Grok API 응답이 유효하지 않습니다.');
    }
  } catch (error) {
    console.error('Error calling Grok API:', error);
    throw error;
  }
}
