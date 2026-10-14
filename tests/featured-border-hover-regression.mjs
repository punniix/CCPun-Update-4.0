import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const css=readFileSync('components/layout/website-43/Website43.module.css','utf8');
const rules=[];
postcss.parse(css).walkRules(rule=>{if(rule.selector==='.featuredScroller')rules.push(rule)});
test('Featured carousel provides clearance for 2px upward hover without cutting top gold border',()=>{
 assert.equal(rules.filter(rule=>rule.nodes.some(x=>x.prop==='padding-block')).length,1,'one base vertical clearance declaration; breakpoint overrides remain horizontal only');
 const p=Object.fromEntries(rules.find(rule=>rule.nodes.some(x=>x.prop==='padding-block')).nodes.filter(x=>x.type==='decl').map(x=>[x.prop,x.value]));
 assert.equal(p['padding-block'],'4px');
 assert.equal(p['overflow-x'],'auto');
 assert.equal(css.includes('.articleCard:hover, .featuredCard:hover, .toolCtaCard:hover { border-color: var(--w43-gold); }'),true,'hover still changes border to brand gold');
 assert.match(css,/\.articleCard:hover,\s*\.featuredCard:hover,\s*\.toolCtaCard:hover\s*\{\s*transform:\s*translateY\(-2px\)/);
 assert.match(css,/\.featuredCard\s*\{[^}]*overflow:\s*hidden;[^}]*border:\s*1px solid/);
});
