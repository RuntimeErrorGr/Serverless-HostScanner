from celery import Celery
from app.config import settings
import requests
import redis
import json
from app.log import get_logger
celery_app = Celery(
    "tasks",
    broker=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
    backend=f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0",
)

log = get_logger(__name__)

@celery_app.task
def scan(targets, scan_type, scan_uuid):
    payload = {
        "targets": targets,
        "scan_type": scan_type,
        "scan_id": scan_uuid
    }
    try:
        callback_url = "http://webserver-service.default.svc.cluster.local/api/scans/hook"
        headers = {"X-Callback-Url": callback_url}
        response = requests.post(
            settings.OPENFAAS_ASYNC_FUNCTION_URL,
            json=payload,
            headers=headers,
            timeout=60
        )
        response.raise_for_status()
        return response
    except Exception as e:
        # Optionally: update scan status in DB to 'failed'
        r = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0)
        r.publish(f"scan:{scan_uuid}", json.dumps({"error": str(e)}))
        return {"error": str(e)}