"use client";

import { useFormStatus } from "react-dom";
import { subirArquivo, gerarTreinamentoIA } from "@/lib/actions";
import { useDict } from "./I18nProvider";

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
  const d = useDict();
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{d.admin.gerarIA.cliente}</span>
      <select
        name="clienteId"
        defaultValue=""
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      >
        <option value="">{d.admin.gerarIA.global}</option>
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
  const d = useDict();
  return (
    <div className="space-y-6">
      {/* Subir apresentação como está (PDF ou PPT) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {d.admin.gerarIA.subirTitulo}
        </h2>
        <form action={subirArquivo} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{d.admin.gerarIA.tituloLabel}</span>
            <input name="titulo" required className={inputCls} placeholder="Ex: Phishing no Teams" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{d.admin.gerarIA.descricao}</span>
            <input name="descricao" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{d.admin.gerarIA.arquivoLabel}</span>
            <input
              name="arquivo"
              type="file"
              accept=".pdf,.pptx"
              required
              className="w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
            />
          </label>
          <SelectCliente clientes={clientes} />
          <Botao rotulo={d.admin.gerarIA.subirBtn} pendingRotulo={d.admin.gerarIA.subindo} cor="slate" />
          <p className="text-xs text-slate-500">{d.admin.gerarIA.subirAjuda}</p>
        </form>
      </div>

      {/* Gerar curso por IA a partir de um tema */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {d.admin.gerarIA.gerarTemaTitulo}
        </h2>
        <form
          action={gerarTreinamentoIA}
          className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">{d.admin.gerarIA.temaLabel}</span>
            <input name="tema" required className={inputCls} placeholder="Ex: Engenharia social no WhatsApp" />
          </label>
          <SelectCliente clientes={clientes} />
          <Botao rotulo={d.admin.gerarIA.gerarBtn} pendingRotulo={d.admin.gerarIA.gerando} />
          <p className="text-xs text-slate-500">{d.admin.gerarIA.gerarAjuda}</p>
        </form>
      </div>
    </div>
  );
}
