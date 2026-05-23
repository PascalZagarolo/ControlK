CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" varchar(255) PRIMARY KEY NOT NULL,
  "openai_key_enc" text,
  "preferred_ai_model" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_settings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);
