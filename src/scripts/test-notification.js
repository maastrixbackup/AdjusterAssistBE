// test-notification.js
const Subscription = require("../models/subscription.model"); // Update path to your model file
const { supabaseAdmin } = require("../config/supabase");

const TARGET_USER_ID = "5ce04794-ec28-4778-b646-075261acd92c"; 

async function runTest() {
  console.log("🏁 Starting Notification Event Testing Flow...");

  try {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 5); // 5 hours in the past

    console.log("🕒 Manipulating subscription row expiry timestamp to force an artificial rollover event...");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ expires_at: pastDate.toISOString() })
      .eq("user_id", TARGET_USER_ID);

    if (error) throw error;

    // Run the method!
    console.log("⚙️ Running checkAndResetMonthlyUsage()...");
    await Subscription.checkAndResetMonthlyUsage(TARGET_USER_ID);

    console.log("✅ Process completed! Check your Supabase 'notifications' table to verify the rows.");
  } catch (err) {
    console.error("❌ Test Script Failure:", err.message);
  }
}
const TEST_USER_IDS = [
    " ",
    "SECOND_REAL_USER_UUID_HERE"
];

async function runBulkTest() {
    console.log("🏁 Starting Bulk Selected Notification Test Flow...");
    
    if (TEST_USER_IDS.includes("FIRST_REAL_USER_UUID_HERE")) {
        console.error("❌ ERROR: Please replace the placeholder UUIDs with actual user IDs from your database profiles table.");
        process.exit(1);
    }

    try {
        console.log(`📦 Grouping targeted batch query for ${TEST_USER_IDS.length} users...`);
        
        // Trigger the bulk dispatcher
        await dispatchNotificationToSelectedUsers({
            userIds: TEST_USER_IDS,
            type: "OFFER_PROMO",
            title: "Exclusive Flash Offer! ⚡",
            body: "We are testing our new bulk target engine. Get 25% off premium features today using code BULK25.",
            metadata: { discount_code: "BULK25", action_route: "/billing/upgrade" }
        });

        console.log("\n📡 Verification Steps:");
        console.log("-----------------------------------------------------------------");
        console.log("1. Go to your Supabase Table Editor -> 'notifications' table.");
        console.log(`2. Verify that ${TEST_USER_IDS.length} brand new rows have been created.`);
        console.log("3. Confirm each row has its own unique ID but shares the same title, body, and metadata.");
        console.log("4. If the targeted profiles had active 'expo_push_token' strings saved, check those physical devices for push banners!");
        console.log("-----------------------------------------------------------------");
        console.log("✅ Bulk test sequence finished.");

    } catch (error) {
        console.error("❌ Test Script execution crashed:", error.message);
    }
}

runBulkTest();

// runTest();