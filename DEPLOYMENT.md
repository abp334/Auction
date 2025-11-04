# Deployment Guide - BidArena Live

This guide covers deploying your MERN stack cricket auction application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Hosting Options](#hosting-options)
3. [Database Setup (MongoDB Atlas)](#database-setup)
4. [Backend Deployment](#backend-deployment)
5. [Frontend Deployment](#frontend-deployment)
6. [Environment Variables](#environment-variables)
7. [Complete Deployment Steps](#complete-deployment-steps)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- MongoDB Atlas account (free tier available)
- Git repository (GitHub, GitLab, or Bitbucket)
- Node.js 18+ installed locally
- Domain name (optional, but recommended)

---

## Hosting Options

### Backend (Node.js/Express/Socket.IO)

**Recommended Options:**

1. **Render** (Recommended for beginners)

   - Free tier available
   - Automatic deployments from Git
   - Easy environment variable management
   - URL: https://render.com

2. **Railway**

   - Free tier available
   - Great for Socket.IO
   - URL: https://railway.app

3. **Heroku**

   - Easy deployment
   - Free tier discontinued, paid plans available
   - URL: https://www.heroku.com

4. **DigitalOcean App Platform**

   - Simple deployment
   - Good performance
   - URL: https://www.digitalocean.com/products/app-platform

5. **AWS EC2 / Google Cloud / Azure**
   - More control, requires more setup
   - Better for production at scale

### Frontend (React/Vite)

**Recommended Options:**

1. **Vercel** (Recommended)

   - Free tier
   - Automatic deployments
   - Excellent for React
   - URL: https://vercel.com

2. **Netlify**

   - Free tier
   - Easy deployment
   - URL: https://www.netlify.com

3. **Cloudflare Pages**

   - Free tier
   - Fast CDN
   - URL: https://pages.cloudflare.com

4. **GitHub Pages**
   - Free
   - Requires extra configuration

---

## Database Setup

### MongoDB Atlas Setup

1. **Create Account**

   - Go to https://www.mongodb.com/cloud/atlas
   - Sign up for free account

2. **Create Cluster**

   - Click "Build a Database"
   - Choose FREE tier (M0)
   - Select your preferred cloud provider and region
   - Click "Create"

3. **Create Database User**

   - Go to "Database Access" in left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create username and password (save these!)
   - Set privileges to "Atlas admin" or "Read and write to any database"
   - Click "Add User"

4. **Whitelist IP Address**

   - Go to "Network Access" in left sidebar
   - Click "Add IP Address"
   - For production: Click "Allow Access from Anywhere" (0.0.0.0/0)
   - For development: Add your current IP
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Database" in left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with your database name (e.g., `bidarena`)

**Example Connection String:**

```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/bidarena?retryWrites=true&w=majority
```

---

## Environment Variables

### Backend Environment Variables (.env)

Create a `.env` file in the `server/` directory:

```env
# Server Configuration
PORT=5001
NODE_ENV=production

# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/bidarena?retryWrites=true&w=majority

# JWT Secrets (Generate strong random strings)
JWT_ACCESS_SECRET=your-super-secret-access-key-here-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here-min-32-chars

# CORS Origins (Your frontend URL)
CLIENT_ORIGIN=https://your-frontend-domain.vercel.app
# Or for multiple origins:
# CLIENT_ORIGIN=https://your-frontend-domain.vercel.app,https://www.yourdomain.com
```

**Generate JWT Secrets:**

```bash
# On Linux/Mac:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use online generator:
# https://www.grc.com/passwords.htm
```

### Frontend Environment Variables

Create a `.env` file in the root directory:

```env
# Backend API URL (Your backend deployment URL)
VITE_API_URL=https://your-backend-app.onrender.com/api/v1

# Socket.IO Server URL (Same as backend URL, without /api/v1)
VITE_SERVER_URL=https://your-backend-app.onrender.com
```

**Note:** `VITE_SERVER_URL` is used for Socket.IO connections. If not set, it defaults to `http://localhost:5001` for local development.

**For Production Build:**

- Vite uses `VITE_` prefix for environment variables
- These are embedded at build time
- Make sure to set these in your hosting platform's environment variables

---

## Backend Deployment

### Option 1: Render (Recommended)

1. **Create Account**

   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service**

   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the repository

3. **Configure Service**

   - **Name**: `bidarena-backend` (or your choice)
   - **Environment**: `Node`
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm start`
   - **Root Directory**: Leave empty (or set to `server` if deploying from root)

4. **Add Environment Variables**

   - Click "Environment" tab
   - Add all variables from your `.env` file:
     - `PORT=5001`
     - `NODE_ENV=production`
     - `MONGODB_URI=your-mongodb-uri`
     - `JWT_ACCESS_SECRET=your-secret`
     - `JWT_REFRESH_SECRET=your-secret`
     - `CLIENT_ORIGIN=https://your-frontend.vercel.app`

5. **Deploy**

   - Click "Create Web Service"
   - Wait for deployment (usually 5-10 minutes)
   - Copy your service URL (e.g., `https://bidarena-backend.onrender.com`)

6. **Important Notes for Render**
   - Free tier spins down after 15 minutes of inactivity
   - First request after spin-down may take 30-60 seconds
   - Consider upgrading to paid plan for production
   - Socket.IO works but may need keep-alive configuration

### Option 2: Railway

1. **Create Account**

   - Go to https://railway.app
   - Sign up with GitHub

2. **Create New Project**

   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Select your repository

3. **Configure Service**

   - Railway auto-detects Node.js
   - Set **Root Directory** to `server`
   - Set **Start Command** to `npm start`
   - Set **Build Command** to `npm run build`

4. **Add Environment Variables**

   - Click on your service → "Variables"
   - Add all environment variables

5. **Deploy**
   - Railway auto-deploys on push
   - Get your service URL from "Settings" → "Domains"

### Option 3: Heroku

1. **Install Heroku CLI**

   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku

   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login**

   ```bash
   heroku login
   ```

3. **Create App**

   ```bash
   cd server
   heroku create bidarena-backend
   ```

4. **Set Environment Variables**

   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your-mongodb-uri
   heroku config:set JWT_ACCESS_SECRET=your-secret
   heroku config:set JWT_REFRESH_SECRET=your-secret
   heroku config:set CLIENT_ORIGIN=https://your-frontend.vercel.app
   ```

5. **Deploy**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push heroku main
   ```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

1. **Create Account**

   - Go to https://vercel.com
   - Sign up with GitHub

2. **Import Project**

   - Click "Add New..." → "Project"
   - Import your GitHub repository

3. **Configure Project**

   - **Framework Preset**: Vite
   - **Root Directory**: `./` (root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Add Environment Variables**

   - Go to "Environment Variables"
   - Add:
     - `VITE_API_URL=https://your-backend.onrender.com/api/v1`
     - `VITE_SOCKET_URL=https://your-backend.onrender.com` (if different)

5. **Deploy**

   - Click "Deploy"
   - Wait for deployment
   - Get your URL (e.g., `https://bidarena-live.vercel.app`)

6. **Update Backend CORS**
   - Update `CLIENT_ORIGIN` in backend to include your Vercel URL
   - Redeploy backend

### Option 2: Netlify

1. **Create Account**

   - Go to https://www.netlify.com
   - Sign up with GitHub

2. **Add New Site**

   - Click "Add new site" → "Import an existing project"
   - Connect to GitHub
   - Select your repository

3. **Configure Build**

   - **Base directory**: Leave empty
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

4. **Add Environment Variables**

   - Go to "Site settings" → "Environment variables"
   - Add:
     - `VITE_API_URL=https://your-backend.onrender.com/api/v1`

5. **Deploy**
   - Click "Deploy site"
   - Get your URL (e.g., `https://bidarena-live.netlify.app`)

---

## Complete Deployment Steps

### Step-by-Step Checklist

1. **✅ Set up MongoDB Atlas**

   - [ ] Create account
   - [ ] Create cluster
   - [ ] Create database user
   - [ ] Whitelist IP (0.0.0.0/0 for production)
   - [ ] Get connection string

2. **✅ Deploy Backend**

   - [ ] Choose hosting platform (Render/Railway/Heroku)
   - [ ] Connect GitHub repository
   - [ ] Configure build/start commands
   - [ ] Add all environment variables
   - [ ] Deploy and get backend URL

3. **✅ Deploy Frontend**

   - [ ] Choose hosting platform (Vercel/Netlify)
   - [ ] Connect GitHub repository
   - [ ] Configure build settings
   - [ ] Add environment variables (VITE_API_URL)
   - [ ] Deploy and get frontend URL

4. **✅ Update CORS**

   - [ ] Update `CLIENT_ORIGIN` in backend with frontend URL
   - [ ] Redeploy backend

5. **✅ Update Frontend Socket Connection**

   - [ ] Check `AuctionRoom.tsx` - ensure Socket.IO connects to backend URL
   - [ ] Update if using environment variable for Socket URL

6. **✅ Test Everything**
   - [ ] Test login/signup
   - [ ] Test admin dashboard
   - [ ] Test captain dashboard
   - [ ] Test player view
   - [ ] Test auction room
   - [ ] Test bidding
   - [ ] Test Socket.IO connections

---

## Production Considerations

### Security Checklist

- [ ] Use strong JWT secrets (32+ characters)
- [ ] Use HTTPS only (most platforms provide this)
- [ ] Set `NODE_ENV=production`
- [ ] Review CORS settings (only allow your frontend domain)
- [ ] Enable MongoDB Atlas IP whitelist restrictions
- [ ] Use environment variables, never commit secrets
- [ ] Enable rate limiting (consider adding `express-rate-limit`)

### Performance Optimization

- [ ] Enable gzip compression (usually handled by platform)
- [ ] Use CDN for static assets (Vercel/Netlify provide this)
- [ ] Consider Redis for session storage at scale
- [ ] Monitor database connections
- [ ] Set up error tracking (Sentry, LogRocket)

### Monitoring

- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Monitor error logs
- [ ] Set up database monitoring in MongoDB Atlas
- [ ] Monitor API response times

---

## Troubleshooting

### Backend Issues

**Problem: Application won't start**

- Check build command output
- Verify all environment variables are set
- Check MongoDB connection string
- Verify PORT is set correctly

**Problem: CORS errors**

- Verify `CLIENT_ORIGIN` includes your frontend URL
- Check that frontend URL has no trailing slash
- Verify CORS middleware is configured correctly

**Problem: Socket.IO not connecting**

- Check that Socket.IO server is running
- Verify CORS settings for Socket.IO
- Check firewall/network settings
- For Render: Free tier may have WebSocket limitations

**Problem: Database connection failed**

- Verify MongoDB Atlas IP whitelist includes 0.0.0.0/0
- Check connection string format
- Verify database user credentials
- Check MongoDB Atlas cluster status

### Frontend Issues

**Problem: API calls failing**

- Verify `VITE_API_URL` is set correctly
- Check CORS settings on backend
- Verify backend is running and accessible
- Check browser console for errors

**Problem: Socket.IO not connecting**

- Verify Socket.IO client connects to correct URL
- Check that backend Socket.IO server is running
- Verify WebSocket support in browser

**Problem: Build fails**

- Check Node.js version (should be 18+)
- Verify all dependencies are in package.json
- Check for TypeScript errors
- Review build logs

### Common Environment Variable Issues

**Problem: Environment variables not working**

- Frontend: Variables must start with `VITE_`
- Backend: Variables must be set in hosting platform
- Restart/deploy after adding variables
- Check for typos in variable names

---

## Quick Reference

### Environment Variables Summary

**Backend (.env):**

```env
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CLIENT_ORIGIN=https://your-frontend.vercel.app
```

**Frontend (.env):**

```env
VITE_API_URL=https://your-backend.onrender.com/api/v1
```

### Build Commands

**Backend:**

```bash
cd server
npm install
npm run build
npm start
```

**Frontend:**

```bash
npm install
npm run build
# Output in dist/ directory
```

### Testing Locally Before Deployment

1. **Test Backend:**

   ```bash
   cd server
   npm install
   npm run build
   npm start
   # Should run on http://localhost:5001
   ```

2. **Test Frontend:**
   ```bash
   npm install
   npm run build
   npm run preview
   # Should run on http://localhost:4173
   ```

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review hosting platform logs
3. Check MongoDB Atlas logs
4. Verify all environment variables are set
5. Test locally first to isolate issues

---

## Next Steps After Deployment

1. **Set up custom domain** (optional)
2. **Configure SSL certificates** (usually automatic)
3. **Set up monitoring and alerts**
4. **Configure backup strategy** for MongoDB
5. **Set up CI/CD** for automatic deployments
6. **Performance testing** with expected load
7. **Security audit** of production deployment

---

Good luck with your deployment! 🚀
