import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { salvarQuiz } from "@/lib/actions";

const SLOTS = 6; // número fixo de perguntas editáveis
const ALTS = 4; // alternativas por pergunta

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const treinamentoId = Number(id);

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

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/admin/treinamentos" className="text-sm text-slate-500 hover:underline">
        ← Treinamentos
      </Link>
      <h1 className="mt-3 text-xl font-semibold">Quiz · {treinamento.titulo}</h1>
      <p className="mb-6 text-sm text-slate-500">
        Preencha as perguntas. Slots em branco são ignorados. Marque a alternativa correta.
      </p>

      <form action={salvarQuiz} className="space-y-6">
        <input type="hidden" name="treinamentoId" value={treinamentoId} />
        <input type="hidden" name="totalPerguntas" value={SLOTS} />

        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium text-slate-700">Nota mínima para aprovar (%)</span>
          <input
            name="notaMinima"
            type="number"
            min={0}
            max={100}
            defaultValue={treinamento.notaMinima}
            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>

        {Array.from({ length: SLOTS }).map((_, p) => {
          const pergunta = treinamento.perguntas[p];
          return (
            <div key={p} className="rounded-lg border border-slate-200 bg-white p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  Pergunta {p + 1}
                </span>
                <input
                  name={`p${p}_enunciado`}
                  defaultValue={pergunta?.enunciado ?? ""}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                  placeholder="Enunciado (deixe vazio para ignorar)"
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
                        placeholder={`Alternativa ${a + 1}`}
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
            Salvar quiz
          </button>
          <Link
            href="/admin/treinamentos"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
