import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { salvarQuiz } from "@/lib/actions";
import { getUsuarioAtual } from "@/lib/auth";
import { podeEditarTreino } from "@/lib/escopo";
import { getDict } from "@/lib/i18n-server";

// O banco tem 12 slots e a prova mostra só uma parte (perguntasPorTentativa).
// Quem reprova cai noutro sorteio, então precisa haver folga no banco.
const SLOTS = 12;
const ALTS = 4; // alternativas por pergunta

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const treinamentoId = Number(id);
  const usuario = (await getUsuarioAtual())!;
  const d = await getDict();

  const treinamento = await prisma.treinamento.findUnique({
    where: { id: treinamentoId },
    include: {
      perguntas: {
        orderBy: { ordem: "asc" },
        include: { alternativas: true },
      },
    },
  });
  if (!treinamento) notFound();
  if (!podeEditarTreino(treinamento, usuario)) redirect("/admin/treinamentos");

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/treinamentos" className="text-sm text-slate-500 hover:underline">
        {d.admin.quiz.voltar}
      </Link>
      <h1 className="mt-3 text-xl font-semibold">{d.admin.quiz.titulo(treinamento.titulo)}</h1>
      <p className="mb-6 text-sm text-slate-500">{d.admin.quiz.instrucao}</p>

      <form action={salvarQuiz} className="space-y-6">
        <input type="hidden" name="treinamentoId" value={treinamentoId} />
        <input type="hidden" name="totalPerguntas" value={SLOTS} />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">{d.admin.quiz.notaMinima}</span>
            <input
              name="notaMinima"
              type="number"
              min={0}
              max={100}
              defaultValue={treinamento.notaMinima}
              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">{d.admin.quiz.porTentativa}</span>
            <input
              name="perguntasPorTentativa"
              type="number"
              min={1}
              max={SLOTS}
              defaultValue={treinamento.perguntasPorTentativa}
              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <p className="w-full text-xs text-slate-400">{d.admin.quiz.porTentativaAjuda}</p>
        </div>

        {Array.from({ length: SLOTS }).map((_, p) => {
          const pergunta = treinamento.perguntas[p];
          return (
            <div key={p} className="rounded-lg border border-slate-200 bg-white p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  {d.admin.quiz.pergunta(p + 1)}
                </span>
                <input
                  name={`p${p}_enunciado`}
                  defaultValue={pergunta?.enunciado ?? ""}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  placeholder={d.admin.quiz.enunciadoPh}
                />
              </label>
              <div className="mt-3 space-y-2">
                {Array.from({ length: ALTS }).map((__, a) => {
                  const alt = pergunta?.alternativas[a];
                  const corretaIdx = pergunta?.alternativas.findIndex((x) => x.correta) ?? 0;
                  return (
                    <label key={a} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`p${p}_correta`}
                        value={a}
                        defaultChecked={pergunta ? corretaIdx === a : a === 0}
                      />
                      <input
                        name={`p${p}_alt${a}`}
                        defaultValue={alt?.texto ?? ""}
                        className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-500"
                        placeholder={d.admin.quiz.alternativaPh(a + 1)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex gap-3">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            {d.admin.quiz.salvar}
          </button>
          <Link
            href="/admin/treinamentos"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {d.admin.quiz.cancelar}
          </Link>
        </div>
      </form>
    </div>
  );
}
