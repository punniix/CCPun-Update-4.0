'use client';
import { usePublicCopy } from "@/components/ui/PublicCopyProvider";
import { BLOG_COPY_DEFAULTS } from "@/lib/content/blog-copy-defaults";

import {useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import type {ArticleBlock} from '@/lib/content/types';
import styles from './SignatureArticle.module.css';

type Editorial=Extract<ArticleBlock,{type:'signatureEditorial'}>;
type Explorer=Extract<ArticleBlock,{type:'signaturePlanExplorer'}>;
type TableBlock=Extract<ArticleBlock,{type:'signatureStructuredTable'}>;
const fmt=(n:number)=>new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(n);

// One observer for the entire article: no scroll listeners, RAF loops or timers.
// Offscreen blocks remain static; the browser animates only opacity and transform.
const signatureMotionListeners = new Map<HTMLElement, (visible:boolean)=>void>();
let signatureMotionObserver: IntersectionObserver | null = null;
function useSignatureMotion() {
  const ref=useRef<HTMLElement>(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    const element=ref.current;
    if(!element||typeof IntersectionObserver==='undefined')return;
    if(!signatureMotionObserver){
      signatureMotionObserver=new IntersectionObserver((entries)=>{
        for(const entry of entries)signatureMotionListeners.get(entry.target as HTMLElement)?.(entry.isIntersecting);
      },{rootMargin:'64px 0px 64px 0px',threshold:0});
    }
    signatureMotionListeners.set(element,setVisible);
    signatureMotionObserver.observe(element);
    return()=>{
      signatureMotionObserver?.unobserve(element);
      signatureMotionListeners.delete(element);
      if(signatureMotionListeners.size===0){signatureMotionObserver?.disconnect();signatureMotionObserver=null;}
    };
  },[]);
  return {ref,'data-motion-active':visible?'true':'false'};
}

function Heading({title,description,eyebrow}:{title:string;description?:string;eyebrow?:string}) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);
  return <header className={styles.heading}><span className={styles.eyebrow}>{eyebrow ?? copyText("blog.editorialEyebrow")}</span>
    <h3>{title}</h3>{description&&<p>{description}</p>}</header>;
}
function Foot({text,note}:{text?:string;note?:string}) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);

  return (text||note)?<footer className={styles.foot}>{text&&<p><b>{copyText("blog.b")}</b> {text}</p>}{note&&<small>{note}</small>}</footer>:null;
}
function NumberText({n}:{n:number}){return <span className={styles.amount}>{fmt(n)}</span>;}
/**
 * Format whole-baht inputs in place (30,000, 60,000), with a mobile number keypad.
 * Transient DOM/input state only; no network, cookies or database. Setting the
 * selection after grouping keeps the caret steady even when editing mid-string.
 */
function GroupedMoneyInput({
  id,initialValue,max,onValueChange,
}:{
  id:string;initialValue:number;max:number;onValueChange:(value:number)=>void;
}){
  return <input id={id} className={styles.input} type="text" inputMode="numeric"
    autoComplete="off" spellCheck={false} pattern="[0-9,]*"
    defaultValue={fmt(Math.max(0,Math.min(initialValue,max)))}
    onInput={(event)=>{
      const input=event.currentTarget;
      const raw=input.value;
      const cursor=input.selectionStart??raw.length;
      const toLatin=(text:string)=>text.replace(/[๐-๙]/g,ch=>String(ch.charCodeAt(0)-0x0E50));
      const before=toLatin(raw.slice(0,cursor)).replace(/[^0-9]/g,'').length;
      const digits=toLatin(raw).replace(/[^0-9]/g,'').slice(0,15);
      const amount=Math.min(max,Number(digits)||0);
      const formatted=digits?fmt(amount):'';
      input.value=formatted;
      let position=0,seen=0;
      while(position<formatted.length && seen<Math.min(before,String(amount).length)){
        if(/[0-9]/.test(formatted[position]))seen++;
        position++;
      }
      input.setSelectionRange(position,position);
      onValueChange(amount);
    }}
    onBlur={(event)=>{if(!event.currentTarget.value)event.currentTarget.value='0';}}
  />;
}

const hasHttpSource=(entries:{url?:string}[])=>entries.some(e=>!!e.url&&/^https?:\/\//.test(e.url));
function reviewDate(iso:string|undefined){
  if(!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso))return '';
  const parsed=new Date(iso+'T12:00:00.000Z');
  if(Number.isNaN(parsed.getTime())||parsed.toISOString().slice(0,10)!==iso)return '';
  return new Intl.DateTimeFormat('th-TH',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(parsed);
}

export function SignatureEditorialView({block}: {block:Editorial}) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);

  const motion=useSignatureMotion();
  const [used,setUsed]=useState(Math.max(0,block.used??0));
  const [months,setMonths]=useState(block.months??6);
  const [monthly,setMonthly]=useState(block.monthlyAmount??30000);
  const [existing,setExisting]=useState(block.existingAmount??0);
  const [checked,setChecked]=useState<number[]>([]);
  const [active,setActive]=useState(0);
  const id=useId();
  const entries=block.entries;
  const max=Math.max(0,block.limit??100000);
  const goal=monthly*months,remaining=Math.max(0,goal-existing);
  const progress=max>0?Math.min(100,Math.round(used/max*100)):0;
  const choose=(i:number)=>setChecked(current=>current.includes(i)?current.filter(x=>x!==i):[...current,i]);
  let contents:ReactNode;
  switch(block.kind) {
    case 'insight':
      contents=<div className={styles.two}>
        <div className={styles.panel}><span className={styles.caption}>{copyText("blog.caption")}</span><h4>{block.firstLabel||copyText("blog.signatureEditorialViewText")}</h4></div>
        <div className={styles.panel}><span className={styles.caption}>{copyText("blog.caption2")}</span><h4>{block.secondLabel||copyText("blog.signatureEditorialViewText2")}</h4></div>
      </div>;break;
    case 'limit':
      contents=<div className={styles.panel}><div className={styles.split}>
        <span className={styles.caption}>{copyText("blog.caption3")}</span><strong><NumberText n={max}/>{" "}{copyText("blog.strong")}</strong></div>
        <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={max||100} aria-valuenow={Math.min(max,used)} aria-label={copyText("blog.signatureEditorialViewarialabel")}>
          <span style={{width:progress+'%'}}/></div>
        <label className={styles.field} htmlFor={id}>{copyText("blog.field")}</label>
        <input id={id} className={styles.range} type="range" min={0} max={max||100} step={Math.max(1,Math.round(max/100)||1)} value={Math.min(used,max||100)} onChange={e=>setUsed(Number(e.target.value))}/>
        <div className={styles.two}><div><span className={styles.caption}>{copyText("blog.caption4")}</span><div className={styles.number}><NumberText n={Math.min(used,max)}/></div></div>
          <div><span className={styles.caption}>{copyText("blog.caption5")}</span><div className={styles.number}><NumberText n={Math.max(0,max-used)}/></div></div></div>
      </div>;break;
    case 'beforeAfter':
      contents=<div className={styles.two}>{entries.slice(0,2).map((item,i)=><div className={styles.panel} key={i}>
        <span className={styles.caption}>{i===0?copyText("blog.signatureEditorialViewText3"):copyText("blog.signatureEditorialViewText4")}</span>
        <h4>{item.label}</h4><div className={styles.highlight}>{item.value}</div>{item.detail&&<p>{item.detail}</p>}</div>)}</div>;break;
    case 'timeline':
      contents=<ol className={styles.timeline}>{entries.map((item,i)=><li className={styles.timelineStep} key={i}>
        <span className={styles.stepNum}>{String(i+1).padStart(2,'0')}</span><div><b>{item.label}</b><p>{item.value}</p>{item.detail&&<small>{item.detail}</small>}</div></li>)}</ol>;break;
    case 'checklist':
      contents=<div className={styles.panel}><p className={styles.highlight}>{copyText("blog.highlight")}{checked.length} / {entries.length}{" "}{copyText("blog.highlight2")}</p>
        <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={entries.length||1} aria-valuenow={checked.length} aria-label={copyText("blog.signatureEditorialViewarialabel2")}><span style={{width:(entries.length?checked.length/entries.length*100:0)+'%'}}/></div>
        <div className={styles.checklist}>{entries.map((e,i)=><label key={i}>
          <input type="checkbox" checked={checked.includes(i)} onChange={()=>choose(i)}/>
          <span><b>{e.label}</b><small>{e.value}</small></span></label>)}</div>
        <small>{copyText("blog.small")}</small></div>;break;
    case 'calculation':
      contents=<div className={styles.two}>
        <div className={styles.panel}>
          <label className={styles.field} htmlFor={id+'monthly'}>{copyText("blog.field2")}</label>
          <GroupedMoneyInput id={id+'monthly'} initialValue={block.monthlyAmount??30000} max={1000000000} onValueChange={setMonthly}/>
          <label className={styles.field} htmlFor={id+'months'}>{copyText("blog.field3")}{months}</label>
          <input id={id+'months'} className={styles.range} type="range" min={1} max={120} value={months} onChange={e=>setMonths(Number(e.target.value))}/>
          <label className={styles.field} htmlFor={id+'existing'}>{copyText("blog.field4")}</label>
          <GroupedMoneyInput id={id+'existing'} initialValue={block.existingAmount??0} max={1000000000000} onValueChange={setExisting}/>
        </div>
        <div className={styles.panel}><span className={styles.caption}>{copyText("blog.caption6")}</span><p className={styles.number}><NumberText n={remaining}/>{" "}{copyText("blog.strong")}</p>
          <details className={styles.details}><summary>{copyText("blog.summary")}</summary>
            <p>{fmt(monthly)} × {fmt(months)}{" "}{copyText("blog.p3")}{fmt(goal)}{" "}{copyText("blog.strong")}</p>
            <p>{fmt(goal)} − {fmt(existing)} = {fmt(goal-existing)}{" "}{copyText("blog.strong")}</p>
            <p>{copyText("blog.p4")}</p></details>
        </div>
      </div>;break;
    case 'glossary': {
      const term=entries[active];
      contents=<div className={styles.glossary}>
        <nav className={styles.termNav} aria-label={copyText("blog.signatureEditorialViewarialabel3")}>{entries.map((e,i)=><button className={i===active?styles.selected:undefined} type="button" key={i} aria-pressed={i===active} onClick={()=>setActive(i)}>{e.label}</button>)}</nav>
        <div className={styles.panel} key={active} aria-live="polite">{term?<><span className={styles.caption}>{copyText("blog.caption7")}</span><h4>{term.label}</h4><p>{term.value}</p>{term.detail&&<div className={styles.subtle}><b>{copyText("blog.b2")}</b><p>{term.detail}</p></div>}</>:<p>{copyText("blog.p5")}</p>}</div>
      </div>;break;
    }
    case 'sources': {
      // Never show "verified" based on free-form text alone.
      const reviewed=block.sourceStatus==='verified'&&!!reviewDate(block.verifiedAt)&&hasHttpSource(entries);
      contents=<div className={styles.sourceGroup}>
        <div className={styles.sourceMeta} aria-label={copyText("blog.signatureEditorialViewarialabel4")}>
          <span className={styles.sourceBadge} data-verified={reviewed?'true':'false'}>
            {reviewed?copyText("blog.signatureEditorialViewText5"):copyText("blog.signatureEditorialViewText6")}
          </span>
          {block.effectivePeriod&&<p><strong>{copyText("blog.strong2")}</strong> {block.effectivePeriod}</p>}
          {block.sourceVersion&&<p><strong>{copyText("blog.strong3")}</strong> {block.sourceVersion}</p>}
          {reviewed&&block.verifiedAt&&<p><strong>{copyText("blog.strong4")}</strong> <time dateTime={block.verifiedAt}>{reviewDate(block.verifiedAt)}</time></p>}
        </div>
        <div className={styles.sourceList} role="list">{entries.map((e,i)=><div className={styles.sourceRow} role="listitem" key={i}>
          <div><cite>{e.label}</cite><p>{e.value}</p>{e.detail&&<small>{e.detail}</small>}</div>
          {e.url&&/^https?:\/\//.test(e.url)&&<a href={e.url} target="_blank" rel="noopener noreferrer" aria-label={copyText("blog.signatureEditorialViewText7")+e.label}>{copyText("blog.a")}<span aria-hidden="true">↗</span></a>}
        </div>)}</div>
        {!reviewed&&<p className={styles.sourceDisclaimer}>{copyText("blog.sourceDisclaimer")}</p>}
      </div>;break;
    }
    default: contents=null;
  }
  return <section className={styles.root} {...motion} data-ccpun-signature={block.kind} aria-label={block.title}>
    <Heading title={block.title} description={block.description} eyebrow={block.kind==='sources'?'CCPUN / SOURCE & VERIFICATION':'CCPUN / EDITORIAL INSIGHT'}/>
    {contents}
    <Foot text={block.takeaway} note={block.sampleNote}/>
  </section>;
}
export function SignatureTableView({block}:{block:TableBlock}) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);

  const motion=useSignatureMotion();
  // Keep every table row in server-rendered HTML for readers and search engines.
  // Only collapse the long tail of the mobile layout with native <details>
  // (no extra JavaScript state, tracking, or persistence).
  const mobileRow=(r:string[],i:number)=><dl key={i} className={styles.panel}>
    {block.headers.map((h,j)=><div key={j}><dt>{h}</dt><dd>{r[j]??'—'}</dd></div>)}
  </dl>;
  const mobileInitialRows=5;
  return <section className={styles.root} {...motion} aria-label={block.title} data-ccpun-signature="table">
    <Heading title={block.title} description={block.description} eyebrow={copyText("blog.signatureTableVieweyebrow")}/>
    <div className={styles.tableDesktop}><table><thead><tr>{block.headers.map((h,i)=><th scope="col" key={i}>{h}</th>)}</tr></thead>
      <tbody>{block.rows.map((r,i)=><tr key={i}>{block.headers.map((_,j)=><td key={j}>{r[j]??'—'}</td>)}</tr>)}</tbody></table></div>
    <div className={styles.tableMobile}>
      {block.rows.slice(0,mobileInitialRows).map(mobileRow)}
      {block.rows.length>mobileInitialRows&&<details className={styles.tableMore}>
        <summary>{copyText("blog.summary2")}{block.rows.length-mobileInitialRows}{" "}{copyText("blog.summary3")}<span aria-hidden="true">⌄</span></summary>
        <div className={styles.tableMoreRows}>{block.rows.slice(mobileInitialRows).map((r,i)=>mobileRow(r,i+mobileInitialRows))}</div>
      </details>}
    </div>
    <Foot text={block.takeaway} note={block.sampleNote}/>
  </section>;
}
function PlanSelector({plans,index,onSelect,label}:{plans:Explorer['plans'];index:number;onSelect:(n:number)=>void;label:string}) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);

  const [open,setOpen]=useState(false);
  return <div className={styles.selectWrap}>
    <span className={styles.field}>{label}</span>
    <div className={styles.customSelect}>
      <button className={styles.selectButton} type="button" aria-expanded={open} aria-haspopup="true" onClick={()=>setOpen(x=>!x)}>
        {plans[index]?.name||copyText("blog.planSelectorText")} <span aria-hidden="true">{open?'▴':'▾'}</span></button>
      {open&&<div className={styles.optionList} role="group" aria-label={label}>{plans.map((p,i)=>
        <button key={i} className={i===index?styles.optionActive:undefined} type="button" aria-pressed={i===index}
          onClick={()=>{onSelect(i);setOpen(false);}}>{p.name}{i===index?' ✓':''}</button>)}</div>}
    </div>
  </div>;
}
export function SignaturePlanView({block}:{block:Explorer}) {
  const copyText = usePublicCopy(BLOG_COPY_DEFAULTS);

  const motion=useSignatureMotion();
  const plans=block.plans;
  const [view,setView]=useState<'single'|'overview'|'compare'>('single');
  const [a,setA]=useState(0);
  const [b,setB]=useState(Math.min(1,plans.length-1));
  const [activeCategory,setCategory]=useState('all');
  const [diff,setDiff]=useState(false);
  const [more,setMore]=useState(false);
  const categories=[['all',copyText("blog.categoriesText")],['medical',copyText("blog.categoriesText2")],['extra',copyText("blog.categoriesText3")],['condition',copyText("blog.categoriesText4")]];
  const rows=useMemo(()=>{
    const labels=Array.from(new Set(plans.flatMap(p=>p.benefits.map(item=>item.label))));
    return labels.map(label=>{
      const aa=plans[a]?.benefits.find(x=>x.label===label);
      const bb=plans[b]?.benefits.find(x=>x.label===label);
      return {label,va:aa?.value||'—',vb:bb?.value||'—',category:bb?.category||aa?.category||'medical'};
    }).filter(r=>(activeCategory==='all'||r.category===activeCategory)&&(!diff||r.va!==r.vb));
  },[plans,a,b,activeCategory,diff]);
  const focus=plans[a];
  if(!focus)return null;
  return <section className={styles.root} {...motion} data-ccpun-signature="plan-explorer" aria-label={block.title}>
    <Heading title={block.title} description={block.description} eyebrow={copyText("blog.signaturePlanVieweyebrow")}/>
    <div className={styles.tabs} role="group" aria-label={copyText("blog.signaturePlanViewarialabel")}>
      {[['single',copyText("blog.signaturePlanViewText")],['overview',copyText("blog.signaturePlanViewText2")],['compare',copyText("blog.signaturePlanViewText3")]].map(([v,label])=><button key={v} type="button"
        className={view===v?styles.selected:undefined} aria-pressed={view===v} onClick={()=>setView(v as typeof view)}>{label}</button>)}
    </div>
    {view==='single'&&<>
      <PlanSelector plans={plans} index={a} onSelect={setA} label={copyText("blog.signaturePlanViewlabel")}/>
      <div className={styles.featurePanel} key={a}>
        <span className={styles.caption}>{copyText("blog.caption8")}</span><h4>{focus.name}</h4>{focus.headline&&<div className={styles.number}>{focus.headline}</div>}
        <div className={styles.benefitGrid}>{focus.benefits.slice(0,more?undefined:4).map((item,i)=>
          <div key={i}><span className={styles.caption}>{item.label}</span><strong>{item.value}</strong></div>)}</div>
        {focus.benefits.length>4&&<button className={styles.ghostButton} type="button" onClick={()=>setMore(x=>!x)}>{more?copyText("blog.signaturePlanViewText4"):copyText("blog.signaturePlanViewText5")}</button>}
        <button className={styles.primaryButton} type="button" onClick={()=>{setB(a===b?(a+1)%plans.length:b);setView('compare')}}>{copyText("blog.primaryButton")}</button>
      </div>
    </>}
    {view==='overview'&&<div className={styles.overview}>{plans.map((plan,i)=><button type="button" key={i} className={styles.overCard}
      onClick={()=>{setA(i);setView('single')}}><span className={styles.caption}>{copyText("blog.caption9")}{i+1}</span><h4>{plan.name}</h4><p>{plan.headline}</p><small>{copyText("blog.small2")}</small></button>)}</div>}
    {view==='compare'&&<>
      <div className={styles.two}><PlanSelector plans={plans} index={a} onSelect={setA} label={copyText("blog.signaturePlanViewlabel2")}/>
        <PlanSelector plans={plans} index={b} onSelect={setB} label={copyText("blog.signaturePlanViewlabel3")}/></div>
      <div className={styles.two}><div className={styles.panel}><span className={styles.caption}>{copyText("blog.signaturePlanViewlabel2")}</span><h4>{plans[a]?.name}</h4><div className={styles.highlight}>{plans[a]?.headline}</div></div>
        <div className={styles.panel}><span className={styles.caption}>{copyText("blog.signaturePlanViewlabel3")}</span><h4>{plans[b]?.name}</h4><div className={styles.highlight}>{plans[b]?.headline}</div></div></div>
      <div className={styles.filters}>{categories.map(([key,text])=><button type="button" key={key} aria-pressed={key===activeCategory}
        className={key===activeCategory?styles.selected:undefined} onClick={()=>setCategory(key)}>{text}</button>)}
        <button type="button" aria-pressed={diff} className={diff?styles.selected:undefined} onClick={()=>setDiff(!diff)}>{copyText("blog.selected")}</button></div>
      <div className={styles.tableDesktop}><table><thead><tr><th scope="col">{copyText("blog.highlight2")}</th><th scope="col">{plans[a]?.name}</th><th scope="col">{plans[b]?.name}</th></tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i}><th scope="row">{r.label}</th><td>{r.va}</td><td>{r.vb}</td></tr>)}</tbody></table></div>
      <div className={styles.tableMobile}>{rows.map((r,i)=><dl key={i} className={styles.panel}>
        <div><dt>{r.label}</dt><dd></dd></div><div><dt>{copyText("blog.signaturePlanViewlabel2")}</dt><dd>{r.va}</dd></div><div><dt>{copyText("blog.signaturePlanViewlabel3")}</dt><dd>{r.vb}</dd></div></dl>)}</div>
      {rows.length===0&&<p className={styles.caption}>{copyText("blog.caption10")}</p>}
    </>}
    <aside className={styles.planFacts} aria-label={copyText("blog.signaturePlanViewarialabel2")}>
      <h4>{copyText("blog.h4")}</h4>
      <p>{copyText("blog.p6")}{plans.length}{" "}{copyText("blog.p7")}{plans.slice(0,4).map(p=>p.name).join(' · ')}{plans.length>4?copyText("blog.signaturePlanViewText6")+(plans.length-4)+copyText("blog.signaturePlanViewText7"):''}</p>
      <details>
        <summary>{copyText("blog.summary4")}{plans.length}{" "}{copyText("blog.summary5")}</summary>
        <div className={styles.planFactsGrid}>
          {plans.map((plan,i)=><section className={styles.planFactCard} key={i} aria-label={plan.name}>
            <h5>{plan.name}</h5>
            {plan.headline&&<p className={styles.planFactHeadline}>{plan.headline}</p>}
            <dl>{plan.benefits.map((benefit,j)=><div key={j}><dt>{benefit.label}</dt><dd>{benefit.value}</dd></div>)}</dl>
          </section>)}
        </div>
      </details>
    </aside>
    <Foot text={block.takeaway} note={block.sampleNote}/>
  </section>;
}
