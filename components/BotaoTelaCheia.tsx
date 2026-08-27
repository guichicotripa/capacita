"use client";

import { useEffect, useState } from "react";
import { useDict } from "./I18nProvider";

// Tela cheia de verdade (API de fullscreen do navegador), não só uma janela
// maior. Abrir em outra janela ainda mostra a barra do navegador; isto tira
// tudo e deixa só a capacitação, que é o que se espera de "apresentação".
export function BotaoTelaCheia() {
  const d = useDict();
  const [cheia, setCheia] = useState(false);

  // Só assina o evento. Detectar suporte aqui exigiria um setState no corpo do
  // efeito (cascading render) e, pior, mudaria o que é renderizado depois da
  // hidratação. O suporte é conferido na hora do clique.
  useEffect(() => {
    const aoMudar = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  const alternar = () => {
    const raiz = document.documentElement;
    // Navegador sem a API (Safari no iPhone, por exemplo): não faz nada em vez
    // de estourar. A capacitação continua utilizável na janela normal.
    if (!raiz.requestFullscreen) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      raiz.requestFullscreen().catch(() => {});
    }
  };

  return (
    <button onClick={alternar} className="text-sm text-slate-500 hover:underline">
      {cheia ? `⤡ ${d.treino.sairTelaCheia}` : `⛶ ${d.treino.telaCheia}`}
    </button>
  );
}
