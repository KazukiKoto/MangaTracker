const Panel = ({ title, copy, children, className = "" }) => (
  <section
    className={`rounded-[1.5rem] bg-white/90 shadow-floating border border-white/40 backdrop-blur-md px-6 py-7 flex flex-col gap-4 ${className}`}
  >
    <header>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {copy && <p className="text-sm text-slate-500">{copy}</p>}
    </header>
    {children}
  </section>
);

export default Panel;
