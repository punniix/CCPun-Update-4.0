import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/lib/admin/identity";
import { readMarketingDashboard } from "@/lib/admin/marketing/store";
import { marketingWindowSchema } from "@/lib/admin/marketing/model";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff"};
export async function GET(request:Request){const identity=await getAdminIdentity();if(!identity)return NextResponse.json({error:"unauthorized"},{status:401,headers});if(identity.role!=="owner")return NextResponse.json({error:"forbidden"},{status:403,headers});const key=marketingWindowSchema.safeParse(new URL(request.url).searchParams.get("window")??"rolling_7");if(!key.success)return NextResponse.json({error:"invalid-window"},{status:400,headers});const data=await readMarketingDashboard(key.data);return NextResponse.json(data,{status:data.state==="ready"?200:503,headers});}
