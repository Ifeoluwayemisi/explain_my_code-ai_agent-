export function cleanText(text: string) {
  if (!text) return "";
  // Remove code fences, Markdown headings, and extra whitespace
  return text.replace(/```[\w]*|#+/g, "").trim();
}

export function chunkText(text: string, maxLength = 2000) {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + maxLength));
    start += maxLength;
  }
  return chunks;
}
