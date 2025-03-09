import { z } from "zod";
import { log } from "../utils";

// Configuration for the Gemini API
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "models/gemini-1.5-pro";

// Get API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Define the types for the Gemini API responses and requests
const GeminiResponseSchema = z.object({
  candidates: z.array(
    z.object({
      content: z.object({
        parts: z.array(
          z.object({
            text: z.string()
          })
        )
      })
    })
  )
});

export type GeminiResponse = z.infer<typeof GeminiResponseSchema>;

interface GeminiRequestOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

/**
 * Generates text using the Gemini API
 * @param prompt The prompt to send to Gemini
 * @param options Optional configuration for the request
 * @returns The generated text
 */
export async function generateText(prompt: string, options: GeminiRequestOptions = {}): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  try {
    const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: options.maxTokens || 1024,
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.95,
          topK: options.topK || 40
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log(`Gemini API Error: ${response.status} - ${errorText}`, 'gemini');
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const parsed = GeminiResponseSchema.parse(data);

    // Extract the generated text from the first candidate
    if (parsed.candidates && parsed.candidates.length > 0) {
      const candidate = parsed.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        return candidate.content.parts[0].text;
      }
    }

    throw new Error("No content in the response");
  } catch (error) {
    log(`Error generating text with Gemini: ${error}`, 'gemini');
    throw error;
  }
}


export const gemini = {
  async generateInsights(tweetHistory: string): Promise<{ description: string; topics: string[] }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }

    log("Generating insights from tweet history", 'gemini');

    const promptText = `
    Analyze this Twitter history and provide insights in JSON format:
    {
      "description": "A comprehensive description of the person",
      "topics": ["important topic 1", "important topic 2"]
    }

    Tweet history:
    ${tweetHistory}`;

    log(`Making request to ${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent`, 'gemini');
    try {
      const response = await fetch(`${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`Gemini API request failed with status ${response.status}: ${errorText}`, 'gemini');
        throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      log("Successfully received response from Gemini API", 'gemini');

      try {
        // Parse the response to extract description and topics
        if (data.candidates && data.candidates.length > 0) {
          const textContent = data.candidates[0].content.parts[0].text;
          log(`Raw Gemini response: ${textContent.substring(0, 100)}...`, 'gemini');

          // Try to extract JSON from the response
          const jsonMatch = textContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const jsonStr = jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            return {
              description: parsed.description || "AI couldn't generate a description",
              topics: Array.isArray(parsed.topics) ? parsed.topics : []
            };
          }
        }

        // Fallback if we couldn't parse the response
        return {
          description: "This user appears to be interested in technology and social media.",
          topics: ["Technology", "Social Media"]
        };
      } catch (parseError) {
        log(`Error parsing Gemini response: ${parseError}`, 'gemini');
        return {
          description: "Error parsing AI response. The user appears to be active on social media.",
          topics: ["Social Media"]
        };
      }
    } catch (error) {
      log(`Error in Gemini API call: ${error}`, 'gemini');
      return {
        description: "Unable to analyze the Twitter profile at this time.",
        topics: ["Unknown"]
      };
    }
  },
  async explainArgument(
    userADescription: string,
    userBDescription: string,
    argument: string,
    handleA: string,
    handleB: string
  ): Promise<string> {
    const prompt = `Analyze these two Twitter users and generate a thoughtful synthesis of where their perspectives might meet:

    User @${handleA}: ${userADescription}

    User @${handleB}: ${userBDescription}

    Focus on finding meaningful connection points between these two perspectives. Your response should:
    1. Acknowledge both Twitter handles explicitly
    2. Highlight genuine areas of potential connection and shared understanding
    3. End with a specific, actionable suggestion for how these two users could meaningfully interact or collaborate

    Format your response in paragraphs, making sure to reference both @${handleA} and @${handleB} by their handles, and end with a section titled "Suggested Next Step:" that proposes a concrete way these users could begin interacting.`;

    return generateText(prompt, {
      temperature: 0.7, // Slightly higher temperature for more creative connections
      maxTokens: 1024
    });
  },
  /**
   * Detects the conceptual frame of a given text and translates it to match another user's perspective
   */
  async translateBetweenFrames(
    sourceText: string,
    targetHandle: string
  ): Promise<{
    sourceFrame: string;
    targetFrame: string;
    translation: string;
  }> {
    const prompt = `Analyze the following text and translate it into a different conceptual frame.

Source text:
${sourceText}

First, detect and name the conceptual frame/paradigm of this text (e.g., "woo-woo", "STEM", "academic", "practical", etc.).
Then, translate this text to match @${targetHandle}'s typical communication style and conceptual frame.
Maintain the core meaning but express it in a way that would resonate with ${targetHandle}'s perspective.

Output your response in this exact JSON format:
{
  "sourceFrame": "name of detected frame",
  "targetFrame": "name of target frame",
  "translation": "translated text"
}`;

    const response = await generateText(prompt, {
      temperature: 0.7,
      maxTokens: 1024
    });

    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          sourceFrame: result.sourceFrame,
          targetFrame: result.targetFrame,
          translation: result.translation
        };
      }
      throw new Error("Could not parse JSON from response");
    } catch (error) {
      log(`Error parsing translation response: ${error}`, 'gemini');
      throw error;
    }
  }
};