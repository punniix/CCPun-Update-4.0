export const DEPLOYMENT_CONTRACT_VERSION = 2;

export const DEPLOYMENT_LANES = Object.freeze({
  "web-production": {
    "domain": "ccpun.com",
    "provider": "hostinger",
    "role": "web",
    "environment": "production",
    "publicEnvironment": "production",
    "sanityProjectId": "kyfxgjnq",
    "sanityDataset": "production",
    "uatMode": "0",
    "productionAnalytics": "1",
    "indexable": true,
    "nodeMajor": 24,
    "workspace": "@ccpun/web",
    "buildCommand": "npm run build",
    "rootDirectory": "./",
    "outputDirectory": "apps/web/.next"
  },
  "web-uat": {
    "domain": "test.ccpun.com",
    "provider": "hostinger",
    "role": "web",
    "environment": "web-uat",
    "publicEnvironment": "web-uat",
    "sanityProjectId": "ccb9lnw5",
    "sanityDataset": "uat",
    "uatMode": "1",
    "productionAnalytics": "0",
    "indexable": false,
    "nodeMajor": 24,
    "workspace": "@ccpun/web",
    "buildCommand": "npm run build",
    "rootDirectory": "./",
    "outputDirectory": "apps/web/.next"
  },
  "admin-production": {
    "domain": "admin.ccpun.com",
    "provider": "hostinger",
    "role": "admin",
    "environment": "production-admin",
    "publicEnvironment": "production-admin",
    "sanityProjectId": "kyfxgjnq",
    "sanityDataset": "production",
    "uatMode": "0",
    "productionAnalytics": "0",
    "indexable": false,
    "nodeMajor": 24,
    "workspace": "@ccpun/admin"
  },
  "admin-uat": {
    "domain": "admin-test.ccpun.com",
    "provider": "hostinger",
    "role": "admin",
    "environment": "admin-uat",
    "publicEnvironment": "admin-uat",
    "sanityProjectId": "ccb9lnw5",
    "sanityDataset": "uat",
    "uatMode": "1",
    "productionAnalytics": "0",
    "indexable": false,
    "nodeMajor": 24,
    "workspace": "@ccpun/admin"
  }
});

export const DEPLOYMENT_CONTRACT = Object.freeze({
  version: DEPLOYMENT_CONTRACT_VERSION,
  lanes: DEPLOYMENT_LANES,
});
