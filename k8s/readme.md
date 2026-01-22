Verify the access from CLI:
gcloud container clusters get-credentials private-webhook-cluster --region us-central1 --project prj-gdg-ai-meetup-20250717-1

gcloud container clusters update private-webhook-cluster \
    --region=us-central1 \
    --enable-master-authorized-networks \
    --master-authorized-networks 122.164.246.124/32

gcloud container clusters get-credentials private-webhook-cluster     --location=us-central1



Step 1: Enable Workload Identity on the Cluster

gcloud container clusters update private-webhook-cluster \
    --region=us-central1 \
    --workload-pool=prj-gdg-ai-meetup-20250717-1.svc.id.goog

Note: This process can take several minutes as it updates the cluster control plane.

Step 2: Enable GKE Metadata Server on Node Pools
If you are using GKE Standard (not Autopilot), you must also enable the GKE Metadata Server on your existing node pools so the pods can actually reach the identity pool.

gcloud container node-pools list \
    --cluster=private-webhook-cluster \
    --region=us-central1

NAME          MACHINE_TYPE  DISK_SIZE_GB  NODE_VERSION
default-pool  e2-medium     50            1.33.5-gke.2072000

gcloud container node-pools update default-pool \
    --cluster=private-webhook-cluster \
    --region=us-central1 \
    --workload-metadata=GKE_METADATA

Warning: This will trigger a rolling recreation of your nodes. Your pods will be rescheduled.

Step 3: Run the IAM Binding Again

Now that the pool exists, your original command will work:

# 1. Create a Kubernetes Service Account in your GKE cluster
kubectl create serviceaccount client-app-ksa

# 2. Bind the GSA to the KSA so the pod can "become" the service account
gcloud iam service-accounts add-iam-policy-binding \
    df-cx-client-sa@prj-gdg-ai-meetup-20250717-1.iam.gserviceaccount.com \
    --role="roles/iam.workloadIdentityUser" \
    --member="serviceAccount:prj-gdg-ai-meetup-20250717-1.svc.id.goog[default/client-app-ksa]"

df-cx-client-sa@prj-gdg-ai-meetup-20250717-1.iam.gserviceaccount.com


Updated IAM policy for serviceAccount [df-cx-client-sa@prj-gdg-ai-meetup-20250717-1.iam.gserviceaccount.com].
bindings:
- members:
  - serviceAccount:prj-gdg-ai-meetup-20250717-1.svc.id.goog[default/client-app-ksa]
  role: roles/iam.workloadIdentityUser
etag: BwZI8Gv5QJw=
version: 1

Earlier we receive error, after enable woroad idemt at cluster it got fix. seee above steps

# 3. Annotate the KSA to tell GKE which Google account to use
kubectl annotate serviceaccount client-app-ksa \
    iam.gke.io/gcp-service-account=df-cx-client-sa@prj-gdg-ai-meetup-20250717-1.iam.gserviceaccount.com

serviceaccount/client-app-ksa annotated

Why this is necessary:
By default, GKE pods use the Compute Engine default service account of the node they run on. Workload Identity is the secure "bridge" that allows a specific Kubernetes Service Account (KSA) to act as a specific Google Service Account (GSA).[5][6][7] This ensures your client app can call Dialogflow CX without needing a JSON key file stored inside the cluster.


cd k8s

kubectl describe deploy client-app
kubectl delete deploy client-app

kubectl apply -f deploy.yaml
kubectl apply -f svc.yaml
kubectl apply -f gateway.yaml
kubectl apply -f route.yaml

kubectl apply -f healthcheck.yaml  (optioanl)



kubectl get deploy

kubectl get pods
kubectl get svc
kubectl get gateway internal-https-gateway
kubectl get httproute webhook-route

kubectl describe gateway internal-https-gateway
kubectl describe httproute webhook-route

kubectl delete deploy client-app
kubectl delete gateway internal-https-gateway
kubectl delete httproute webhook-route


curl -k -H "Host: webhook.internal" https://10.0.0.9

4. How to Test Manually (Optional)
If you want to be 100% sure the Load Balancer is working before testing in Dialogflow, run a temporary "curl" pod inside your GKE cluster:
code
Bash
# Start a temporary pod
kubectl run curl-test --image=curlimages/curl -i --tty --rm -- \
    curl -ivk --resolve webhook.internal:443:10.0.0.9 https://webhook.internal/