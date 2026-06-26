"use client";

import { useFormStatus } from "react-dom";
import { subirArquivo, gerarTreinamentoIA } from "@/lib/actions";

function Botao({
  rotulo,
  pendingRotulo,
  cor = "violet",
}: {
  rotulo: string;
  pendingRotulo: string;
  cor?: "violet" | "slate";
}) {
  const { pending } = useFormStatus();
  const cores =
    cor === "slate"
      ? "bg-slate-900 hover:bg-slate-800"
      : "bg-violet-600 hover:bg-violet-700";
  return (
    <button
      disabled={pending}
      className={`w-full rounded-md ${cores} py-2 text-sm font-medium text-white disabled:opacity-60`}
    >
      {pending ? pendingRotulo : rotulo}
    </button>
  );
}

function SelectCliente({ clientes }: { clientes: { id: number; nome: string }[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">Cliente</span>
      <select
        name="clienteId"
        defaultValue=""
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      >
        <option value="">Global (todos)</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500";

export function GerarComIA({ clientes }: { clientes: { id: number; nome: string }[] }) {
  return (
    <div className="space-y-6">
      {/* Subir apresentação como está (PDF ou PPT) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Subir apresentação (PDF ou PPT)
        </h2>
        <form action={subirArquivo} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Título</span>
            <input name="titulo" required className={inputCls} placeholder="Ex: Phishing no Teams" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Descrição</span>
            <input name="descricao" className={inputCls} placeholder="Resumo curto (opcional)" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Arquivo (.pdf ou .pptx)</span>
            <input
              name="arquivo"
              type="file"
              accept=".pdf,.pptx"
              required
              className="w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
            />
          </label>
          <SelectCliente clientes={clientes} />
          <Botao rotulo="📎 Subir e mostrar como está" pendingRotulo="Subindo…" cor="slate" />
          <p className="text-xs text-slate-500">
            Mostra cada página exatamente como no arquivo. <strong>PDF é o recomendado</strong>{" "}
            (PowerPoint → Salvar como PDF). O <code>.pptx</code> pode não renderizar em alguns
            arquivos. O quiz você adiciona depois (vira a última página).
          </p>
        </form>
      </div>

      {/* Gerar curso por IA a partir de um tema */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Gerar por IA (tema)
        </h2>
        <form
          action={gerarTreinamentoIA}
          className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Tema</span>
            <input name="tema" required className={inputCls} placeholder="Ex: Engenharia social no WhatsApp" />
          </label>
          <SelectCliente clientes={clientes} />
          <Botao rotulo="✨ Gerar curso em slides com IA" pendingRotulo="Gerando com IA… (alguns segundos)" />
          <p className="text-xs text-slate-500">
            A IA escreve um curso em slides + quiz de 4 perguntas. Você pode editar depois.
          </p>
        </form>
      </div>
    </div>
  );
}
