-- Pre-appointment reconstruction: an appointment owns a self-contained
-- snapshot (JSONB) of the flares it drafted, corrected in place and printed.
-- Forward-only and additive: no change to flares or treatments.

-- CreateTable
CREATE TABLE "appointments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "specialty" TEXT,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "appointments_user_visit_idx" ON "appointments"("user_id", "visit_date" DESC, "created_at" DESC);

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
