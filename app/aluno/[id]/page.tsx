import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { statusDe, formatarData } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { concluir } from "@/lib/actions";

export default async function TreinamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = (await getUsuarioAtual())!;

  const atrib = await prisma.atribuicao.findUnique({
    where: { id: Number(id) },
    include: { treinamento: true },
  });

  if (!atrib || atrib.usuarioId !== usuario.id) notFound();
  const status = statusDe(atrib);
  // Acesso cortado apos o prazo.
  if (status === "vencido") redirect("/aluno");

  const t = atrib.treinamento;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/aluno" className="text-sm text-slate-500 hover:underline">
        ← Voltar
      </Link>

      <div className="mt-3 flex items-center gap-2">
        <h1 className="text-xl font-semibold">{t.titulo}</h1>
        <StatusBadge status={status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">{t.descricao}</p>
      <p className="mt-1 text-xs text-slate-400">Prazo: {formatarData(atrib.prazo)}</p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6">
        {t.tipo === "video" && t.conteudoUrl ? (
          <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
            <iframe
              src={t.conteudoUrl}
              className="h-full w-full"
              allowFullScreen
              title={t.titulo}
            />
          </div>
        ) : (
          <div className="space-y-3 text-sm leading-relaxed text-slate-700">
            {(t.corpo || "").split("\n\n").map((par, i) => (
              <p key={i}>{par}</p>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
        {status === "concluido" ? (
          <p className="text-sm text-green-700">
            ✓ Concluído em {formatarData(atrib.concluidoEm!)}
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Ao terminar o conteúdo, marque como concluído.
            </p>
            <form action={concluir}>
              <input type="hidden" name="atribuicaoId" value={atrib.id} />
              <button className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
                Marcar como concluído
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
