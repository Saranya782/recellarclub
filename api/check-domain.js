const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

module.exports = async (req, res) => {
  const { name } = req.query;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Domain name is required" });
  }

  // Strip TLD if user entered "example.com" — API expects just "example"
  const domainName = name
    .trim()
    .toLowerCase()
    .split(".")[0]
    .replace(/[^a-z0-9-]/g, "");

  if (!domainName) {
    return res.status(400).json({ error: "Invalid domain name" });
  }

  // Use Fixie proxy for static outbound IP
  const fixieUrl = process.env.FIXIE_URL;
  const axiosConfig = {
    params: {
      "auth-userid": process.env.RC_USER_ID,
      "api-key": process.env.RC_API_KEY,
      "domain-name": domainName,
      tlds: "com,net,org,in",
      "suggest-alternative": "true",
    },
    timeout: 15000,
  };

  if (fixieUrl) {
    axiosConfig.httpsAgent = new HttpsProxyAgent(fixieUrl);
    axiosConfig.proxy = false; // Let the agent handle proxying
  }

  try {
    const response = await axios.get(
      "https://httpapi.com/api/domains/available.json",
      axiosConfig
    );

    // Check if response is HTML (Cloudflare block)
    const data = response.data;
    if (typeof data === "string" && data.includes("<!DOCTYPE")) {
      return res.status(403).json({
        error:
          "IP blocked by Cloudflare. Whitelist Fixie IP in ResellerClub Settings → API.",
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
        error:
          "IP blocked by Cloudflare. Whitelist Fixie IP in ResellerClub Settings → API.",
      });
    }

    res.status(500).json({
      error:
        typeof errorData === "string"
          ? "Unexpected response from ResellerClub API"
          : errorData || "Failed to check domain availability",
    });
  }
};
