const express = require('express');
const ejs = require('ejs');
const axios = require('axios');
const dotenv = require('dotenv');
const cookieSession = require('cookie-session');
const { AuthorizationCode } = require('simple-oauth2');

dotenv.config();

const oauth2Client = new AuthorizationCode({
  client: {
    id: process.env.SPOTIFY_CLIENT_ID,
    secret: process.env.SPOTIFY_CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://accounts.spotify.com',
    tokenPath: '/api/token',
    authorizePath: '/authorize',
  },
});

const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-top-read',
  'playlist-read-private',
  'playlist-read-collaborative',
];

const redirectUri = 'http://localhost:3000/callback';

  

const app = express();

app.use(express.static('public')); // Serve static files (CSS, images) from the 'public' folder
app.set('view engine', 'ejs'); // Set EJS as the view engine

app.use(cookieSession({
  name: 'spotify-auth-session',
  keys: ['key1', 'key2'],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

app.get('/', (req, res) => {
    res.render('index');
  });
  
  app.get('/login', (req, res) => {
    const authorizationUri = oauth2Client.authorizeURL({
      scope: SPOTIFY_SCOPES,
      redirect_uri: redirectUri,
    });
  
    res.redirect(authorizationUri);
  });
  
  app.get('/callback', async (req, res) => {
    const { code } = req.query;
  
    try {
      const tokenParams = {
        code,
        redirect_uri: redirectUri,
      };
      const accessTokenResponse = await oauth2Client.getToken(tokenParams);
  
      const { access_token: accessToken, refresh_token: refreshToken } = accessTokenResponse.token;
  
      req.session.accessToken = accessToken;
      req.session.refreshToken = refreshToken;
  
      res.redirect('/stats');
    } catch (error) {
      console.error('Error getting access token:', error.message);
      res.redirect('/');
    }
  });
  
  app.get('/logout', (req, res) => {
    // Log out the user (this will be implemented later)
  });
  
  app.get('/stats', async (req, res) => {
    if (!req.session.accessToken) {
      return res.redirect('/');
    }
  
    const userData = await fetchUserData(req.session.accessToken);
  
    if (!userData) {
      return res.redirect('/login');
    }
  
    const { display_name: displayName, email, images } = userData;
    const imageUrl = images.length > 0 ? images[0].url : '';
  
    res.render('stats', {
      displayName,
      email,
      imageUrl,
    });
  });
  
  
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


async function fetchUserData(accessToken) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  try {
    const response = await axios.get('https://api.spotify.com/v1/me', { headers });
    return response.data;
  } catch (error) {
    console.error('Error fetching user data:', error.message);
    return null;
  }
}
