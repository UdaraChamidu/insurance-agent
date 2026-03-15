export default function FaqAccordion({ items = [] }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <details
          key={item.question}
          className={`faq-item group rounded-[1.5rem] border border-blue-100 bg-white/90 p-6 shadow-[0_18px_45px_rgba(37,99,235,0.08)] open:border-blue-300 open:bg-blue-50/40 reveal`}
          open={index === 0}
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <summary className="cursor-pointer list-none text-lg font-semibold text-slate-950">
            <span className="flex items-start justify-between gap-4">
              <span>{item.question}</span>
              <span className="faq-toggle mt-0.5">+</span>
            </span>
          </summary>
          <p className="body-copy mt-4 text-slate-700">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
