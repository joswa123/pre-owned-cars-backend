# AutoDeal4U Backend

This is the backend API for the AutoDeal4U pre-owned cars platform. It is built with Node.js, Express, Sequelize, and MySQL.

## Scalable Architecture

This project is configured to run in a horizontally scalable architecture using Docker, Redis, and Nginx.

- **Nginx**: Acts as a Load Balancer, distributing traffic to the Node.js instances.
- **Node.js**: The API runs in 3 replicas (containers) to handle concurrent traffic.
- **Redis**: Provides a shared, distributed cache for all Node.js instances.
- **MySQL**: Persistent relational database.

## Running Locally with Docker

1. Ensure Docker Desktop is installed and running.
2. Copy `.env.example` to `.env` and fill in your variables.
3. Build and start the services:

```bash
docker-compose up --build
```

4. The API will be available at `http://localhost/api/v1/...` (port 80).

### Useful Docker Commands

- **Stop services**: `docker-compose stop`
- **Tear down completely (wipes DB)**: `docker-compose down -v`
- **Scale instances**: `docker-compose up --scale node-app=5 -d`
- **View logs**: `docker-compose logs -f node-app`

## Testing Caching and Load Balancing

- **Create a car**:
  ```bash
  curl -X POST http://localhost/api/v1/cars -H "Content-Type: application/json" -d '{"brandId": 1, "modelId": 1, "price": 45000}'
  ```

- **Get cars (Cache test)**:
  ```bash
  curl http://localhost/api/v1/cars
  ```
  *The first request queries MySQL (Cache MISS). The second request hits Redis (Cache HIT).*

- **Check logs for Load Balancing**:
  Check the `node-app` logs in the terminal. You should see different Process IDs (PIDs) serving consecutive requests.
