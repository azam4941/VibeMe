import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  // Sensitive keywords for moderation (Example: detecting abuse, adult content, escort services)
  private readonly forbiddenKeywords = [
    'escort', 'porn', 'xxx', 'nude', 'naked', 'call girl', 'gigolo',
    'money hack',
  ];

  /**
   * Moderates a text message.
   * In a real-world scenario, this would call an external AI API like:
   * - Google Perspective API
   * - OpenAI Moderation API
   * - AWS Rekognition/Azure Content Moderator
   * 
   * @param text The message text to moderate
   * @returns { isFlagged: boolean; reason?: string }
   */
  async moderateMessage(text: string): Promise<{ isFlagged: boolean; reason?: string }> {
    const lowercaseText = text.toLowerCase();

    // 1. Simple Keyword Matching (Fast check)
    for (const keyword of this.forbiddenKeywords) {
      if (lowercaseText.includes(keyword)) {
        this.logger.warn(`Message flagged for keyword: ${keyword}`);
        return { isFlagged: true, reason: `Content contains forbidden keyword: ${keyword}` };
      }
    }

    // 2. Pattern Matching (Regex) for more complex cases
    // Example: detecting phone numbers in messages if restricted, or specific patterns
    // const phoneRegex = /\b\d{10}\b/;
    // if (phoneRegex.test(text)) { ... }

    // 3. AI Moderation (Simulated)
    // Here we can simulate a more advanced AI check
    if (this.isToxic(lowercaseText)) {
      return { isFlagged: true, reason: 'AI detected toxic or inappropriate content.' };
    }

    return { isFlagged: false };
  }

  private isToxic(text: string): boolean {
    // Simulated AI logic for toxic content detection
    // In reality, this would be a machine learning model
    const toxicPatterns = [
      /i will (kill|hurt|beat) you/i,
      /you are (worthless|trash|garbage)/i,
      /give me your (address|location|pin)/i, // Privacy protection
    ];

    return toxicPatterns.some(pattern => pattern.test(text));
  }
}
