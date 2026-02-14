require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/check-domain", async (req, res) => {
  const { name } = req.query;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Domain name is required" });
  }

  // Strip TLD if user entered "example.com" — API expects just "example"
  const domainName = name.trim().toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "");

  if (!domainName) {
    return res.status(400).json({ error: "Invalid domain name" });
  }

  try {
    const response = await axios.get(
      "https://httpapi.com/api/domains/available.json",
      {
        params: {
          "auth-userid": process.env.RC_USER_ID,
          "api-key": process.env.RC_API_KEY,
          "domain-name": domainName,
          tlds: "com,net,org,in",
          "suggest-alternative": "true",
        },
        timeout: 15000,
      }
    );

    // Check if success response is actually HTML (Cloudflare block with 200 status)
    const data = response.data;
    if (typeof data === "string" && data.includes("<!DOCTYPE")) {
      return res.status(403).json({
        error: "Your server IP is blocked by Cloudflare. Whitelist it in ResellerClub Settings → API.",
      });
    }

    res.json(data);
  } catch (error) {
    console.error("Domain check failed:", error.message);

    const errorData = error.response?.data;
    const isHtml =
      typeof errorData === "string" &&
      (errorData.includes("<!DOCTYPE") || errorData.includes("<html"));

    if (isHtml || error.response?.status === 403) {
      return res.status(403).json({
        error: "Your server IP is blocked by Cloudflare. Whitelist it in ResellerClub Settings → API.",
      });
    }

    const message =
      typeof errorData === "string"
        ? "Unexpected response from ResellerClub API"
        : errorData || "Failed to check domain availability";

    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
