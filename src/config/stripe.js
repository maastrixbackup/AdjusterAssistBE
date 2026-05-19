// config/stripe.js
const Stripe = require("stripe");

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27", // Uses a stable, reliable API version
});

module.exports = stripe;