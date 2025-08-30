<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://aistudio-preprod.corp.google.com/apps/drive/1P2rr4cwHFMXKCx46LQ8lr7l4BsR9ML8q?resourceKey=0-gnXiO8PBNQKxrDzvEuW-KQ

## Run Locally

**Prerequisites:**  
- Node.js
- Google Cloud Project with Vertex AI API enabled
- Google Cloud SDK installed and authenticated (`gcloud auth application-default login`)

1. Install dependencies:
   `npm install`
2. Set up Google Cloud configuration in [.env.local](.env.local):
   - `GOOGLE_CLOUD_PROJECT`: Your Google Cloud project ID
   - `GOOGLE_CLOUD_LOCATION`: Your preferred Vertex AI location (default: us-central1)
3. Ensure you're authenticated with Google Cloud:
   `gcloud auth application-default login`
4. Run the app:
   `npm run dev`
