export interface AIImageGenerationResult {
  buffer: Buffer;
  mimeType: string;
}

export interface AIProvider {
  generateImage(prompt: string): Promise<AIImageGenerationResult>;
}
