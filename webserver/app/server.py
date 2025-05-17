import uvicorn
import logging
from app.config import settings

logging.getLogger("websockets.protocol").setLevel(logging.INFO)
logging.getLogger("websockets.server").setLevel(logging.INFO)

if __name__ == "__main__":  # pragma: no cover
    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.ENV in ["test", "dev"],
        log_level="info" if settings.ENV in ["prod", "test", "dev"] else "debug",
    )