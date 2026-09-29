import "server-only";
import { neon } from "@neondatabase/serverless";
import { adminOperationsRuntimeInputFromEnvironment, resolveAdminOperationsRuntimeIdentity } from "../operations/foundation";
import { marketingWindowSchema, marketingActionSchema, type MarketingDashboard, type MarketingWindow, type MarketingActionInput, type MarketingAction, type MarketingQualitySignals } from "./model";
import { normalizeMarketingDashboardSemantics, selectComparableMarketingDashboard } from "./integrity";

function client(variables:Record<string,string|undefined>){
  if(!resolveAdminOperationsRuntimeIdentity(adminOperationsRuntimeInputFromEnvironment(variables))||!variables.CCPUN_ADMIN_DATABASE_URL?.trim())throw new Error("MARKETING_DATABASE_NOT_READY");
  return neon(variables.CCPUN_ADMIN_DATABASE_URL.trim(),{fetchOptions:{signal:AbortSignal.timeout(20000)}});
}

function unavailableMarketingDashboard(key:MarketingWindow, generatedAt=new Date().toISOString(), note="Marketing analytical store unavailable; existing analytics exports remain available."):MarketingDashboard {
  return {state:"unavailable",version:"marketing-v1",generatedAt,window:{key,currentStart:"",currentEnd:"",previousStart:"",previousEnd:"",calendarPolicy:"Unavailable"},kpis:[],contentPerformance:[],campaigns:[],benchmarks:[],leaderboards:[],trend:[],funnel:{mode:"activity-only",steps:[],limitation:"Data unavailable; no fabricated zeros"},health:[],opportunities:[],actions:[],manifest:[],notes:[note]};
}

function validateModel(value:unknown): MarketingDashboard {
  const data=value as MarketingDashboard|undefined;
  if(!data||data.version!=="marketing-v1"||!Array.isArray(data.kpis)||!Array.isArray(data.leaderboards)||!Array.isArray(data.contentPerformance)) throw new Error("MARKETING_INVALID_RESPONSE");
  return data;
}

function attachQualitySignals(model:MarketingDashboard,raw:unknown):MarketingDashboard{
  const signals=raw as MarketingQualitySignals|undefined;
  if(!signals||!Array.isArray(signals.anomalies))return model;
  const relevant=signals.anomalies.filter(anomaly=>
    (anomaly.date>=model.window.currentStart&&anomaly.date<=model.window.currentEnd)
    ||(anomaly.date>=model.window.previousStart&&anomaly.date<=model.window.previousEnd)
  );
  return {...model,qualitySignals:{...signals,anomalies:relevant}};
}

function fallbackKeys(key:MarketingWindow):[MarketingWindow,MarketingWindow]{
  if(key==="this_week") return ["last_week","rolling_7"];
  if(key==="this_month") return ["last_month","rolling_28"];
  if(key==="last_week") return ["rolling_7","rolling_28"];
  if(key==="last_month") return ["rolling_28","rolling_7"];
  return [key,key];
}

export async function readMarketingDashboard(window:MarketingWindow="rolling_7",variables:Record<string,string|undefined>=process.env,cutoff=new Date().toISOString()):Promise<MarketingDashboard>{
  const key=marketingWindowSchema.parse(window);
  const [fallbackKey,rollingKey]=fallbackKeys(key);
  try{
    const rows=await client(variables).query(
      "SELECT jsonb_build_object('requested',ccpun_admin.admin_read_marketing_v3($1,$4::timestamptz),'fallback',ccpun_admin.admin_read_marketing_v3($2,$4::timestamptz),'rolling',ccpun_admin.admin_read_marketing_v3($3,$4::timestamptz),'qualitySignals',ccpun_admin.admin_marketing_traffic_quality($4::timestamptz)) AS data",
      [key,fallbackKey,rollingKey,cutoff],
    );
    const data=rows[0]?.data;
    const selected=selectComparableMarketingDashboard(key,[
      {key,model:validateModel(data?.requested)},
      {key:fallbackKey,model:validateModel(data?.fallback)},
      {key:rollingKey,model:validateModel(data?.rolling)},
    ]);
    return normalizeMarketingDashboardSemantics(attachQualitySignals(selected,data?.qualitySignals));
  }catch{
    return unavailableMarketingDashboard(key);
  }
}

/** Latest successful stored facts from one database snapshot. Requested cutoff is validated request metadata, not a historical replay selector. */
export async function readMarketingWorkspaceModels(requestedCutoff:string,variables:Record<string,string|undefined>=process.env):Promise<{weekly:MarketingDashboard;monthly:MarketingDashboard;cutoff:string}>{
  const fallbackCutoff=new Date().toISOString();
  try{
    if(!Number.isFinite(Date.parse(requestedCutoff)))throw new Error("MARKETING_INVALID_REQUEST_CUTOFF");
    const rows=await client(variables).query(
      "SELECT jsonb_build_object('cutoff',statement_timestamp(),'weekly',ccpun_admin.admin_read_marketing_v3('this_week',statement_timestamp()),'weeklyFallback',ccpun_admin.admin_read_marketing_v3('last_week',statement_timestamp()),'weeklyRolling',ccpun_admin.admin_read_marketing_v3('rolling_7',statement_timestamp()),'monthly',ccpun_admin.admin_read_marketing_v3('this_month',statement_timestamp()),'monthlyFallback',ccpun_admin.admin_read_marketing_v3('last_month',statement_timestamp()),'monthlyRolling',ccpun_admin.admin_read_marketing_v3('rolling_28',statement_timestamp()),'qualitySignals',ccpun_admin.admin_marketing_traffic_quality(statement_timestamp())) AS data",
      [],
    );
    const data=rows[0]?.data;
    if(!data||!Number.isFinite(Date.parse(data.cutoff)))throw new Error("MARKETING_INVALID_RESPONSE");
    const candidates=[
      data.weekly,data.weeklyFallback,data.weeklyRolling,data.monthly,data.monthlyFallback,data.monthlyRolling,
    ].map(validateModel);
    if(candidates.some(model=>model.generatedAt!==data.cutoff))throw new Error("MARKETING_CUTOFF_CHANGED");
    const weekly=normalizeMarketingDashboardSemantics(attachQualitySignals(selectComparableMarketingDashboard("this_week",[
      {key:"this_week",model:candidates[0]},{key:"last_week",model:candidates[1]},{key:"rolling_7",model:candidates[2]},
    ]),data.qualitySignals));
    const monthly=normalizeMarketingDashboardSemantics(attachQualitySignals(selectComparableMarketingDashboard("this_month",[
      {key:"this_month",model:candidates[3]},{key:"last_month",model:candidates[4]},{key:"rolling_28",model:candidates[5]},
    ]),data.qualitySignals));
    return{weekly,monthly,cutoff:data.cutoff as string};
  }catch{
    return{
      weekly:unavailableMarketingDashboard("this_week",fallbackCutoff,"Marketing stored snapshot unavailable; no source API refresh attempted."),
      monthly:unavailableMarketingDashboard("this_month",fallbackCutoff,"Marketing stored snapshot unavailable; no source API refresh attempted."),
      cutoff:fallbackCutoff,
    };
  }
}

export async function saveMarketingAction(input:MarketingActionInput,variables:Record<string,string|undefined>=process.env):Promise<MarketingAction>{
  const parsed=marketingActionSchema.parse(input);
  if(["measuring","done"].includes(parsed.status)&&!parsed.executedAt)throw new Error("INVALID_MARKETING_ACTION");
  const rows=await client(variables).query("SELECT ccpun_admin.admin_save_marketing_action($1::jsonb) AS data",[JSON.stringify(parsed)]);
  return rows[0]?.data as MarketingAction;
}
export async function syncMarketingIdentity(input:unknown[],variables:Record<string,string|undefined>=process.env){
  const rows=await client(variables).query("SELECT ccpun_admin.admin_sync_marketing_identity($1::jsonb) AS data",[JSON.stringify(input)]);
  return Number(rows[0]?.data);
}
