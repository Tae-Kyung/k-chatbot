export interface TextChunk {
  content: string;
  metadata: {
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export function chunkText(
  text: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    separator?: string;
  } = {}
): TextChunk[] {
  const {
    chunkSize = 500,
    chunkOverlap = 50,
    separator = '\n\n',
  } = options;

  const chunks: TextChunk[] = [];

  // Split by separator first (paragraphs)
  const paragraphs = text.split(separator).filter((p) => p.trim().length > 0);

  let currentChunk = '';
  let currentStartChar = 0;
  let charOffset = 0;
  let chunkIndex = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);

    if (currentChunk.length > 0 && (currentChunk + ' ' + paragraph).split(/\s+/).length > chunkSize) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        metadata: {
          chunkIndex,
          startChar: currentStartChar,
          endChar: charOffset,
        },
      });
      chunkIndex++;

      // Overlap: keep the last N words
      const currentWords = currentChunk.split(/\s+/);
      const overlapWords = currentWords.slice(-chunkOverlap);
      currentChunk = overlapWords.join(' ') + ' ' + paragraph;
      currentStartChar = charOffset - overlapWords.join(' ').length;
    } else {
      if (currentChunk.length === 0) {
        currentStartChar = charOffset;
      }
      currentChunk += (currentChunk.length > 0 ? ' ' : '') + paragraph;
    }

    charOffset += paragraph.length + separator.length;
  }

  // Don't forget the last chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        chunkIndex,
        startChar: currentStartChar,
        endChar: charOffset,
      },
    });
  }

  // Handle case where single paragraph is too long
  const result: TextChunk[] = [];
  for (const chunk of chunks) {
    const words = chunk.content.split(/\s+/);
    if (words.length > chunkSize * 1.5) {
      // Split oversized chunks
      let i = 0;
      let subIndex = 0;
      while (i < words.length) {
        const subChunk = words.slice(i, i + chunkSize).join(' ');
        result.push({
          content: subChunk,
          metadata: {
            chunkIndex: chunk.metadata.chunkIndex * 100 + subIndex,
            startChar: chunk.metadata.startChar,
            endChar: chunk.metadata.endChar,
          },
        });
        i += chunkSize - chunkOverlap;
        subIndex++;
      }
    } else {
      result.push(chunk);
    }
  }

  return result;
}
