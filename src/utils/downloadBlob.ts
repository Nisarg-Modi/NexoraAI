export function createObjectUrlDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const triggerDownload = () => {
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const cleanup = () => {
    URL.revokeObjectURL(url);
  };

  return { url, triggerDownload, cleanup };
}
