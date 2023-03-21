// Import modules and packages
const express = require("express");
const ejs = require("ejs");
const axios = require("axios");
const dotenv = require("dotenv");
const cookieSession = require("cookie-session");
const { AuthorizationCode } = require("simple-oauth2");

// Initialize and configure the app
dotenv.config();

const oauth2Client = new AuthorizationCode({
  client: {
    id: process.env.SPOTIFY_CLIENT_ID,
    secret: process.env.SPOTIFY_CLIENT_SECRET,
  },
  auth: {
    tokenHost: "https://accounts.spotify.com",
    tokenPath: "/api/token",
    authorizePath: "/authorize",
  },
});

const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
];

const redirectUri = "https://spotifystats.herokuapp.com/callback";

const app = express();

// Middleware
app.use(express.static("public")); // Serve static files (CSS, images) from the 'public' folder

app.set("view engine", "ejs"); // Set EJS as the view engine

app.use(
  cookieSession({
    name: "spotify-auth-session",
    keys: ["key1", "key2"],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  })
);

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  console.log("Entering /login route");

  const authorizationUri = oauth2Client.authorizeURL({
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    show_dialog: true,
  });

  console.log("Authorization URI:", authorizationUri);

  res.redirect(authorizationUri);
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const tokenParams = {
      code,
      redirect_uri: redirectUri,
    };
    const accessTokenResponse = await oauth2Client.getToken(tokenParams);

    const { access_token: accessToken, refresh_token: refreshToken } =
      accessTokenResponse.token;

    req.session.accessToken = accessToken;
    req.session.refreshToken = refreshToken;

    console.log("Access token set in session:", accessToken);

    res.redirect("/stats");
  } catch (error) {
    console.error("Error getting access token:", error.message);
    console.error("Error details:", error.data);
    res.redirect("/");
  }
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

app.get("/stats", async (req, res) => {
  if (!req.session.accessToken) {
    console.log("No access token in session. Redirecting to /.");
    forceLogout(req);
    return res.redirect("/");
  }

  const userData = await fetchUserData(req.session.accessToken);

  // Check for an invalid access token error and redirect to the home page
  if (userData && userData.error === "invalid_token") {
    console.log("Invalid access token. Redirecting to /.");
    forceLogout(req);
    return res.redirect("/");
  }

  if (!userData) {
    console.log("No user data found.");
    return res.render("stats", { noData: true });
  }

  const displayName = userData.display_name || "Unknown User";
  const email = userData.email || "No email available";
  const images = userData.images || [];
  const imageUrl =
    images.length > 0 ? images[0].url : "/default-profile-pic.png";

  res.render("stats", {
    displayName,
    email,
    imageUrl,
    noData: false,
  });
});

app.get("/top-artists", async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect("/");
  }

  const topArtists = await fetchTopArtists(req.session.accessToken);

  if (!topArtists) {
    return res.redirect("/login");
  }

  res.render("top-artists", {
    topArtists,
  });
});

app.get("/top-tracks", async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect("/");
  }

  const topTracks = await fetchTopTracks(req.session.accessToken);

  if (!topTracks) {
    return res.redirect("/login");
  }

  res.render("top-tracks", {
    topTracks,
  });
});

app.get("/top-genres", async (req, res) => {
  if (!req.session.accessToken) {
    return res.redirect("/");
  }

  const topGenres = await fetchTopGenres(req.session.accessToken);

  if (!topGenres) {
    return res.redirect("/login");
  }

  res.render("top-genres", {
    topGenres,
  });
});

// Utility functions
async function fetchUserData(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    const response = await axios.get("https://api.spotify.com/v1/me", {
      headers,
    });
    return response.data || {};
  } catch (error) {
    console.error("Error fetching user data:", error.message);
    // Return an error object when the access token is invalid
    if (error.response && error.response.status === 401) {
      return { error: "invalid_token" };
    }
    return null;
  }
}

async function fetchTopArtists(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const queryParams = new URLSearchParams({
    time_range: "short_term",
    limit: 50,
  });

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/me/top/artists?${queryParams}`,
      { headers }
    );
    return response.data.items || []; // Return an empty array if no data is available
  } catch (error) {
    console.error("Error fetching top artists:", error.message);
    return null;
  }
}

async function fetchArtistDetails(accessToken, artistId) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${artistId}`,
      { headers }
    );
    const { followers, popularity, monthly_listeners } = response.data;
    return {
      followers: followers.total,
      popularity,
      monthlyListeners: monthly_listeners,
    };
  } catch (error) {
    console.error("Error fetching artist details:", error.message);
    return null;
  }
}

async function fetchTopTracks(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const queryParams = new URLSearchParams({
    time_range: "short_term",
    limit: 50,
  });

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/me/top/tracks?${queryParams}`,
      { headers }
    );
    return response.data.items || []; // Return an empty array if no data is available
  } catch (error) {
    console.error("Error fetching top tracks:", error.message);
    return null;
  }
}

async function fetchTopGenres(accessToken) {
  const topArtists = await fetchTopArtists(accessToken);

  if (!topArtists) {
    return null;
  }

  const genreCount = {};
  const genreArtists = {};

  topArtists.forEach((artist) => {
    artist.genres.forEach((genre) => {
      if (genreCount[genre]) {
        genreCount[genre]++;
      } else {
        genreCount[genre] = 1;
        genreArtists[genre] = artist.images[1].url;
      }
    });
  });

  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50) // Limit to the top 50 genres
    .map((entry, index) => {
      return {
        rank: index + 1,
        name: entry[0],
        artistImage: genreArtists[entry[0]],
      };
    });

  return topGenres;
}

function forceLogout(req) {
  req.session = null;
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
