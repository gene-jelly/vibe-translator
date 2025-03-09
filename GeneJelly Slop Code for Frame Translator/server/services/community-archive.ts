import { z } from "zod";
import { log } from "../utils";
import { CommunityArchive } from "../../shared/schema";

const TweetSchema = z.object({
  tweet_id: z.string(),
  full_text: z.string(),
  created_at: z.string(),
  favorite_count: z.number(),
  account_id: z.string(),
  retweet_count: z.number().nullable().optional(),
  reply_to_tweet_id: z.string().nullable().optional(),
  reply_to_user_id: z.string().nullable().optional(),
  reply_to_username: z.string().nullable().optional(),
  fts: z.string().nullable().optional(),
  archive_upload_id: z.number().optional(),
  updated_at: z.string().optional()
});

export type Tweet = z.infer<typeof TweetSchema>;

class CommunityArchiveAPI {
  private baseUrl: string;

  constructor() {
    const apiUrl = process.env.COMMUNITY_ARCHIVE_API_URL;
    if (!apiUrl) {
      throw new Error('COMMUNITY_ARCHIVE_API_URL environment variable is required');
    }
    this.baseUrl = apiUrl;
    log(`Initialized Community Archive API with base URL: ${this.baseUrl}`, 'community-archive');
  }

  async getUserProfile(handle: string): Promise<{tweets: Tweet[], topics: string[]}> {
    try {
      const cleanHandle = handle.replace(/^@+/, '');
      log(`Fetching profile data for: ${cleanHandle}`, 'community-archive');

      // Get recent popular tweets
      const tweets = await this.getRecentPopularTweets(cleanHandle);

      // Extract topics from full-text search data
      const topics = new Set<string>();
      tweets.forEach(tweet => {
        if (tweet.fts) {
          // Extract meaningful words from the FTS field
          const words = tweet.fts.split("'")
            .filter(word => word.length > 3) // Filter out short words
            .filter(word => !['behind', 'after', 'before', 'could', 'would'].includes(word)); // Filter common words
          words.forEach(word => topics.add(word));
        }
      });

      return {
        tweets,
        topics: Array.from(topics)
      };
    } catch (error) {
      log(`Error getting user profile: ${error}`, 'community-archive');
      throw error;
    }
  }

  async getRecentPopularTweets(handle: string, limit: number = 25): Promise<Tweet[]> {
    try {
      const cleanHandle = handle.replace(/^@+/, '');
      log(`Attempting to fetch tweets for handle: ${cleanHandle}`, 'community-archive');

      const response = await fetch(`${this.baseUrl}/rest/v1/tweets?select=*&order=favorite_count.desc&limit=${limit}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_KEY || '',
          'Authorization': `Bearer ${process.env.SUPABASE_KEY || ''}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        log(`API Error: ${response.status} - ${errorText}`, 'community-archive');
        throw new Error(`Failed to fetch tweets: ${response.statusText}`);
      }

      const data = await response.json();
      log(`Successfully fetched tweets for ${cleanHandle}`, 'community-archive');

      const tweets = z.array(TweetSchema).parse(data);
      return tweets;
    } catch (error) {
      log(`Error in getRecentPopularTweets: ${error}`, 'community-archive');
      throw error;
    }
  }

  // Mock data for testing
  private generateMockTweets(count: number): Tweet[] {
    return Array.from({ length: count }, (_, i) => ({
      tweet_id: `mock-${i}`,
      full_text: `This is a mock tweet ${i}`,
      created_at: new Date().toISOString(),
      favorite_count: Math.floor(Math.random() * 100),
      account_id: "mock-account",
      retweet_count: Math.floor(Math.random() * 50),
      reply_to_tweet_id: null,
      reply_to_user_id: null,
      reply_to_username: null,
      fts: null,
      archive_upload_id: i,
      updated_at: new Date().toISOString()
    }));
  }

  async getTweets(userId: string, limit: number = 10) {
    return this.generateMockTweets(limit);
  }

  async getArchive(id: string): Promise<CommunityArchive | null> {
    try {
      // Implementation would go here
      return null;
    } catch (error) {
      console.error('Error fetching archive:', error);
      return null;
    }
  }

  async createArchive(archive: Partial<CommunityArchive>): Promise<CommunityArchive | null> {
    try {
      // Implementation would go here
      return null;
    } catch (error) {
      console.error('Error creating archive:', error);
      return null;
    }
  }
}

export const communityArchive = new CommunityArchiveAPI();