import { useRef, useCallback } from "react";
import { Bold, Italic, Underline, List, ListOrdered, Image, Link, AlignLeft, AlignCenter, Type } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const insertImage = () => {
    const url = prompt("URL de l'image :");
    if (url) exec("insertImage", url);
  };

  const insertLink = () => {
    const url = prompt("URL du lien :");
    if (url) exec("createLink", url);
  };

  const tools = [
    { icon: Bold, cmd: "bold", title: "Gras" },
    { icon: Italic, cmd: "italic", title: "Italique" },
    { icon: Underline, cmd: "underline", title: "Souligné" },
    { icon: AlignLeft, cmd: "justifyLeft", title: "Aligner à gauche" },
    { icon: AlignCenter, cmd: "justifyCenter", title: "Centrer" },
    { icon: List, cmd: "insertUnorderedList", title: "Liste à puces" },
    { icon: ListOrdered, cmd: "insertOrderedList", title: "Liste numérotée" },
  ];

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
        {tools.map(({ icon: Icon, cmd, title }) => (
          <button
            key={cmd}
            type="button"
            title={title}
            onMouseDown={(e) => { e.preventDefault(); exec(cmd); }}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon size={14} />
          </button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" title="Insérer une image" onMouseDown={(e) => { e.preventDefault(); insertImage(); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Image size={14} />
        </button>
        <button type="button" title="Insérer un lien" onMouseDown={(e) => { e.preventDefault(); insertLink(); }} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Link size={14} />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <select
          onChange={(e) => exec("fontSize", e.target.value)}
          className="text-xs bg-transparent border-none outline-none text-muted-foreground cursor-pointer"
          defaultValue="3"
        >
          <option value="1">Petit</option>
          <option value="3">Normal</option>
          <option value="5">Grand</option>
          <option value="7">Très grand</option>
        </select>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          if (editorRef.current) onChange(editorRef.current.innerHTML);
        }}
        dangerouslySetInnerHTML={{ __html: value }}
        data-placeholder={placeholder}
        className="min-h-[160px] max-h-[300px] overflow-y-auto px-4 py-3 text-sm text-foreground outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground/50 prose prose-sm max-w-none"
        style={{ wordBreak: "break-word" }}
      />
    </div>
  );
}
