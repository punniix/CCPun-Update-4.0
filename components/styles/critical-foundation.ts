export const CRITICAL_FOUNDATION_CSS = `
          :root{color-scheme:dark;--background:0 15% 18%;--foreground:0 10% 98%;--primary:45 60% 70%;--primary-foreground:0 15% 12%;--muted-foreground:0 10% 70%;--border:0 12% 32%;--radius:1rem;}
          body{background-color:hsl(0 15% 18%);color:hsl(0 10% 98%);font-family:'Kanit',system-ui,sans-serif;font-weight:300;-webkit-font-smoothing:antialiased;}
          .hero-dark-overlay{background:linear-gradient(180deg,rgba(15,20,30,.45) 0%,rgba(20,25,35,.40) 50%,rgba(15,20,30,.50) 100%);}
          .hero-gold-accent{background:radial-gradient(ellipse at 30% 20%,rgba(220,190,130,.08) 0%,transparent 50%),radial-gradient(ellipse at 70% 80%,rgba(220,190,130,.05) 0%,transparent 50%);}
          .hero-grid-pattern{background-image:radial-gradient(circle at 1px 1px,rgba(255,255,255,.3) 1px,transparent 0);background-size:40px 40px;}
          .glass-card{position:relative;overflow:hidden;border-radius:1rem;background:linear-gradient(135deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,.06) 50%,rgba(255,255,255,.03) 100%);backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(255,255,255,.15);box-shadow:0 8px 32px rgba(0,0,0,.25),inset 0 1px 1px rgba(255,255,255,.15);}
          .gold-button{position:relative;overflow:hidden;border-radius:9999px;padding:.75rem 1.25rem;font-weight:600;transition:all .3s;color:hsl(0 15% 12%);background:linear-gradient(135deg,hsl(45,60%,70%) 0%,hsl(45,70%,78%) 50%,hsl(45,60%,70%) 100%);background-size:200% 200%;box-shadow:0 2px 8px rgba(0,0,0,.2),0 0 20px rgba(220,190,130,.18),inset 0 1px 0 rgba(255,255,255,.45),inset 0 -1px 0 rgba(0,0,0,.08);}
          .text-gold-gradient{color:#e0c985;}
          @media(max-width:768px){.gold-button{padding:.75rem 1.25rem;}}
          @media(min-width:768px){.gold-button{padding:1rem 2rem;}}
          @keyframes hero-fade-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
          .hero-badge{animation:hero-fade-up .4s ease both;}
          .hero-heading{animation:hero-fade-up .4s ease both;}
          .hero-subtitle{animation:hero-fade-up .4s ease .1s both;}
          .hero-cta{animation:hero-fade-up .4s ease .2s both;}
          @keyframes scroll-breath{0%,100%{transform:translateX(-50%) translateY(0);opacity:1}50%{transform:translateX(-50%) translateY(6px);opacity:.62}}
          @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}.hero-badge,.hero-heading,.hero-subtitle,.hero-cta,.scroll-indicator{animation:none!important}}
        `;
