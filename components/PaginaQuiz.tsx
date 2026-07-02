"use client";

import { submeterQuiz } from "@/lib/actions";
import { useDict } from "./I18nProvider";

type Pergunta = {
  id: number;
  enunciado: string;
  alternativas: { id: number; texto: string }[];
};

// O quiz renderizado como uma "página" do deck (última etapa do treinamento).
export function PaginaQuiz({
  atribuicaoId,
  notaMinima,
  perguntas,
}: {
  atribuicaoId: number;
  notaMinima: number;
  perguntas: Pergunta[];
}) {
  const d = useDict();
  return (
    <form action={submeterQuiz} className="px-8 py-7">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{d.treino.avaliacaoFinal}</p>
      <h2 className="mt-1 text-lg font-semibold">
        {d.treino.respondaConcluir(notaMinima)}
      </h2>
      <input type="hidden" name="atribuicaoId" value={atribuicaoId} />
      <div className="mt-5 space-y-5">
        {perguntas.map((p, i) => (
          <fieldset key={p.id} className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">
              {i + 1}. {p.enunciado}
            </legend>
            {p.alternativas.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input type="radio" name={`p_${p.id}`} value={a.id} required />
                {a.texto}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <button className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        {d.treino.enviarRespostas}
      </button>
    </form>
  );
}
