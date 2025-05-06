from fastapi import FastAPI

from app.api import (
    test_router,
)

app = FastAPI(title="Serverless Webserver API", version="0.1.0")

app.include_router(test_router, prefix="/test", tags=["test"])



@app.get("/")
def root():
    return {"message": "Hello world"}