// next/dynamic pour le banc statique : un React.lazy sous Suspense.
import { createElement, lazy, Suspense, type ComponentType } from "react";
type Charge = () => Promise<unknown>;
export default function dynamic(charger: Charge, opts?: { loading?: ComponentType }) {
  const L = lazy(async () => {
    const r = (await charger()) as { default?: ComponentType } | ComponentType;
    return { default: (typeof r === "function" ? r : r.default) as ComponentType };
  });
  return function Dyn(props: Record<string, unknown>) {
    return createElement(Suspense, { fallback: opts?.loading ? createElement(opts.loading) : null }, createElement(L, props));
  };
}
