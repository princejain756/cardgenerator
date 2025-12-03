// Lightweight shim for @imgly/background-removal in this build.
// It simply returns the original image without background removal,
// so the rest of the app can work without onnxruntime-web in the browser.

export async function removeBackground(input: string | Blob | File): Promise<string | Blob | File> {
  return input;
}
