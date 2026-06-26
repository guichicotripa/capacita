import JSZip from "jszip";

// Decodifica as entidades XML mais comuns nos textos do slide.
function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

// Extrai o texto dos slides de um .pptx (que é um zip de XMLs).
// Pega o conteúdo das tags <a:t> (runs de texto) de cada slide, em ordem.
export async function extrairTextoPptx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const nomes = Object.keys(zip.files).filter(
    (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)
  );
  nomes.sort((a, b) => {
    const na = Number(a.match(/slide(\d+)\.xml/)?.[1] ?? 0);
    const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] ?? 0);
    return na - nb;
  });

  const partes: string[] = [];
  for (const nome of nomes) {
    const xml = await zip.files[nome].async("string");
    const textos = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) =>
      decodeXml(m[1])
    );
    const slide = textos.join(" ").trim();
    if (slide) partes.push(slide);
  }
  return partes.join("\n\n").trim();
}
