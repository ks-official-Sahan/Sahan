"use client";

import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

import { isSafeHref } from "@/lib/cms/href";

// TipTap 3 editor for a post body, loaded on demand only
// (components/admin/blog/RichEditorField.tsx dynamic-imports this with
// ssr:false), so TipTap never ships to the public bundle
// (docs/plan/admin-cms-adr.md, Step 12). The editor edits raw HTML; the
// server re-sanitizes it into contentHtml/contentText on save
// (lib/cms/rich-text.ts) — this component's own link/image checks are a
// convenience for the editor, not the security boundary.

interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichEditor({ value, onChange }: RichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: false,
        // A defense-in-depth check alongside the server-side allowlist
        // (lib/cms/rich-text.ts), which is what actually enforces this.
        validate: (href) => isSafeHref(href),
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm min-h-[320px] max-w-none rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-none",
      },
    },
  });

  // The value prop can change under the editor (loading a different post,
  // or an AI-drafted body replacing the current one) without remounting it.
  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to `value` changing from outside
  }, [value]);

  if (!editor) return null;

  const setLink = () => {
    const url = window.prompt("Link URL");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!isSafeHref(url)) {
      window.alert("That URL is not allowed. Use an https, mailto or tel link, or a path on this site.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const buttonClass = (active: boolean) =>
    `rounded border px-2 py-1 text-xs font-medium ${active ? "border-primary bg-primary/10" : "border-input bg-background hover:bg-muted"}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="Formatting">
        <button type="button" className={buttonClass(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button type="button" className={buttonClass(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        <button type="button" className={buttonClass(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()}>
          Code
        </button>
        <button type="button" className={buttonClass(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </button>
        <button type="button" className={buttonClass(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          H3
        </button>
        <button type="button" className={buttonClass(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          Bullets
        </button>
        <button type="button" className={buttonClass(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          Numbered
        </button>
        <button type="button" className={buttonClass(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          Quote
        </button>
        <button type="button" className={buttonClass(false)} onClick={setLink}>
          Link
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
