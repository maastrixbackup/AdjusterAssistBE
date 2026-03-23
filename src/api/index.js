const serverless = require("serverless-http");
const app = require("../../src/app"); // your existing file

module.exports = serverless(app);