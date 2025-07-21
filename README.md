# Host Scanner

*Host Scanner* — a lightweight penetration testing SaaS platform built on the Function-as-a-Service (FaaS) cloud philosophy.

The platform is composed of three systems:

1. **Authorization**
2. **Web Client**
3. **Serverless Backend**

Each system has a well-defined role that will be detailed in the [Proposed Solution](#proposed-solution) section.

In short, the platform is a REST API wrapper on top of a network scanning engine running on a serverless infrastructure. It provides:

- Integration with an **identity management service** for authentication and authorization  
- Integration with an **SMTP server** for email services
<img width="953" height="757" alt="block diagram drawio" src="https://github.com/user-attachments/assets/642e44fc-c8b7-4dc8-b55d-e07c4e2cce96" />
