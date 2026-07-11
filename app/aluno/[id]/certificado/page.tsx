import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatarData } from "@/lib/status";
import { codigoCertificado } from "@/lib/certificado";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import { getDict } from "@/lib/i18n-server";

// Certificado de conclusão imprimível de uma atribuição concluída.
// Acesso: o dono da atribuição ou um admin.
export default async function CertificadoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");
  const d = await getDict();

  const atrib = await prisma.atribuicao.findUnique({
    where: { id: Number(id) },
    include: { treinamento: true, usuario: { include: { cliente: true } } },
  });
  if (!atrib) notFound();
  // Só o dono ou um admin veem o certificado.
  if (atrib.usuarioId !== usuario.id && usuario.papel !== "admin") redirect("/aluno");

  if (!atrib.concluidoEm) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <p className="text-sm text-slate-500">{d.certificado.naoConcluido}</p>
        <Link href="/aluno" className="mt-4 inline-block text-sm text-slate-600 hover:underline">
          {d.certificado.voltar}
        </Link>
      </div>
    );
  }

  const codigo = codigoCertificado(atrib.id, atrib.concluidoEm);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/aluno" className="text-sm text-slate-600 hover:underline">
          {d.certificado.voltar}
        </Link>
        <BotaoImprimir rotulo={d.certificado.imprimir} />
      </div>

      {/* Folha do certificado */}
      <div className="certificado rounded-xl border-4 border-slate-900 bg-white p-10 text-center">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-lg font-bold text-white">
            C
          </span>
          <span className="text-lg font-semibold tracking-wide">Capacita</span>
        </div>

        <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-900">
          {d.certificado.titulo}
        </h1>

        <p className="mt-8 text-sm text-slate-500">{d.certificado.intro}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{atrib.usuario.nome}</p>

        <p className="mt-6 text-sm text-slate-500">{d.certificado.concluiu}</p>
        <p className="mt-1 text-xl font-medium text-slate-900">{atrib.treinamento.titulo}</p>

        <p className="mt-6 text-sm text-slate-600">
          {d.certificado.em} {formatarData(atrib.concluidoEm)}
          {atrib.nota != null && ` — ${d.certificado.nota(atrib.nota)}`}
        </p>

        {atrib.usuario.cliente && (
          <p className="mt-2 text-sm text-slate-500">
            {d.certificado.cliente}: {atrib.usuario.cliente.nome}
          </p>
        )}

        <div className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-400">
          <p>
            {d.certificado.codigo}: <span className="font-mono text-slate-600">{codigo}</span>
          </p>
          <p className="mt-1">{d.certificado.emitido}</p>
        </div>
      </div>
    </div>
  );
}
