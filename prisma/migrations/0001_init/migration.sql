-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "condition_label" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flares" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "onset_date" DATE NOT NULL,
    "onset_precision" TEXT NOT NULL,
    "end_date" DATE,
    "end_precision" TEXT,
    "peak_severity" SMALLINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "flares_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "flares_status_check" CHECK ("status" IN ('open', 'closed')),
    CONSTRAINT "flares_onset_precision_check" CHECK ("onset_precision" IN ('exact', 'approx')),
    CONSTRAINT "flares_end_precision_check" CHECK ("end_precision" IS NULL OR "end_precision" IN ('exact', 'approx')),
    CONSTRAINT "flares_peak_severity_check" CHECK ("peak_severity" IS NULL OR ("peak_severity" >= 1 AND "peak_severity" <= 5))
);

-- CreateTable
CREATE TABLE "treatments" (
    "id" UUID NOT NULL,
    "flare_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "started_on" DATE,
    "started_precision" TEXT,
    "helped" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "treatments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "treatments_helped_check" CHECK ("helped" IS NULL OR "helped" IN ('yes', 'no', 'unsure'))
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "flares_user_id_idx" ON "flares"("user_id");

-- CreateIndex
CREATE INDEX "flares_user_id_created_at_idx" ON "flares"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "treatments_flare_id_idx" ON "treatments"("flare_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flares" ADD CONSTRAINT "flares_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_flare_id_fkey" FOREIGN KEY ("flare_id") REFERENCES "flares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
