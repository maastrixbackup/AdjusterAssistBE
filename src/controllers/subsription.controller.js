const razorpay = require("../config/razorpay");
const { supabaseAdmin } = require("../config/supabase");
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

module.exports = { getMySubscription, upgradeSubscription, createSubscriptionOrder, verifySubscriptionPayment };