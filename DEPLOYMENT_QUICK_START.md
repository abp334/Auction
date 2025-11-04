# Quick Deployment Guide

## TL;DR - Fastest Way to Deploy

### 1. MongoDB Atlas (5 minutes)
1. Sign up at https://mongodb.com/cloud/atlas
2. Create free cluster (M0)
3. Create database user (save password!)
4. Whitelist IP: `0.0.0.0/0` (allow all)
5. Get connection string (replace `<password>` and `<dbname>`)

### 2. Backend on Render (10 minutes)
1. Sign up at https://render.com (GitHub login)
2. New → Web Service → Connect GitHub repo
3. Settings:
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm start`
4. Add Environment Variables:
   ```
   PORT=5001
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/bidarena
   JWT_ACCESS_SECRET=<generate-32-char-random-string>
   JWT_REFRESH_SECRET=<generate-32-char-random-string>
   CLIENT_ORIGIN=https://your-frontend.vercel.app
   ```
5. Deploy → Copy URL (e.g., `https://bidarena-backend.onrender.com`)

**Generate JWT Secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Frontend on Vercel (5 minutes)
1. Sign up at https://vercel.com (GitHub login)
2. Add New → Project → Import GitHub repo
3. Settings:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add Environment Variable:
   ```
   VITE_API_URL=https://bidarena-backend.onrender.com/api/v1
   VITE_SERVER_URL=https://bidarena-backend.onrender.com
   ```
5. Deploy → Copy URL (e.g., `https://bidarena-live.vercel.app`)

### 4. Update Backend CORS
1. Go back to Render dashboard
2. Update `CLIENT_ORIGIN` to your Vercel URL
3. Redeploy backend

### 5. Test
- Visit your Vercel URL
- Test login/signup
- Test auction room

---

## Environment Variables Summary

### Backend (Render)
```
PORT=5001
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=<32-char-random>
JWT_REFRESH_SECRET=<32-char-random>
CLIENT_ORIGIN=https://your-frontend.vercel.app
```

### Frontend (Vercel)
```
VITE_API_URL=https://your-backend.onrender.com/api/v1
VITE_SERVER_URL=https://your-backend.onrender.com
```

---

## Common Issues

**CORS Error?**
- Update `CLIENT_ORIGIN` in backend with your frontend URL
- Redeploy backend

**Socket.IO Not Connecting?**
- Verify `VITE_SERVER_URL` matches your backend URL
- Check Render logs for Socket.IO errors
- Free tier on Render may have WebSocket limitations

**Database Connection Failed?**
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check connection string format
- Verify password in connection string

**Build Fails?**
- Check Node.js version (18+)
- Review build logs
- Verify all environment variables are set

---

## Quick Commands

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Test Backend Locally:**
```bash
cd server
npm install
npm run build
npm start
```

**Test Frontend Locally:**
```bash
npm install
npm run build
npm run preview
```

---

For detailed instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

