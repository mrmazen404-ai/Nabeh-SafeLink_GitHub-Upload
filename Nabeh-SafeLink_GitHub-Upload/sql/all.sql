-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.custom_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'USER'::text CHECK (role = ANY (ARRAY['USER'::text, 'SUPERVISOR'::text, 'ADMIN'::text])),
  status text NOT NULL DEFAULT 'ACTIVE'::text CHECK (status = ANY (ARRAY['ACTIVE'::text, 'SUSPENDED'::text, 'DELETED'::text])),
  email_verified boolean NOT NULL DEFAULT false,
  preferred_language character varying NOT NULL DEFAULT 'ar'::character varying CHECK (preferred_language::text = ANY (ARRAY['ar'::character varying, 'en'::character varying]::text[])),
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  auth_token_version integer NOT NULL DEFAULT 0,
  CONSTRAINT custom_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_profiles (
  user_id uuid NOT NULL,
  display_name character varying NOT NULL,
  preferred_language character varying NOT NULL DEFAULT 'ar'::character varying CHECK (preferred_language::text = ANY (ARRAY['ar'::character varying, 'en'::character varying]::text[])),
  timezone character varying,
  avatar_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id)
);
CREATE TABLE public.custom_auth_otps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  purpose text NOT NULL CHECK (purpose = ANY (ARRAY['signup'::text, 'recovery'::text])),
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at timestamp with time zone NOT NULL,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT custom_auth_otps_pkey PRIMARY KEY (id),
  CONSTRAINT custom_auth_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id)
);
CREATE TABLE public.model_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  model_name text NOT NULL,
  version text NOT NULL,
  task_type text NOT NULL CHECK (task_type = ANY (ARRAY['URL'::text, 'MESSAGE'::text])),
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  dataset_reference text,
  artifact_path text,
  status text NOT NULL DEFAULT 'TRAINING'::text CHECK (status = ANY (ARRAY['TRAINING'::text, 'CANDIDATE'::text, 'APPROVED'::text, 'RETIRED'::text])),
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT model_versions_pkey PRIMARY KEY (id),
  CONSTRAINT model_versions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.custom_users(id)
);
CREATE TABLE public.scans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  input_type text NOT NULL CHECK (input_type = ANY (ARRAY['URL'::text, 'TEXT'::text, 'MESSAGE'::text, 'FILE'::text, 'EMAIL_HEADER'::text])),
  input_value_masked text,
  input_hash character(64),
  input_language character varying,
  status text NOT NULL DEFAULT 'PROCESSING'::text CHECK (status = ANY (ARRAY['PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text])),
  classification text CHECK (classification = ANY (ARRAY['SAFE'::text, 'SUSPICIOUS'::text, 'DANGEROUS'::text, 'UNKNOWN'::text, 'NEEDS_REVIEW'::text])),
  confidence_score numeric CHECK (confidence_score IS NULL OR confidence_score >= 0::numeric AND confidence_score <= 1::numeric),
  confidence_level text CHECK (confidence_level IS NULL OR (confidence_level = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text]))),
  recommendation text,
  model_version_id uuid,
  request_id uuid,
  idempotency_key_hash character(64),
  error_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  analysis_snapshot jsonb,
  user_hidden_at timestamp with time zone,
  user_deleted_at timestamp with time zone,
  CONSTRAINT scans_pkey PRIMARY KEY (id),
  CONSTRAINT scans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id),
  CONSTRAINT scans_model_version_id_fkey FOREIGN KEY (model_version_id) REFERENCES public.model_versions(id)
);
CREATE UNIQUE INDEX scans_user_idempotency_key_unique
  ON public.scans (user_id, idempotency_key_hash)
  WHERE idempotency_key_hash IS NOT NULL;
CREATE TABLE public.scan_signals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  signal_code character varying NOT NULL,
  signal_label_en text,
  signal_label_ar text,
  severity smallint NOT NULL DEFAULT 1 CHECK (severity >= 1 AND severity <= 5),
  evidence_masked text,
  source text NOT NULL CHECK (source = ANY (ARRAY['ML'::text, 'RULE'::text, 'REPUTATION'::text, 'GEMINI'::text, 'OTHER'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT scan_signals_pkey PRIMARY KEY (id),
  CONSTRAINT scan_signals_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id)
);
CREATE TABLE public.scan_explanations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  language character varying NOT NULL DEFAULT 'ar'::character varying,
  summary text NOT NULL DEFAULT ''::text,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reasons) = 'array'::text),
  recommendation text NOT NULL DEFAULT ''::text,
  provider text NOT NULL DEFAULT 'TEMPLATE'::text CHECK (provider = ANY (ARRAY['TEMPLATE'::text, 'GEMINI'::text, 'HUMAN_REVIEW'::text, 'LOCAL_RULES'::text])),
  prompt_version text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT scan_explanations_pkey PRIMARY KEY (id),
  CONSTRAINT scan_explanations_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id)
);
CREATE TABLE public.fraud_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_ar text NOT NULL,
  description_en text,
  description_ar text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT fraud_types_pkey PRIMARY KEY (id)
);
CREATE TABLE public.scan_fraud_types (
  scan_id uuid NOT NULL,
  fraud_type_id uuid NOT NULL,
  confidence_score numeric CHECK (confidence_score IS NULL OR confidence_score >= 0::numeric AND confidence_score <= 1::numeric),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT scan_fraud_types_pkey PRIMARY KEY (scan_id, fraud_type_id),
  CONSTRAINT scan_fraud_types_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id),
  CONSTRAINT scan_fraud_types_fraud_type_id_fkey FOREIGN KEY (fraud_type_id) REFERENCES public.fraud_types(id)
);
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reported_classification text NOT NULL CHECK (reported_classification = ANY (ARRAY['SAFE'::text, 'SUSPICIOUS'::text, 'DANGEROUS'::text, 'UNKNOWN'::text, 'NEEDS_REVIEW'::text])),
  comment text,
  status text NOT NULL DEFAULT 'NEW'::text CHECK (status = ANY (ARRAY['NEW'::text, 'REVIEWED'::text, 'USED_FOR_ANALYSIS'::text])),
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reviewed_by_admin_id uuid,
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id),
  CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id),
  CONSTRAINT feedback_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.custom_users(id),
  CONSTRAINT feedback_reviewed_by_admin_id_fkey FOREIGN KEY (reviewed_by_admin_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['SCAN_COMPLETED'::text, 'DANGEROUS_RESULT'::text, 'SYSTEM'::text])),
  title text NOT NULL,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id),
  CONSTRAINT notifications_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id)
);
CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT false,
  dangerous_scan_enabled boolean NOT NULL DEFAULT true,
  weekly_summary_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id)
);
CREATE TABLE public.privacy_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type = ANY (ARRAY['PRIVACY_POLICY'::text, 'DATA_RETENTION'::text, 'MODEL_IMPROVEMENT'::text, 'TERMS_OF_USE'::text])),
  version text NOT NULL,
  granted boolean NOT NULL,
  granted_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  accepted_at timestamp with time zone,
  ip_hash character,
  user_agent_hash character,
  CONSTRAINT privacy_consents_pkey PRIMARY KEY (id),
  CONSTRAINT privacy_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id)
);
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL CHECK (action = ANY (ARRAY['LOGIN'::text, 'REGISTER'::text, 'VERIFY_EMAIL'::text, 'DELETE_SCAN'::text, 'CHANGE_ROLE'::text, 'UPDATE_PRIVACY'::text, 'ADMIN_ACTION'::text, 'OTHER'::text])),
  resource_type text,
  resource_id uuid,
  metadata_masked jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.custom_users(id)
);
CREATE TABLE public.dangerous_indicators (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  indicator_type text NOT NULL CHECK (indicator_type = ANY (ARRAY['DOMAIN'::text, 'URL_HASH'::text, 'IP'::text, 'EMAIL'::text, 'KEYWORD'::text])),
  indicator_value_hash character NOT NULL,
  display_value_masked text,
  severity smallint NOT NULL DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),
  source text NOT NULL DEFAULT 'SYSTEM'::text,
  is_active boolean NOT NULL DEFAULT true,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT dangerous_indicators_pkey PRIMARY KEY (id)
);
CREATE TABLE public.uploaded_files (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  storage_path text NOT NULL,
  original_name_masked text,
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sha256 character,
  scan_status text NOT NULL DEFAULT 'PENDING'::text CHECK (scan_status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'FAILED'::text, 'QUARANTINED'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT uploaded_files_pkey PRIMARY KEY (id),
  CONSTRAINT uploaded_files_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id)
);
CREATE TABLE public.email_header_analyses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL,
  spf_result text,
  dkim_result text,
  dmarc_result text,
  sender_domain_masked text,
  authentication_results jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_header_analyses_pkey PRIMARY KEY (id),
  CONSTRAINT email_header_analyses_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES public.scans(id)
);
CREATE TABLE public.api_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key_prefix character varying NOT NULL,
  key_hash character NOT NULL UNIQUE,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id)
);
CREATE TABLE public.integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE'::text CHECK (status = ANY (ARRAY['ACTIVE'::text, 'PAUSED'::text, 'REVOKED'::text])),
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_reference text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  CONSTRAINT integrations_pkey PRIMARY KEY (id),
  CONSTRAINT integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id)
);
CREATE TABLE public.system_settings (
  key text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT system_settings_pkey PRIMARY KEY (key),
  CONSTRAINT system_settings_updated_by_admin_fkey FOREIGN KEY (updated_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.support_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL DEFAULT ('TK-'::text || upper(replace(gen_random_uuid()::text, '-'::text, ''::text))),
  user_id uuid,
  email text,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN'::text CHECK (status = ANY (ARRAY['OPEN'::text, 'IN_PROGRESS'::text, 'RESOLVED'::text, 'CLOSED'::text])),
  priority text NOT NULL DEFAULT 'NORMAL'::text CHECK (priority = ANY (ARRAY['LOW'::text, 'NORMAL'::text, 'HIGH'::text, 'URGENT'::text])),
  assigned_to uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone,
  assigned_admin_id uuid,
  admin_reply text,
  replied_at timestamp with time zone,
  CONSTRAINT support_requests_pkey PRIMARY KEY (id),
  CONSTRAINT support_requests_ticket_id_key UNIQUE (ticket_id),
  CONSTRAINT support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id),
  CONSTRAINT support_requests_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.custom_users(id),
  CONSTRAINT support_requests_assigned_admin_id_fkey FOREIGN KEY (assigned_admin_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'SUPERVISOR'::text CHECK (role = ANY (ARRAY['SUPERVISOR'::text, 'ADMIN'::text, 'SUPER_ADMIN'::text])),
  status text NOT NULL DEFAULT 'ACTIVE'::text CHECK (status = ANY (ARRAY['ACTIVE'::text, 'SUSPENDED'::text, 'DELETED'::text])),
  email_verified boolean NOT NULL DEFAULT false,
  two_factor_required boolean NOT NULL DEFAULT true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.admin_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  refresh_token_hash character NOT NULL UNIQUE,
  token_family uuid NOT NULL,
  ip_hash character,
  user_agent_hash character,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  revoke_reason text,
  CONSTRAINT admin_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT admin_sessions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_2fa_methods (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL UNIQUE,
  method text NOT NULL DEFAULT 'TOTP'::text CHECK (method = 'TOTP'::text),
  secret_ciphertext text NOT NULL,
  secret_nonce text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  verified_at timestamp with time zone,
  last_used_step bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_2fa_methods_pkey PRIMARY KEY (id),
  CONSTRAINT admin_2fa_methods_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_2fa_recovery_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  code_hash character NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_2fa_recovery_codes_pkey PRIMARY KEY (id),
  CONSTRAINT admin_2fa_recovery_codes_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email_hash character,
  ip_hash character,
  admin_user_id uuid,
  outcome text NOT NULL CHECK (outcome = ANY (ARRAY['SUCCESS'::text, 'INVALID_CREDENTIALS'::text, 'INVALID_2FA'::text, 'LOCKED'::text, 'SUSPENDED'::text, 'RATE_LIMITED'::text])),
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_login_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT admin_login_attempts_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email)),
  role text NOT NULL DEFAULT 'SUPERVISOR'::text CHECK (role = ANY (ARRAY['SUPERVISOR'::text, 'ADMIN'::text, 'SUPER_ADMIN'::text])),
  invited_by uuid NOT NULL,
  token_hash character NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_invitations_pkey PRIMARY KEY (id),
  CONSTRAINT admin_invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  target_user_id uuid,
  target_scan_id uuid,
  before_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata_masked jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_hash character,
  user_agent_hash character,
  request_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT admin_audit_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id),
  CONSTRAINT admin_audit_logs_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.custom_users(id),
  CONSTRAINT admin_audit_logs_target_scan_id_fkey FOREIGN KEY (target_scan_id) REFERENCES public.scans(id)
);
CREATE TABLE public.admin_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_user_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  CONSTRAINT admin_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT admin_notifications_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.policy_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  policy_type text NOT NULL CHECK (policy_type = ANY (ARRAY['TERMS'::text, 'PRIVACY'::text, 'DISCLAIMER'::text])),
  version text NOT NULL,
  title text NOT NULL,
  content_markdown text NOT NULL,
  content_hash character,
  is_active boolean NOT NULL DEFAULT false,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  language character varying NOT NULL DEFAULT 'ar'::character varying CHECK (language::text = ANY (ARRAY['ar'::character varying, 'en'::character varying]::text[])),
  CONSTRAINT policy_documents_pkey PRIMARY KEY (id)
);
CREATE TABLE public.account_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'PENDING'::text CHECK (status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'PROCESSING'::text, 'COMPLETED'::text, 'CANCELLED'::text, 'FAILED'::text])),
  reason text,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  confirmed_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  failure_reason text,
  processed_by_admin_id uuid,
  decision_reason text,
  CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id),
  CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.custom_users(id),
  CONSTRAINT account_deletion_requests_processed_by_admin_id_fkey FOREIGN KEY (processed_by_admin_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.site_visitors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  visitor_hash character NOT NULL UNIQUE,
  last_page character varying NOT NULL DEFAULT 'welcome'::character varying,
  first_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT site_visitors_pkey PRIMARY KEY (id)
);
CREATE TABLE public.platform_daily_metrics (
  metric_date date NOT NULL DEFAULT CURRENT_DATE,
  total_scans bigint NOT NULL DEFAULT 0 CHECK (total_scans >= 0),
  safe_scans bigint NOT NULL DEFAULT 0 CHECK (safe_scans >= 0),
  suspicious_scans bigint NOT NULL DEFAULT 0 CHECK (suspicious_scans >= 0),
  dangerous_scans bigint NOT NULL DEFAULT 0 CHECK (dangerous_scans >= 0),
  unknown_scans bigint NOT NULL DEFAULT 0 CHECK (unknown_scans >= 0),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT platform_daily_metrics_pkey PRIMARY KEY (metric_date)
);
