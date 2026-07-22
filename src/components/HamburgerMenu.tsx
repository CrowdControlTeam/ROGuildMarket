"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sidebar } from "./Sidebar";
import { marketViewTitle } from "@/lib/market-labels";

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("market");

  // "Mercado"/"Regalos" siguen fijos aquí a propósito — migrar el resto de
  // este componente a i18n es una tarea aparte (ver ro-guild-market-plan.md).
  const links: { href: string; label: string; enabled: boolean }[] = [
    { href: "/market", label: "Mercado", enabled: true },
    { href: "/market?type=SALE", label: marketViewTitle(t, "SALE"), enabled: true },
    { href: "/market?type=BUY", label: marketViewTitle(t, "BUY"), enabled: true },
    { href: "/market?type=TRADE", label: marketViewTitle(t, "TRADE"), enabled: true },
    { href: "/market/gifts", label: "Regalos", enabled: true },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú del mercado"
        className="flex flex-col gap-1 p-1"
      >
        <span className="block h-0.5 w-5 bg-ro-gold" />
        <span className="block h-0.5 w-5 bg-ro-gold" />
        <span className="block h-0.5 w-5 bg-ro-gold" />
      </button>

      <Sidebar side="left" open={open} onClose={() => setOpen(false)} title="Mercado">
        <nav className="flex flex-col gap-1">
          {links.map((link) =>
            link.enabled ? (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 font-medium hover:bg-ro-gold/20"
              >
                {link.label}
              </Link>
            ) : (
              <span
                key={link.label}
                className="cursor-not-allowed rounded-md px-3 py-2 text-ro-text-muted"
              >
                {link.label}{" "}
                <span className="text-xs italic">(próximamente)</span>
              </span>
            ),
          )}
        </nav>
      </Sidebar>
    </>
  );
}
