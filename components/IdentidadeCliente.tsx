"use client";

import { useState } from "react";
import { salvarIdentidadeCliente } from "@/lib/actions";
import { useDict } from "./I18nProvider";

// Logo e cor da empresa, recolhido por padrão para não poluir a lista.
// A prévia mostra o logo atual; o arquivo novo só substitui depois de salvar.
export function IdentidadeCliente({
  id,
  temLogo,
  corAtual,
}: {
  id: number;
  temLogo: boolean;
  corAtual: string | null;
}) {
  const d = useDict();
  const [aberto, setAberto] = useState(false);
  const [cor, setCor] = useState(corAtual ?? "#4f46e5");
  const [removendo, setRemovendo] = useState(false);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
      >
        {d.admin.clientes.identidade}
      </button>
    );
  }

  return (
    <form
      action={salvarIdentidadeCliente}
      className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <input type="hidden" name="id" value={id} />
      {removendo && <input type="hidden" name="removerLogo" value="1" />}

      <p className="mb-3 text-xs font-semibold text-slate-500">
        {d.admin.clientes.identidadeTitulo}
      </p>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        {/* Prévia do logo atual */}
        <div className="flex h-20 w-32 items-center justify-center rounded-md border border-slate-200 bg-white p-2">
          {temLogo && !removendo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={`/api/cliente/${id}/logo`}
              alt={d.admin.clientes.logoAtual}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-[11px] text-slate-400">{d.admin.clientes.semLogo}</span>
          )}
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              {d.admin.clientes.logoArquivo}
            </span>
            <input
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={() => setRemovendo(false)}
              className="w-full text-xs file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-white"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              {d.admin.clientes.logoAjuda}
            </span>
          </label>

          <label className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">
              {d.admin.clientes.corPrimaria}
            </span>
            <input
              name="corPrimaria"
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-8 w-14 cursor-pointer rounded border border-slate-300 bg-white"
            />
            <code className="text-[11px] text-slate-500">{cor}</code>
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800">
          {d.comum.salvar}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
        >
          {d.comum.cancelar}
        </button>
        {temLogo && !removendo && (
          <button
            type="button"
            onClick={() => setRemovendo(true)}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            {d.admin.clientes.removerLogo}
          </button>
        )}
        {removendo && (
          <span className="text-[11px] text-red-600">{d.admin.clientes.logoSeraRemovido}</span>
        )}
      </div>
    </form>
  );
}
