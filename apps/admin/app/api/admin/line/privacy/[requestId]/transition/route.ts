import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOriginAdminMutation } from "@/lib/admin/auth-config";
import { getAdminIdentity } from "@/lib/admin/identity";
import { transitionPrivacyRequest } from "@/lib/admin/line/business-intelligence";
import { hasAdminPermission } from "@/lib/admin/rbac";

export const dynamic="force-dynamic";
const headers={ "Cache-Control":"private, no-cache, no-store, max-age=0, must-revalidate","X-Robots-Tag":"noindex, nofollow, noarchive" };
const bodySchema=z.object({ status:z.enum(["verified","prepared","approved","cancelled","failed"]), verificationToken:z.string().min(1).max(200).optional() }).strict();

export async function POST(request:Request,{params}:{params:Promise<{requestId:string}>}){
  const identity=await getAdminIdentity();
  if(!identity) return NextResponse.json({error:"unauthorized"},{status:401,headers});
  if(identity.role!=="owner"||!hasAdminPermission(identity.role,"settings:read")) return NextResponse.json({error:"forbidden"},{status:403,headers});
  if(!isSameOriginAdminMutation(request.url,request.headers.get("origin"))) return NextResponse.json({error:"invalid-origin"},{status:403,headers});
  const requestId=z.string().uuid().safeParse((await params).requestId);
  const body=bodySchema.safeParse(await request.json().catch(()=>null));
  if(!requestId.success||!body.success) return NextResponse.json({error:"invalid-request"},{status:400,headers});
  try {
    return NextResponse.json(await transitionPrivacyRequest({requestId:requestId.data,status:body.data.status,verificationToken:body.data.verificationToken,actor:identity.actor}),{headers});
  } catch(error) {
    const code=error instanceof Error?error.message:"";
    return NextResponse.json({error:code==="PRIVACY_DELETE_EXECUTION_HUMAN_GATE"?"irreversible-human-gate":"privacy-transition-unavailable"},{status:503,headers});
  }
}
