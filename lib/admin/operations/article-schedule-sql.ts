// Each mutation and its audit commit together; no editorial content enters Postgres.
const audited = (mutation: string, actor: string) => `WITH changed AS (${mutation}), audit AS (
  INSERT INTO ccpun_admin.article_schedule_audit
    (generation,row_version,article_id,status,actor,scheduled_at,draft_revision,published_revision,error_code,transaction_id)
  SELECT generation,row_version,article_id,status,${actor},scheduled_at,draft_revision,published_revision,error_code,transaction_id FROM changed
) SELECT * FROM changed`;

export const PREPARE_ARTICLE_SCHEDULE = audited(`
  INSERT INTO ccpun_admin.article_schedule AS existing
    (article_id,generation,draft_revision,published_revision,scheduled_at,mode,status,created_by)
  SELECT $1,$2::uuid,$3,$4,$5::timestamptz,mode,'preparing',$6
  FROM ccpun_admin.article_scheduler_identity
  WHERE singleton=true AND enabled=true
    AND $5::timestamptz>clock_timestamp()+interval '30 seconds'
    AND $5::timestamptz<=clock_timestamp()+interval '90 days'
    AND (($7::uuid IS NULL AND $8::bigint=0) OR EXISTS (
      SELECT 1 FROM ccpun_admin.article_schedule WHERE article_id=$1 AND generation=$7::uuid AND row_version=$8::bigint
    ))
  ON CONFLICT (article_id) DO UPDATE SET
    generation=EXCLUDED.generation,row_version=existing.row_version+1,
    draft_revision=EXCLUDED.draft_revision,published_revision=EXCLUDED.published_revision,
    scheduled_at=EXCLUDED.scheduled_at,mode=EXCLUDED.mode,status='preparing',created_by=EXCLUDED.created_by,
    workflow_run_id=NULL,execution_id=NULL,lease_expires_at=NULL,updated_at=clock_timestamp(),completed_at=NULL,error_code=NULL,transaction_id=NULL
  WHERE existing.generation=$7::uuid AND existing.row_version=$8::bigint
    AND existing.status IN ('scheduled','cancelled','stale','failed','published','validated')
  RETURNING *`, "created_by");

export const ACK_ARTICLE_DISPATCH = audited(`
  UPDATE ccpun_admin.article_schedule SET status='scheduled',workflow_run_id=$3,
    row_version=row_version+1,updated_at=clock_timestamp()
  WHERE article_id=$1 AND generation=$2::uuid AND status='preparing'
    AND EXISTS (SELECT 1 FROM ccpun_admin.article_scheduler_identity WHERE singleton=true AND enabled=true)
  RETURNING *`, "'workflow-dispatch'");

export const FAIL_ARTICLE_DISPATCH = audited(`
  UPDATE ccpun_admin.article_schedule SET status='failed',error_code='DISPATCH_UNCONFIRMED',
    row_version=row_version+1,updated_at=clock_timestamp(),completed_at=clock_timestamp()
  WHERE article_id=$1 AND generation=$2::uuid AND status='preparing'
  RETURNING *`, "'workflow-dispatch'");

export const CANCEL_ARTICLE_SCHEDULE = audited(`
  UPDATE ccpun_admin.article_schedule SET status='cancelled',row_version=row_version+1,
    updated_at=clock_timestamp(),completed_at=clock_timestamp(),error_code=NULL
  WHERE article_id=$1 AND generation=$2::uuid AND row_version=$3::bigint AND status IN ('preparing','scheduled')
  RETURNING *`, "$4");

export const CLAIM_ARTICLE_SCHEDULE = audited(`
  UPDATE ccpun_admin.article_schedule SET status='executing',execution_id=$3::uuid,
    lease_expires_at=clock_timestamp()+interval '2 minutes',row_version=row_version+1,updated_at=clock_timestamp()
  WHERE article_id=$1 AND generation=$2::uuid AND status='scheduled' AND scheduled_at<=clock_timestamp()
    AND EXISTS (SELECT 1 FROM ccpun_admin.article_scheduler_identity WHERE singleton=true AND enabled=true)
  RETURNING *`, "'scheduler'");

export const AUTHORIZE_ARTICLE_EXECUTION = `SELECT EXISTS (
  SELECT 1 FROM ccpun_admin.article_schedule s CROSS JOIN ccpun_admin.article_scheduler_identity i
  WHERE s.article_id=$1 AND s.generation=$2::uuid AND s.execution_id=$3::uuid AND s.status='executing'
    AND s.lease_expires_at>clock_timestamp()+interval '30 seconds' AND i.singleton=true AND i.enabled=true
) AS allowed`;

export const FINISH_ARTICLE_SCHEDULE = audited(`
  UPDATE ccpun_admin.article_schedule SET status=$4,error_code=$5,transaction_id=$6,
    row_version=row_version+1,updated_at=clock_timestamp(),completed_at=clock_timestamp()
  WHERE article_id=$1 AND generation=$2::uuid AND execution_id=$3::uuid AND status='executing'
    AND $4 IN ('published','validated','stale','failed','reconciliation-required')
  RETURNING *`, "'scheduler'");
