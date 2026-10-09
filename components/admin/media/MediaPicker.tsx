"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Group, Image, Modal, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { AlertCircle, FileText, Search, Upload } from "lucide-react";

import { MEDIA_CONFIG } from "@sahan-sac/media-kit/config";
import { uploadToMediaLibrary } from "@sahan-sac/media-kit/upload-client";

import { registerUpload } from "@/lib/actions/media";

export interface MediaPickerResult {
  mediaId: string;
  src: string;
  alt: string;
}

interface MediaPickerProps {
  onSelect: (result: MediaPickerResult) => void;
  kind?: "IMAGE" | "DOCUMENT";
  required?: boolean;
}

interface MediaItem extends MediaPickerResult {
  kind: "IMAGE" | "DOCUMENT";
  title: string | null;
  folder: string;
  width: number | null;
  height: number | null;
}

interface MediaPage {
  items: MediaItem[];
  nextCursor: string | null;
}

// Modal component for choosing or uploading media. Search and pagination stay
// server-side, so the browser never downloads the full library to filter it.
export function MediaPicker({ onSelect, kind = "IMAGE", required = false }: MediaPickerProps) {
  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<"browse" | "upload">("browse");
  const [search, setSearch] = useState("");
  const [alt, setAlt] = useState("");
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeMB = kind === "IMAGE" ? MEDIA_CONFIG.images.maxSizeMB : MEDIA_CONFIG.documents.maxSizeMB;
  const formats = kind === "IMAGE" ? MEDIA_CONFIG.images.formats : MEDIA_CONFIG.documents.formats;
  const altRequired = kind === "IMAGE" || required;

  useEffect(() => {
    if (!opened || mode !== "browse") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ kind, limit: "24" });
      if (search.trim()) params.set("q", search.trim());
      void fetch(`/api/admin/media?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as (MediaPage & { error?: string }) | null;
          if (!response.ok || !data) throw new Error(data?.error || "Could not load media.");
          setItems(data.items);
          setNextCursor(data.nextCursor);
          setSelected(null);
          setAlt("");
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
  }, [kind, mode, opened, search]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const params = new URLSearchParams({ kind, limit: "24", after: nextCursor });
      if (search.trim()) params.set("q", search.trim());
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

  const choose = useCallback(
    (result: MediaPickerResult) => {
      if (altRequired && !alt.trim()) {
        setError("Add alt text before choosing this image.");
        return;
      }
      onSelect({ ...result, alt: alt.trim() });
      setOpened(false);
      setError(null);
    },
    [alt, altRequired, onSelect]
  );

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (altRequired && !alt.trim()) {
        setError("Add alt text before uploading this image.");
        event.currentTarget.value = "";
        return;
      }

      setError(null);
      setUploading(true);
      try {
        const uploaded = await uploadToMediaLibrary(file, registerUpload, {
          fileName: file.name,
          ...(altRequired ? { alt: alt.trim() } : {}),
        });
        if (!uploaded.ok) {
          setError(uploaded.error);
          return;
        }
        onSelect({ mediaId: uploaded.mediaId, src: uploaded.url, alt: alt.trim() });
        setOpened(false);
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [alt, altRequired, onSelect]
  );

  return (
    <>
      <Button type="button" onClick={() => setOpened(true)} variant="light" leftSection={<Upload size={16} />} aria-label={`Choose ${kind.toLowerCase()}`}>
        Choose {kind.toLowerCase()}
      </Button>

      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
          setMode("browse");
          setSearch("");
          setAlt("");
          setSelected(null);
          setError(null);
        }}
        title={`Select ${kind.toLowerCase()}`}
        size="lg"
        centered
      >
        <Stack gap="md">
          {error ? <Alert color="red" icon={<AlertCircle size={18} />} role="alert">{error}</Alert> : null}

          <Group>
            <Button.Group aria-label="Media source">
              <Button type="button" aria-pressed={mode === "browse"} variant={mode === "browse" ? "filled" : "light"} onClick={() => setMode("browse")}>
                Browse
              </Button>
              <Button type="button" aria-pressed={mode === "upload"} variant={mode === "upload" ? "filled" : "light"} onClick={() => setMode("upload")}>
                Upload
              </Button>
            </Button.Group>
          </Group>

          {altRequired ? (
            <TextInput
              label="Alt text"
              description="Describe the image for people who cannot see it."
              value={alt}
              onChange={(event) => setAlt(event.currentTarget.value)}
              maxLength={500}
              required
              autoComplete="off"
            />
          ) : null}

          {mode === "browse" ? (
            <>
              <TextInput
                label="Search library"
                placeholder="Search by title, ID, alt text or folder"
                leftSection={<Search size={16} />}
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
              />
              {loading ? <Text role="status" aria-live="polite" size="sm">Loading media…</Text> : null}
              {!loading && items.length === 0 ? <Text size="sm" c="dimmed">No media matches this search.</Text> : null}
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                {items.map((item) => (
                  <button
                    key={item.mediaId}
                    type="button"
                    onClick={() => {
                      setSelected(item);
                      setAlt(item.alt || "");
                      setError(null);
                    }}
                    aria-pressed={selected?.mediaId === item.mediaId}
                    className="rounded-md border border-border p-2 text-left aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/40"
                  >
                    {item.kind === "IMAGE" ? (
                      <Image src={item.src} alt="" h={92} fit="cover" radius="sm" />
                    ) : (
                      <span className="flex h-[92px] items-center justify-center rounded bg-muted/50">
                        <FileText size={28} aria-hidden="true" />
                      </span>
                    )}
                    <Text size="xs" fw={500} mt="xs" lineClamp={1}>{item.title || item.mediaId}</Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>{item.folder}</Text>
                  </button>
                ))}
              </SimpleGrid>
              {nextCursor ? <Button type="button" variant="light" onClick={() => void loadMore()} loading={loadingMore}>Load more</Button> : null}
              {selected ? (
                <Button type="button" onClick={() => choose(selected)} disabled={altRequired && !alt.trim()}>
                  Use selected {kind.toLowerCase()}
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={formats.map((format) => `.${format}`).join(",")}
                onChange={handleUpload}
                disabled={uploading}
                aria-label={`Upload ${kind.toLowerCase()}`}
              />
              <Text size="xs" c="dimmed">Formats: {formats.join(", ")} • Max {maxSizeMB} MB</Text>
              {uploading ? <Text role="status" aria-live="polite" size="sm">Uploading…</Text> : null}
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
