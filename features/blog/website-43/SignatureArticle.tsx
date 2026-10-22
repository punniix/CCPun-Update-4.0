'use client';

import {useId,useMemo,useState,type ReactNode} from 'react';
import type {ArticleBlock} from '@/lib/content/types';
import styles from './SignatureArticle.module.css';

type Editorial=Extract<ArticleBlock,{type:'signatureEditorial'}>;
type Explorer=Extract<ArticleBlock,{type:'signaturePlanExplorer'}>;
type TableBlock=Extract<ArticleBlock,{type:'signatureStructuredTable'}>;
const fmt=(n:number)=>new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(n);
function Heading({title,description}:{title:string;description?:string}) {
  return <header className={styles.heading}><span className={styles.eyebrow}>CCPUN / EDITORIAL INSIGHT</span>
    <h3>{title}</h3>{description&&<p>{description}</p>}</header>;
}
function Foot({text,note}:{text?:string;note?:string}) {
  return (text||note)?<footer className={styles.foot}>{text&&<p><b>สิ่งที่ควรดูต่อ</b> {text}</p>}{note&&<small>{note}</small>}</footer>:null;
}
function NumberText({n}:{n:number}){return <span className={styles.amount}>{fmt(n)}</span>;}
export function SignatureEditorialView({block}: {block:Editorial}) {
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
        <div className={styles.panel}><span className={styles.caption}>สิ่งที่มักมองก่อน</span><h4>{block.firstLabel||'ดูตัวเลขที่สูงหรือราคาที่ถูกที่สุด'}</h4></div>
        <div className={styles.panel}><span className={styles.caption}>สิ่งที่ควรดูจริง ๆ</span><h4>{block.secondLabel||'ดูเงื่อนไข ข้อจำกัด และสิ่งที่ได้รับแลกมา'}</h4></div>
      </div>;break;
    case 'limit':
      contents=<div className={styles.panel}><div className={styles.split}>
        <span className={styles.caption}>วงเงินเต็ม (ตัวอย่าง)</span><strong><NumberText n={max}/> บาท</strong></div>
        <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={max||100} aria-valuenow={Math.min(max,used)} aria-label="สัดส่วนวงเงินที่ใช้">
          <span style={{width:progress+'%'}}/></div>
        <label className={styles.field} htmlFor={id}>ทดลองเปลี่ยนจำนวนเงินที่ใช้ไป</label>
        <input id={id} className={styles.range} type="range" min={0} max={max||100} step={Math.max(1,Math.round(max/100)||1)} value={Math.min(used,max||100)} onChange={e=>setUsed(Number(e.target.value))}/>
        <div className={styles.two}><div><span className={styles.caption}>ใช้แล้ว</span><div className={styles.number}><NumberText n={Math.min(used,max)}/></div></div>
          <div><span className={styles.caption}>คงเหลือ</span><div className={styles.number}><NumberText n={Math.max(0,max-used)}/></div></div></div>
      </div>;break;
    case 'beforeAfter':
      contents=<div className={styles.two}>{entries.slice(0,2).map((item,i)=><div className={styles.panel} key={i}>
        <span className={styles.caption}>{i===0?'ก่อน':'หลัง'}</span>
        <h4>{item.label}</h4><div className={styles.highlight}>{item.value}</div>{item.detail&&<p>{item.detail}</p>}</div>)}</div>;break;
    case 'timeline':
      contents=<ol className={styles.timeline}>{entries.map((item,i)=><li className={styles.timelineStep} key={i}>
        <span className={styles.stepNum}>{String(i+1).padStart(2,'0')}</span><div><b>{item.label}</b><p>{item.value}</p>{item.detail&&<small>{item.detail}</small>}</div></li>)}</ol>;break;
    case 'checklist':
      contents=<div className={styles.panel}><p className={styles.highlight}>เตรียมข้อมูลแล้ว {checked.length} / {entries.length} รายการ</p>
        <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={entries.length||1} aria-valuenow={checked.length} aria-label="ความพร้อมของข้อมูล"><span style={{width:(entries.length?checked.length/entries.length*100:0)+'%'}}/></div>
        <div className={styles.checklist}>{entries.map((e,i)=><label key={i}>
          <input type="checkbox" checked={checked.includes(i)} onChange={()=>choose(i)}/>
          <span><b>{e.label}</b><small>{e.value}</small></span></label>)}</div>
        <small>เช็กครบไม่ได้หมายความว่าได้รับสิทธิภาษีหรือผ่านการรับประกัน</small></div>;break;
    case 'calculation':
      contents=<div className={styles.two}>
        <div className={styles.panel}>
          <label className={styles.field} htmlFor={id+'monthly'}>เงินต่อเดือน (บาท)</label>
          <input id={id+'monthly'} className={styles.input} type="number" min={0} max={1000000000} value={monthly} onChange={e=>setMonthly(Math.max(0,Math.min(1000000000,Number(e.target.value)||0)))}/>
          <label className={styles.field} htmlFor={id+'months'}>จำนวนเดือน: {months}</label>
          <input id={id+'months'} className={styles.range} type="range" min={1} max={120} value={months} onChange={e=>setMonths(Number(e.target.value))}/>
          <label className={styles.field} htmlFor={id+'existing'}>เงินที่มีแล้ว (บาท)</label>
          <input id={id+'existing'} className={styles.input} type="number" min={0} max={1000000000000} value={existing} onChange={e=>setExisting(Math.max(0,Number(e.target.value)||0))}/>
        </div>
        <div className={styles.panel}><span className={styles.caption}>ส่วนที่ยังต้องเตรียม (สมมติฐาน)</span><p className={styles.number}><NumberText n={remaining}/> บาท</p>
          <details className={styles.details}><summary>ดูที่มาของตัวเลข</summary>
            <p>{fmt(monthly)} × {fmt(months)} เดือน = {fmt(goal)} บาท</p>
            <p>{fmt(goal)} − {fmt(existing)} = {fmt(goal-existing)} บาท</p>
            <p>ถ้ามีเงินเกินเป้าหมาย ผลที่ยังต้องเตรียมจะเป็นศูนย์</p></details>
        </div>
      </div>;break;
    case 'glossary': {
      const term=entries[active];
      contents=<div className={styles.glossary}>
        <nav className={styles.termNav} aria-label="เลือกคำศัพท์">{entries.map((e,i)=><button className={i===active?styles.selected:undefined} type="button" key={i} aria-pressed={i===active} onClick={()=>setActive(i)}>{e.label}</button>)}</nav>
        <div className={styles.panel} key={active} aria-live="polite">{term?<><span className={styles.caption}>ความหมาย</span><h4>{term.label}</h4><p>{term.value}</p>{term.detail&&<div className={styles.subtle}><b>ควรดูอะไรต่อ</b><p>{term.detail}</p></div>}</>:<p>เพิ่มคำศัพท์ใน Sanity เพื่อแสดงที่นี่</p>}</div>
      </div>;break;
    }
    case 'sources':
      contents=<div className={styles.sourceList}>{entries.map((e,i)=><div className={styles.sourceRow} key={i}>
        <div><b>{e.label}</b><p>{e.value}</p>{e.detail&&<small>{e.detail}</small>}</div>
        {e.url&&/^https?:\/\//.test(e.url)&&<a href={e.url} target="_blank" rel="noopener noreferrer">ดูแหล่งข้อมูล <span aria-hidden>↗</span></a>}
      </div>)}</div>;break;
    default: contents=null;
  }
  return <section className={styles.root} data-ccpun-signature={block.kind} aria-label={block.title}>
    <Heading title={block.title} description={block.description}/>
    {contents}
    <Foot text={block.takeaway} note={block.sampleNote}/>
  </section>;
}
export function SignatureTableView({block}:{block:TableBlock}) {
  return <section className={styles.root} aria-label={block.title} data-ccpun-signature="table">
    <Heading title={block.title} description={block.description}/>
    <div className={styles.tableDesktop}><table><thead><tr>{block.headers.map((h,i)=><th scope="col" key={i}>{h}</th>)}</tr></thead>
      <tbody>{block.rows.map((r,i)=><tr key={i}>{block.headers.map((_,j)=><td key={j}>{r[j]??'—'}</td>)}</tr>)}</tbody></table></div>
    <div className={styles.tableMobile}>{block.rows.map((r,i)=><dl key={i} className={styles.panel}>
      {block.headers.map((h,j)=><div key={j}><dt>{h}</dt><dd>{r[j]??'—'}</dd></div>)}</dl>)}</div>
    <Foot text={block.takeaway} note={block.sampleNote}/>
  </section>;
}
function PlanSelector({plans,index,onSelect,label}:{plans:Explorer['plans'];index:number;onSelect:(n:number)=>void;label:string}) {
  const [open,setOpen]=useState(false);
  return <div className={styles.selectWrap}>
    <span className={styles.field}>{label}</span>
    <div className={styles.customSelect}>
      <button className={styles.selectButton} type="button" aria-expanded={open} aria-haspopup="true" onClick={()=>setOpen(x=>!x)}>
        {plans[index]?.name||'เลือกแผน'} <span aria-hidden="true">{open?'▴':'▾'}</span></button>
      {open&&<div className={styles.optionList} role="group" aria-label={label}>{plans.map((p,i)=>
        <button key={i} className={i===index?styles.optionActive:undefined} type="button" aria-pressed={i===index}
          onClick={()=>{onSelect(i);setOpen(false);}}>{p.name}{i===index?' ✓':''}</button>)}</div>}
    </div>
  </div>;
}
export function SignaturePlanView({block}:{block:Explorer}) {
  const plans=block.plans;
  const [view,setView]=useState<'single'|'overview'|'compare'>('single');
  const [a,setA]=useState(0);
  const [b,setB]=useState(Math.min(1,plans.length-1));
  const [activeCategory,setCategory]=useState('all');
  const [diff,setDiff]=useState(false);
  const [more,setMore]=useState(false);
  const categories=[['all','ทั้งหมด'],['medical','ผลประโยชน์หลัก'],['extra','เพิ่มเติม'],['condition','เงื่อนไข']];
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
  return <section className={styles.root} data-ccpun-signature="plan-explorer" aria-label={block.title}>
    <Heading title={block.title} description={block.description}/>
    <div className={styles.tabs} role="group" aria-label="วิธีดูข้อมูล">
      {[['single','01 ดูแผนเดียว'],['overview','ดูภาพรวม'],['compare','02 เปรียบเทียบ']].map(([v,label])=><button key={v} type="button"
        className={view===v?styles.selected:undefined} aria-pressed={view===v} onClick={()=>setView(v as typeof view)}>{label}</button>)}
    </div>
    {view==='single'&&<>
      <PlanSelector plans={plans} index={a} onSelect={setA} label="เลือกแผนที่สนใจ"/>
      <div className={styles.featurePanel} key={a}>
        <span className={styles.caption}>แผนที่เลือก</span><h4>{focus.name}</h4>{focus.headline&&<div className={styles.number}>{focus.headline}</div>}
        <div className={styles.benefitGrid}>{focus.benefits.slice(0,more?undefined:4).map((item,i)=>
          <div key={i}><span className={styles.caption}>{item.label}</span><strong>{item.value}</strong></div>)}</div>
        {focus.benefits.length>4&&<button className={styles.ghostButton} type="button" onClick={()=>setMore(x=>!x)}>{more?'ซ่อนรายละเอียด':'ดูรายละเอียดทั้งหมด'}</button>}
        <button className={styles.primaryButton} type="button" onClick={()=>{setB(a===b?(a+1)%plans.length:b);setView('compare')}}>นำไปเปรียบเทียบ</button>
      </div>
    </>}
    {view==='overview'&&<div className={styles.overview}>{plans.map((plan,i)=><button type="button" key={i} className={styles.overCard}
      onClick={()=>{setA(i);setView('single')}}><span className={styles.caption}>แผน {i+1}</span><h4>{plan.name}</h4><p>{plan.headline}</p><small>ดูรายละเอียด ↗</small></button>)}</div>}
    {view==='compare'&&<>
      <div className={styles.two}><PlanSelector plans={plans} index={a} onSelect={setA} label="แผน A"/>
        <PlanSelector plans={plans} index={b} onSelect={setB} label="แผน B"/></div>
      <div className={styles.two}><div className={styles.panel}><span className={styles.caption}>แผน A</span><h4>{plans[a]?.name}</h4><div className={styles.highlight}>{plans[a]?.headline}</div></div>
        <div className={styles.panel}><span className={styles.caption}>แผน B</span><h4>{plans[b]?.name}</h4><div className={styles.highlight}>{plans[b]?.headline}</div></div></div>
      <div className={styles.filters}>{categories.map(([key,text])=><button type="button" key={key} aria-pressed={key===activeCategory}
        className={key===activeCategory?styles.selected:undefined} onClick={()=>setCategory(key)}>{text}</button>)}
        <button type="button" aria-pressed={diff} className={diff?styles.selected:undefined} onClick={()=>setDiff(!diff)}>เฉพาะที่ต่าง</button></div>
      <div className={styles.tableDesktop}><table><thead><tr><th scope="col">รายการ</th><th scope="col">{plans[a]?.name}</th><th scope="col">{plans[b]?.name}</th></tr></thead>
        <tbody>{rows.map((r,i)=><tr key={i}><th scope="row">{r.label}</th><td>{r.va}</td><td>{r.vb}</td></tr>)}</tbody></table></div>
      <div className={styles.tableMobile}>{rows.map((r,i)=><dl key={i} className={styles.panel}>
        <div><dt>{r.label}</dt><dd></dd></div><div><dt>แผน A</dt><dd>{r.va}</dd></div><div><dt>แผน B</dt><dd>{r.vb}</dd></div></dl>)}</div>
      {rows.length===0&&<p className={styles.caption}>ไม่พบความแตกต่างในหมวดที่เลือก</p>}
    </>}
    <Foot text={block.takeaway} note={block.sampleNote}/>
  </section>;
}
