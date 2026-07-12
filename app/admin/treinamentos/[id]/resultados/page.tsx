import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUsuarioAtual } from "@/lib/auth";
import { podeVerTreino, escopoCliente } from "@/lib/escopo";
import { getDict } from "@/lib/i18n-server";

// Análise da avaliação de um treinamento: acerto por pergunta e quem errou cada uma
// (usa as respostas guardadas na última tentativa de cada aluno).
export default async function ResultadosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = (await getUsuarioAtual())!;
  const escopo = escopoCliente(usuario);
  const d = await getDict();

  const t = await prisma.treinamento.findUnique({
    where: { id: Number(id) },
    include: {
      perguntas: { orderBy: { ordem: "asc" }, include: { alternativas: true } },
      // Admin de cliente só vê tentativas dos próprios alunos, mesmo em treino global.
      atribuicoes: {
        where: escopo === null ? {} : { usuario: { clienteId: escopo } },
        include: { usuario: { select: { nome: true } } },
      },
    },
  });
  if (!t) notFound();
  if (!podeVerTreino(t, usuario)) redirect("/admin/treinamentos");

  const tentativas = t.atribuicoes.filter((a) => a.ultimasRespostas);
  const nPart = tentativas.length;

  const analise = t.perguntas.map((p) => {
    const correta = p.alternativas.find((al) => al.correta);
    const erraram: string[] = [];
    let acertos = 0;
    for (const a of tentativas) {
      const resp = (a.ultimasRespostas as Record<string, number>)[p.id];
      if (correta && resp === correta.id) acertos++;
      else erraram.push(a.usuario.nome);
    }
    const acc = nPart ? Math.round((acertos / nPart) * 100) : 0;
    return { p, correta, acertos, erraram, acc };
  });

  const acertoMedio =
    analise.length && nPart
      ? Math.round(analise.reduce((s, x) => s + x.acc, 0) / analise.length)
      : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/treinamentos" className="text-sm text-slate-500 hover:underline">
        {d.admin.quiz.voltar}
      </Link>
      <h1 className="mt-3 text-xl font-semibold text-slate-900">{d.admin.resultados.titulo(t.titulo)}</h1>
      <p className="text-sm text-slate-500">{d.admin.resultados.subtitulo}</p>

      {t.perguntas.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
          {d.admin.resultados.semQuiz}
        </p>
      ) : nPart === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
          {d.admin.resultados.semTentativas}
        </p>
      ) : (
        <>
          {/* Resumo */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-3xl font-bold text-slate-900">{acertoMedio}%</p>
              <p className="text-xs text-slate-500">{d.admin.resultados.acertoMedio(acertoMedio)}</p>
            </div>
            <div className="h-10 w-px bg-slate-100" />
            <div>
              <p className="text-3xl font-bold text-slate-900">{nPart}</p>
              <p className="text-xs text-slate-500">{d.admin.resultados.participantes(nPart)}</p>
            </div>
          </div>

          {/* Por pergunta */}
          <div className="mt-4 space-y-3">
            {analise.map((q, i) => (
              <div key={q.p.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-slate-800">
                    {i + 1}. {q.p.enunciado}
                  </p>
                  <span className={`shrink-0 text-lg font-bold ${corAcerto(q.acc)}`}>{q.acc}%</span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-2 rounded-full ${corBarra(q.acc)}`} style={{ width: `${q.acc}%` }} />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  {d.admin.resultados.acertaram(q.acertos, nPart)}
                  {q.erraram.length > 0 && ` · ${d.admin.resultados.erraram(q.erraram.length)}`}
                </p>

                <p className="mt-2 text-xs text-slate-400">
                  {d.admin.resultados.respostaCerta}:{" "}
                  <span className="font-medium text-green-700">{q.correta?.texto ?? "—"}</span>
                </p>

                {q.erraram.length > 0 ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-slate-500">{d.admin.resultados.quemErrou}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {q.erraram.map((nome, j) => (
                        <span
                          key={j}
                          className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
                        >
                          {nome}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs font-medium text-green-600">
                    ✓ {d.admin.resultados.todosAcertaram}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function corAcerto(acc: number): string {
  if (acc >= 70) return "text-green-600";
  if (acc >= 40) return "text-amber-600";
  return "text-red-600";
}
function corBarra(acc: number): string {
  if (acc >= 70) return "bg-green-500";
  if (acc >= 40) return "bg-amber-400";
  return "bg-red-500";
}
