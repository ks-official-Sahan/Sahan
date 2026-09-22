import "server-only";

import { env } from "@/lib/env";

// Cloudinary Admin API client with injectable fetch for testing.
// All requests use HTTP Basic Auth (not signed URLs).
// Never log or print credentials.

export interface CloudinaryAsset {
  public_id: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  folder: string;
  secure_url: string;
  created_at: string;
}

export type FetchFn = typeof fetch;

export class CloudinaryClient {
  private apiKey: string;
  private apiSecret: string;
  private cloudName: string;
  private fetchFn: FetchFn;

  constructor(fetchFn: FetchFn = fetch) {
    this.apiKey = env.CLOUDINARY_API_KEY || "";
    this.apiSecret = env.CLOUDINARY_API_SECRET || "";
    this.cloudName = env.CLOUDINARY_CLOUD_NAME || "";
    this.fetchFn = fetchFn;
  }

  private authHeader(): string {
    const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64");
    return `Basic ${credentials}`;
  }

  // Fetch asset metadata from Cloudinary Admin API
  async getAsset(publicId: string): Promise<CloudinaryAsset | null> {
    if (!this.apiKey || !this.apiSecret || !this.cloudName) {
      throw new Error("Cloudinary credentials not configured");
    }

    try {
      const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/image/${publicId}`;
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: {
          Authorization: this.authHeader(),
        },
      });

      if (!response.ok) return null;
      return (await response.json()) as CloudinaryAsset;
    } catch {
      return null;
    }
  }

  // Delete asset from Cloudinary
  async deleteAsset(publicId: string): Promise<boolean> {
    if (!this.apiKey || !this.apiSecret || !this.cloudName) {
      throw new Error("Cloudinary credentials not configured");
    }

    try {
      const url = `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/image/destroy`;
      const body = new URLSearchParams({ public_id: publicId });

      const response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: this.authHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

export const cloudinary = new CloudinaryClient();
