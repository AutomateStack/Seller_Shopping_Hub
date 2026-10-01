import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link2, Minus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface RichDescriptionEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const toolbarActions = [
  { icon: Bold, label: "Bold", prefix: "**", suffix: "**", placeholder: "bold text" },
  { icon: Italic, label: "Italic", prefix: "*", suffix: "*", placeholder: "italic text" },
  { icon: Heading2, label: "Heading", prefix: "\n## ", suffix: "", placeholder: "Heading" },
  { icon: Heading3, label: "Subheading", prefix: "\n### ", suffix: "", placeholder: "Subheading" },
  { icon: List, label: "Bullet List", prefix: "\n- ", suffix: "", placeholder: "List item" },
  { icon: ListOrdered, label: "Numbered List", prefix: "\n1. ", suffix: "", placeholder: "List item" },
  { icon: Link2, label: "Link", prefix: "[", suffix: "](url)", placeholder: "link text" },
  { icon: Minus, label: "Divider", prefix: "\n---\n", suffix: "", placeholder: "" },
];

export function RichDescriptionEditor({ value, onChange }: RichDescriptionEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const insertMarkdown = (prefix: string, suffix: string, placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || placeholder;
    const newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
    onChange(newText);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + prefix.length + selectedText.length + suffix.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // Simple markdown to HTML for preview
  const renderPreview = (md: string) => {
    let html = md
      .replace(/### (.+)/g, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
      .replace(/## (.+)/g, '<h2 class="text-lg font-bold mt-4 mb-1">$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline">$1</a>')
      .replace(/^---$/gm, '<hr class="my-3 border-border" />')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
      .replace(/\n/g, "<br />");
    return html;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 bg-muted/50">
          <TooltipProvider delayDuration={300}>
            {toolbarActions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => insertMarkdown(action.prefix, action.suffix, action.placeholder)}
                  >
                    <action.icon className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{action.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs h-7"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? "Edit" : "Preview"}
        </Button>
      </div>

      {showPreview ? (
        <div
          className="min-h-[160px] rounded-md border border-border bg-background p-3 text-sm prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: renderPreview(value) || '<span class="text-muted-foreground">No description yet...</span>' }}
        />
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write product description using markdown...&#10;&#10;## Features&#10;- Feature 1&#10;- Feature 2&#10;&#10;**Bold text** and *italic text* supported"
          rows={8}
          className="font-mono text-sm"
        />
      )}
      <p className="text-xs text-muted-foreground">
        Supports markdown: **bold**, *italic*, ## headings, - bullet lists, [links](url)
      </p>
    </div>
  );
}
