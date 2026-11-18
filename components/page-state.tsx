"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
  return (
    <p className="page-state state-loading" role="status">
      <LoaderCircle className="spinner" size={20} aria-hidden="true" />
      {label}
    </p>
  );
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="page-state" aria-busy={pending}>
      <h2 role="status">{title}</h2>
      <p>{description}</p>
      <button type="button" className="button button-quiet" disabled={pending}
        onClick={() => startTransition(() => router.refresh())}>
        <RotateCcw className={pending ? "spinner" : undefined} size={16} aria-hidden="true" />
        {pending ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  link,
}: {
  title: string;
  description: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="page-state" role="status">
      <h2>{title}</h2>
      <p>{description}</p>
      {link && <Link className="button button-quiet" href={link.href}>{link.label}</Link>}
    </div>
  );
}
