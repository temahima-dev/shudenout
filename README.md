This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Rakuten API Configuration (Required)
RAKUTEN_APP_ID=1087100771157502289
NEXT_PUBLIC_RAKUTEN_APP_ID=1087100771157502289
NEXT_PUBLIC_RAKUTEN_BASE_URL=https://app.rakuten.co.jp/services/api/Travel/SimpleHotelSearch/20170426
NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID=4b8560c4.4d2e4a15.4b8560c5.ac4760d5
NEXT_PUBLIC_RAKUTEN_FORMAT=json

# Development Environment
NODE_ENV=development
NEXT_PUBLIC_ENV=development
VERCEL_ENV=development

# Optional: Google Analytics
NEXT_PUBLIC_GA_ID=G-P2JPNCL5DG
```

**⚠️ Important:** All environment variables must be set in both `.env.local` (for local development) and Vercel dashboard (for production).

### Development Server

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your actual API keys
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Main app: [http://localhost:3000](http://localhost:3000)
   - API test: [http://localhost:3000/api/test](http://localhost:3000/api/test)
   - Hotel search: [http://localhost:3000/api/hotels?area=shinjuku](http://localhost:3000/api/hotels?area=shinjuku)

### Verification

After setup, verify that all APIs are working:
```bash
curl http://localhost:3000/api/test
# Should return: {"status":"success","hasRakutenKey":true}

curl "http://localhost:3000/api/hotels?area=shinjuku"
# Should return hotel data with items array
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment & Monitoring

### Deploy on Vercel

1. **Environment Variables Setup:**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Add all variables from `.env.local` for both Production and Preview environments
   - Use "Redeploy with cache disabled" after setting variables

2. **Deployment Verification:**
   ```bash
   # Check health status
   curl https://www.shudenout.com/api/health
   
   # Verify API functionality
   curl https://www.shudenout.com/api/test
   curl "https://www.shudenout.com/api/hotels?area=shinjuku"
   ```

### Uptime Monitoring

Set up monitoring for these endpoints:
- **Health Check:** `https://www.shudenout.com/api/health`
- **API Test:** `https://www.shudenout.com/api/test`

**Recommended Services:**
- [UptimeRobot](https://uptimerobot.com/) (Free)
- [Pingdom](https://www.pingdom.com/)
- [StatusCake](https://www.statuscake.com/)

**Monitor Configuration:**
- Check interval: 5 minutes
- Timeout: 30 seconds
- Expected status: 200
- Alert on: Status code != 200 or response time > 5000ms

### Environment Sync

To sync production environment variables to local development:
```bash
# Install Vercel CLI
npm install -g vercel

# Link project and pull environment variables
vercel link
vercel env pull .env.production

# Copy to local development
cp .env.production .env.local
```

### Build Verification

The project includes automatic environment variable checking:
```bash
# Manual check
npm run check-env

# Automatic check (runs after build)
npm run build
```
