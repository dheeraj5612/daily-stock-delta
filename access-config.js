/* Public configuration only. Never put secret keys or webhook secrets here. */
window.DailyStockDeltaAccessConfig = Object.freeze({
  version: 1,
  auth: Object.freeze({
    enabled: false,
    provider: "clerk",
    publishableKey: "",
    frontendApiHost: ""
  }),
  billing: Object.freeze({
    enabled: false,
    provider: "stripe",
    paymentLink: ""
  })
});
