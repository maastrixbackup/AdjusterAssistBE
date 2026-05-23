const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { supabaseAdmin } = require("../../config/supabase");

const RECOVERY_CODE_COUNT = 8;
const BCRYPT_ROUNDS = 12;

function generateRecoveryCode() {
    const raw = crypto.randomBytes(5).toString("hex").toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
}

function normalizeRecoveryCode(code) {
    return String(code || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

async function generateMFARecoveryCodes(userId) {
    if (!userId) {
        throw new Error("userId is required");
    }

    const plainCodes = new Set();

    while (plainCodes.size < RECOVERY_CODE_COUNT) {
        plainCodes.add(generateRecoveryCode());
    }

    const codes = Array.from(plainCodes);

    // Remove old unused codes
    const { error: deleteError } = await supabaseAdmin
        .from("mfa_recovery_codes")
        .delete()
        .eq("user_id", userId)
        .is("used_at", null);

    if (deleteError) {
        throw new Error(deleteError.message);
    }

    const rows = await Promise.all(
        codes.map(async (code, index) => ({
            user_id: userId,
            code_index: index + 1,
            code_hash: await bcrypt.hash(normalizeRecoveryCode(code), BCRYPT_ROUNDS),
            last_four: code.slice(-4),
            expires_at: null,
            regenerated_at: new Date().toISOString(),
        })),
    );

    const { error: insertError } = await supabaseAdmin
        .from("mfa_recovery_codes")
        .insert(rows);

    if (insertError) {
        throw new Error(insertError.message);
    }

    return codes;
}

async function verifyAndConsumeRecoveryCode({
    userId,
    recoveryCode,
    ip,
    userAgent,
}) {
    const normalizedCode = normalizeRecoveryCode(recoveryCode);

    if (!userId || !normalizedCode) {
        throw new Error("Invalid recovery code request");
    }

    const { data: rows, error } = await supabaseAdmin
        .from("mfa_recovery_codes")
        .select("*")
        .eq("user_id", userId)
        .is("used_at", null);

    if (error) {
        throw new Error(error.message);
    }

    let matchedRow = null;

    for (const row of rows || []) {
        const matched = await bcrypt.compare(
            normalizedCode,
            row.code_hash,
        );

        if (matched) {
            matchedRow = row;
            break;
        }
    }

    if (!matchedRow) {
        return {
            valid: false,
        };
    }

    const { error: updateError } = await supabaseAdmin
        .from("mfa_recovery_codes")
        .update({
            used_at: new Date().toISOString(),
            used_ip: ip || null,
            used_user_agent: userAgent || null,
        })
        .eq("id", matchedRow.id)
        .is("used_at", null);

    if (updateError) {
        throw new Error(updateError.message);
    }

    return {
        valid: true,
        code_id: matchedRow.id,
    };
}

async function deleteAllUserMFAFactors(userId) {
    const { data, error } =
        await supabaseAdmin.auth.admin.mfa.listFactors({
            userId,
        });

    if (error) {
        throw new Error(error.message);
    }
    const factors = data?.factors || [];

    for (const factor of factors) {
        const { error: deleteError } =
            await supabaseAdmin.auth.admin.mfa.deleteFactor({
                userId,
                id: factor.id,
            });

        if (deleteError) {
            throw new Error(deleteError.message);
        }
    }

    return factors.length;
}

module.exports = {
    generateMFARecoveryCodes,
    normalizeRecoveryCode,
    verifyAndConsumeRecoveryCode,
    deleteAllUserMFAFactors
};