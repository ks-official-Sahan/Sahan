"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Group, Image, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Search } from "lucide-react";

import { MediaPicker } from "@/components/admin/media/MediaPicker";

type MediaKind = "IMAGE" | "VIDEO" | "DOCUMENT";
interface MediaItem {
  mediaId: string;
  src: string;
  kind: MediaKind;
  alt: string;
  title: string | null;
  folder: string;
  width: number | null;
  height: number | null;
}
interface MediaPage {
  items: MediaItem[];
  nextCursor: string | null;
}

export default function MediaLibrary({ canUpload }: { canUpload: boolean }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"ALL" | MediaKind>("ALL");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "24" });
      if (query.trim()) params.set("q", query.trim());
      if (kind !== "ALL") params.set("kind", kind);
      void fetch(`/api/admin/media?${params.toString()}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as (MediaPage & { error?: string }) | null;
          if (!response.ok || !data) throw new Error(data?.error || "Could not load media.");
          setItems(data.items);
          setNextCursor(data.nextCursor);
        })
        .catch((cause) => {
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause.message : "Could not load media.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, refreshKey]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "24", after: nextCursor });
      if (query.trim()) params.set("q", query.trim());
      if (kind !== "ALL") params.set("kind", kind);
      const response = await fetch(`/api/admin/media?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as (MediaPage & { error?: string }) | null;
      if (!response.ok || !data) throw new Error(data?.error || "Could not load more media.");
      setItems((current) => [...current, ...data.items]);
      setNextCursor(data.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load more media.");
    } finally {
      setLoadingMore(false);
    }
  };

  const afterUpload = () => setRefreshKey((value) => value + 1);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <Group align="flex-end" grow>
          <TextInput
            label="Search media"
            placeholder="Title, ID, alt text or folder"
            leftSection={<Search size={16} />}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="min-w-64"
          />
          <Select
            label="Kind"
            value={kind}
            onChange={(value) => setKind((value as "ALL" | MediaKind) || "ALL")}
            data={[
              { value: "ALL", label: "All media" },
              { value: "IMAGE", label: "Images" },
              { value: "VIDEO", label: "Videos" },
              { value: "DOCUMENT", label: "Documents" },
            ]}
            className="min-w-40"
          />
        </Group>
        {canUpload ? (
          <Group>
            <MediaPicker kind="IMAGE" onSelect={afterUpload} />
            <MediaPicker kind="DOCUMENT" onSelect={afterUpload} />
          </Group>
        ) : null}
      </Group>

      {error ? <Alert color="red" role="alert">{error}</Alert> : null}
      {loading ? <Text role="status" aria-live="polite" size="sm" c="dimmed">Loading media…</Text> : null}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" aria-busy={loading}>
        {items.map((asset) => (
          <Link key={asset.mediaId} href={`/admin/media/${asset.mediaId}`} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card withBorder h="100%">
              {asset.kind === "IMAGE" ? (
                <Card.Section withBorder inheritPadding py="xs">
                  <Image src={asset.src} alt="" height={180} fit="cover" />
                </Card.Section>
              ) : (
                <Card.Section withBorder p="lg" className="flex h-[180px] items-center justify-center bg-muted/30">
                  <Badge>{asset.kind}</Badge>
                </Card.Section>
              )}
              <Stack gap="xs" p="xs">
                <Text size="sm" fw={500} lineClamp={1}>{asset.title || asset.mediaId}</Text>
                <Group justify="space-between">
                  <Badge size="xs" variant="light">{asset.folder}</Badge>
                  <Text size="xs" c="dimmed">{asset.width && asset.height ? `${asset.width} × ${asset.height}` : asset.kind}</Text>
                </Group>
              </Stack>
            </Card>
          </Link>
        ))}
      </SimpleGrid>

      {!loading && items.length === 0 ? <Text py="xl" ta="center" c="dimmed">No media matches this search.</Text> : null}
      {nextCursor ? <Button variant="light" onClick={() => void loadMore()} loading={loadingMore}>Load more</Button> : null}
    </Stack>
  );
}
