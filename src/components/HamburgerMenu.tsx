"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar } from "./Sidebar";

const LINKS: { href: string; label: string; enabled: boolean }[] = [
  { href: "/market", label: "Comprar", enabled: true },
  { href: "/market/new", label: "Vender", enabled: true },
  { href: "#", label: "Petición de compra", enabled: false },
  { href: "#", label: "Regalar", enabled: false },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);

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
          {LINKS.map((link) =>
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
