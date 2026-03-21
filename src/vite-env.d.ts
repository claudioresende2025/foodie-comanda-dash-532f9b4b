/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'tesseract.js' {
  const Tesseract: {
    recognize: (image: string | File | Blob, lang?: string, options?: any) => Promise<{ data: { text: string } }>;
  };
  export default Tesseract;
}
