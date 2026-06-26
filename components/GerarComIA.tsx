"use client";

import { useFormStatus } from "react-dom";
import { gerarTreinamentoIA, gerarCursoDePPT } from "@/lib/actions";

function Botao({ rotulo, pendingRotulo }: { rotulo: string; pendingRotulo: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded-md bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
    >
      {pending ? pendingRotulo : rotulo}
    </button>
  );
}

export function GerarComIA({ clientes }: { clientes: { id: number; nome: string }[] }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Gerar por IA
      </h2>
      <form
        action={gerarTreinamentoIA}
        className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Tema</span>
          <input
            name="tema"
            required
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
            placeholder="Ex: Engenharia social no WhatsApp"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Cliente</span>
          <select
            name="clienteId"
            defaultValue=""
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="">Global (todos)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <Botao rotulo="✨ Gerar treinamento com IA" pendingRotulo="Gerando com IA… (alguns segundos)" />
        <p className="text-xs text-slate-500">
          A IA escreve o conteúdo e um quiz de 4 perguntas. Você pode editar depois.
        </p>
      </form>

      <form
        action={gerarCursoDePPT}
        className="mt-4 space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Ou suba um PowerPoint (.pptx)
          </span>
          <input
            name="arquivo"
            type="file"
            accept=".pptx"
            required
            className="w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-white"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Cliente</span>
          <select
            name="clienteId"
            defaultValue=""
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
          >
            <option value="">Global (todos)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <Botao
          rotulo="📎 Transformar PPT em curso"
          pendingRotulo="Lendo PPT e gerando…"
        />
        <p className="text-xs text-slate-500">
          A IA lê o texto dos slides e monta o curso + quiz.
        </p>
      </form>
    </div>
  );
}
