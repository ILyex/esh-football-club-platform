CREATE TABLE "MatchPushOutbox" (
    "id" TEXT NOT NULL,
    "dedupKey" VARCHAR(191) NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchEventId" TEXT,
    "kind" VARCHAR(32) NOT NULL,
    "payload" JSONB NOT NULL,
    "queuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchPushOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "endpointHash" VARCHAR(64) NOT NULL,
    "p256dh" VARCHAR(128) NOT NULL,
    "auth" VARCHAR(64) NOT NULL,
    "ownerTokenHash" VARCHAR(64) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'ar',
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PushSubscriptionCategory" (
    "subscriptionId" TEXT NOT NULL,
    "category" "TeamCategory" NOT NULL,
    CONSTRAINT "PushSubscriptionCategory_pkey" PRIMARY KEY ("subscriptionId", "category")
);

CREATE TABLE "MatchPushDelivery" (
    "id" TEXT NOT NULL,
    "outboxId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchPushDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchPushOutbox_dedupKey_key" ON "MatchPushOutbox"("dedupKey");
CREATE INDEX "MatchPushOutbox_queuedAt_createdAt_idx" ON "MatchPushOutbox"("queuedAt", "createdAt");
CREATE INDEX "MatchPushOutbox_matchId_createdAt_idx" ON "MatchPushOutbox"("matchId", "createdAt");
CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "PushSubscription"("endpointHash");
CREATE INDEX "PushSubscription_ownerTokenHash_idx" ON "PushSubscription"("ownerTokenHash");
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
CREATE INDEX "PushSubscriptionCategory_category_idx" ON "PushSubscriptionCategory"("category");
CREATE UNIQUE INDEX "MatchPushDelivery_outboxId_subscriptionId_key" ON "MatchPushDelivery"("outboxId", "subscriptionId");
CREATE INDEX "MatchPushDelivery_subscriptionId_sentAt_idx" ON "MatchPushDelivery"("subscriptionId", "sentAt");

ALTER TABLE "PushSubscription"
    ADD CONSTRAINT "PushSubscription_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushSubscriptionCategory"
    ADD CONSTRAINT "PushSubscriptionCategory_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchPushDelivery"
    ADD CONSTRAINT "MatchPushDelivery_outboxId_fkey"
    FOREIGN KEY ("outboxId") REFERENCES "MatchPushOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchPushDelivery"
    ADD CONSTRAINT "MatchPushDelivery_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
