const {supabase} = require("../config/supabase");
const { jwtVerify, createRemoteJWKSet } = require("jose");

const SUPABASE_URL = process.env.SUPABASE_URL;

const JWKS = createRemoteJWKSet(
    new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);
const verifyToken = async (token) => {
    try {
        const { payload } = await jwtVerify(
            token,
            JWKS,
            {
                issuer: `${SUPABASE_URL}/auth/v1`,
            }
        );
        return {
            ...payload,
            id: payload.sub,
        };
    } catch (error) {
        throw new Error("Invalid or expired token");
    }
};

module.exports = {
    verifyToken,
};