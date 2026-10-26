import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export function moneyTreeDigest(tree) {
 return createHash('sha256').update(JSON.stringify(tree, (key,value) => key === 'ref' || key === 'key' ? undefined : typeof value === 'function' ? '[callback]' : value)).digest('hex');
}
export const eyebrowMoneyTreePins = Object.freeze([
  {
    "after": "d44dc043af75936b86eabcbd30b27da8e177a8953c0d6a39542516eb6348df13",
    "before": "c4cdb46c509ac2b0bea56f1a4a43183746a1b963802891791d104bc06b6695a9"
  },
  {
    "after": "8540c5345462d679b5604a25aeff189501187cca253329d612dbc49ec7132298",
    "before": "a6b83dce2eed6f1c83fb5aad000ad5c58299b6168ac8b85c0b8b9b762660109c"
  },
  {
    "after": "13f39e97225ee76135f17073e1df63f7b099157a0679dae6f7d0ae0ebde944f4",
    "before": "584db9d1c32f7a11f6d2d141d841f7d2fd0b931a560f6de5b814ce8b21712df1"
  },
  {
    "after": "e71c892ace01fddba0a441348564ff2fa959200be849a396ac9c2ad828d1573f",
    "before": "9f89d3a94bd92843160a2c6e24f78d7d0045b9ba1b58e72ca69c56d0e08bd5c3"
  },
  {
    "after": "2d504b79b965688c630abc20aee5b052b9c8db1b0dd069cf30bec8e67dc65084",
    "before": "36c980f2efa275708116ecd2c1b2be0dc6ea47b2bfc7813f74d35bdd1cbe0cad"
  },
  {
    "after": "709609eb6cd2c3448ce03fc95916a48355b6dc6ba0cd0412488e2fc9a3ade2ef",
    "before": "040361a90f2c1d2fd193c7fb5dbfc8d7268dccff41d28d1f6d13f4623049b861"
  }
]);
export function inverseEyebrowMoneyTree(tree) {
 const actual=moneyTreeDigest(tree);
 const pin=eyebrowMoneyTreePins.find(item => item.after===actual || item.before===actual);
 let resultHeroCount=0;
 const detect=value=>{ if(Array.isArray(value)) return value.forEach(detect); if(!value || typeof value!=='object' || !value.props) return; if(value.props.className==='resultHero') resultHeroCount++; detect(value.props.children); };
 detect(tree);
 if(!resultHeroCount) return tree;
 assert.ok(pin, 'C15 refuses unknown full Money Story result tree');
 if(actual===pin.before) return tree;
 let count=0;
 function visit(value) {
  if(Array.isArray(value)) return value.map(visit);
  if(!value || typeof value !== 'object' || !value.props) return value;
  let props = { ...value.props, children: visit(value.props.children) };
  if(value.type === 'p' && props.className === 'muted' && Array.isArray(props.children) && props.children[0] === 'ชีวิตของ') {
   count++; props={...props,className:'kicker',children:['ผลลัพธ์ · ',...props.children.slice(1)]};
  }
  return {...value,props};
 }
 const result=visit(tree);
 assert.equal(count,1);
 assert.equal(moneyTreeDigest(result),pin.before,'C15 reconstructs whole prior result, with every unrelated property retained');
 return result;
}
