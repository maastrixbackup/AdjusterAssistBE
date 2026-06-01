const { supabaseAdmin } = require('../../config/supabase.js');
const { sendPushNotificationToUser } = require('./pushNotification.service.js');


const dispatchNotification = async ({ userId, type, title, body, metadata = {} }) => {
    try {
        if (!userId) return null;

        // 1. Commit a permanent record to your new database inbox ledger
        const { data: dbRecord, error: dbError } = await supabaseAdmin
            .from('notifications')
            .insert({
                user_id: userId,
                type: type.toUpperCase(),
                title,
                body,
                metadata
            })
            .select('id')
            .single();

        if (dbError) throw dbError;

        // 2. Fetch the target user's active push token mapping 
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('expo_push_token')
            .eq('id', userId)
            .single();

        // 3. Fire-and-forget push message dispatch if token is active
        if (profile?.expo_push_token) {
            sendPushNotificationToUser(
                profile.expo_push_token,
                title,
                body,
                { ...metadata, notification_id: dbRecord.id, type }
            ).catch(err => console.error(`⚠️ Push token failed delivery for user ${userId}:`, err.message));
        }

        return dbRecord;
    } catch (error) {
        console.error("❌ Notification Dispatcher Crash:", error.message);
        // We catch errors internally so primary app actions (like payment completions) don't crash
    }
};

module.exports = { dispatchNotification };