// ─────────────────────────────────────────────────────────────────────────────
// Property Finder Enterprise API – Type Definitions
// Aligned with the actual PF Atlas API (api-docs.propertyfinder.net)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Auth ───────────────────────────────────────────────────────────────────

export interface PFTokenResponse {
  accessToken: string;
  expiresIn: number; // seconds (currently 1800 = 30 min)
  tokenType: "Bearer";
}

export interface PFTokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

// ─── Listing (actual PF Atlas response shape) ───────────────────────────────

export interface PFImageVariant {
  url: string;
  height?: number;
  width?: number;
  error?: string;
}

export interface PFListingImage {
  original?: PFImageVariant;
  watermarked?: PFImageVariant;
  large?: PFImageVariant;
  medium?: PFImageVariant;
  thumbnail?: PFImageVariant;
}

export interface PFListingMedia {
  images?: PFListingImage[];
  videos?: {
    default?: string;
    view360?: string;
  };
}

export interface PFListingPrice {
  amounts?: {
    daily?: number;
    monthly?: number;
    sale?: number;
    weekly?: number;
    yearly?: number;
  };
  type?: "sale" | "rent" | "yearly" | "monthly" | "daily" | "weekly";
  onRequest?: boolean;
  downpayment?: number;
  numberOfCheques?: number;
  numberOfMortgageYears?: number;
  utilitiesInclusive?: boolean;
  paymentMethods?: string[];
  mortgage?: { comment?: string; enabled?: boolean };
  obligation?: { comment?: string; enabled?: boolean };
  valueAffected?: { comment?: string; enabled?: boolean };
  minimalRentalPeriod?: number;
}

export interface PFListingLocation {
  id: number;
  fullName?: { en?: string; ar?: string };
  lat?: string;
  lon?: string;
  path?: string;
}

// ─── Location endpoint types (/v1/locations) ─────────────────────────────────

export interface PFLocationTreeNode {
  id: number;
  name: string;
  type: string;
}

export interface PFLocation {
  id: number;
  name: string;
  type: string;
  coordinates?: { lat: number; lng: number };
  tree?: PFLocationTreeNode[];
}

/**
 * Resolved, app-facing location attached to every AppProperty.
 *  - `name`        → specific community (e.g. "Taormina Village")
 *  - `fullAddress` → hierarchical string, specific → broad (e.g. "Taormina Village, Majan, Dubai Land, Dubai.")
 */
export interface AppPropertyLocation {
  id: number;
  name: string;
  fullAddress: string;
}

export interface PFAssignedTo {
  id: number;
  name?: string;
  photos?: { thumbnail?: string };
}

export interface PFListingState {
  stage?: string;
  type?: string;
  reasons?: Array<{ en?: string; ar?: string }>;
}

export interface PFListingPortal {
  isLive?: boolean;
  name?: string;
  publishedAt?: string;
}

export interface PFListingCompliance {
  advertisementLicenseIssuanceDate?: string;
  listingAdvertisementNumber?: string;
  issuingClientLicenseNumber?: string;
  regaResponse?: {
    age?: number;
    amenities?: string[];
    bathrooms?: string;
    bedrooms?: string;
    category?: string;
    compliance?: {
      advertisementLicenseIssuanceDate?: string;
      issuingClientLicenseNumber?: string;
    };
    location?: PFListingLocation;
    price?: PFListingPrice;
    size?: number;
    type?: string;
  };
  type?: string;
  userConfirmedDataIsCorrect?: boolean;
}

export interface PFListing {
  id: string;
  reference?: string;
  title?: { en?: string; ar?: string };
  description?: { en?: string; ar?: string };
  category?: "residential" | "commercial";
  type?: string; // apartment, villa, townhouse, penthouse, etc.
  bedrooms?: string; // "studio", "1", "2", ...
  bathrooms?: string; // "none", "1", "2", ...
  size?: number; // sqft
  builtUpArea?: number;
  price?: PFListingPrice;
  location?: PFListingLocation;
  media?: PFListingMedia;
  amenities?: string[]; // enum values: "central-ac", "private-pool", etc.
  furnishingType?: "furnished" | "unfurnished" | "semi-furnished";
  projectStatus?: "completed" | "completed_primary" | "off_plan" | "off_plan_primary";
  developer?: string;
  state?: PFListingState;
  assignedTo?: PFAssignedTo;
  compliance?: PFListingCompliance;
  portals?: {
    propertyfinder?: PFListingPortal;
  };
  products?: Record<string, unknown>;
  age?: number;
  floorNumber?: string;
  unitNumber?: string;
  ownerName?: string;
  parkingSlots?: number;
  availableFrom?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { id: number; name?: string; photos?: { thumbnail?: string } };
  updatedBy?: { id: number; name?: string };
  rnpm?: { state?: string; enabledAt?: string; revokedAt?: string };
  /** UAE emirate slug — always "dubai" for this account */
  uaeEmirate?: string;
  /** Verification state: "approved" | "pending" | "rejected" */
  verificationStatus?: string;
  /** Commercial / warehouse floor count */
  numberOfFloors?: number;
  /** PF quality scoring object (shape varies) */
  qualityScore?: {
    color?: string;
    value?: number;
    details?: Record<string, {
      color?: string;
      group?: string;
      tag?: string;
      value?: number;
      weight?: number;
      help?: string;
    }>;
  };

  [key: string]: unknown;
}

// ─── Listings response ──────────────────────────────────────────────────────

export interface PFPagination {
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  nextPage?: number | null;
  prevPage?: number | null;
}

export interface PFListingsResponse {
  results: PFListing[];
  pagination: PFPagination;
  activeCts?: unknown;
}

// ─── Query params ───────────────────────────────────────────────────────────

export interface PFListingsParams {
  page?: number;
  perPage?: number;
  draft?: boolean;
  archived?: boolean;
  orderBy?: "createdAt" | "price" | "publishedAt";
  sortDir?: "asc" | "desc";
  filterState?: string;
  filterCategory?: "residential" | "commercial";
  filterOfferingType?: "rent" | "sale";
  filterType?: string;
  filterLocationId?: string;
  filterAssignedToId?: string;
  filterBedrooms?: string;
  filterBathrooms?: string;
  filterCompletionStatus?: string;
  filterFurnishingType?: string;
  filterPriceFrom?: number;
  filterPriceTo?: number;
  filterIds?: string;
  filterReference?: string;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export type PFWebhookEventType =
  | "listing.published"
  | "listing.unpublished"
  | "listing.action"
  | "listing.systemUpdated"
  | "listing.publishFailed"
  | "lead.created"
  | "lead.updated"
  | "lead.assigned"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "user.activated"
  | "user.deactivated"
  | "publicProfile.verification.approved"
  | "publicProfile.verification.rejected";

/**
 * Atlas Enterprise webhook envelope.
 * Prefer `entity` + `payload` (current PF docs). `data` / `created_at` kept for legacy.
 */
export interface PFWebhookEvent {
  id: string;
  type: PFWebhookEventType;
  timestamp?: string;
  created_at?: string;
  entity?: {
    id: string;
    type: string;
  };
  payload?: Record<string, unknown>;
  data?: {
    listing?: Partial<PFListing>;
    listing_id?: number | string;
    [key: string]: unknown;
  };
}

// ─── Transformed App Property ─────────────────────────────────────────────────

export type PropertyCategory = "Buy" | "Rent" | "Commercial Buy" | "Commercial Rent";

export interface ConnectivityEntry {
  place: string;
  time: string;
}

export interface AppProperty {
  id: string;
  title: string;
  slug: string;
  url?: string;
  category: PropertyCategory;
  type?: string;
  location: AppPropertyLocation;
  seo_title?: string; 
  developer?: string;
  price_aed?: number;
  price_display: string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  space_sqft?: number;
  space_display?: string;
  image_url: string;
  description: string;
  source: "pf" | "local";

  pf_id?: string;
  reference_number?: string;
  property_type?: string;
  status?: string;
  furnished?: string;
  completion_status?: string;
  permit_number?: string;
  qr_url?: string;
  developer_raw?: string;
  virtual_tour_url?: string;

  agent?: {
    name: string;
    phone?: string;
    email?: string;
    photo?: string;
    rera_number?: string;
  };

  detail_page?: {
    gallery_images: string[];
    floor_plans?: string[];
    amenities: string[];
    description_subtitle?: string;
    description_paragraphs?: string[];
    description_payment_highlights?: string[];
    description_full_blocks?: import("./listing-content").DescriptionBlock[];
    connectivity_intro?: string;
    connectivity_groups?: import("./listing-content").ConnectivityGroup[];
    payment_methods?: string[];
    connectivity: Record<string, string>;
    payment_plan?: string;
    booking_deposit_percent?: number;
    handover_date?: string;
    starting_price_aed?: number;
    size_sqm?: number;
    permit_number?: string;
    rera_permit?: string;
    description_ar?: string;
    videos?: string[];
    virtual_tour_url?: string;
    project?: {
      id: number;
      name: string;
      developer?: string;
      handover_date?: string;
    };
  };

  pf_updated_at?: string;
  pf_published_at?: string;
}
