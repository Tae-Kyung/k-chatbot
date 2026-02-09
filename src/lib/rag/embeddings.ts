import { getOpenAI } from '@/lib/openai/client';
import { EMBEDDING_BATCH_SIZE, EMBEDDING_MAX_INPUT_LENGTH } from '@/config/constants';

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.substring(0, EMBEDDING_MAX_INPUT_LENGTH),
  });
  return response.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const openai = getOpenAI();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE).map((t) => t.substring(0, EMBEDDING_MAX_INPUT_LENGTH));
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}
