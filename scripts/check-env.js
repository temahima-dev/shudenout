#!/usr/bin/env node

/**
 * Environment Variables Check Script
 * Verifies that all required environment variables are present before deployment
 */

// Load environment variables from .env.local if it exists
const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=');
        process.env[key] = value;
      }
    }
  });
}

const requiredEnvVars = [
  'RAKUTEN_APP_ID',
  'NEXT_PUBLIC_RAKUTEN_APP_ID',
  'NEXT_PUBLIC_RAKUTEN_BASE_URL',
  'NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID',
  'NEXT_PUBLIC_RAKUTEN_FORMAT'
];

const optionalEnvVars = [
  'NEXT_PUBLIC_GA_ID',
  'NEXT_PUBLIC_ENV',
  'VERCEL_ENV'
];

console.log('🔍 Environment Variables Check');
console.log('================================');

let hasErrors = false;
let warnings = [];

// Check required variables
console.log('\n📋 Required Variables:');
requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: MISSING`);
    hasErrors = true;
  } else {
    const displayValue = varName.includes('APP_ID') 
      ? `${value.substring(0, 8)}...` 
      : value.length > 50 
        ? `${value.substring(0, 47)}...`
        : value;
    console.log(`✅ ${varName}: ${displayValue}`);
  }
});

// Check optional variables
console.log('\n📋 Optional Variables:');
optionalEnvVars.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.log(`⚠️  ${varName}: Not set`);
    warnings.push(varName);
  } else {
    console.log(`✅ ${varName}: ${value}`);
  }
});

// Environment-specific checks
console.log('\n🌍 Environment Detection:');
const nodeEnv = process.env.NODE_ENV || 'development';
const vercelEnv = process.env.VERCEL_ENV || 'local';
console.log(`📍 NODE_ENV: ${nodeEnv}`);
console.log(`📍 VERCEL_ENV: ${vercelEnv}`);

// Production-specific checks
if (vercelEnv === 'production') {
  console.log('\n🚀 Production Environment Checks:');
  
  // Ensure all required vars are present in production
  if (hasErrors) {
    console.log('❌ CRITICAL: Missing required environment variables in production!');
    process.exit(1);
  }
  
  // Check for development-specific values
  const appId = process.env.NEXT_PUBLIC_RAKUTEN_APP_ID;
  if (appId && appId.includes('test') || appId.includes('dev')) {
    console.log('⚠️  WARNING: Using development API keys in production');
    warnings.push('Development API keys detected');
  }
  
  console.log('✅ Production environment checks passed');
}

// Summary
console.log('\n📊 Summary:');
console.log(`✅ Required variables: ${requiredEnvVars.length - (hasErrors ? 1 : 0)}/${requiredEnvVars.length}`);
console.log(`⚠️  Warnings: ${warnings.length}`);

if (hasErrors) {
  console.log('\n❌ Build failed due to missing required environment variables.');
  console.log('Please set the missing variables and try again.');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are present.');
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} optional variables are missing (this is OK).`);
  }
}
