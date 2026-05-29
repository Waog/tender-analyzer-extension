import { useEffect, useRef, useState } from "react";
import { storeFile } from "~/utils/fileStorage";
import "./App.css";

type ItemCrudMessage = AddItemMessage;
type AddItemMessage = { type: "add-item"; payload: ListItem };
type UpdateItemMessage = { type: "update-item"; payload: ListItem };

interface ListItem {
  id: string;
  filename: string;
  fileSize: number;
  mime: string;
  notes: string;
  state: "⌛" | "✅" | "❌";
}

function App() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const listener = (message: ItemCrudMessage) => {
      if (message.type === "add-item") {
        setItems((prev) => [...prev, message.payload]);
      } else if (message.type === "update-item") {
        setItems((prev) =>
          prev.map((item) =>
            item.id === message.payload.id
              ? { ...item, ...message.payload }
              : item,
          ),
        );
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  async function handleReset() {
    await browser.runtime.sendMessage({ type: "reset" });
    setItems([]);
  }

  async function handleCopyToClipboard() {
    const prompt = await browser.runtime.sendMessage({ type: "get-prompt" });
    await navigator.clipboard.writeText(prompt);
  }

  async function handleDownloadPromptFile() {
    const prompt = await browser.runtime.sendMessage({ type: "get-prompt" });
    const blob = new Blob([prompt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompt.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const id = await storeFile(file);
      await browser.runtime.sendMessage({
        type: "process-file",
        payload: { id },
      });
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files);
    }
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      await handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  return (
    <div className="app">
      <h1>Tender Analyzer</h1>
      <button onClick={handleCopyToClipboard}>to clipboard</button>
      <button onClick={handleDownloadPromptFile}>download prompt file</button>
      <button onClick={handleReset}>reset</button>
      <div
        className={`drop-zone${isDragOver ? " drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <span>Drop files here or click to select</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
      </div>
      {items.length > 0 && <ProgressSummary items={items} />}
      <ul className="file-list">
        {sortByState(items).map((item) => (
          <li key={item.id} className="file-item">
            <span className="file-state">{item.state}</span>
            <div className="file-content">
              <span className="file-name">{getBasename(item.filename)}</span>
              <div className="file-meta">
                <span>{getFileExtension(item.filename)}</span>
                <span>{item.mime}</span>
                <span>{formatFileSize(item.fileSize)}</span>
                <span>{item.notes}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressSummary({ items }: { items: ListItem[] }) {
  const pending = items.filter((i) => i.state === "⌛").length;
  const done = items.filter((i) => i.state === "✅").length;
  const failed = items.filter((i) => i.state === "❌").length;
  return (
    <div className="progress-summary">
      <span>⌛ {pending}</span>
      <span>✅ {done}</span>
      <span>❌ {failed}</span>
      <span className="progress-total">/ {items.length} total</span>
    </div>
  );
}

const STATE_ORDER: Record<ListItem["state"], number> = {
  "⌛": 0,
  "❌": 1,
  "✅": 2,
};

function sortByState(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

function getBasename(filepath: string): string {
  return filepath.replace(/\\/g, "/").split("/").pop() ?? filepath;
}

function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop();
  return ext ? `.${ext}` : "-";
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default App;
