import { ChevronDown } from "lucide-react";
import type { ArticleFaq as ArticleFaqItem } from "@/lib/content/types";

export default function ArticleFaq({ items }: { items: ArticleFaqItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className="mt-12 border-t border-border/30 pt-8" aria-labelledby="article-faq-title">
      <h2 id="article-faq-title" className="text-xl font-semibold text-foreground sm:text-2xl">
        คำถามที่พบบ่อย
      </h2>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <details key={item.question} className="group rounded-xl border border-border/60 bg-secondary/55 px-4 py-1 sm:px-5">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
              <span>{item.question}</span>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-primary transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              />
            </summary>
            <p className="pb-4 text-sm leading-7 text-muted-foreground sm:text-base">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
