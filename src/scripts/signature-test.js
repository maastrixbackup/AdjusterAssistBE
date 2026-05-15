const crypto = require("crypto");

const orderId = "order_Spf3MCjFA2pxSt";
const paymentId = "pay_test123";

const generatedSignature = crypto
  .createHmac(
    "sha256",
    "BWb3EK7z0j0i95pkd3EmpIwR"
  )
  .update(`${orderId}|${paymentId}`)
  .digest("hex");

console.log(generatedSignature);