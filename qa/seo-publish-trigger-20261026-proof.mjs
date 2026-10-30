// C7 exact successor admission for owner-requested signed producer and read-only views.
// Historical maps and golden digests remain unchanged. Any additional byte fails.
export const seoPublishTriggerSources = Object.freeze({
  "apps/admin/proxy.ts": {
    "before": "5098b24e07dc12ba94f72bf4d247bc6c770eec680637d367e4bc9f11c75a96e2",
    "after": "fca63d9ffb97bcb034ad56faaced304c1380ac6b2500ee9baedba58b5861b810"
  },
  "apps/web/proxy.ts": {
    "before": "f15c9436fd2cddb9ae4e1d2759a8dfb3c4f69678e46658729ced7ee67a314aaf",
    "after": "2ff9e66f97482f7b5624779f27a9c78f63ef5fa33f9168b048f56defb1f4f529"
  },
  "apps/admin/app/(control-plane)/operations/health/page.tsx": {
    "before": "42363fbd8dcfca51db20a1d741c4a945950653314657e3f71c7b87474b2b82a3",
    "after": "d4cda6a49d5c38a6607e9116f6428c67a0d900f80592ab384ecc517b2eb3942c"
  },
  "features/admin/components/SeoOverviewPage.tsx": {
    "before": "e2725c6ec6074be36199960f6fe5765906d604e8433ae900769266f4b9e1e68f",
    "after": "f521f81ab0293407aef06a88b7f4a6c74553d514e0c99238decb3ebd5025f391"
  },
  "lib/admin/sanity-control.ts": {
    "before": "26acbd8948113e99cf10d7cd88ffcf7c19382821b8bba40e13673f0c2bd34a31",
    "after": "4df41fdc85ab2b3d8dd72ee89a8f9d028c9a3a78177eb539e413a871abfce0b7"
  }
});
export function seoPublishTriggerPredecessorDigest(file,digest) {
 // Preserve the reviewed Admin preview asset hotfix: signed assets bypass the public optimizer.
 if(file==='apps/admin/next.config.ts'&&digest==='e240e22fce8c3af163d21514672574ae6f09b3001bb64dee7ab0e4167738ef41')return '4e8a5020135b0644a68e9ef9431f35a90e8b022b7e2551a58ce7d2bb661b276e';
 const entry=Object.hasOwn(seoPublishTriggerSources,file)?seoPublishTriggerSources[file]:null;
 return entry&&digest===entry.after?entry.before:digest;
}

export function seoPublishTriggerDomPredecessor(html) {
 if(typeof html!=='string')return html;
 const head='<div><div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p class="text-xs font-semibold tracking-[0.12em] text-[#e0c985]">เนื้อหาและการค้นหา</p><h1 class="mt-2 text-3xl font-semibold">ตรวจ SEO</h1><p class="mt-3 max-w-3xl text-sm leading-6 text-white/70">รวมผลตรวจ SEO และข้อควรระวังไว้ในที่เดียว คะแนนมาจากกฎตรวจของ CCPun ไม่ใช่คะแนนจาก Google หากบทความเคยเผยแพร่แล้ว การเปลี่ยนที่อยู่หน้าหรือการให้เครื่องมือค้นหาเก็บหน้าต้องตรวจผลกระทบแยกก่อน</p></div>';
 const link='<a href="/seo/post-publish/" class="inline-flex min-h-11 items-center px-4 text-sm text-[#e0c985] underline">SEO หลังเผยแพร่</a>';
 const research='<a href="/content/research/" class="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">ดูข้อมูลงานวิจัย</a>';
 const reviews='<a href="/dashboard/reviews/" class="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5">ดูข้อเสนอที่รอตรวจ</a>';
 const analytics='<a href="/analytics/" class="inline-flex min-h-11 items-center rounded-xl border border-[#e0c985]/30 bg-[#e0c985]/10 px-4 py-2.5 text-sm text-[#f4df9b] hover:bg-[#e0c985]/15">ดูผลลัพธ์จากการค้นหา</a>';
 const tail='</div></div><section class="mt-7 grid gap-3 sm:grid-cols-4">';
 let result=html;
 for(const intelligence of ['',analytics]){
  const block=head+'<div class="flex gap-2" style="flex-wrap:wrap">'+link+intelligence+research+reviews+tail;
  // Full action container, exact existing links and page-start placement. Never relocate a fragment or normalize another wrapper.
  if(result.startsWith(block)&&result.split(link).length===2)result=head+'<div class="flex gap-2">'+intelligence+research+reviews+tail+result.slice(block.length);
 }
 const healthBlock='<div class="mt-7"><button data-fixture-component="PostPublishHealthCard" data-fixture-props="{}"></button></div>';
 if(result.split(healthBlock).length===2)result=result.replace(healthBlock,'');
 return result;
}
