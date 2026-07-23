"use client";

import { useState } from "react";
import { criarCliente } from "@/lib/actions";
import { useDict } from "./I18nProvider";

// Form recolhível para o admin cadastrar uma nova empresa-cliente (onboarding).
// Só o nome é obrigatório; o resto do cadastro da empresa é opcional para não
// travar um onboarding rápido.
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
      className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="font-medium">{d.admin.clientes.novoTitulo}</h2>

      <Campo nome="nome" rotulo={d.admin.clientes.nome} obrigatorio autoFocus />

      <p className="text-xs text-slate-400">{d.admin.clientes.opcionais}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="cnpj" rotulo={d.admin.clientes.cnpj} />
        <Campo nome="telefone" rotulo={d.admin.clientes.telefone} tipo="tel" />
        <Campo nome="email" rotulo={d.admin.clientes.emailEmpresa} tipo="email" />
        <Campo nome="responsavel" rotulo={d.admin.clientes.responsavel} />
      </div>
      <Campo nome="endereco" rotulo={d.admin.clientes.endereco} />

      <div className="flex gap-2">
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
      </div>
    </form>
  );
}

function Campo({
  nome,
  rotulo,
  tipo = "text",
  obrigatorio = false,
  autoFocus = false,
}: {
  nome: string;
  rotulo: string;
  tipo?: string;
  obrigatorio?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</label>
      <input
        name={nome}
        type={tipo}
        required={obrigatorio}
        autoFocus={autoFocus}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
    </div>
  );
}
