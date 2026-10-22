// ─────────────────────────────────────────────────────────────────────────────
// Property Finder → App Property Transformer
//
// Maps the actual PF Atlas API response to the AppProperty shape used by UI.
// Defensive: every field is optional-safe.
// ─────────────────────────────────────────────────────────────────────────────

import type { AppProperty, AppPropertyLocation, PFListing } from "./types";
import {
  connectivityGroupsToRecord,
  descriptionPlainText,
  normalizeAmenityList,
  parseDelimitedList,
  parseListingContent,
  stripListingHtml,
} from "./listing-content";
/**
 * Optional image URL transforms (e.g. CDN resize presets) supplied by the app.
 * Omitted transforms leave the URL unchanged.
 */
export type ImageUrlTransforms = {
  card?: (url: string) => string;
  hero?: (url: string) => string;
};

const identity = (url: string): string => url;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-");
}

/** Verbatim Property Finder title (English, then Arabic). */
function resolveListingTitle(listing: PFListing): string {
  return listing.title?.en ?? listing.title?.ar ?? "Untitled Property";
}

function buildDescriptionFields(rawDesc: string) {
  const parsed = parseListingContent(rawDesc);
  const body =
    parsed.introParagraphs.length > 0
      ? descriptionPlainText(parsed.introParagraphs)
      : stripListingHtml(rawDesc);
  return { parsed, body };
}

function sqftToSqm(sqft: number): number {
  return Math.round(sqft / 10.7639);
}

function formatPrice(amount: number, currency = "AED"): string {
  if (amount >= 1_000_000) {
    const m = (amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 2);
    return `${parseFloat(m)}M ${currency}`;
  }
  if (amount >= 1_000) {
    return `${amount.toLocaleString("en-AE")} ${currency}`;
  }
  return `${amount} ${currency}`;
}

/** Price types that indicate a rental listing */
const RENT_PRICE_TYPES = new Set(["rent", "yearly", "monthly", "daily", "weekly"]);

function isRentalPriceType(priceType?: string): boolean {
  return RENT_PRICE_TYPES.has(priceType ?? "");
}

function resolvePriceAmount(listing: PFListing): number | undefined {
  const amounts = listing.price?.amounts;
  if (!amounts) return undefined;

  if (listing.price?.type === "sale" && amounts.sale) return amounts.sale;
  if (isRentalPriceType(listing.price?.type)) {
    return amounts.yearly ?? amounts.monthly ?? amounts.daily ?? amounts.weekly;
  }
  return amounts.sale ?? amounts.yearly ?? amounts.monthly ?? amounts.daily;
}

function resolveCategory(listing: PFListing): AppProperty["category"] {
  const isCommercial = listing.category === "commercial";
  const isRent = isRentalPriceType(listing.price?.type);

  if (isCommercial) return isRent ? "Commercial Rent" : "Commercial Buy";
  return isRent ? "Rent" : "Buy";
}

// Location is now resolved upstream (in cache.ts) via lib/propertyfinder/locations.ts
// and passed into `transformPFListing(listing, location)`.

const AMENITY_LABELS: Record<string, string> = {
  "central-ac": "Central A/C",
  "built-in-wardrobes": "Built-in Wardrobes",
  "kitchen-appliances": "Kitchen Appliances",
  security: "Security",
  concierge: "Concierge Service",
  "private-gym": "Private Gym",
  "shared-gym": "Shared Gym",
  "private-jacuzzi": "Private Jacuzzi",
  "shared-spa": "Shared Spa",
  "covered-parking": "Covered Parking",
  "maids-room": "Maid's Room",
  "barbecue-area": "Barbecue Area",
  "shared-pool": "Shared Pool",
  "childrens-pool": "Children's Pool",
  "private-garden": "Private Garden",
  "private-pool": "Private Pool",
  "view-of-water": "Water View",
  "walk-in-closet": "Walk-in Closet",
  "lobby-in-building": "Building Lobby",
  balcony: "Balcony",
  networked: "Networked",
  "view-of-landmark": "Landmark View",
  "dining-in-building": "In-Building Dining",
  "conference-room": "Conference Room",
  study: "Study Room",
  "maid-service": "Maid Service",
  "childrens-play-area": "Children's Play Area",
  "pets-allowed": "Pets Allowed",
  electricity: "Electricity",
  waters: "Water",
  sanitation: "Sanitation",
};

function resolveAmenityLabels(amenities?: string[]): string[] {
  if (!amenities?.length) return [];
  return amenities.map((a) => AMENITY_LABELS[a] ?? a.replace(/-/g, " "));
}

function resolvePropertyTypeLabel(listing: PFListing): string {
  const typeMap: Record<string, string> = {
    apartment: "Residential – Apartments",
    villa: "Residential – Villas",
    townhouse: "Residential – Villas & Townhouses",
    penthouse: "Residential – Penthouse",
    "hotel-apartment": "Residential – Hotel Apartments",
    "residential-floor": "Residential – Full Floor",
    "bulk-sale-unit": "Bulk Sale",
    land: "Land",
    office: "Commercial – Office",
    retail: "Commercial – Retail",
    warehouse: "Commercial – Warehouse",
    "whole-building": "Commercial – Whole Building",
    duplex: "Residential – Duplex",
    shop: "Commercial – Retail",
  };
  return typeMap[listing.type ?? ""] ?? listing.type ?? "Property";
}

function resolveBedrooms(
  bedrooms?: string,
): number | string | undefined {
  if (!bedrooms) return undefined;
  if (bedrooms === "studio") return "Studio";
  if (bedrooms === "none") return undefined;
  const n = parseInt(bedrooms, 10);
  return isNaN(n) ? bedrooms : n;
}

function resolveBathrooms(bathrooms?: string): number | string | undefined {
  if (!bathrooms) return undefined;
  if (bathrooms === "none") return undefined;
  const n = parseInt(bathrooms, 10);
  return isNaN(n) ? bathrooms : n;
}

function resolveImages(listing: PFListing): string[] {
  if (!listing.media?.images?.length) return [];
  return listing.media.images
    .map(
      (img) =>
        img.original?.url ??
        img.watermarked?.url ??
        img.large?.url ??
        img.medium?.url ??
        img.thumbnail?.url ??
        "",
    )
    .filter(Boolean);
}

function resolveVideos(listing: PFListing): string[] {
  const vids: string[] = [];
  if (listing.media?.videos?.default) vids.push(listing.media.videos.default);
  return vids;
}

function resolveVirtualTour(listing: PFListing): string | undefined {
  return listing.media?.videos?.view360 || undefined;
}

function resolveCompletionStatus(
  listing: PFListing,
): "ready" | "off_plan" | undefined {
  const ps = listing.projectStatus;
  if (!ps) return undefined;
  if (ps === "off_plan" || ps === "off_plan_primary") return "off_plan";
  if (ps === "completed" || ps === "completed_primary") return "ready";
  return undefined;
}

// ─── Main transformer ─────────────────────────────────────────────────────────

export function transformPFListing(
  listing: PFListing,
  location: AppPropertyLocation,
  images: ImageUrlTransforms = {},
): AppProperty {
  const title = resolveListingTitle(listing);
  const rawDesc = listing.description?.en ?? listing.description?.ar ?? "";
  const { parsed, body: description } = buildDescriptionFields(rawDesc);
  const paymentMethods = parseDelimitedList(
    listing.price?.paymentMethods?.join(", "),
  );
  const amenities = normalizeAmenityList(
    resolveAmenityLabels(listing.amenities),
    parsed.amenities,
  );
  const connectivityFromDesc = connectivityGroupsToRecord(
    parsed.connectivityGroups,
  );
  const listingImages = resolveImages(listing);
  const heroImage = (images.hero ?? identity)(
    listingImages[0] ?? "/images/placeholder-property.svg",
  );
  const sizeSqft = listing.size ?? listing.builtUpArea;
  const sizeSqm = sizeSqft ? sqftToSqm(sizeSqft) : undefined;
  const priceAed = resolvePriceAmount(listing);
  // Append listing.id to guarantee URL uniqueness — agents frequently use identical
  // titles for different units, which would otherwise produce duplicate slugs and
  // make affected listings unreachable (getListingBySlug returns first match only).
  const slug = `${slugify(title)}-${listing.id}`;
  const virtualTour = resolveVirtualTour(listing);
  const completionStatus = resolveCompletionStatus(listing);
  const permitNumber =
    listing.compliance?.listingAdvertisementNumber ?? undefined;

  return {
    id: listing.id,
    title,
    slug,
    category: resolveCategory(listing),
    type: resolvePropertyTypeLabel(listing),
    location,
    seo_title: undefined, // title is verbatim PF; override here if SEO needs differ
    developer: listing.developer,
    developer_raw: listing.developer,
    price_aed: priceAed,
    price_display:
      listing.price?.onRequest || !priceAed
        ? "Price on Request"
        : formatPrice(priceAed, "AED"),
    bedrooms: resolveBedrooms(listing.bedrooms),
    bathrooms: resolveBathrooms(listing.bathrooms),
    space_sqft: sizeSqft,
    space_display: sizeSqft ? `${sizeSqft.toLocaleString()} sqft` : undefined,
    image_url: heroImage,
    description,
    source: "pf",

    pf_id: listing.id,
    reference_number: listing.reference,
    property_type: listing.type,
    status: listing.state?.stage,
    furnished: listing.furnishingType,
    completion_status: completionStatus,
    permit_number: permitNumber,
    virtual_tour_url: virtualTour,

    agent: listing.assignedTo
      ? {
        name: listing.assignedTo.name ?? "Agent",
        photo: listing.assignedTo.photos?.thumbnail,
      }
      : undefined,

    detail_page: {
      gallery_images: listingImages.map((url) => (images.card ?? identity)(url)),
      floor_plans: [],
      amenities,
      description_subtitle: parsed.subtitle,
      description_paragraphs: parsed.introParagraphs,
      description_payment_highlights: parsed.paymentHighlights.length
        ? parsed.paymentHighlights
        : undefined,
      description_full_blocks: parsed.fullDescriptionBlocks,
      connectivity_intro: parsed.connectivityIntro,
      connectivity_groups: parsed.connectivityGroups.length
        ? parsed.connectivityGroups
        : undefined,
      payment_methods: paymentMethods.length ? paymentMethods : undefined,
      connectivity: connectivityFromDesc,
      payment_plan:
        paymentMethods.length > 0
          ? paymentMethods.join(", ")
          : undefined,
      booking_deposit_percent: listing.price?.downpayment
        ? listing.price.downpayment
        : undefined,
      handover_date: undefined,
      starting_price_aed: priceAed,
      size_sqm: sizeSqm,
      permit_number: permitNumber,
      rera_permit: permitNumber,
      description_ar: listing.description?.ar,
      videos: resolveVideos(listing),
      virtual_tour_url: virtualTour,
      project: undefined,
    },

    pf_updated_at: listing.updatedAt,
    pf_published_at: listing.portals?.propertyfinder?.publishedAt,
  };
}

/**
 * Resolver strategy used by `transformPFListings`. Typically a wrapper around
 * `lib/propertyfinder/locations.ts::getLocationsByIds` that has pre-fetched the
 * unique set of location ids.
 */
export type LocationResolver = (
  listing: PFListing,
) => AppPropertyLocation;

export function transformPFListings(
  listings: PFListing[],
  resolveLocation: LocationResolver,
  images: ImageUrlTransforms = {},
): AppProperty[] {
  // The API already sends filter[state]=live, so every listing here should be
  // active.  We keep a belt-and-suspenders check but log any rejections so
  // discrepancies between PF dashboard counts and our count are visible.
  const active: PFListing[] = [];
  const rejected: { id: string; stage?: string; isLive?: boolean }[] = [];

  for (const l of listings) {
    const stage = l.state?.stage;
    const isLive = l.portals?.propertyfinder?.isLive;

    if (stage === "live" || isLive === true) {
      active.push(l);
    } else {
      rejected.push({ id: l.id, stage, isLive });
    }
  }

  if (rejected.length > 0) {
    console.warn(
      `[PF Transform] Dropped ${rejected.length} listings that passed API filter[state]=live but failed client-side liveness check:`,
      rejected,
    );
  }

  console.info(
    `[PF Transform] ${listings.length} from API → ${active.length} active (${rejected.length} dropped)`,
  );

  return active.map((l) => transformPFListing(l, resolveLocation(l), images));
}
