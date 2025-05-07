from fastapi import FastAPI

from app.api import (
    scan_router,
)

app = FastAPI(title="Serverless Webserver API", version="0.1.0")

app.include_router(scan_router, prefix="/scan", tags=["scan"])



@app.get("/")
def root():
    return {"message": "casa world"}