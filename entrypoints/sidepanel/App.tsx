import { useEffect, useState } from "react";
import "./App.css";

type ItemCrudMessage = AddItemMessage;
type AddItemMessage = { type: "add-item"; payload: ListItem };
type UpdateItemMessage = { type: "update-item"; payload: ListItem };

interface ListItem {
  id: string;
  filename: string;
  fileSize: number;
  mime: string;
  state: string;
}

function App() {
  const [items, setItems] = useState<ListItem[]>([]);

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

  console.log({ items });

  return (
    <div className="app">
      <h1>Tender Analyzer</h1>
      <ul className="file-list">
        {items.map((item) => (
          <li key={item.id} className="file-item">
            <span className="file-name">{getBasename(item.filename)}</span>
            <div className="file-meta">
              <span>{item.state}</span>
              <span>{getFileType(item.filename, item.mime)}</span>
              <span>{formatFileSize(item.fileSize)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getBasename(filepath: string): string {
  return filepath.replace(/\\/g, "/").split("/").pop() ?? filepath;
}

function getFileType(filename: string, mime: string): string {
  const ext = filename.split(".").pop();
  return ext ? `.${ext}` : mime;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export default App;
