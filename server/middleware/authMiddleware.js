import { auth } from "express-oauth2-jwt-bearer";
import Users from "../models/Users.js";

// Validates Auth0 access tokens (RS256, JWKS auto-fetched)
export const verifyAccessToken = auth({
  audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  tokenSigningAlg: "RS256",
});

// Fetches user profile from Auth0's /userinfo endpoint (free, no rate limits)
async function fetchAuth0Profile(accessToken) {
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Determines the role based on which frontend app made the request.
// User app (port 5173) → USER, Admin app (port 5174) → ADMIN.
function getRoleFromOrigin(req) {
  const origin = req.headers.origin || "";
  const adminUrl = process.env.ADMIN_URL || "http://localhost:5174";
  return origin === adminUrl ? "ADMIN" : "USER";
}

// Maps Auth0 sub claim to the local MongoDB user.
// If the user doesn't exist locally, auto-provisions using /userinfo.
// Role is determined by which app (user vs admin) the request comes from.
export const resolveUser = async (req, res, next) => {
  try {
    const auth0Id = req.auth.payload.sub;
    let user = await Users.findOne({ auth0_id: auth0Id });

    if (!user) {
      // Get profile from Auth0 /userinfo
      const token = req.headers.authorization?.split(" ")[1];
      const profile = token ? await fetchAuth0Profile(token) : null;

      const email = profile?.email || `${auth0Id}@placeholder.local`;
      const username = profile?.nickname || profile?.preferred_username || email.split("@")[0];
      const role = getRoleFromOrigin(req);

      try {
        user = await Users.create({
          auth0_id: auth0Id,
          email,
          username,
          role,
          is_active: true,
          is_profile_complete: false,
        });
        console.log(`Auto-provisioned ${role}: ${username} (${email})`);
      } catch (createError) {
        if (createError.code === 11000) {
          const suffix = auth0Id.split("|")[1]?.slice(-6) || Date.now().toString(36);
          user = await Users.create({
            auth0_id: auth0Id,
            email,
            username: `${username}_${suffix}`,
            role,
            is_active: true,
            is_profile_complete: false,
          });
          console.log(`Auto-provisioned ${role} (with suffix): ${username}_${suffix}`);
        } else {
          console.error("Failed to auto-provision user:", createError.message);
          return res.status(500).json({ message: "Failed to create user profile" });
        }
      }
    }

    if (!user.is_active) {
      return res.status(403).json({ message: "User account is deactivated" });
    }

    req.user = { userId: user._id.toString(), role: user.role, auth0Id };
    next();
  } catch (error) {
    console.error("Error resolving user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
