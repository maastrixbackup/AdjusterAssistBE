const razorpay = require("../config/razorpay");
const { supabaseAdmin, createUserClient } = require("../config/supabase");
const Subscription = require("../models/subscription.model");
const { sendSubscriptionUpgradeEmail } = require("../services/email.service");
const crypto = require("crypto");

/**
 * Fetches the current user's subscription status
 */
const getMySubscription = async (req, res) => {
  try {
    // req.user.id is a UUID string from the Supabase Auth Middleware
    const stats = await Subscription.getStats(req.user.id);

    // Auto-Repair: If user has no record in 'subscriptions' table yet
    if (!stats) {
      console.log(`🔧 Auto-initializing subscription for UUID: ${req.user.id}`);
      await Subscription.initFreeTier(req.user.id);
      const newStats = await Subscription.getStats(req.user.id);

      return res.status(200).json({
        success: true,
        subscription: {
          ...newStats,
          remaining: (newStats.usage_limit || 0) - (newStats.current_usage || 0),
          is_unlimited: newStats.plan_type === 'enterprise'
        }
      });
    }

    const usageLimit = stats.usage_limit || 0;
    const currentUsage = stats.current_usage || 0;

    res.status(200).json({
      success: true,
      subscription: {
        ...stats,
        // UI Helper: Calculate remaining drafts for the Mobile App
        remaining: stats.plan_type === 'enterprise' ? 'unlimited' : Math.max(0, usageLimit - currentUsage),
        is_unlimited: stats.plan_type === 'enterprise'
      }
    });
  } catch (error) {
    console.error("Fetch Sub Error:", error.message);
    res.status(500).json({ success: false, message: "Error fetching subscription" });
  }
};

/**
 * Upgrades the user's plan and resets their usage
 */
const upgradeSubscription = async (req, res) => {
  try {
    const { planType } = req.body;
    const userId = req.user.id; // This is a UUID string

    // Configuration mapping for Adjuster Assist tiers
    const planConfigs = {
      pro: { limit: 500, days: 30 },
      enterprise: { limit: 999999, days: 90 }
    };

    const config = planConfigs[planType?.toLowerCase()];
    if (!config) {
      return res.status(400).json({ success: false, message: "Invalid plan type selected" });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + config.days);

    // Pass the UUID and the config to the Supabase update function
    await Subscription.updateTier(userId, {
      plan_type: planType.toLowerCase(),
      usage_limit: config.limit,
      expires_at: expiryDate.toISOString()
    });

    // Async email notification - we don't block the response for this
    sendSubscriptionUpgradeEmail(req.user.email, planType).catch(err => {
      console.error("Upgrade Email Failed for UUID:", userId, err.message);
    });

    res.status(200).json({
      success: true,
      message: `Successfully upgraded to ${planType.toUpperCase()}!`,
      newLimit: config.limit >= 999999 ? 'unlimited' : config.limit
    });
  } catch (error) {
    console.error("Upgrade Process Error:", error.message);
    res.status(500).json({ success: false, message: "Could not complete the upgrade" });
  }
};


const createSubscriptionOrder = async (req, res) => {
  try {

    const { planType } = req.body;

    const plans = {
      pro: 99900,
      enterprise: 499900,
    };

    const amount = plans[planType];

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    const receipt = `rcpt_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt,
      notes: {
        userId: req.user.id,
        planType,
      },
    });

    // LOG ORDER IMMEDIATELY
    await supabaseAdmin
      .from("payments")
      .insert([{
        user_id: req.user.id,
        razorpay_order_id: order.id,
        amount,
        currency: "INR",
        status: "created",
        plan_type: planType,
        receipt,
        raw_response: order,
      }]);

    return res.status(200).json({
      success: true,
      order,
      key: process.env.RAZORPAY_KEY_ID,
    });

  } catch (error) {

    console.error(
      "CREATE ORDER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Order creation failed",
    });
  }
};


const verifySubscriptionPayment = async (req, res) => {

  try {

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planType
    } = req.body;

    const userId = req.user.id;

    // ─────────────────────────────
    // DUPLICATE CHECK
    // ─────────────────────────────

    const { data: existingPayment } =
      await supabaseAdmin
        .from("payments")
        .select("*")
        .eq(
          "razorpay_payment_id",
          razorpay_payment_id
        )
        .single();

    if (existingPayment?.verified) {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
      });
    }

    // ─────────────────────────────
    // SIGNATURE VERIFY
    // ─────────────────────────────

    const generatedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_SECRET
      )
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (
      generatedSignature !== razorpay_signature
    ) {

      await supabaseAdmin
        .from("payments")
        .update({
          status: "signature_failed",
          failure_reason:
            "Invalid Razorpay signature",
        })
        .eq(
          "razorpay_order_id",
          razorpay_order_id
        );

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // ─────────────────────────────
    // FETCH PAYMENT FROM RAZORPAY
    // ─────────────────────────────

    const payment =
      await razorpay.payments.fetch(
        razorpay_payment_id
      );

    if (payment.status !== "captured") {

      await supabaseAdmin
        .from("payments")
        .update({
          status: payment.status,
          failure_reason:
            "Payment not captured",
          raw_response: payment,
        })
        .eq(
          "razorpay_order_id",
          razorpay_order_id
        );

      return res.status(400).json({
        success: false,
        message: "Payment not captured",
      });
    }

    // ─────────────────────────────
    // PLAN CONFIG
    // ─────────────────────────────

    const planConfigs = {
      pro: {
        limit: 500,
        days: 30,
        amount: 99900,
      },

      enterprise: {
        limit: 999999,
        days: 90,
        amount: 499900,
      },
    };

    const config = planConfigs[planType];

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan",
      });
    }

    // ─────────────────────────────
    // AMOUNT VALIDATION
    // ─────────────────────────────

    if (payment.amount !== config.amount) {

      await supabaseAdmin
        .from("payments")
        .update({
          status: "amount_mismatch",
          failure_reason:
            "Amount tampering detected",
          raw_response: payment,
        })
        .eq(
          "razorpay_order_id",
          razorpay_order_id
        );

      return res.status(400).json({
        success: false,
        message: "Amount mismatch",
      });
    }

    // ─────────────────────────────
    // UPGRADE SUBSCRIPTION
    // ─────────────────────────────

    const expiryDate = new Date();

    expiryDate.setDate(
      expiryDate.getDate() + config.days
    );

    await Subscription.updateTier(userId, {
      plan_type: planType,
      usage_limit: config.limit,
      expires_at: expiryDate.toISOString(),
    });

    // ─────────────────────────────
    // UPDATE PAYMENT LOG
    // ─────────────────────────────

    await supabaseAdmin
      .from("payments")
      .update({
        razorpay_payment_id,
        razorpay_signature,
        verified: true,
        verified_at: new Date().toISOString(),
        status: "captured",
        raw_response: payment,
      })
      .eq(
        "razorpay_order_id",
        razorpay_order_id
      );

    // ─────────────────────────────
    // EMAIL
    // ─────────────────────────────

    sendSubscriptionUpgradeEmail(
      req.user.email,
      planType
    ).catch(console.error);

    return res.status(200).json({
      success: true,
      message: "Subscription activated",
    });

  } catch (error) {

    console.error(
      "VERIFY PAYMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};


const ALLOWED_RANGES = new Set(["24h", "week", "month", "year", "all"]);

const RANGE_CONFIG = {
  "24h": { amount: 24, unit: "hours" },
  week: { amount: 7, unit: "days" },
  month: { amount: 1, unit: "months" },
  year: { amount: 1, unit: "years" },
};

function getStartDate(range) {
  if (range === "all") return null;

  const date = new Date();
  const config = RANGE_CONFIG[range];

  if (!config) return null;

  switch (config.unit) {
    case "hours":
      date.setHours(date.getHours() - config.amount);
      break;
    case "days":
      date.setDate(date.getDate() - config.amount);
      break;
    case "months":
      date.setMonth(date.getMonth() - config.amount);
      break;
    case "years":
      date.setFullYear(date.getFullYear() - config.amount);
      break;
  }

  return date;
}

// Usage History

function toPositiveNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(number, 0) : fallback;
}

function formatTransactionTitle(actionType) {
  if (!actionType) return "Usage Activity";

  return String(actionType)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const getDetailedUsageHistory = async (req, res) => {
  try {
    const range = ALLOWED_RANGES.has(req.query.range)
      ? req.query.range
      : "all";

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "50", 10), 1),
      100,
    );

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const startDate = getStartDate(range);

    /**
     * If your auth middleware sets req.user:
     * const userId = req.user?.id;
     *
     * If your tables have user_id, prefer explicit filters:
     * .eq("user_id", userId)
     *
     * If req.supabase is user-scoped and RLS is correctly enabled,
     * RLS will already restrict rows.
     */

    const subscriptionQuery = req.supabase
      .from("subscriptions")
      .select(
        "id, plan_type, usage_limit, current_usage, status, expires_at, created_at, updated_at",
      )
      .maybeSingle();

    const { data: subData, error: subError } = await subscriptionQuery;

    if (subError) {
      console.error("[UsageHistory] Subscription fetch failed:", subError);
      return res.status(500).json({
        success: false,
        message: "Unable to load subscription information.",
      });
    }

    if (!subData) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found for this account.",
        meta: {
          range,
          runInPeriod: 0,
          remaining: 0,
          currentUsage: 0,
          totalQuota: 0,
          nextRenewal: null,
          planStatus: "missing",
          page,
          limit,
          hasMore: false,
          totalRecords: 0,
        },
        transactions: [],
      });
    }

    let historyBaseQuery = req.supabase
      .from("credit_logs")
      .select("id, action_type, workspace_name, credits_deducted, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false });

    if (startDate) {
      historyBaseQuery = historyBaseQuery.gte(
        "created_at",
        startDate.toISOString(),
      );
    }

    const { data: streamData, error: streamError, count } =
      await historyBaseQuery.range(from, to);

    if (streamError) {
      console.error("[UsageHistory] Credit logs fetch failed:", streamError);
      return res.status(500).json({
        success: false,
        message: "Unable to load usage history.",
      });
    }

    /**
     * Important:
     * This fetches total credits used in the selected range,
     * not just the current paginated page.
     */
    let aggregateQuery = req.supabase
      .from("credit_logs")
      .select("credits_deducted");

    if (startDate) {
      aggregateQuery = aggregateQuery.gte("created_at", startDate.toISOString());
    }

    const { data: aggregateData, error: aggregateError } = await aggregateQuery;

    if (aggregateError) {
      console.error("[UsageHistory] Aggregate fetch failed:", aggregateError);
      return res.status(500).json({
        success: false,
        message: "Unable to calculate usage metrics.",
      });
    }

    const runInPeriod = (aggregateData || []).reduce((sum, log) => {
      return sum + toPositiveNumber(log.credits_deducted);
    }, 0);

    const usageLimit = toPositiveNumber(subData.usage_limit);
    const currentUsage = toPositiveNumber(subData.current_usage);
    const creditsRemaining = Math.max(usageLimit - currentUsage, 0);

    const transactions = (streamData || []).map((item) => {
      const credits = toPositiveNumber(item.credits_deducted);

      return {
        id: String(item.id),
        title: formatTransactionTitle(item.action_type),
        rawActionType: item.action_type || null,
        workspace: item.workspace_name || "Workspace",
        cost: `-${credits} cr`,
        credits,
        timestamp: item.created_at,
      };
    });

    return res.status(200).json({
      success: true,
      meta: {
        range,
        runInPeriod,
        remaining: creditsRemaining,
        currentUsage,
        totalQuota: usageLimit,
        nextRenewal: subData.expires_at || null,
        planStatus: subData.status || "unknown",
        planType: subData.plan_type || null,
        page,
        limit,
        totalRecords: count || 0,
        hasMore: from + transactions.length < (count || 0),
      },
      transactions,
    });
  } catch (error) {
    console.error("[UsageHistory] Unexpected failure:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch usage stream data metrics.",
    });
  }
};

module.exports = { getMySubscription, upgradeSubscription, createSubscriptionOrder, verifySubscriptionPayment, getDetailedUsageHistory };