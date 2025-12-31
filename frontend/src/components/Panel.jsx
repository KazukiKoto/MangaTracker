import { forwardRef } from "react";

const Panel = forwardRef(({ title, copy, children, className = "" }, ref) => (
  <section
    ref={ref}
    className={`rounded-[1.5rem] bg-white/90 shadow-floating border border-white/40 backdrop-blur-md px-6 py-7 flex flex-col gap-4 dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_25px_60px_rgba(1,4,9,0.8)] ${className}`}
  >
    <header>
      <h2 className="text-xl font-semibold text-ink dark:text-white">{title}</h2>
      {copy && <p className="text-sm text-slate-500 dark:text-slate-400">{copy}</p>}
    </header>
    {children}
  </section>
));

Panel.displayName = "Panel";

export default Panel;
