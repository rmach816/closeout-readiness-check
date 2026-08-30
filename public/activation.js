(() => {
  const query = new URLSearchParams(window.location.search);
  const activationId = query.get("activation_id");
  const publicKey = query.get("public_key");
  const panel = document.getElementById("computer-activation");
  const plans = document.getElementById("activation-plans");
  const status = document.getElementById("activation-status");
  if (!panel || !plans || !status) return;
  if (!activationId && !publicKey && query.get("checkout") !== "canceled") return;
  panel.hidden = false;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(activationId || "") || !/^[A-Za-z0-9_-]{32,512}$/.test(publicKey || "")) {
    status.textContent = "Open the original activation link from your completed check in Claude Desktop to choose a plan.";
    return;
  }
  plans.hidden = false;
  const buttons = Array.from(plans.querySelectorAll("[data-checkout-plan]"));
  let pending = false;
  for (const button of buttons) {
    button.addEventListener("click", async () => {
      if (pending) return;
      const plan = button.dataset.checkoutPlan;
      if (plan !== "monthly" && plan !== "annual") return;
      pending = true;
      buttons.forEach((item) => { item.disabled = true; });
      status.dataset.kind = "";
      status.textContent = "Opening secure Stripe checkout…";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "checkout", plan, activationId, publicKey }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Checkout unavailable");
        const result = await response.json();
        const destination = new URL(result.url);
        if (destination.protocol !== "https:" || destination.hostname !== "checkout.stripe.com" || destination.username || destination.password) {
          throw new Error("Unexpected checkout destination");
        }
        window.location.assign(destination.href);
      } catch {
        status.dataset.kind = "error";
        status.textContent = "Checkout could not be opened. Please try again, or contact support if this continues.";
        pending = false;
        buttons.forEach((item) => { item.disabled = false; });
      } finally {
        clearTimeout(timer);
      }
    });
  }
})();
