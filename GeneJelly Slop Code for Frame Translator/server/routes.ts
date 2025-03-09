import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { communityArchive } from "./services/community-archive";
import { gemini } from "./services/gemini";
import { insertUserSchema, insertComparisonSchema } from "@shared/schema";
import { z } from "zod";
import { log } from "./utils";

export async function registerRoutes(app: Express): Promise<Server> {
  // Test endpoints for troubleshooting
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/test/supabase", async (req, res) => {
    try {
      const tweets = await communityArchive.getRecentPopularTweets("_TheExGenesis");
      res.json({ 
        success: true, 
        tweetsCount: tweets.length,
        sampleTweet: tweets.length > 0 ? tweets[0] : null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      log(`Supabase test error: ${message}`, "express");
      res.status(500).json({ success: false, message });
    }
  });

  app.get("/api/test/gemini", async (req, res) => {
    try {
      const result = await gemini.generateInsights("This is a test tweet. Just testing the Gemini API integration.");
      res.json({ success: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      log(`Gemini test error: ${message}`, "express");
      res.status(500).json({ success: false, message });
    }
  });

  // Frame translation endpoint
  app.post("/api/translate", async (req, res) => {
    try {
      const { sourceText, targetHandle } = req.body;

      if (!sourceText || !targetHandle) {
        return res.status(400).json({ 
          message: "Source text and target handle are required" 
        });
      }

      // First check if the target user exists in our Community Archive
      try {
        await communityArchive.getRecentPopularTweets(targetHandle);
      } catch (error) {
        return res.status(404).json({ 
          message: `Could not find Twitter profile for @${targetHandle}` 
        });
      }

      // Perform the translation
      const result = await gemini.translateBetweenFrames(
        sourceText,
        targetHandle
      );

      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      log(`Translation error: ${message}`, "express");
      res.status(500).json({ message });
    }
  });

  // Get or create user profile
  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      res.json(user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      res.status(400).json({ message });
    }
  });

  // Get user insights
  app.get("/api/users/:handle/insights", async (req, res) => {
    try {
      const user = await storage.getUserByTwitterHandle(req.params.handle);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let insight = await storage.getInsight(user.id);

      if (!insight) {
        try {
          // Fetch and analyze tweets
          const tweets = await communityArchive.getRecentPopularTweets(user.twitterHandle);
          const tweetHistory = tweets.map(t => t.full_text).join("\n");

          if (!tweetHistory.trim()) {
            return res.status(400).json({ 
              message: "No tweets available for analysis", 
              twitterHandle: user.twitterHandle 
            });
          }

          const analysis = await gemini.generateInsights(tweetHistory);

          // Create new insight
          insight = await storage.createInsight({
            userId: user.id,
            description: analysis.description,
            topics: analysis.topics,
            createdAt: new Date().toISOString()
          });

          if (!insight) {
            throw new Error("Failed to create insight");
          }
        } catch (tweetError) {
          return res.status(500).json({ 
            message: `Failed to process tweets: ${tweetError instanceof Error ? tweetError.message : 'Unknown error'}`,
            twitterHandle: user.twitterHandle 
          });
        }
      }

      res.json(insight);
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      res.status(500).json({ message });
    }
  });

  // Create comparison between users
  app.post("/api/comparisons", async (req, res) => {
    try {
      // First get both users
      const [userA, userB] = await Promise.all([
        storage.getUser(req.body.userAId),
        storage.getUser(req.body.userBId)
      ]);

      if (!userA || !userB) {
        return res.status(404).json({ message: "One or both users not found" });
      }

      // Get insights after confirming users exist
      const [insightA, insightB] = await Promise.all([
        storage.getInsight(userA.id),
        storage.getInsight(userB.id)
      ]);

      if (!insightA || !insightB) {
        return res.status(404).json({ 
          message: "Insights not found for one or both users",
          details: {
            userA: { id: userA.id, hasInsight: !!insightA },
            userB: { id: userB.id, hasInsight: !!insightB }
          }
        });
      }

      // Generate explanation using Gemini with Twitter handles
      const explanation = await gemini.explainArgument(
        insightA.description,
        insightB.description,
        "Find meaningful connection points", // Generic prompt
        userA.twitterHandle,
        userB.twitterHandle
      );

      if (!explanation) {
        throw new Error("Failed to generate explanation");
      }

      // Now create the full comparison object with all required fields
      const comparisonData = {
        userAId: userA.id,
        userBId: userB.id,
        argumentText: "Find meaningful connection points", // Generic prompt
        explanation: explanation,
        createdAt: new Date(), // Send as Date object instead of string
      };

      // Validate and create the comparison
      const validatedData = insertComparisonSchema.parse(comparisonData);
      const comparison = await storage.createComparison(validatedData);

      res.json(comparison);
    } catch (error) {
      if (error instanceof Error) {
        log(`Comparison creation error: ${error.message}`, "express");
        console.error("Full error:", error);
        res.status(500).json({ message: error.message });
      } else {
        res.status(500).json({ message: "An unexpected error occurred" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}