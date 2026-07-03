CREATE TABLE "collections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"raindrop_collection_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raindrop_tags" (
	"raindrop_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	CONSTRAINT "raindrop_tags_raindrop_id_tag_id_pk" PRIMARY KEY("raindrop_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "raindrops" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"raindrop_id" integer NOT NULL,
	"title" varchar(1024) NOT NULL,
	"link" text NOT NULL,
	"excerpt" text,
	"domain" varchar(255),
	"cover" text,
	"type" varchar(32),
	"collection_id" integer,
	"created_at" timestamp with time zone NOT NULL,
	"last_update" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"raindrop_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_raindrop_id_raindrops_id_fk" FOREIGN KEY ("raindrop_id") REFERENCES "public"."raindrops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raindrop_tags" ADD CONSTRAINT "raindrop_tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raindrops" ADD CONSTRAINT "raindrops_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raindrops" ADD CONSTRAINT "raindrops_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "collections_user_raindrop_id_idx" ON "collections" USING btree ("user_id","raindrop_collection_id");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "raindrop_tags_user_tag_idx" ON "raindrop_tags" USING btree ("user_id","tag_id");--> statement-breakpoint
CREATE INDEX "raindrop_tags_tag_id_idx" ON "raindrop_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raindrops_user_raindrop_id_idx" ON "raindrops" USING btree ("user_id","raindrop_id");--> statement-breakpoint
CREATE INDEX "raindrops_user_id_idx" ON "raindrops" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "raindrops_collection_id_idx" ON "raindrops" USING btree ("collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_idx" ON "tags" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "tags_user_id_idx" ON "tags" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_clerk_user_id_idx" ON "users" USING btree ("clerk_user_id");