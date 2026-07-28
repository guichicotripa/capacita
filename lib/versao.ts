import pkg from "../package.json";

// Versão visível na tela de login. Pedido do Danilo, e por um bom motivo: sem
// isso não dá para saber, olhando o site, se um deploy realmente chegou ao ar.
// Junta a versão do package.json com o commit publicado pela Vercel.
export function versaoApp(): string {
  const sha = (
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    ""
  ).slice(0, 7);
  return sha ? `v${pkg.version} · ${sha}` : `v${pkg.version} · local`;
}
