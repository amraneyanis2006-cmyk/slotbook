-- F-11 Service catalogue: service names are unique regardless of case (F-11 §2, §5).
CREATE UNIQUE INDEX "service_name_ci" ON "Service" (lower("name"));
