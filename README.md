# Host Scanner

<img width="1899" height="910" alt="dashboard-image" src="https://github.com/user-attachments/assets/bc3b52f1-6432-48f1-8093-1b71e20fad23" />

*Host Scanner* — a lightweight penetration testing SaaS platform built on the Function-as-a-Service (FaaS) cloud philosophy.

The platform is composed of three systems:

1. **Authorization**
2. **Web Client**
3. **Serverless Backend**

In short, the platform is a REST API wrapper on top of a network scanning engine running on a serverless infrastructure. It provides:

- Integration with an **identity management service** for authentication and authorization  
- Integration with an **SMTP server** for email services

## Block Diagram
<img width="953" height="757" alt="block diagram drawio" src="https://github.com/user-attachments/assets/642e44fc-c8b7-4dc8-b55d-e07c4e2cce96" />

## Activity Diagrams

### Admin
<img width="770" height="756" alt="login activity diagram drawio" src="https://github.com/user-attachments/assets/e0fe7100-ca9d-43c1-a9ad-c7730438ebaf" />

The **users management flow** (see Figure 4) is important due to the **elevated permissions** granted to admin users within the platform.

#### Admin Capabilities

If a user is assigned the **admin role**, they have the ability to:

- Access **individual data** of any other user  
- View **aggregated statistics** related to the activity of all users  
- **Restrict access** for specific users  

#### Unauthorized Access Handling

If a user **without** admin privileges attempts to access this flow:

- They are **redirected to their personal dashboard**  
- The flow is marked as having ended in a **failed state**

### Authentication
<img width="845" height="442" alt="admin activity diagram drawio" src="https://github.com/user-attachments/assets/63714249-79cd-451e-b799-4816222acc53" />

The authentication flow is the most critical component in terms of platform security. Its main goal is to **verify user identity** and **prevent unauthorized access** to resources.

The flow operates as follows:

1. **Check for Existing Authentication**  
   - If the user is already authenticated, they are redirected to the authenticated area.
   - If not, the flow continues to the next step.

2. **Check for Existing Account**  
   - If the user has an account:
     - They must enter their credentials.
     - The system then checks whether the **email address is confirmed**:
       - If confirmed: the user is redirected to the authenticated area.
       - If not confirmed: a **confirmation email** is sent.
   - If the user does *not* have an account:
     - They must **create a new account**.
     - After account creation, the identity must be confirmed via email.
     - If successful, the user is redirected to the authenticated area.

3. **Access Restrictions**  
   - If an admin has restricted the user's access, the authentication flow ends in a **failure state**.

### Scan
<img width="1244" height="586" alt="scan activity diagram drawio" src="https://github.com/user-attachments/assets/1a87a5fc-4fab-4215-9363-518d6dedba43" />

The **scan flow** (see Figure 3) represents the **core functionality** of the platform.

To initiate a scan, the user must first be **logged in**. If the user is not authenticated, they must go through the [authentication flow](#authentication-flow) described earlier.

#### Steps to Start a Scan:

1. **Import Targets**  
   The user imports the list of targets they wish to scan into the platform.

2. **Configure Scan Options**  
   The user sets the scanning parameters based on their specific objectives.

#### Scan States

The scanning process is **asynchronous** and transitions through a defined set of states:

- `pending`
- `running`
- `completed` (final)
- `failed` (final)

#### State Transitions

- The scan **starts in the `pending` state**.
- Once it leaves `pending`, it **cannot return** to that state.
- From `running`, it must transition to a **final state**:
  - `completed` (success)
  - `failed` (error or interruption)
- If an error occurs during the `pending` phase, the scan can **transition directly to `failed`**.

> ⚠️ The `failed` state acts as a **fallback** in case of any error during the scanning process.

# Architecture

## Platform level
<img width="751" height="971" alt="platform level architecture drawio" src="https://github.com/user-attachments/assets/870ebeb0-3855-4813-b050-26ece2284544" />

The Web Client Cluster consists of several interconnected components:

- **Keycloak Pod**  
  Handles authentication using [Keycloak](https://www.keycloak.org/), an open-source identity and access management solution. It communicates with the Webserver via a dedicated API for user CRUD operations and callbacks.

- **Keycloak PostgreSQL Pod**  
  Acts as persistent storage for user data managed by Keycloak.

- **Webserver Pod**  
  Composed of three distinct microservices. All configurations and environment variables are mounted from Kubernetes Secrets.

- **Nginx Proxy**  
  Balances traffic between the backend and frontend microservices based on route structure. Allows access from both the browser and API clients.

- **FastAPI Backend**  
  Serves as the core API that implements application logic and acts as middleware between the frontend and backend services. It integrates with:
  - **MariaDB** (for business logic data)
  - **Redis** (for async processing and pub/sub)
  - **Celery** (task queue)
  - **Keycloak** (authentication)
  - **External mail service** (email delivery)

- **React Frontend**  
  A Single Page Application (SPA) that:
  - Implements authentication via Keycloak
  - Interacts with the backend through API calls
  - Sends Bearer tokens (from Keycloak) for secured requests

- **Redis Pod**  
  A key-value store used for:
  - Asynchronous operations (via Celery)
  - Publish/subscribe messaging
  - Scan task coordination

- **MariaDB Pod**  
  Persistent storage for business logic data. Requires a synchronization layer with Keycloak PostgreSQL to maintain user entity consistency.

- **Celery Worker Pod**  
  Executes background tasks pulled from Redis. Delegates scan jobs to the Serverless Cluster and manages their lifecycle.

---

### Serverless Cluster

The Serverless Cluster uses [OpenFaaS](https://www.openfaas.com/) on Kubernetes to support scalable function execution.

- **OpenFaaS Gateway Pod**  
  Acts as the central API to deploy, monitor, and scale functions.

- **NATS Queue Pod**  
  Manages asynchronous task execution for OpenFaaS, similar to Redis in the Web Cluster.

- **OpenFaaS Function Pod**  
  Executes the scanning logic. During execution, it publishes updates to Redis, which are then consumed by Celery workers.

- **OpenFaaS Prometheus Pod**  
  Collects metrics and supports auto-scaling via the Alert Manager.
  
## Infrastructure level
<img width="728" height="889" alt="topologie drawio" src="https://github.com/user-attachments/assets/c9517e50-97b9-4b04-b1d3-5f142f386f04" />

# Application
The frontend is a single page React application (SPA) with Typescript Execute.
The backend is a Python application built using the **FastAPI** framework. The relational database used to store all business logic data is an open-source MySQL variant — **MariaDB**.

For asynchronous processing and publish/subscribe operations, a non-relational **Redis** key-value store is used. Redis acts as a buffer zone in a **producer-consumer** model, where the Web Client system is on one side and the Serverless system on the other.

**Redis** was chosen over alternatives like RabbitMQ and Kafka because of its:

- Very fast read/write operations, which are essential for real-time actions and messaging  
- High interoperability, including **native integration with Celery**

Asynchronous tasks are managed by the **Celery** distributed processing queue. One Celery worker was deployed on each of the three worker nodes in the cluster to evenly distribute scanning tasks.

**Celery** was selected due to its strong compatibility with FastAPI and its ease of development.


<img width="1601" height="835" alt="scan-running" src="https://github.com/user-attachments/assets/5bcdd963-c831-48e0-9d9d-f0eab5fd4ba4" />
<img width="445" height="785" alt="scanmodal" src="https://github.com/user-attachments/assets/821cd3e8-7f83-4b80-9057-5d80891ed67d" />



