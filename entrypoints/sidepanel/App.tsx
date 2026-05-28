import { useEffect, useState } from "react";
import "./App.css";

interface DownloadedFile {
  filename: string;
  fileSize: number;
  mime: string;
}

function App() {
  const [downloads, setDownloads] = useState<DownloadedFile[]>([]);

  useEffect(() => {
    const listener = (message: { type: string; download: DownloadedFile }) => {
      if (message.type === "download-complete") {
        setDownloads((prev) => [...prev, message.download]);
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  return (
    <div className="app">
      <h1>Tender Analyzer</h1>
      <ul className="file-list">
        {downloads.map((d, i) => (
          <li key={i} className="file-item">
            <span className="file-name">{getBasename(d.filename)}</span>
            <span className="file-type">{getFileType(d.filename, d.mime)}</span>
            <span className="file-size">{formatFileSize(d.fileSize)}</span>
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
