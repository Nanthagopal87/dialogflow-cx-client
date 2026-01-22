To run and test the image locally, you need to provide the same environment variables you used in Cloud Run/GKE. 

Additionally, because the code needs to talk to the Dialogflow CX API, you must **pass your Google Cloud credentials into the container**, otherwise the API calls will fail with an authentication error.

### 1. The Docker Run Command
Use the following command. I am mapping port **8081** on your machine to **8080** in the container to stay consistent with your previous tests.

**If you are using a Service Account JSON Key:**
1. Place your `key.json` in your current folder.
2. Run:

```bash
docker run -it \
  -p 8081:8080 \
  -e PROJECT_ID=prj-gdg-ai-meetup-20250717-1 \
  -e LOCATION=us-central1 \
  -e AGENT_ID=your-agent-uuid \
  -e GOOGLE_APPLICATION_CREDENTIALS=/tmp/keys/key.json \
  -v "$(pwd):/tmp/keys" \
  us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/[REPO_NAME]/df-cx-client:v2
```

**If you want to use your local "Application Default Credentials" (ADC):**
(This uses the login you performed earlier with `gcloud auth application-default login`)

*   **Linux/Mac:**
    ```bash
    docker run -it -p 8081:8080 \
      -e PROJECT_ID=prj-gdg-ai-meetup-20250717-1 \
      -e LOCATION=us-central1 \
      -e AGENT_ID=your-agent-uuid \
      -e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json \
      -v "$HOME/.config/gcloud:/root/.config/gcloud" \
      us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/[REPO_NAME]/df-cx-client:v2
    ```
*   **Windows (PowerShell):**
    ```powershell
    docker run -it -p 8081:8080 `
      -e PROJECT_ID=prj-gdg-ai-meetup-20250717-1 `
      -e LOCATION=us-central1 `
      -e AGENT_ID=your-agent-uuid `
      -e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json `
      -v "$env:APPDATA/gcloud:/root/.config/gcloud" `
      us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/[REPO_NAME]/df-cx-client:v2
    ```

---

### 2. What these flags do:
*   `-it`: Runs the container in **interactive** mode so you can see the `console.log` output immediately.
*   `-p 8081:8080`: Connects your computer's port **8081** to the container's port **8080**.
*   `-e`: Sets the environment variables your Node.js code expects (`process.env.PROJECT_ID`, etc.).
*   `-v`: **Volume Mounting**. This is the "magic" part that shares your Google credentials from your computer into the container so the Dialogflow SDK can "see" them.

---

### 3. Test with Curl
Once the container is running and you see `"Client app listening on port 8080"`, open a **second terminal** and test it:

```bash
curl -X POST http://localhost:8081/api/message \
-H "Content-Type: application/json" \
-d '{
  "text": "demo"
}'
```

### 4. What to look for:
*   **If it works:** You will see the JSON response from Dialogflow.
*   **If the `uuid` error is still there:** The container will crash immediately with the `ERR_REQUIRE_ESM` error. This means you need to double-check that you downgraded `uuid` to `8.3.2` and rebuilt the image.
*   **If you get a Permission Error:** It means the credentials mount (`-v`) isn't pointing to the right folder on your machine.

**Did the container start up without the ESM error this time?**