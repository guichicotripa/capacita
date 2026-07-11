"use client";

import { useState } from "react";
import { criarCliente } from "@/lib/actions";
import { useDict } from "./I18nProvider";

// Form recolhível para o admin cadastrar uma nova empresa-cliente (onboarding).
export function FormNovoCliente() {
  const d = useDict();
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {d.admin.clientes.novo}
      </button>
    );
  }

  return (
    <form
      action={criarCliente}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="grow">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {d.admin.clientes.novoTitulo}
        </label>
        <input
          name="nome"
          required
          autoFocus
          placeholder={d.admin.clientes.nome}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
        />
      </div>
      <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
        {d.admin.clientes.criar}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
      >
        {d.comum.cancelar}
      </button>
    </form>
  );
}
