-- F-14 Availability templates (FR-19, BR-18): templates and their weekly entries.

-- CreateTable
CREATE TABLE "AvailabilityTemplate" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateEntry" (
    "id" SERIAL NOT NULL,
    "templateId" INTEGER NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "startTime" CHAR(5) NOT NULL,
    "serviceId" INTEGER NOT NULL,

    CONSTRAINT "TemplateEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityTemplate_staffId_idx" ON "AvailabilityTemplate"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateEntry_templateId_weekday_startTime_key" ON "TemplateEntry"("templateId", "weekday", "startTime");

-- AddForeignKey
ALTER TABLE "AvailabilityTemplate" ADD CONSTRAINT "AvailabilityTemplate_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEntry" ADD CONSTRAINT "TemplateEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AvailabilityTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateEntry" ADD CONSTRAINT "TemplateEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Weekday is ISO (1 = Monday … 7 = Sunday).
ALTER TABLE "TemplateEntry" ADD CONSTRAINT "TemplateEntry_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7);
