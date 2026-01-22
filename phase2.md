Congratulations! Transitioning to **GKE** is a great next step. Since you are already using the **Gateway API** and **HttpRoute**, you are using the modern networking standard for Kubernetes.

Unlike Cloud Run, GKE requires a few more manual steps regarding container management and identity. Here is the roadmap for Phase 2:

---

### 1. Build and Push the Image to Artifact Registry
GKE cannot build from source like Cloud Run does. You must host your image in a registry.

```bash
# 1. Create a repository (if you don't have one)
gcloud artifacts repositories create my-repo --repository-format=docker --location=us-central1

# 2. Build the image (replace PROJECT_ID)
docker build -t us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/my-repo/df-cx-client:v1 .

# 3. Push to Registry
docker push us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/my-repo/df-cx-client:v1
```

---

### 2. Configure Workload Identity (IAM)
In Cloud Run, you just attached the service account. In GKE, you use **Workload Identity Federation** to link a Kubernetes Service Account (KSA) to your Google Service Account (GSA).

```bash
# 1. Create a Kubernetes Namespace (optional)
kubectl create namespace df-apps

# 2. Create a Kubernetes Service Account
kubectl create serviceaccount df-client-ksa --namespace df-apps

# 3. Bind the KSA to the GSA (df-cx-client-sa)
gcloud iam service-accounts add-iam-policy-binding \
    df-cx-client-sa@prj-gdg-ai-meetup-20250717-1.iam.gserviceaccount.com \
    --role="roles/iam.workloadIdentityUser" \
    --member="serviceAccount:prj-gdg-ai-meetup-20250717-1.svc.id.goog[df-apps/df-client-ksa]"

# 4. Annotate the KSA
kubectl annotate serviceaccount df-client-ksa \
    --namespace df-apps \
    iam.gke.io/gcp-service-account=df-cx-client-sa@prj-gdg-ai-meetup-20250717-1.iam.gserviceaccount.com
```

---

### 3. Kubernetes Deployment & Service
Create a file named `client-app.yaml`. Note that the app can still listen on **8080** inside the container; Kubernetes handles the internal routing.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: df-cx-client
  namespace: df-apps
spec:
  replicas: 2
  selector:
    matchLabels:
      app: df-cx-client
  template:
    metadata:
      labels:
        app: df-cx-client
    spec:
      serviceAccountName: df-client-ksa # Crucial for IAM
      containers:
      - name: client-app
        image: us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/my-repo/df-cx-client:v1
        ports:
        - containerPort: 8080
        env:
        - name: PROJECT_ID
          value: "prj-gdg-ai-meetup-20250717-1"
        - name: LOCATION
          value: "us-central1"
        - name: AGENT_ID
          value: "your-agent-uuid"
---
apiVersion: v1
kind: Service
metadata:
  name: df-cx-client-service
  namespace: df-apps
spec:
  selector:
    app: df-cx-client
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
```
Apply it: `kubectl apply -f client-app.yaml`

---

### 4. Update Gateway API (HttpRoute)
Since your webhook is already on an `HttpRoute`, you can either create a new route or add a rule to the existing one. This allows you to share the same IP/Load Balancer.

**Example: Splitting traffic by path**
*   `your-domain.com/webhook` -> Webhook Service
*   `your-domain.com/api` -> Client App Service

```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: HTTPRoute
metadata:
  name: df-combined-route
  namespace: df-apps
spec:
  parentRefs:
  - name: my-gateway # Your existing Gateway name
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: df-cx-client-service
      port: 80
  - matches:
    - path:
        type: PathPrefix
        value: /webhook
    backendRefs:
    - name: df-cx-webhook-service
      port: 8080
```

---

### Key GKE Considerations:
1.  **Port Conflict:** There is **no conflict** between your webhook on 8080 and your client on 8080 because they are in different Pods/Deployments. They only meet at the `HTTPRoute`.
2.  **Readiness Probes:** For GKE, it is highly recommended to add `readinessProbe` and `livenessProbe` to your YAML to ensure the Load Balancer doesn't send traffic to a crashing container.
3.  **Regional Endpoints:** Just like in Cloud Run, ensure your Node.js code continues to use the `${location}-dialogflow.googleapis.com` endpoint logic.

How is your `HttpRoute` currently configured? Are you using a specific domain or just the Load Balancer IP?


##############
us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/cloud-run-source-deploy/df-cx-client-service
# 1. Build the image locally
docker build -t [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPO_NAME]/df-cx-client:v1 .
gcloud artifacts repositories create my-repo --repository-format=docker --location=us-central1


docker build -t us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/my-repo/df-cx-client:v1 .

or

gcloud builds submit --tag [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPO_NAME]/df-cx-client:v1 .

gcloud builds submit --tag us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/my-repo/df-cx-client:v1 .


# 2. Push to Google Cloud Artifact Registry
docker push [REGION]-docker.pkg.dev/[PROJECT_ID]/[REPO_NAME]/df-cx-client:v1
docker push us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/my-repo/df-cx-client:v1


### 

Great news! Now that the image is built, you are ready for the final stretch: **Pushing the image to the registry** and **Deploying to GKE**.

Here are the remaining steps to get your Phase 2 live:

### 1. Push the Image to Artifact Registry
You need to move that local image to Google Cloud so GKE can pull it.

```bash
# 1. Authenticate Docker to Google Cloud (if not already done)
gcloud auth configure-docker us-central1-docker.pkg.dev

# 2. Tag your image (replace [REPO_NAME] with your actual repo name)
docker tag [LOCAL_IMAGE_NAME] us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/[REPO_NAME]/df-cx-client:v1

# 3. Push it
docker push us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/[REPO_NAME]/df-cx-client:v1
```

---

### 2. Final Deployment YAML
Create a file named `df-cx-client-deployment.yaml`. 

**Note:** Since your Gateway is `gke-l7-rilb` (Internal Load Balancer), it will be accessible at your internal IP `10.0.0.9`.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: client-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: client-chat
  template:
    metadata:
      labels:
        app: client-chat
    spec:
      serviceAccountName: client-app-ksa # Must match the KSA you created
      containers:
      - name: node-app
        image: us-central1-docker.pkg.dev/prj-gdg-ai-meetup-20250717-1/[REPO_NAME]/df-cx-client:v1
        ports:
        - containerPort: 8080
        env:
        - name: PROJECT_ID
          value: "prj-gdg-ai-meetup-20250717-1"
        - name: LOCATION
          value: "us-central1"
        - name: AGENT_ID
          value: "YOUR_AGENT_UUID" # Ensure this is your actual UUID
---
apiVersion: v1
kind: Service
metadata:
  name: client-backend-svc
spec:
  type: ClusterIP
  selector:
    app: client-chat
  ports:
  - port: 80
    targetPort: 8080
---
kind: HTTPRoute
apiVersion: gateway.networking.k8s.io/v1
metadata:
  name: webhook-route # We update the existing route
spec:
  parentRefs:
  - name: internal-https-gateway
  rules:
  # Rule 1: Dialogflow Client API
  - matches:
    - path:
        type: PathPrefix
        value: /api
    backendRefs:
    - name: client-backend-svc
      port: 80
  # Rule 2: Webhook logic (Default)
  - matches:
    - path:
        type: PathPrefix
        value: /
    backendRefs:
    - name: webhook-backend-svc
      port: 8080
```

---

### 3. Apply and Verify
Apply the configuration:
```bash
kubectl apply -f df-cx-client-deployment.yaml
```

**Check if pods are running:**
```bash
kubectl get pods -l app=client-chat
```

**Check Workload Identity (The most common point of failure):**
If the pods crash or show `PERMISSION_DENIED` in the logs, verify the KSA is linked correctly:
```bash
# This should show the 'iam.gke.io/gcp-service-account' annotation
kubectl describe sa client-app-ksa
```

---

### 4. How to Test (Internal Gateway)
Since you are using a **Regional Internal Load Balancer** (`gke-l7-rilb`), you **cannot** access this URL from your public browser. You must test it from a VM or another Pod *within the same VPC*.

**To test from inside the cluster:**
```bash
# Start a temporary testing pod
kubectl run curl-test --image=curlimages/curl -it --rm --restart=Never -- /bin/sh

# Once inside the shell, run the curl command against the Gateway IP
curl -k -X POST https://10.0.0.9/api/message \
-H "Content-Type: application/json" \
-d '{
  "text": "demo"
}'
```

*(The `-k` flag is used because your `webhook-server-tls` is likely using a self-signed or internal certificate.)*

### Summary Checklist:
1. [ ] **Image Pushed** to Artifact Registry.
2. [ ] **Workload Identity enabled** on Cluster/Node Pool.
3. [ ] **IAM Binding** done (`df-cx-client-sa` <-> `client-app-ksa`).
4. [ ] **Deployment applied** with correct `serviceAccountName`.
5. [ ] **HTTPRoute updated** to route `/api` to the client app.

How did the deployment go? Any new logs or errors?