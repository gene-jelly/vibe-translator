import { 
  users, type User, type InsertUser,
  insights, type Insight, type InsertInsight,
  comparisons, type Comparison, type InsertComparison
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByTwitterHandle(handle: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Insight operations
  getInsight(userId: number): Promise<Insight | undefined>;
  createInsight(insight: InsertInsight): Promise<Insight>;
  updateInsight(id: number, insight: Partial<InsertInsight>): Promise<Insight>;

  // Comparison operations
  getComparison(id: number): Promise<Comparison | undefined>;
  createComparison(comparison: InsertComparison): Promise<Comparison>;
  getComparisonsByUser(userId: number): Promise<Comparison[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private insights: Map<number, Insight>;
  private comparisons: Map<number, Comparison>;
  private currentIds: { user: number; insight: number; comparison: number };

  constructor() {
    this.users = new Map();
    this.insights = new Map();
    this.comparisons = new Map();
    this.currentIds = { user: 1, insight: 1, comparison: 1 };
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTwitterHandle(handle: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.twitterHandle === handle,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.user++;
    const user: User = { id, ...insertUser };
    this.users.set(id, user);
    return user;
  }

  async getInsight(userId: number): Promise<Insight | undefined> {
    return Array.from(this.insights.values()).find(
      (insight) => insight.userId === userId,
    );
  }

  async createInsight(insertInsight: InsertInsight): Promise<Insight> {
    const id = this.currentIds.insight++;
    const insight: Insight = { id, ...insertInsight };
    this.insights.set(id, insight);
    return insight;
  }

  async updateInsight(id: number, updateData: Partial<InsertInsight>): Promise<Insight> {
    const existing = this.insights.get(id);
    if (!existing) {
      throw new Error(`Insight not found: ${id}`);
    }
    const updated: Insight = { ...existing, ...updateData };
    this.insights.set(id, updated);
    return updated;
  }

  async getComparison(id: number): Promise<Comparison | undefined> {
    return this.comparisons.get(id);
  }

  async createComparison(insertComparison: InsertComparison): Promise<Comparison> {
    const id = this.currentIds.comparison++;
    const comparison: Comparison = {
      id,
      ...insertComparison,
      createdAt: new Date(), // Ensure createdAt is a Date object
    };
    this.comparisons.set(id, comparison);
    return comparison;
  }

  async getComparisonsByUser(userId: number): Promise<Comparison[]> {
    return Array.from(this.comparisons.values()).filter(
      (comparison) => comparison.userAId === userId || comparison.userBId === userId,
    );
  }
}

export const storage = new MemStorage();